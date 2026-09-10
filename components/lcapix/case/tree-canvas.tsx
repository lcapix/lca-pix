'use client'

// TreeCanvas — flexible playground canvas with pan/zoom/drag.
// Default "Tree" view is a full interactive canvas: scroll to zoom,
// drag empty space to pan, drag nodes to reposition, click to select.
// List and Graph views are still delegated out.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { HIERARCHY_TYPES, type HierarchyNodeType } from '@/lib/lcapix-demo'
import { pastelFor } from '@/lib/hierarchy-pastels'
import { ListView } from './list-view'
import { GraphView } from './graph-view'
import type { CaseTreeNode, FlatCaseNode } from '@/lib/case-tree-adapter-types'

export type CanvasView = 'Tree' | 'List' | 'Graph'

export interface TreeCanvasProps {
  root: CaseTreeNode
  flat: FlatCaseNode[]
  selected: string | null
  onSelect: (id: string) => void
  view?: CanvasView
  highlightQuery?: string
}

interface NodePos {
  x: number
  y: number
}

const NODE_W = 220
const NODE_H = 72
const COL_W = NODE_W + 40   // horizontal gap between sibling columns
const ROW_GAP = 80          // vertical gap between depth rows

export function TreeCanvas({ root, flat, selected, onSelect, view = 'Tree', highlightQuery }: TreeCanvasProps) {
  if (view === 'List') return <ListView flat={flat} selected={selected} onSelect={onSelect} />
  if (view === 'Graph') return <GraphView flat={flat} selected={selected} onSelect={onSelect} />

  return (
    <PlaygroundCanvas root={root} selected={selected} onSelect={onSelect} highlightQuery={highlightQuery} />
  )
}

interface PlaygroundProps {
  root: CaseTreeNode
  selected: string | null
  onSelect: (id: string) => void
  highlightQuery?: string
}

interface LaidOut {
  id: string
  node: CaseTreeNode
  depth: number
  parentId: string | null
}

