'use client'

// The cost lines a file gave: amount, kind, the step it goes on and how it
// was worked out. Adding to a case, each line's step picker sits behind its
// own Edit (F2), like the lines we read, so a bill of materials with a cost
// on every part is not a column of open pickers.

import { useState } from 'react'
import type { IngestPlan } from '@/lib/ingest/maplca'
import { costKey } from '@/lib/import/review'

import { StepCell, stepChoiceText, type StepPicker } from './step-cell'

const KIND: Record<string, string> = {
  labor: 'Labour',
  energy: 'Energy',
  material: 'Material',
  transportation: 'Transport',
  opex: 'Running cost',
  capex: 'Equipment',
}

export function CostsCard({
  costs,
  appending,
  picker,
}: {
  costs: IngestPlan['costs']
  appending: boolean
  picker: StepPicker
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const total = (prefix: string) =>
    costs.filter((c) => c.node.startsWith(prefix)).reduce((sum, c) => sum + Number(c.amount || 0), 0)
  const electricity = total('Electricity')
  const gas = total('Natural gas')
  const columns = appending ? 5 : 4
  return (
    <section className="np-card" style={{ maxWidth: 'none' }} aria-labelledby="ip-costs-h">
      <div style={{ padding: '22px 24px 8px' }}>
        <h2 id="ip-costs-h" className="np-h2" style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          Costs we read <span className="ds-count">{costs.length}</span>
        </h2>
        {(electricity > 0 || gas > 0) && (
          <p className="ds-mono" style={{ margin: '6px 0 0' }}>
            {electricity > 0 ? `Electricity ${money(electricity)}` : ''}
            {electricity > 0 && gas > 0 ? ' · ' : ''}
            {gas > 0 ? `Natural gas ${money(gas)}` : ''}
          </p>
        )}
      </div>
      <div className="ip-fit">
        <table className="ds-table ip-costs-table">
          <thead>
            <tr>
              <th scope="col" className="ip-col-amount" style={{ textAlign: 'right' }}>
                Amount
              </th>
              <th scope="col" className="ip-col-status">Kind</th>
              <th scope="col">Step</th>
              <th scope="col">How it was worked out</th>
              {appending && (
                <th scope="col" className="ip-col-edit">
                  <span className="ds-sr-only">Edit</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {costs.map((c, i) => {
              const key = costKey(c, i)
              const isOpen = appending && open.has(i)
              return [
                <tr key={`c${i}`} data-open={isOpen || undefined}>
                  <td className="ds-mono" style={{ textAlign: 'right' }}>
                    ${Number(c.amount).toLocaleString()}
                  </td>
                  <td>{KIND[c.category] ?? c.category}</td>
                  <td>{appending ? <span className="ip-line-step">{stepChoiceText(key, picker)}</span> : c.node}</td>
                  <td style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>{c.basis}</td>
                  {appending && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="ds-link ip-edit-toggle"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Close the step of' : 'Change the step of'} the ${KIND[c.category] ?? c.category} cost of $${Number(c.amount).toLocaleString()}`}
                        onClick={() => toggle(i)}
                      >
                        {isOpen ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  )}
                </tr>,
                isOpen && (
                  <tr key={`e${i}`} className="ip-line-edit-row">
                    <td colSpan={columns}>
                      <div className="ip-line-field" style={{ maxWidth: 420 }}>
                        <span className="edu-field-label">Step this cost goes on</span>
                        <StepCell stepKey={key} picker={picker} />
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
