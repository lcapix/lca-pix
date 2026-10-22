'use client'

// One node on the Tree canvas: a pastel card with its tier, name and the
// subtree roll-up line ("Σ $… · n flows"). Carries data-node-id: the canvas
// drags and selects by it. Dimmed when the canvas search does not match it;
// outlined in amber when it does.

import { pastelFor } from '@/lib/hierarchy-pastels'
import { NODE_H, NODE_W, rollupLine, type LaidOut, type NodePos } from '@/lib/case-editor/tree-layout'

export function TreeNodeCard({
  n,
  pos,
  active,
  isMatch,
  dimmed,
  dragging,
  rolled,
  onSelect,
}: {
  n: LaidOut
  pos: NodePos
  active: boolean
  isMatch: boolean
  dimmed: boolean
  /** Being dragged: no transition. */
  dragging: boolean
  /** Subtree totals (this node + everything below). */
  rolled: { cost: number; flows: number } | undefined
  onSelect: (id: string) => void
}) {
  const tone = pastelFor(n.node.type)
  return (
    <div
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
          dragging
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
        title={
          (n.node.children?.length ?? 0) > 0
            ? 'Rolled-up total of everything below this node'
            : undefined
        }
      >
        {rollupLine(
          rolled ?? { cost: n.node.cost, flows: n.node.flows },
          (n.node.children?.length ?? 0) > 0,
        )}
      </div>
    </div>
  )
}
