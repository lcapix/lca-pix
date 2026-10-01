'use client'

// Top contributors to the focal category of the active case's latest run.

import { MiniBar, fmtNum } from '@/components/lcapix'

export function TopContributorsCard({
  contributors,
  cases,
}: {
  contributors: Array<{ name: string; value: number; pct: number }>
  cases: any[]
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}
      >
        Top contributors
      </div>
      {contributors.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          {cases.length === 0
            ? 'Add a case and run an assessment to see what is driving impact.'
            : 'Run an assessment on this case to see top contributors.'}
        </div>
      ) : (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {contributors.slice(0, 5).map((c: any, i: number) => (
            <div key={c.id ?? c.name ?? i}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  {c.name}
                </span>
                <span
                  className="mono"
                  style={{
                    marginLeft: 'auto',
                    color: 'var(--text-primary)',
                  }}
                >
                  {fmtNum(c.value, 1)}
                </span>
                <span
                  className="mono"
                  style={{
                    marginLeft: 8,
                    color: 'var(--text-tertiary)',
                    width: 40,
                    textAlign: 'right',
                  }}
                >
                  {fmtNum(c.pct, 1)}%
                </span>
              </div>
              <MiniBar
                value={c.pct}
                max={40}
                height={4}
                color={`oklch(from var(--brand-primary) l c h / ${1 - i * 0.12})`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
