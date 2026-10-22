'use client'

import type { ConsultantItem } from '@/lib/insights/consultant'

/** What a consultant would look at: levers triggered by this case. */
export function ConsultantList({ items }: { items: ConsultantItem[] }) {
  return (
    <div style={{ padding: '4px 24px 6px' }}>
      <div
        className="eyebrow"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 10, marginBottom: 8 }}
      >
        What a sustainability consultant would look at
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 12px',
              background: 'var(--surface-raised)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 6px' }}>
              {item.why}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {item.moves.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
