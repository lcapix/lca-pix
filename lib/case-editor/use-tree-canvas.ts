'use client'

// The Tree canvas's interaction (guardrails §5, unchanged): nodes carry
// data-node-id; mousedown on a node starts a drag and under 3 px of movement
// is a click-select; mousedown on empty space pans. Wheel uses a native
// non-passive listener: a plain wheel is swallowed, zoom only with Ctrl/⌘
// (incl. trackpad pinch). Zoom clamps 0.25–3. The canvas fits once it can be
// measured; Fit and Reset re-fit.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { CaseTreeNode } from '@/lib/case-tree-adapter-types'
import { rollupTree } from '@/lib/case-tree-adapter'
import {
  fitTransform,
  layoutTree,
  resyncPositions,
  zoomAt,
  zoomIn,
  zoomOut,
  type NodePos,
} from './tree-layout'

export function useTreeCanvas({ root, onSelect }: { root: CaseTreeNode; onSelect: (id: string) => void }) {
  // 1. Initial positions via a tidy-ish top-to-bottom tree layout.
  const { initialPositions, nodes, bounds } = useMemo(() => layoutTree(root), [root])

  // Roll costs and flow-counts UP the tree so every node shows its subtree
  // total, not just its own value — otherwise a product / line / subprocess
  // reads $0 because the values live on the operations below it.
  const rollup = useMemo(() => rollupTree(root), [root])

  // 2. Live positions map (so user can drag nodes)
  const [positions, setPositions] = useState<Record<string, NodePos>>(initialPositions)

  // Re-sync when tree shape changes
  useEffect(() => {
    setPositions((prev) => resyncPositions(prev, nodes, initialPositions))
  }, [initialPositions, nodes])

  // 3. Viewport transform (pan + zoom)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [transform, setTransform] = useState({ x: 40, y: 40, k: 1 })
  const [didFit, setDidFit] = useState(false)

  const fitToView = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const next = fitTransform(el.getBoundingClientRect(), bounds)
    if (next) setTransform(next)
  }, [bounds.w, bounds.h])

  // Auto-fit once on mount / after size known
  useLayoutEffect(() => {
    if (didFit) return
    const id = requestAnimationFrame(() => {
      const el = viewportRef.current
      if (el && el.getBoundingClientRect().width > 50) {
        fitToView()
        setDidFit(true)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [didFit, fitToView])

  // 4. Interaction: pan, zoom, drag-node
  const panRef = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null)
  const dragRef = useRef<{
    id: string
    sx: number
    sy: number
    ox: number
    oy: number
  } | null>(null)
  const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab')

  // Wheel zoom — needs non-passive to preventDefault
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      // Case editor is fullscreen — there is no page scroll to bubble
      // to, so EVERY wheel event inside the canvas is swallowed. Zoom
      // only on deliberate intent (⌘/Ctrl + wheel, or trackpad pinch
      // which Chromium reports as wheel + ctrlKey). Plain scrolls are
      // consumed silently so the canvas neither zooms nor shifts the
      // page.
      e.preventDefault()
      if (!e.ctrlKey && !e.metaKey) return
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setTransform((t) => zoomAt(t, cx, cy, e.deltaY))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onMouseDown = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement
    const nodeEl = target.closest('[data-node-id]') as HTMLElement | null
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId!
      const pos = positions[id]
      if (pos) {
        dragRef.current = {
          id,
          sx: e.clientX,
          sy: e.clientY,
          ox: pos.x,
          oy: pos.y,
        }
        setCursor('grabbing')
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
    // Pan on empty
    panRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      tx: transform.x,
      ty: transform.y,
    }
    setCursor('grabbing')
  }

  const onMouseMove = (e: ReactMouseEvent) => {
    if (dragRef.current) {
      const d = dragRef.current
      const dx = (e.clientX - d.sx) / transform.k
      const dy = (e.clientY - d.sy) / transform.k
      setPositions((p) => ({
        ...p,
        [d.id]: { x: d.ox + dx, y: d.oy + dy },
      }))
      return
    }
    if (panRef.current) {
      const p = panRef.current
      setTransform((t) => ({ ...t, x: p.tx + (e.clientX - p.sx), y: p.ty + (e.clientY - p.sy) }))
    }
  }

  const endInteraction = (e?: ReactMouseEvent) => {
    const wasDrag = !!dragRef.current
    const moved = dragRef.current
      ? Math.abs((e?.clientX ?? 0) - dragRef.current.sx) +
          Math.abs((e?.clientY ?? 0) - dragRef.current.sy) >
        3
      : false
    const dragId = dragRef.current?.id
    dragRef.current = null
    panRef.current = null
    setCursor('grab')
    // Tiny-drag = click: select
    if (wasDrag && !moved && dragId) {
      onSelect(dragId)
    }
  }

  const onMouseLeave = () => {
    dragRef.current = null
    panRef.current = null
    setCursor('grab')
  }

  /** The node being dragged right now (it moves without a transition). */
  const isDragging = (id: string) => dragRef.current?.id === id

  const handleZoomOut = () => setTransform((t) => zoomOut(t))
  const handleZoomIn = () => setTransform((t) => zoomIn(t))

  /** Put every node back where the layout put it, and fit again. */
  const resetLayout = () => {
    setPositions(initialPositions)
    setDidFit(false)
    requestAnimationFrame(fitToView)
  }

  return {
    viewportRef,
    nodes,
    bounds,
    rollup,
    positions,
    transform,
    cursor,
    onMouseDown,
    onMouseMove,
    endInteraction,
    onMouseLeave,
    isDragging,
    zoomOut: handleZoomOut,
    zoomIn: handleZoomIn,
    fitToView,
    resetLayout,
  }
}
