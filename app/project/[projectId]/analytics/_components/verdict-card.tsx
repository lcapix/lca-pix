'use client'

// Verdict card: the best non-baseline case and its GWP change vs the baseline.

import { Icon, fmtNum } from '@/components/lcapix'
import type { AssessmentData, BestComparison } from '@/lib/analytics/types'

export function VerdictCard({
  bestComparison,
  baseCase,
}: {
  bestComparison: BestComparison
  baseCase: AssessmentData | undefined
}) {
  return (
    <div
      className="card"
      style={{
        padding: 24,
        marginBottom: 20,
        background:
          'linear-gradient(135deg, var(--brand-subtle), transparent 70%)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'var(--brand-primary)',
            color: 'oklch(0.15 0.01 240)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="target" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            Your best-case scenario is{' '}
            <span style={{ color: 'var(--brand-primary)' }}>
              {bestComparison.best.caseName}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 2,
            }}
          >
            Reduces total impact by{' '}
            <span
              className="mono"
              style={{
                color:
                  bestComparison.deltaPct > 0
                    ? 'var(--signal-success)'
                    : 'var(--signal-error)',
              }}
            >
              {bestComparison.deltaPct > 0 ? '↓' : '↑'}{' '}
              {fmtNum(Math.abs(bestComparison.deltaPct), 1)}%
            </span>{' '}
            vs.{' '}
            <span
              style={{
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            >
              {baseCase?.caseName}
            </span>
            .
          </div>
        </div>
      </div>
    </div>
  )
}
