'use client'

// The inspector's title block: the node's tier chip, name and id.

import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export function InspectorHeader({ node }: { node: FlatCaseNode }) {
  const t = HIERARCHY_TYPES.find((h) => h.id === node.type)
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: t?.color,
            background: 'oklch(from ' + t?.color + ' l c h / 0.15)',
            padding: '2px 6px',
            borderRadius: 3,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {t?.label}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
        {node.label}
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}
      >
        ID: {node.id}
      </div>
    </div>
  )
}
