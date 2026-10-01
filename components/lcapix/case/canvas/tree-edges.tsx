'use client'

// The Tree canvas's edges: one curve per parent → child, in the child's tier
// colour, under the cards and never catching the pointer.

import { HIERARCHY_TYPES, type HierarchyNodeType } from '@/lib/lcapix-demo'
import { edgePath, type LaidOut, type NodePos } from '@/lib/case-editor/tree-layout'

export function TreeEdges({
  nodes,
  positions,
  bounds,
}: {
  nodes: LaidOut[]
  positions: Record<string, NodePos>
  bounds: { w: number; h: number }
}) {
  const colorFor = (t: HierarchyNodeType) =>
    HIERARCHY_TYPES.find((h) => h.id === t)?.color || 'var(--text-tertiary)'
  return (
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
        const col = colorFor(n.node.type)
        return (
          <path
            key={n.id}
            d={edgePath(a, b)}
            stroke={col}
            strokeWidth={1.5}
            fill="none"
            opacity={0.55}
          />
        )
      })}
    </svg>
  )
}
