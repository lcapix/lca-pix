'use client'

import type { IngestPlan } from '@/lib/ingest/maplca'
import { costKey } from '@/lib/import/review'

import { StepCell, type StepPicker } from './step-cell'

/** The extracted cost lines: amount, category, and the node (or, when appending, a STEP picker), basis. */
export function CostsCard({
  costs,
  appending,
  picker,
}: {
  costs: IngestPlan['costs']
  appending: boolean
  picker: StepPicker
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        COSTS · {costs.length} LINES
      </div>
      {costs.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', fontSize: 12.5, alignItems: 'baseline' }}>
          <span className="mono" style={{ minWidth: 110 }}>
            ${Number(c.amount).toLocaleString()}
          </span>
          <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>{c.category}</span>
          {appending ? (
            <StepCell stepKey={costKey(c, i)} picker={picker} />
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>{c.node}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.basis})</span>
        </div>
      ))}
    </div>
  )
}
