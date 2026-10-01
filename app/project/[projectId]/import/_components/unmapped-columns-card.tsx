'use client'

import type { UnmappedColumnNote } from '@/lib/import/review'

/** Columns the connector read but did not map, each with a role picker (or dismissed as ignored). */
export function UnmappedColumnsCard({
  unmappedColumns,
  dismissedNotes,
  onDismiss,
  columnRoles,
  onRoleChange,
  roles,
}: {
  unmappedColumns: UnmappedColumnNote[]
  dismissedNotes: Set<number>
  onDismiss: (noteIndex: number) => void
  columnRoles: Record<string, string>
  onRoleChange: (column: string, role: string) => void
  roles: Array<[string, string]>
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        UNMAPPED COLUMNS · assign a role so nothing is dropped
      </div>
      {unmappedColumns.map((c) =>
        dismissedNotes.has(c.noteIndex) ? null : (
          <div
            key={c.column}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: '6px 0',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => onDismiss(c.noteIndex)}
              title="Ignore this column"
              aria-label={`Ignore column ${c.column}`}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.column}</span>
            {c.sample && (
              <span
                className="mono"
                style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}
              >
                e.g. "{c.sample}"
              </span>
            )}
            <select
              className="input"
              style={{ fontSize: 11, padding: '3px 6px', height: 26 }}
              value={columnRoles[c.column] ?? 'ignore'}
              onChange={(ev) =>
                onRoleChange(c.column, ev.target.value)
              }
              aria-label={`Role for column ${c.column}`}
            >
              {roles.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {(columnRoles[c.column] ?? 'ignore') !== 'ignore' && (
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                recorded on the case — add the matching connector to map it
              </span>
            )}
          </div>
        ),
      )}
    </div>
  )
}
