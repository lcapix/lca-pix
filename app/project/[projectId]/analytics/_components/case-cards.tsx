'use client'

// Head-to-head case cards: one card per assessed case with its GWP headline,
// change vs the baseline, total cost and stat tiles.

import { StatusDot, fmtNum, fmtInt } from '@/components/lcapix'
import { fmtMoney } from '@/lib/analytics/costs'
import { caseCardDelta, gwpUnit } from '@/lib/analytics/derive'
import type { AssessmentData } from '@/lib/analytics/types'

export function CaseCards({
  assessmentData,
  baseCase,
}: {
  assessmentData: AssessmentData[]
  baseCase: AssessmentData | undefined
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, assessmentData.length)}, 1fr)`,
        gap: 16,
        marginBottom: 20,
      }}
    >
      {assessmentData.map((c, i) => (
        <CaseCard key={c.caseId} c={c} index={i} baseCase={baseCase} />
      ))}
    </div>
  )
}

function CaseCard({
  c,
  index: i,
  baseCase,
}: {
  c: AssessmentData
  /** Position of the case; picks its chart colour. */
  index: number
  baseCase: AssessmentData | undefined
}) {
  const isBase = c === baseCase
  const delta = caseCardDelta(c, baseCase)
  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Header band with accent colour */}
      <div
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: `color-mix(in oklab, var(--chart-${(i % 5) + 1}) 12%, var(--surface-raised))`,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: `var(--chart-${(i % 5) + 1})`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {c.caseName}
        </span>
        <span
          className="chip"
          style={{
            fontSize: 10,
            marginLeft: 'auto',
            padding: '3px 9px',
          }}
        >
          {isBase ? 'BASE' : 'COMP'}
        </span>
      </div>

      {/* Hero number */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div
          className="eyebrow"
          style={{ marginBottom: 6, fontSize: 10 }}
          title="Global warming result of the latest run. Other categories are in different units, so they are compared one by one below, never added together."
        >
          CLIMATE CHANGE (GWP)
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {c.totalScore !== 0 ? fmtNum(c.totalScore, 2) : '—'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            {gwpUnit(c.categories)}
          </div>
          {!isBase && delta !== null && (
            <span
              className="mono"
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                color:
                  delta < 0
                    ? 'var(--signal-success, #16a34a)'
                    : '#b45309',
                background:
                  delta < 0
                    ? 'color-mix(in oklab, var(--signal-success, #16a34a) 14%, transparent)'
                    : 'color-mix(in oklab, #d98568 18%, transparent)',
              }}
            >
              {delta < 0 ? '↓' : '↑'}{' '}
              {fmtNum(Math.abs(delta), 1)}%
            </span>
          )}
        </div>

        {/* Total cost line — cost sits alongside impact, the core
            LCAPIX cost↔impact pairing. */}
        {c.costs.total > 0 && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px dashed var(--border-subtle)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}
          >
            <span className="eyebrow" style={{ fontSize: 10 }}>
              TOTAL COST
            </span>
            <span
              className="mono"
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginLeft: 'auto',
              }}
            >
              {fmtMoney(c.costs.total, c.costs.currency)}
            </span>
          </div>
        )}
      </div>

      {/* Stat tiles row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="eyebrow"
            style={{ fontSize: 9, marginBottom: 4 }}
          >
            CATEGORIES
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {fmtInt(c.categories.length)}
          </div>
        </div>
        <div
          style={{
            padding: '12px 16px',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="eyebrow"
            style={{ fontSize: 9, marginBottom: 4 }}
          >
            COMPONENTS
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {fmtInt(c.components.length)}
          </div>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div
            className="eyebrow"
            style={{ fontSize: 9, marginBottom: 4 }}
          >
            STATUS
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          >
            <StatusDot status="success" /> Assessed
          </div>
        </div>
      </div>
    </div>
  )
}
