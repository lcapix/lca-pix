'use client'

import { fmtSig } from '@/components/lcapix/formatters'
import type { Contributor } from '@/lib/insights/magic-insights'

/** Top contributor mini-list (per active category). */
export function ContributorsList({ activeLabel, contributors }: { activeLabel: string; contributors: Contributor[] }) {
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
        className="eyebrow"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 14, marginBottom: 8 }}
      >
        Source data — top contributors for {activeLabel}
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
            background: 'var(--surface-overlay)',
          }}
        >
          <span style={{ flex: 1, color: 'var(--text-primary)' }}>{c.name}</span>
          <span
            className="mono"
            style={{ color: 'var(--text-tertiary)', fontSize: 11 }}
          >
            {fmtSig(c.value)}
          </span>
          <span
            className="mono"
            style={{
              color: 'var(--brand-primary)',
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
