'use client'

// Cost next to impact: each case's cost by kind, and for each copy what the
// change costs against what it saves in the selected category.

import { COST_KEYS, type CostKey } from '@/lib/compare/diff'
import { costImpact, costView } from '@/lib/compare/analytics'
import { fmtNum } from '@/components/lcapix'
import { HelpTip } from '@/components/lcapix/help-tip'
import type { CompareCase, CompareDiff } from './types'
import { BAD, GOOD, Muted, Panel, money, seriesColor, signedMoney, signedPct, signedSig, td, tdNum, th } from './ui'

const LABEL: Record<CostKey, string> = {
  material: 'Material',
  labor: 'Labor',
  energy: 'Energy',
  transportation: 'Transport',
  equipment: 'Equipment',
  overhead: 'Overhead',
  opex: 'Operating (other)',
  capex: 'Capital',
}

export function CostPanel({
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
  const views = cases.map(costView)
  const kinds = COST_KEYS.filter((k) => views.some((v) => v.byKind[k] > 0.005))
  const unit = base.totals.find((t) => t.category === category)?.unit ?? ''
  const copies = cases.filter((c) => c.caseId !== base.caseId)

  if (!views.some((v) => v.total > 0)) {
    return (
      <Panel title="Cost">
        <Muted>None of these cases has step costs yet. Add labor, material or energy costs on the steps to compare cost.</Muted>
      </Panel>
    )
  }

  return (
    <>
      <Panel
        title="Cost by kind, per functional unit"
        help="The step costs each case holds now (activity-based: hours × wage, material bought, energy used). Costs are read live from the cases, while impacts come from each case's run."
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Cost</th>
                {cases.map((c, i) => (
                  <th key={c.caseId} style={{ ...th, textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: seriesColor(i), marginRight: 6 }} />
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k}>
                  <td style={td}>{LABEL[k]}</td>
                  {views.map((v) => (
                    <td key={v.caseId} style={tdNum}>
                      {money(v.byKind[k])}
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                        {v.total ? `${fmtNum((v.byKind[k] / v.total) * 100, 1)}%` : ''}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>Total</td>
                {views.map((v) => (
                  <td key={v.caseId} style={{ ...tdNum, fontWeight: 600 }}>
                    {money(v.total)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {copies.length > 0 && (
        <Panel
          title={`Cost against ${category}`}
          help={`What each change costs next to what it does to ${category}. Cost per unit avoided is the extra cost for each ${unit} the change removes; a negative figure means the change also saves money. It is only shown when the change lowers the impact and the cost moved.`}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Copy</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cost change</th>
                  <th style={{ ...th, textAlign: 'right' }}>{category} change</th>
                  <th style={{ ...th, textAlign: 'right' }}>
                    Cost per {unit} avoided
                    <HelpTip label="How is this worked out?">
                      Cost change divided by the impact removed. Compare it with a carbon price or with other
                      options: the lower it is, the cheaper each unit of impact avoided.
                    </HelpTip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {copies.map((copy) => {
                  const ci = costImpact(base, copy, category)
                  const unchanged = diffs.find((d) => d.caseId === copy.caseId)?.inventory.costUnchanged ?? []
                  const hasRuns = !!copy.run && !!base.run
                  return (
                    <tr key={copy.caseId}>
                      <td style={td}>
                        {copy.name}
                        {unchanged.length > 0 && (
                          <div style={{ fontSize: 11.5, color: BAD, marginTop: 2 }}>
                            Cost not updated where exchanges changed ({unchanged.join(', ')}).
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdNum, color: ci.costDelta <= 0 ? GOOD : BAD }}>{signedMoney(ci.costDelta)}</td>
                      <td style={{ ...tdNum, color: ci.impactDelta <= 0 ? GOOD : BAD }}>
                        {hasRuns ? `${signedSig(ci.impactDelta)} (${signedPct(ci.impactDeltaPct, 2)})` : 'not run'}
                      </td>
                      <td style={tdNum}>
                        {hasRuns && ci.costPerUnitAvoided !== null ? (
                          <span style={{ fontWeight: 600 }}>{signedMoney(ci.costPerUnitAvoided)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {!hasRuns ? '—' : ci.impactDelta >= 0 ? 'no reduction' : 'cost unchanged'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  )
}
