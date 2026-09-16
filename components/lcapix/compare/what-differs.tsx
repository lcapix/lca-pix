'use client'

// What each copy changes against the base, read from the cases themselves:
// the run scope, the exchanges on each step, the steps, the step costs.

import { totalOf } from '@/lib/compare/analytics'
import type { CostKey, FlowChange, FlowSide } from '@/lib/compare/diff'
import { HelpTip } from '@/components/lcapix/help-tip'
import type { CompareCase, CompareDiff } from './types'
import { BAD, GOOD, Muted, Panel, money, seriesColor, sig, signedPct, signedSig, td, th } from './ui'

const COST_LABEL: Record<CostKey, string> = {
  material: 'material',
  labor: 'labor',
  energy: 'energy',
  transportation: 'transport',
  equipment: 'equipment',
  overhead: 'overhead',
  opex: 'operating',
  capex: 'capital',
}

const qty = (q: number) => String(Number(q.toPrecision(4)))
const side = (s: FlowSide) => `${s.substance} ${qty(s.quantity)} ${s.unit}`

const KIND_STYLE: Record<FlowChange['kind'], { label: string; color: string }> = {
  swapped: { label: 'Swapped', color: 'var(--brand-primary)' },
  changed: { label: 'Changed', color: 'var(--brand-primary)' },
  added: { label: 'Added', color: GOOD },
  removed: { label: 'Removed', color: BAD },
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: 64,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </span>
  )
}

function NoFactor({ method }: { method: string | null }) {
  return (
    <span
      className="chip"
      title={`No factor under ${method ?? 'this method'}, so this exchange adds nothing to the result`}
      style={{ marginLeft: 6, fontSize: 10, padding: '1px 7px', color: BAD }}
    >
      no factor
    </span>
  )
}

