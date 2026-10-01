'use client'

// The case editor's left pane: the "Components" filter, one row per node
// (tier letter + name, indented by depth) and Add Component.

import type { ChangeEvent } from 'react'
import { Icon } from '@/components/lcapix'
import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface CaseOutlineProps {
  query: string
  onQueryChange: (query: string) => void
  /** The rows to show (already filtered by the query). */
  items: FlatCaseNode[]
  /** How many components the case has, filtered or not. */
  totalComponents: number
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}

export function CaseOutline({
  query,
  onQueryChange,
  items,
  totalComponents,
  selectedId,
  onSelect,
  onAdd,
}: CaseOutlineProps) {
  return (
    <aside
      className="case-sidebar"
      style={{
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--surface-sunken)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '0 10px',
            height: 30,
          }}
        >
          <Icon name="search" size={13} style={{ color: 'var(--text-tertiary)' }} />
          <input
            placeholder="Components"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onQueryChange(e.target.value)
            }
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 12,
              flex: 1,
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 6px' }}>
        {items.length === 0 && (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}
          >
            {totalComponents === 0
              ? 'No components yet.'
              : 'No components match that search.'}
          </div>
        )}
        {items.map((n) => {
          const active = selectedId === n.id
          const t = HIERARCHY_TYPES.find((h) => h.id === n.type)
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                paddingLeft: 8 + n.depth * 14,
                border: 'none',
                borderLeft:
                  '3px solid ' +
                  (active ? 'var(--brand-primary)' : 'transparent'),
                background: active ? 'var(--surface-overlay)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-ui)',
                borderRadius: 4,
                marginBottom: 1,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  color: t?.color,
                  background: 'oklch(from ' + t?.color + ' l c h / 0.15)',
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                {t?.short}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {n.label}
              </span>
            </button>
          )
        })}
      </div>

      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          type="button"
          onClick={onAdd}
        >
          <Icon name="plus" size={12} /> Add Component
        </button>
      </div>
    </aside>
  )
}
