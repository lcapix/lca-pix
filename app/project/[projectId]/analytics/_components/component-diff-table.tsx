'use client'

// Component diff table: each component's total impact per case, with its
// % change vs the baseline case.

import { fmtNum } from '@/components/lcapix'
import { buildComponentDiffRows, shortCaseName } from '@/lib/analytics/derive'
import type { AssessmentData } from '@/lib/analytics/types'

export function ComponentDiffTable({
  assessmentData,
  allComponentNames,
  baseCase,
}: {
  assessmentData: AssessmentData[]
  allComponentNames: string[]
  baseCase: AssessmentData | undefined
}) {
  const rows = buildComponentDiffRows(assessmentData, allComponentNames, baseCase)
  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Component-level difference
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `2fr repeat(${assessmentData.length}, 1fr)`,
          padding: '10px 20px',
          background: 'var(--surface-overlay)',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}
      >
        <div>Component</div>
        {assessmentData.map((d) => (
          <div key={d.caseId} style={{ textAlign: 'right' }}>
            {shortCaseName(d.caseName)}
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.name}
          style={{
            display: 'grid',
            gridTemplateColumns: `2fr repeat(${assessmentData.length}, 1fr)`,
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 13,
          }}
        >
          <div style={{ color: 'var(--text-primary)' }}>
            {row.name}
          </div>
          {row.cells.map(({ caseId, value: val, delta }) => (
            <div
              key={caseId}
              className="mono"
              style={{
                textAlign: 'right',
                color: 'var(--text-secondary)',
              }}
            >
              {val !== 0 ? fmtNum(val, 1) : '—'}
              {delta !== null && val !== 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color:
                      delta < 0
                        ? 'var(--signal-success)'
                        : 'var(--signal-error)',
                  }}
                >
                  {delta < 0 ? '↓' : '↑'}
                  {fmtNum(Math.abs(delta), 0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
