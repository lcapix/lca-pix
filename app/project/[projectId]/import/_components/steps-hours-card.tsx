'use client'

// Steps and hours (F2.3): the operations the routing gave, each with where it
// was read, its hours per unit and the labour cost those hours come to (hours
// × the trade's mean wage, shown as the file gives it, so "after save" never
// sits beside a cost already on screen); untick one to leave it out (with the
// steps under it, its lines and costs); the total of the ticked ones.

import { fixed } from '@/lib/ui/format'
import { TIER_LABEL } from '@/lib/workspace/tier-layout'
import { tickedHours, type StepHoursRow } from '@/lib/import/steps-hours'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function StepsHoursCard({
  rows,
  dropped,
  onToggle,
  unit,
}: {
  rows: StepHoursRow[]
  dropped: ReadonlySet<string>
  onToggle: (name: string) => void
  unit: string
}) {
  const ticked = rows.filter((r) => !dropped.has(r.name)).length
  const allOps = rows.every((r) => r.tier === 'operation')
  const noun = (n: number) => (allOps ? (n === 1 ? 'operation' : 'operations') : n === 1 ? 'step' : 'steps')
  const tickedCost = rows.filter((r) => !dropped.has(r.name)).reduce((t, r) => t + (r.cost ?? 0), 0)
  const anyCost = rows.some((r) => r.cost !== null)
  return (
    <section className="np-card" style={{ maxWidth: 'none' }} aria-labelledby="steps-h">
      <div style={{ padding: '22px 24px 10px' }}>
        <h2 id="steps-h" className="np-h2" style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          {allOps ? 'Operations and hours' : 'Steps and hours'} <span className="ds-count">{rows.length}</span>
        </h2>
        <p className="np-sub" style={{ marginTop: 4 }}>
          Hours per {unit}, read from the file. Labour cost is those hours times the mean wage for the trade. Untick one to leave it out, with what sits under it.
        </p>
      </div>
      <div className="ip-fit">
        <table className="ds-table ip-steps-table">
          <thead>
            <tr>
              <th scope="col" className="ip-col-tick">
                <span className="ds-sr-only">Keep this step</span>
              </th>
              <th scope="col">Step</th>
              <th scope="col" className="ip-col-tier">Tier</th>
              <th scope="col" className="ip-col-num" style={{ textAlign: 'right' }}>
                Hours
              </th>
              <th scope="col" className="ip-col-num" style={{ textAlign: 'right' }}>
                Labour cost
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const keep = !dropped.has(r.name)
              return (
                <tr key={r.name} style={keep ? undefined : { opacity: 0.6 }}>
                  <td>
                    <input type="checkbox" className="ws-check" checked={keep} onChange={() => onToggle(r.name)} aria-label={`Keep ${r.name}`} />
                  </td>
                  <td>
                    <strong style={{ display: 'block', fontSize: 15 }}>{r.name}</strong>
                    {r.where && (
                      <span className="ds-mono" style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
                        {r.where}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="ip-tier">{(TIER_LABEL as Record<string, string>)[r.tier] ?? r.tier}</span>
                  </td>
                  <td className="ds-mono" style={{ textAlign: 'right' }}>
                    {r.hours === null ? '–' : `${fixed(r.hours, 3)} h`}
                  </td>
                  <td className="ds-mono" style={{ textAlign: 'right' }} title={r.basis ?? undefined}>
                    {!keep ? <span style={{ color: 'var(--ds-text-2)' }}>Left out</span> : r.cost === null ? <span style={{ color: 'var(--ds-text-2)' }}>No hours</span> : money(r.cost)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td>
                <strong>
                  {ticked} {noun(ticked)} ticked
                </strong>
              </td>
              <td />
              <td className="ds-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                {fixed(tickedHours(rows, dropped), 3)} h
              </td>
              <td className="ds-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                {anyCost ? money(tickedCost) : '–'}
                <span className="ds-sr-only"> per {unit}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
