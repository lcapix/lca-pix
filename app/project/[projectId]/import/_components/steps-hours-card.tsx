'use client'

// Steps and hours (F2.3): the steps the routing gave, each with where it was
// read and its hours per unit; untick a step to leave it out (with the steps
// under it, its lines and costs); the total of the ticked steps. Labour cost
// is priced at a labour rate after save.

import { fixed } from '@/lib/ui/format'
import { TIER_LABEL } from '@/lib/workspace/tier-layout'
import { tickedHours, type StepHoursRow } from '@/lib/import/steps-hours'

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
  return (
    <section className="np-card" style={{ maxWidth: 'none' }} aria-labelledby="steps-h">
      <div style={{ padding: '22px 24px 10px' }}>
        <h2 id="steps-h" className="np-h2" style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          Steps and hours <span className="ds-count">{rows.length}</span>
        </h2>
        <p className="np-sub" style={{ marginTop: 4 }}>
          Hours per {unit}, read from the file. Labour cost: costed at a labour rate after save.
        </p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="ds-sr-only">Keep this step</span>
              </th>
              <th scope="col">Step</th>
              <th scope="col">Tier</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Hours
              </th>
              <th scope="col">Labour cost</th>
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
                  <td style={{ color: 'var(--ds-text-2)' }}>{keep ? 'After save' : 'Left out'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td>
                <strong>
                  {ticked} {ticked === 1 ? 'step' : 'steps'} ticked
                </strong>
              </td>
              <td />
              <td className="ds-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                {fixed(tickedHours(rows, dropped), 3)} h
              </td>
              <td style={{ color: 'var(--ds-text-2)' }}>per {unit}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
