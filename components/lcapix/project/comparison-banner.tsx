'use client'

// The "Comparing <base> vs <comparative>" banner, shown with two cases or more.

import { Icon } from '@/components/lcapix'

export function ComparisonBanner({
  cases,
  baseCases,
  comparativeCases,
}: {
  cases: any[]
  baseCases: any[]
  comparativeCases: any[]
}) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: '14px 20px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        background:
          'linear-gradient(90deg, var(--brand-subtle), transparent 60%)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <Icon name="sparkle" size={14} style={{ color: 'var(--brand-primary)' }} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Comparing{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {baseCases[0]?.name || 'Baseline'}
        </span>{' '}
        vs{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {comparativeCases[0]?.name || cases[1]?.name || 'Comparative'}
        </span>
      </span>
      <span
        className="mono"
        style={{ color: 'var(--signal-success)', fontWeight: 500 }}
      >
        −28.0% CO₂
      </span>
      <span style={{ color: 'var(--text-disabled)' }}>·</span>
      <span className="mono" style={{ color: 'var(--signal-warn)' }}>
        +$240
      </span>
    </div>
  )
}
