'use client'

// GraphView — layered left-to-right tree with pan + zoom.
// Mirrors LCAPIX/pages-app.jsx lines 672-817.

import { useEffect, useRef, useState } from 'react'
import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface GraphViewProps {
  flat: FlatCaseNode[]
  selected: string | null
  onSelect: (id: string) => void
}

export function GraphView({ flat, selected, onSelect }: GraphViewProps) {
  // Build parent map from depth ordering
  const parentOf: Record<string, string> = {}
  const stack: FlatCaseNode[] = []
  flat.forEach((n) => {
    while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop()
    if (stack.length) parentOf[n.id] = stack[stack.length - 1].id
    stack.push(n)
  })

  const COL_W = 240
  const ROW_H = 56
  const NODE_W = 190
  const NODE_H = 54

  const yById: Record<string, number> = {}
  let rowCursor = 0
  const walk = (id: string): number => {
    const kids = flat.filter((n) => parentOf[n.id] === id)
    if (kids.length === 0) {
      yById[id] = rowCursor * ROW_H
      rowCursor++
      return yById[id]
    }
    const childYs = kids.map((k) => walk(k.id))
    yById[id] = (Math.min(...childYs) + Math.max(...childYs)) / 2
    return yById[id]
  }
  const rootId = flat[0]?.id
  if (rootId) walk(rootId)

  const positioned = flat.map((n) => ({
    ...n,
    x: 40 + n.depth * COL_W,
    y: 40 + (yById[n.id] || 0),
  }))
  const posById = Object.fromEntries(positioned.map((p) => [p.id, p]))

  const maxX = positioned.length
    ? Math.max(...positioned.map((p) => p.x)) + NODE_W + 80
    : 400
  const maxY = positioned.length
    ? Math.max(...positioned.map((p) => p.y)) + NODE_H + 80
    : 400

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.7 })
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  // Fit exactly once per mount. Refitting whenever the layout extents change
  // yanked the viewport back to center on every select/add/edit — losing the
  // user's place on big trees (tool-review polish #4). The Fit button still
  // recenters on demand.
  const didFitRef = useRef(false)

  useEffect(() => {
    const fit = () => {
      if (!hostRef.current) return
      const rect = hostRef.current.getBoundingClientRect()
      if (rect.width < 50) return
      const k = Math.min(0.9, (rect.width - 40) / maxX, (rect.height - 40) / maxY)
      const kFinal = Math.max(0.35, k)
      setTransform({
        x: (rect.width - maxX * kFinal) / 2,
        y: (rect.height - maxY * kFinal) / 2,
        k: kFinal,
      })
    }
    if (didFitRef.current) return
    const fitOnce = () => {
      if (didFitRef.current) return
      fit()
      if (hostRef.current && hostRef.current.getBoundingClientRect().width >= 50) {
        didFitRef.current = true
      }
    }
    fitOnce()
    const id = setTimeout(fitOnce, 100)
    return () => clearTimeout(id)
  }, [flat.length, maxX, maxY])

  // Wheel zoom — attached natively so we can preventDefault (React's
  // onWheel is passive and cannot). Mirrors tree-canvas behaviour: plain
  // wheel is swallowed, zoom only on ⌘/Ctrl (trackpad pinch reports as
  // wheel + ctrlKey on Chromium) and zoom centres on the cursor.
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (!e.ctrlKey && !e.metaKey) return
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setTransform((t) => {
        const delta = -e.deltaY * 0.0015
        const newK = Math.max(0.3, Math.min(2, t.k * (1 + delta)))
        const scale = newK / t.k
        const nx = cx - (cx - t.x) * scale
        const ny = cy - (cy - t.y) * scale
        return { x: nx, y: ny, k: newK }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    dragRef.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const { x, y, tx, ty } = dragRef.current
    setTransform((t) => ({ ...t, x: tx + (e.clientX - x), y: ty + (e.clientY - y) }))
  }
  const onMouseUp = () => {
    dragRef.current = null
  }

  return (
    <div
      ref={hostRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: dragRef.current ? 'grabbing' : 'grab',
        zIndex: 1,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
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
          onClick={() =>
            setTransform((t) => ({ ...t, k: Math.max(0.3, t.k - 0.15) }))
          }
          style={{
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 4,
            color: 'var(--text-secondary)',
          }}
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
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(2, t.k + 0.15) }))}
          style={{
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 4,
            color: 'var(--text-secondary)',
          }}
        >
          +
        </button>
        <div style={{ width: 1, background: 'var(--border-subtle)', margin: '4px 2px' }} />
        <button
          onClick={() => {
            if (!hostRef.current) return
            const r = hostRef.current.getBoundingClientRect()
            const k = Math.min(0.9, r.width / maxX, r.height / maxY)
            setTransform({ x: (r.width - maxX * k) / 2, y: (r.height - maxY * k) / 2, k })
          }}
          style={{
            padding: '0 10px',
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          Fit
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          transition: dragRef.current ? 'none' : 'transform 120ms ease-out',
        }}
      >
        <svg
          width={maxX}
          height={maxY}
          style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
        >
          <defs>
            <marker
              id="gv-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
            </marker>
          </defs>
          {Object.entries(parentOf).map(([child, parent], i) => {
            const pa = posById[parent]
            const pb = posById[child]
            if (!pa || !pb) return null
            const x1 = pa.x + NODE_W
            const y1 = pa.y + NODE_H / 2
            const x2 = pb.x
            const y2 = pb.y + NODE_H / 2
            const mx = (x1 + x2) / 2
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                stroke="var(--border-strong)"
                strokeWidth="1.25"
                fill="none"
                opacity="0.7"
              />
            )
          })}
        </svg>
        {positioned.map((p) => {
          const t = HIERARCHY_TYPES.find((h) => h.id === p.type)
          const active = selected === p.id
          return (
            <div
              key={p.id}
              data-node
              onClick={() => onSelect(p.id)}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                width: NODE_W,
                height: NODE_H,
                background: 'var(--surface-raised)',
                border: active ? `1.5px solid ${t?.color}` : '1px solid var(--border-subtle)',
                borderRadius: 8,
                boxShadow: active
                  ? `0 0 0 4px oklch(from ${t?.color} l c h / 0.18), var(--shadow-md)`
                  : 'var(--shadow-sm)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '8px 12px 8px 16px',
                transition: 'box-shadow 160ms, border-color 160ms, transform 160ms',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: t?.color,
                  borderTopLeftRadius: 8,
                  borderBottomLeftRadius: 8,
                }}
              />
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: t?.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: 3,
                }}
              >
                {t?.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.label}
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}
              >
                {p.flows || 0} flows · ${p.cost || 0}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
