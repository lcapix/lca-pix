'use client'

import type { MappedFlow } from '@/lib/ingest/maplca'
import { noFlowsMessage } from '@/lib/import/display'
import { flowKey, type FlowEdit } from '@/lib/import/review'

import { FlowRow } from './flow-row'
import type { StepPicker } from './step-cell'

/** The extracted flows as a review table (STEP column only when appending). */
export function FlowsTable({
  flows,
  edits,
  onEditFlow,
  connector,
  appending,
  picker,
}: {
  flows: MappedFlow[]
  edits: Record<number, FlowEdit>
  onEditFlow: (i: number, edit: FlowEdit) => void
  connector: string
  appending: boolean
  picker: StepPicker
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        FLOWS · {flows.length} EXTRACTED
      </div>
      {flows.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {noFlowsMessage(connector)}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10.5 }}>
              <th style={{ padding: '6px 8px' }}>APPLY</th>
              <th style={{ padding: '6px 8px' }}>DOCUMENT SAYS</th>
              <th style={{ padding: '6px 8px' }}>DIR</th>
              <th style={{ padding: '6px 8px' }}>QUANTITY (CONVERTED)</th>
              <th style={{ padding: '6px 8px' }}>MAPS TO SUBSTANCE</th>
              <th style={{ padding: '6px 8px' }}>MATCH</th>
              {appending && <th style={{ padding: '6px 8px' }}>STEP</th>}
            </tr>
          </thead>
          <tbody>
            {flows.map((f: MappedFlow, i: number) => {
              const e = edits[i]
              if (!e) return null
              return (
                <FlowRow
                  key={i}
                  flow={f}
                  edit={e}
                  onEdit={(edit) => onEditFlow(i, edit)}
                  appending={appending}
                  stepKey={flowKey(f, i)}
                  picker={picker}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
