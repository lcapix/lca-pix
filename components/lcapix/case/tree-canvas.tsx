'use client'

// TreeCanvas — depth-first orthogonal tree layout.
// Mirrors LCAPIX/pages-app.jsx lines 574-644 (TreeCanvas) with a `view`
// prop that delegates to ListView / GraphView.

import { HIERARCHY_TYPES, type HierarchyNodeType } from '@/lib/lcapix-demo'
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
}

interface LayoutItem {
  node: CaseTreeNode
  depth: number
  y: number
  children: number[]
}

export function TreeCanvas({ root, flat, selected, onSelect, view = 'Tree' }: TreeCanvasProps) {
  if (view === 'List') return <ListView flat={flat} selected={selected} onSelect={onSelect} />
  if (view === 'Graph') return <GraphView flat={flat} selected={selected} onSelect={onSelect} />

  const items: LayoutItem[] = []
  const yOffset = { v: 0 }
  const layout = (node: CaseTreeNode, depth = 0): number => {
    const hasChildren = node.children && node.children.length > 0
    if (hasChildren) {
      const childYs = node.children!.map((ch) => layout(ch, depth + 1))
      const midY = (childYs[0] + childYs[childYs.length - 1]) / 2
      items.push({ node, depth, y: midY, children: childYs })
      return midY
    }
    const myY = yOffset.v
    items.push({ node, depth, y: myY, children: [] })
    yOffset.v += 1
    return myY
  }
  layout(root)

  const colWidth = 220
  const rowHeight = 80
  const nodeW = 200
  const nodeH = 60
  const totalW = 5 * colWidth + 60
  const totalH = (items.length > 0 ? Math.max(...items.map((i) => i.y)) : 0) * rowHeight + 120

  const colorFor = (t: HierarchyNodeType) =>
    HIERARCHY_TYPES.find((h) => h.id === t)?.color || 'var(--text-tertiary)'

  return (
    <div style={{ position: 'relative', minWidth: totalW, minHeight: totalH, padding: 30 }}>
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {items.map((item) =>
          (item.node.children || []).map((ch, ci) => {
            const childItem = items.find((x) => x.node.id === ch.id)
            if (!childItem) return null
            const ax = 30 + item.depth * colWidth + nodeW
            const ay = 30 + item.y * rowHeight + nodeH / 2
            const bx = 30 + childItem.depth * colWidth
            const by = 30 + childItem.y * rowHeight + nodeH / 2
            const midX = (ax + bx) / 2
            return (
              <path
                key={item.node.id + '-' + ci}
                d={`M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${bx} ${by}`}
                stroke="var(--border-strong)"
                strokeWidth="1"
                fill="none"
              />
            )
          }),
        )}
      </svg>
      {items.map((item) => {
        const x = 30 + item.depth * colWidth
        const y = 30 + item.y * rowHeight
        const active = selected === item.node.id
        const col = colorFor(item.node.type)
        const t = HIERARCHY_TYPES.find((h) => h.id === item.node.type)
        return (
          <div
            key={item.node.id}
            onClick={() => onSelect(item.node.id)}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: nodeW,
              height: nodeH,
              background: active ? 'var(--surface-overlay)' : 'var(--surface-raised)',
              border: '1px solid ' + (active ? 'var(--brand-primary)' : 'var(--border-subtle)'),
              borderLeft: '3px solid ' + col,
              borderRadius: 6,
              padding: '8px 12px',
              cursor: 'pointer',
              boxShadow: active ? '0 0 0 3px var(--brand-glow)' : 'none',
              transition: 'all 140ms',
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              {t?.label}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: 4,
              }}
            >
              {item.node.label}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {item.node.flows} flows · ${item.node.cost}
            </div>
          </div>
        )
      })}
    </div>
  )
}
