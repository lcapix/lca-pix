'use client'

// ListView — table view of flat nodes.
// Mirrors LCAPIX/pages-app.jsx lines 646-670.

import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface ListViewProps {
  flat: FlatCaseNode[]
  selected: string | null
  onSelect: (id: string) => void
}

export function ListView({ flat, selected, onSelect }: ListViewProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        padding: 24,
        zIndex: 1,
      }}
    >
      <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 900 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 2fr 120px 80px 100px 80px',
            padding: '10px 14px',
            background: 'var(--surface-overlay)',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
        >
          <div></div>
          <div>Component</div>
          <div>Type</div>
          <div style={{ textAlign: 'right' }}>Flows</div>
          <div style={{ textAlign: 'right' }}>Cost</div>
          <div style={{ textAlign: 'right' }}>Depth</div>
        </div>
        {flat.map((n) => {
          const t = HIERARCHY_TYPES.find((h) => h.id === n.type)
          const active = selected === n.id
          return (
            <div
              key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 2fr 120px 80px 100px 80px',
                padding: '10px 14px',
                borderTop: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                fontSize: 13,
                alignItems: 'center',
                background: active ? 'var(--surface-overlay)' : 'transparent',
                borderLeft: '3px solid ' + (active ? 'var(--brand-primary)' : 'transparent'),
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: t?.color,
                  background: 'oklch(from ' + t?.color + ' l c h / 0.15)',
                  width: 22,
                  height: 22,
                  borderRadius: 3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {t?.short}
              </span>
              <span
                style={{
                  color: 'var(--text-primary)',
                  paddingLeft: n.depth * 16,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {n.label}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{t?.label}</span>
              <span
                className="mono"
                style={{ textAlign: 'right', color: 'var(--text-secondary)' }}
              >
                {n.flows}
              </span>
              <span
                className="mono"
                style={{ textAlign: 'right', color: 'var(--brand-primary)' }}
              >
                ${n.cost}
              </span>
              <span
                className="mono"
                style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}
              >
                L{n.depth}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
