'use client'

// Cost summary from the active case's real component cost columns, or an
// honest empty state.

import { fmtInt } from '@/components/lcapix'
import type { CaseImpact } from '@/lib/project/case-impact'

export function CostSummaryCard({ caseImpact }: { caseImpact: CaseImpact | null }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}
      >
        Cost summary
      </div>
      {caseImpact?.costs ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            rowGap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>Labor</div>
          <div className="mono">
            ${fmtInt(caseImpact.costs.labor)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>Energy</div>
          <div className="mono">
            ${fmtInt(caseImpact.costs.energy)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Material
          </div>
          <div className="mono">
            ${fmtInt(caseImpact.costs.material)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Overhead
          </div>
          <div className="mono">
            ${fmtInt(caseImpact.costs.overhead)}
          </div>
          <div
            style={{
              gridColumn: '1/3',
              height: 1,
              background: 'var(--border-subtle)',
              margin: '4px 0',
            }}
          />
          <div
            style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            Total
          </div>
          <div
            className="mono"
            style={{
              fontWeight: 600,
              color: 'var(--brand-primary)',
            }}
          >
            ${fmtInt(caseImpact.costs.total)}
          </div>
        </div>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
          }}
        >
          No cost data recorded for this case yet.
        </div>
      )}
    </div>
  )
}