function PlaygroundCanvas({ root, selected, onSelect, highlightQuery }: PlaygroundProps) {
  const normalizedQuery = (highlightQuery ?? '').trim().toLowerCase()
  // 1. Compute initial positions via tidy-ish top-to-bottom tree layout
  const { initialPositions, nodes, parentOf, bounds } = useMemo(() => {
    const nodes: LaidOut[] = []
    const parentOf: Record<string, string | null> = {}
    let colCursor = 0
    const xById: Record<string, number> = {}

    const walk = (n: CaseTreeNode, depth: number, parentId: string | null): number => {
      nodes.push({ id: n.id, node: n, depth, parentId })
      parentOf[n.id] = parentId
      const kids = n.children || []
      if (kids.length === 0) {
        const x = colCursor * COL_W
        xById[n.id] = x
        colCursor += 1
        return x
      }
      const childXs = kids.map((c) => walk(c, depth + 1, n.id))
      const x = (childXs[0] + childXs[childXs.length - 1]) / 2
      xById[n.id] = x
      return x
    }
    // Skip the synthetic multi-root container: render its children as an
    // independent forest of top-level nodes (no fake "Case Root" parent).
    if (root.id === '__root__') {
      ;(root.children || []).forEach((c) => walk(c, 0, null))
    } else {
      walk(root, 0, null)
    }

    const positions: Record<string, NodePos> = {}
    let maxX = 0
    let maxY = 0
    for (const n of nodes) {
      const x = xById[n.id] || 0
      const y = n.depth * (NODE_H + ROW_GAP)
      positions[n.id] = { x, y }
      if (x + NODE_W > maxX) maxX = x + NODE_W
      if (y + NODE_H > maxY) maxY = y + NODE_H
    }
    return {
      initialPositions: positions,
      nodes,
      parentOf,
      bounds: { w: maxX, h: maxY },
    }
  }, [root])

  // 2. Live positions map (so user can drag nodes)
  const [positions, setPositions] = useState<Record<string, NodePos>>(initialPositions)

  // Re-sync when tree shape changes
  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, NodePos> = {}
      for (const n of nodes) {
        next[n.id] = prev[n.id] ?? initialPositions[n.id]
      }
      return next
    })
  }, [initialPositions, nodes])

  // 3. Viewport transform (pan + zoom)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [transform, setTransform] = useState({ x: 40, y: 40, k: 1 })
  const [didFit, setDidFit] = useState(false)

  const fitToView = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width < 50 || rect.height < 50) return
    const padding = 60
    const w = Math.max(bounds.w, 1)
    const h = Math.max(bounds.h, 1)
    const k = Math.min(
      (rect.width - padding * 2) / w,
      (rect.height - padding * 2) / h,
      1.2,
    )
    const kFinal = Math.max(0.35, Math.min(2, k))
    setTransform({
      x: (rect.width - w * kFinal) / 2,
      y: (rect.height - h * kFinal) / 2,
      k: kFinal,
    })
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
      setTransform((t) => {
        const delta = -e.deltaY * 0.0015
        const newK = Math.max(0.25, Math.min(3, t.k * (1 + delta)))
        const scale = newK / t.k
        // Zoom around cursor: keep point under cursor fixed
        const nx = cx - (cx - t.x) * scale
        const ny = cy - (cy - t.y) * scale
        return { x: nx, y: ny, k: newK }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
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

  const onMouseMove = (e: React.MouseEvent) => {
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

  const endInteraction = (e?: React.MouseEvent) => {
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

  const colorFor = (t: HierarchyNodeType) =>
    HIERARCHY_TYPES.find((h) => h.id === t)?.color || 'var(--text-tertiary)'
  const labelFor = (t: HierarchyNodeType) =>
    HIERARCHY_TYPES.find((h) => h.id === t)?.label || t

  return (
    <div
      ref={viewportRef}
      data-testid="tree-canvas-viewport"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endInteraction}
      onMouseLeave={() => {
        dragRef.current = null
        panRef.current = null
        setCursor('grab')
      }}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor,
        userSelect: 'none',
        backgroundImage:
          'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Stage */}
      <div
        data-testid="tree-canvas-stage"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {/* Edges */}
        <svg
          width={Math.max(bounds.w + 400, 2000)}
          height={Math.max(bounds.h + 400, 2000)}
          style={{
            position: 'absolute',
            left: -200,
            top: -200,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {nodes.map((n) => {
            if (!n.parentId) return null
            const a = positions[n.parentId]
            const b = positions[n.id]
            if (!a || !b) return null
            const ax = a.x + NODE_W / 2 + 200
            const ay = a.y + NODE_H + 200
            const bx = b.x + NODE_W / 2 + 200
            const by = b.y + 200
            const my = (ay + by) / 2
            const col = colorFor(n.node.type)
            return (
              <path
                key={n.id}
                d={`M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`}
                stroke={col}
                strokeWidth={1.5}
                fill="none"
                opacity={0.55}
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => {
          const pos = positions[n.id]
          if (!pos) return null
          const active = selected === n.id
          const tone = pastelFor(n.node.type)
          const isMatch =
            normalizedQuery.length > 0 &&
            (n.node.label?.toLowerCase().includes(normalizedQuery) ||
              n.id.toLowerCase().includes(normalizedQuery))
          const dimmed = normalizedQuery.length > 0 && !isMatch
          return (
            <div
              key={n.id}
              data-node-id={n.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(n.id)
              }}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
                background: tone.bg,
                border: isMatch
                  ? `2px solid #f59e0b`
                  : `1.5px solid ${tone.border}`,
                borderRadius: 10,
                padding: '10px 14px',
                cursor: 'grab',
                opacity: dimmed ? 0.35 : 1,
                boxShadow: isMatch
                  ? `0 0 0 4px rgba(245, 158, 11, 0.25), 0 4px 12px rgba(15,23,42,0.10)`
                  : active
                  ? `0 0 0 3px ${tone.border}66, 0 4px 12px rgba(15,23,42,0.12)`
                  : '0 1px 4px rgba(15,23,42,0.14)',
                transition:
                  dragRef.current?.id === n.id
                    ? 'none'
                    : 'box-shadow 140ms, border-color 140ms',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                color: tone.text,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: tone.text,
                  opacity: 0.72,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 600,
                  marginBottom: 3,
                }}
              >
                {tone.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: tone.text,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: 3,
                }}
              >
                {n.node.label}
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: tone.text, opacity: 0.72 }}
              >
                {n.node.flows} flows · ${n.node.cost}
              </div>
            </div>
          )
        })}
      </div>

      {/* Zoom controls overlay */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 5,
          display: 'flex',
          gap: 4,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 4,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTransform((t) => ({ ...t, k: Math.max(0.25, t.k - 0.15) }))
          }
          style={zoomBtn}
          aria-label="Zoom out"
        >
          −
        </button>
        <div
          className="mono"
          style={{
            width: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {Math.round(transform.k * 100)}%
        </div>
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(3, t.k + 0.15) }))}
          style={zoomBtn}
          aria-label="Zoom in"
        >
          +
        </button>
        <div style={{ width: 1, background: 'var(--border-subtle)', margin: '4px 2px' }} />
        <button
          type="button"
          onClick={fitToView}
          style={{ ...zoomBtn, width: 'auto', padding: '0 10px', fontSize: 11 }}
          aria-label="Fit to view"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={() => {
            setPositions(initialPositions)
            setDidFit(false)
            requestAnimationFrame(fitToView)
          }}
          style={{ ...zoomBtn, width: 'auto', padding: '0 10px', fontSize: 11 }}
          aria-label="Reset layout"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

const zoomBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 14,
}
