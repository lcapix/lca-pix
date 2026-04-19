'use client'

// MiniCanvas — pan/zoom mini hierarchy tree, mirrored from
// LCAPIX/pages-app.jsx lines 305-404 (ProjectPage's MiniCanvas).
//
// Renders the given tree on a positioned absolute canvas with
// drag-to-pan, wheel-to-zoom, and an auto-fit effect on mount.
// Styling is driven by CSS vars from app/lcapix.css.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HIERARCHY_TYPES, type DemoTreeNode } from '@/lib/lcapix-demo'

export interface MiniCanvasProps {
  tree: DemoTreeNode
}

interface FlatNode {
  id: string
  type: DemoTreeNode['type']
  label: string
  depth: number
  parent: string | null
}

interface PositionedNode extends FlatNode {
  x: number
  y: number
}

export function MiniCanvas({ tree }: MiniCanvasProps) {
  // Flatten with depth + parent pointer
  const flat: FlatNode[] = []
  const walk = (node: DemoTreeNode, depth = 0, parent: string | null = null) => {
    flat.push({ id: node.id, type: node.type, label: node.label, depth, parent })
    ;(node.children || []).forEach((c) => walk(c, depth + 1, node.id))
  }
  walk(tree)

  const parentOf: Record<string, string | null> = Object.fromEntries(
    flat.map((n) => [n.id, n.parent]),
  )

  const COL_W = 200
  const ROW_H = 44
  const NODE_W = 168
  const NODE_H = 40

  const yById: Record<string, number> = {}
  let cursor = 0
  const layout = (id: string): number => {
    const kids = flat.filter((n) => parentOf[n.id] === id)
    if (kids.length === 0) {
      yById[id] = cursor * ROW_H
      cursor++
      return yById[id]
    }
    const ys = kids.map((k) => layout(k.id))
    yById[id] = (Math.min(...ys) + Math.max(...ys)) / 2
    return yById[id]
  }
  layout(tree.id)

  const positioned: PositionedNode[] = flat.map((n) => ({
    ...n,
    x: 20 + n.depth * COL_W,
    y: 16 + (yById[n.id] || 0),
  }))
  const posById: Record<string, PositionedNode> = Object.fromEntries(
    positioned.map((p) => [p.id, p]),
  )
  const maxX = Math.max(...positioned.map((p) => p.x)) + NODE_W + 40
  const maxY = Math.max(...positioned.map((p) => p.y)) + NODE_H + 32

  const [xf, setXf] = useState({ x: 0, y: 0, k: 0.8 })
  const [hovered, setHovered] = useState<string | null>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fit = () => {
      if (!hostRef.current) return
      const r = hostRef.current.getBoundingClientRect()
      if (r.width < 50) return
      const k = Math.min(1, (r.width - 32) / maxX, (r.height - 32) / maxY)
      const kF = Math.max(0.35, k)
      setXf({
        x: (r.width - maxX * kF) / 2,
        y: (r.height - maxY * kF) / 2,
        k: kF,
      })
    }
    fit()
    const id = setTimeout(fit, 120)
    return () => clearTimeout(id)
  }, [maxX, maxY])

  const onWheel = (e: React.WheelEvent) => {
    // Only zoom when the user is deliberately zooming (⌘/Ctrl + scroll).
    // Plain scroll bubbles up so the page can scroll normally while the
    // cursor is over the canvas.
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const d = -e.deltaY * 0.0015
    setXf((t) => ({ ...t, k: Math.max(0.3, Math.min(2, t.k + d)) }))
  }
  const onMD = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-n]')) return
    dragRef.current = { x: e.clientX, y: e.clientY, tx: xf.x, ty: xf.y }
  }
  const onMM = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const { x, y, tx, ty } = dragRef.current
    setXf((t) => ({ ...t, x: tx + (e.clientX - x), y: ty + (e.clientY - y) }))
  }
  const onMU = () => {
    dragRef.current = null
  }

  const hostStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    cursor: dragRef.current ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={hostRef}
      style={hostStyle}
      onWheel={onWheel}
      onMouseDown={onMD}
      onMouseMove={onMM}
      onMouseUp={onMU}
      onMouseLeave={onMU}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 5,
          display: 'flex',
          gap: 2,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 3,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <button
          type="button"
          onClick={() => setXf((t) => ({ ...t, k: Math.max(0.3, t.k - 0.15) }))}
          style={{
            width: 24,
            height: 24,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
        >
          −
        </button>
        <div
          className="mono"
          style={{
            width: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: 'var(--text-secondary)',
          }}
        >
          {Math.round(xf.k * 100)}%
        </div>
        <button
          type="button"
          onClick={() => setXf((t) => ({ ...t, k: Math.min(2, t.k + 0.15) }))}
          style={{
            width: 24,
            height: 24,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
        >
          +
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${xf.x}px, ${xf.y}px) scale(${xf.k})`,
          transformOrigin: '0 0',
          transition: dragRef.current ? 'none' : 'transform 120ms ease-out',
        }}
      >
        <svg
          width={maxX}
          height={maxY}
          style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
        >
          {Object.entries(parentOf).map(([child, parent], i) => {
            if (!parent) return null
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
                strokeWidth="1"
                fill="none"
                opacity="0.6"
              />
            )
          })}
        </svg>
        {positioned.map((p) => {
          const t = HIERARCHY_TYPES.find((h) => h.id === p.type)
          const isHov = hovered === p.id
          return (
            <div
              key={p.id}
              data-n
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                width: NODE_W,
                height: NODE_H,
                background: 'var(--surface-raised)',
                border: isHov
                  ? `1.5px solid ${t?.color}`
                  : '1px solid var(--border-subtle)',
                borderRadius: 6,
                boxShadow: isHov
                  ? `0 0 0 3px oklch(from ${t?.color} l c h / 0.18), var(--shadow-md)`
                  : 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '6px 10px 6px 14px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 140ms, border-color 140ms',
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
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                }}
              />
              <div
                className="mono"
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  color: t?.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  lineHeight: 1.2,
                }}
              >
                {t?.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.3,
                }}
              >
                {p.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
