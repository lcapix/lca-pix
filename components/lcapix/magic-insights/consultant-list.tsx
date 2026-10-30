'use client'

import type { ConsultantItem } from '@/lib/insights/consultant'

/** What a consultant would look at: levers triggered by this case. */
export function ConsultantList({ items }: { items: ConsultantItem[] }) {
  return (
    <div style={{ padding: '4px 24px 6px' }}>
      <div
        className="ds-section-label"
        style={{ fontSize: 10, color: 'var(--ds-text-3)', marginTop: 10, marginBottom: 8 }}
      >
        What a sustainability consultant would look at
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              border: '1px solid var(--ds-line)',
              borderRadius: 8,
              padding: '10px 12px',
              background: 'var(--ds-card)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ds-text)' }}>
              {item.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ds-text-2)', margin: '2px 0 6px' }}>
              {item.why}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5, color: 'var(--ds-text)' }}>
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