export function WhatDiffersPanel({
  base,
  cases,
  diffs,
  category,
}: {
  base: CompareCase
  cases: CompareCase[]
  diffs: CompareDiff[]
  category: string
}) {
  if (!diffs.length) {
    return (
      <Panel title="What differs">
        <Muted>Add a copy of the base to the comparison to see what it changes.</Muted>
      </Panel>
    )
  }
  const characterized = (c: CompareCase) => new Set(c.flows.map((f) => f.substance))
  const baseChar = characterized(base)
  const unit = base.totals.find((t) => t.category === category)?.unit ?? ''

  return (
    <>
      {diffs.map((d) => {
        const idx = cases.findIndex((c) => c.caseId === d.caseId)
        const copy = cases[idx]
        if (!copy) return null
        const copyChar = characterized(copy)
        const inv = d.inventory
        const bTotal = totalOf(base, category)
        const cTotal = totalOf(copy, category)
        const delta = cTotal - bTotal
        const bothRun = !!base.run && !!copy.run
        const noFactorFrom = (s: FlowSide) => !!base.run?.hasSnapshot && !baseChar.has(s.substance)
        const noFactorTo = (s: FlowSide) => !!copy.run?.hasSnapshot && !copyChar.has(s.substance)

        return (
          <Panel
            key={d.caseId}
            title={`${copy.name} against ${base.name}`}
            help="Read from the two cases: the settings each run used, every exchange that was swapped, changed, added or removed on a step, and every step cost that moved. A fair comparison changes one thing at a time."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: seriesColor(idx) }} />
              {bothRun ? (
                <span style={{ fontSize: 13 }}>
                  {category}: <span className="mono">{sig(bTotal)}</span> →{' '}
                  <span className="mono">{sig(cTotal)}</span> {unit}{' '}
                  <span className="mono" style={{ fontWeight: 600, color: delta <= 0 ? GOOD : BAD }}>
                    ({signedSig(delta)}, {signedPct(bTotal ? (delta / Math.abs(bTotal)) * 100 : null, 2)})
                  </span>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: BAD }}>
                  {copy.run ? `${base.name} has no run yet` : `${copy.name} has no run yet`}: run it to compare results.
                </span>
              )}
            </div>

            {[base, copy].map((c) =>
              c.run?.stale ? (
                <div key={`stale-${c.caseId}`} style={{ fontSize: 12.5, color: BAD, marginBottom: 8 }}>
                  {c.name} was edited after run #{c.run.runId}, so its results may not show every change listed here. Re-run it.
                </div>
              ) : null,
            )}

            {d.scope.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <thead>
                  <tr>
                    <th style={th}>
                      Run setting
                      <HelpTip label="Why do run settings matter?">
                        Method and functional unit must match for a valid comparison. A different region
                        changes the electricity factor, which is the point of a grid what-if and a hidden
                        second change anywhere else.
                      </HelpTip>
                    </th>
                    <th style={th}>{base.name}</th>
                    <th style={th}>{copy.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.scope.map((r) => (
                    <tr key={r.label}>
                      <td style={td}>{r.label}</td>
                      <td style={td}>{r.base}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.other}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {inv.identical ? (
              <Muted>
                {d.scope.length
                  ? 'Same steps, exchanges and costs: only the run settings above differ.'
                  : bothRun && Math.abs(delta) > 1e-9 * Math.max(1, Math.abs(bTotal))
                    ? 'Same steps, exchanges, costs and run settings, yet the results differ: one run is older than a change to the factor library. Re-run both.'
                    : 'No differences: same steps, exchanges, costs and run settings.'}
              </Muted>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {inv.flows.length > 0 && (
                  <div>
                    <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
                      Exchanges ({inv.flows.length})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {inv.flows.map((f, i) => (
                          <tr key={i}>
                            <td style={{ ...td, width: 80 }}>
                              <Tag color={KIND_STYLE[f.kind].color}>{KIND_STYLE[f.kind].label}</Tag>
                            </td>
                            <td style={{ ...td, color: 'var(--text-secondary)', width: '32%' }}>{f.step}</td>
                            <td style={td}>
                              {f.kind === 'added' ? (
                                <>
                                  {side(f.to)}
                                  {noFactorTo(f.to) && <NoFactor method={copy.run?.method ?? null} />}
                                </>
                              ) : f.kind === 'removed' ? (
                                <>
                                  <span style={{ textDecoration: 'line-through' }}>{side(f.from)}</span>
                                  {noFactorFrom(f.from) && <NoFactor method={base.run?.method ?? null} />}
                                </>
                              ) : f.kind === 'changed' ? (
                                <>
                                  {f.from.substance}: {qty(f.from.quantity)} {f.from.unit} →{' '}
                                  <strong>
                                    {qty(f.to.quantity)} {f.to.unit}
                                  </strong>
                                </>
                              ) : (
                                <>
                                  {side(f.from)}
                                  {noFactorFrom(f.from) && <NoFactor method={base.run?.method ?? null} />} →{' '}
                                  <strong>{side(f.to)}</strong>
                                  {noFactorTo(f.to) && <NoFactor method={copy.run?.method ?? null} />}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {inv.steps.length > 0 && (
                  <div>
                    <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
                      Steps ({inv.steps.length})
                    </div>
                    {inv.steps.map((s, i) => (
                      <div key={i} style={{ fontSize: 12.5, padding: '4px 0' }}>
                        <Tag color={s.kind === 'added' ? GOOD : BAD}>{s.kind === 'added' ? 'Added' : 'Removed'}</Tag>
                        {s.path.join(' › ')}
                      </div>
                    ))}
                  </div>
                )}

                {(inv.costs.length > 0 || inv.hours.length > 0) && (
                  <div>
                    <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
                      Costs ({inv.costs.length + inv.hours.length})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {inv.costs.map((c, i) => (
                          <tr key={`c${i}`}>
                            <td style={{ ...td, color: 'var(--text-secondary)', width: '32%' }}>{c.step}</td>
                            <td style={td}>
                              {COST_LABEL[c.kind]} cost: {money(c.from)} → <strong>{money(c.to)}</strong>
                            </td>
                          </tr>
                        ))}
                        {inv.hours.map((h, i) => (
                          <tr key={`h${i}`}>
                            <td style={{ ...td, color: 'var(--text-secondary)', width: '32%' }}>{h.step}</td>
                            <td style={td}>
                              labor hours: {h.from ?? '—'} → <strong>{h.to ?? '—'}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {inv.costUnchanged.length > 0 && (
                  <div style={{ fontSize: 12.5, color: BAD }}>
                    Cost not updated on {inv.costUnchanged.join(', ')}.
                    <HelpTip label="Why flag this?">
                      The exchanges on these steps changed but none of their costs did. If the new material or
                      amount costs differently, update the step cost, or the cost comparison will miss it.
                    </HelpTip>
                  </div>
                )}
              </div>
            )}
          </Panel>
        )
      })}
    </>
  )
}
