'use client'

import { amount, grouped } from '@/lib/ui/format'
import type { Contributor } from '@/lib/insights/magic-insights'

/** Top contributor mini-list (per active category). */
export function ContributorsList({ activeLabel, unit, contributors }: { activeLabel: string; unit?: string; contributors: Contributor[] }) {
  return (
    <div
      style={{
        padding: '8px 24px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        className="ds-section-label"
        style={{ fontSize: 10, color: 'var(--ds-text-3)', marginTop: 14, marginBottom: 8 }}
      >
        Source data: top contributors for {activeLabel}
      </div>
      {contributors.slice(0, 5).map((c) => (
        <div
          key={c.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--ds-card)',
          }}
        >
          <span style={{ flex: 1, color: 'var(--ds-text)' }}>{c.name}</span>
          <span
            className="ds-mono"
            style={{ color: 'var(--ds-text-3)', fontSize: 11 }}
          >
            {/* 1.16: the value says what it is: the step's amount in the category's unit. */}
            {grouped(amount(c.value))} {unit ?? ''}
          </span>
          <span
            className="ds-mono"
            style={{
              color: 'var(--ds-green)',
              fontWeight: 600,
              fontSize: 11,
              minWidth: 42,
              textAlign: 'right',
            }}
          >
            {c.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}
