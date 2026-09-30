'use client'

// Data quality side by side. Two results are only comparable when they rest
// on comparable data: this lays out each run's sources, fallbacks, gaps and
// conversions, and calls out gaps that differ between a copy and the base.

import type { ReactNode } from 'react'
import { fmtInt, fmtNum } from '@/components/lcapix'
import { HelpTip } from '@/components/lcapix/help-tip'
import type { CompareCase } from './types'
import { BAD, Muted, Panel, seriesColor, td, tdNum, th } from './ui'

interface Row {
  label: string
  help: string
  value: (c: CompareCase) => ReactNode
}

const share = (c: CompareCase, tiers: string[]) => {
  const s = c.dataQuality?.gw_share_by_tier
  if (!s) return '—'
  return `${fmtNum(tiers.reduce((sum, t) => sum + (Number(s[t]) || 0), 0) * 100, 0)}%`
}

const ROWS: Row[] = [
  {
    label: 'Run',
    help: 'The run each case is compared on: its number, method, region and date.',
    value: (c) =>
      c.run ? (
        <>
          #{c.run.runId} · {c.run.method} · {c.run.region}
          <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{new Date(c.run.runDate).toLocaleString()}</div>
        </>
      ) : (
        'not run'
      ),
  },
  {
    label: 'Global Warming on authoritative sources',
    help: 'Share of the Global Warming result whose factors come from published LCIA methods or official datasets (TRACI, CML, IPCC, eGRID and similar).',
    value: (c) => share(c, ['authoritative']),
  },
  {
    label: 'Global Warming on industry averages',
    help: 'Share resting on industry-average factors (an association or sector average rather than the supplier). A supplier EPD would replace these.',
    value: (c) => share(c, ['industry_average']),
  },
  {
    label: 'Global Warming on unverified sources',
    help: 'Share resting on factors whose source could not be classified. Treat these numbers with care.',
    value: (c) => share(c, ['unverified', 'unknown']),
  },
  {
    label: 'Global factor used for the region',
    help: 'Contributions where no factor exists for the run region, so the Global factor was used instead.',
    value: (c) =>
      c.dataQuality ? `${fmtInt(c.dataQuality.regional_fallbacks)} of ${fmtInt(c.dataQuality.contributions)}` : '—',
  },
  {
    label: 'Exchanges with no factor',
    help: 'Exchanges no factor in the method characterizes. They add nothing to the result, so a copy with more of them can look better than it is.',
    value: (c) =>
      c.dataQuality ? (
        <>
          {fmtInt(c.dataQuality.uncharacterized_flows)}
          {c.dataQuality.uncharacterized_examples?.length > 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, whiteSpace: 'normal' }}>
              {c.dataQuality.uncharacterized_examples.join(', ')}
            </div>
          )}
        </>
      ) : (
        '—'
      ),
  },
  // The coverage row was removed on 2026-09-29 at Shreya's call, with the
  // chips on the results screen. The engine still records category_coverage and
  // the data-quality statement still says it in words.
  {
    label: 'Exchanges left out (unit mismatch)',
    help: "Exchanges whose unit could not be converted to the factor's unit, so they were left out and flagged.",
    value: (c) => (c.dataQuality ? fmtInt(c.dataQuality.excluded_flows) : '—'),
  },
  {
    label: 'Unit conversions applied',
    help: 'Contributions whose amount was converted to the factor unit (grams to kilograms, for example). Recorded with the run.',
    value: (c) => (c.dataQuality ? fmtInt(c.dataQuality.unit_conversions) : '—'),
  },
  {
    label: 'Steps with allocation',
    help: 'Steps whose burden was split with another product (ISO 14044 allocation).',
    value: (c) => (c.dataQuality ? fmtInt(c.dataQuality.allocated_components) : '—'),
  },
]

export function QualityPanel({ base, cases }: { base: CompareCase; cases: CompareCase[] }) {
  const flags: string[] = []
  for (const c of cases) {
    if (c.status === 'incomplete') flags.push(`${c.name} is incomplete (${(c.statusReason ?? 'nothing computed').toLowerCase()}): it is not compared or ranked.`)
    if (c.run?.stale) flags.push(`${c.name} was edited after run #${c.run.runId}: re-run it before trusting the comparison.`)
    if (c.run && !c.run.hasSnapshot) flags.push(`${c.name}'s run #${c.run.runId} predates data-quality records: re-run it to compare data quality.`)
  }
  const bq = base.dataQuality
  for (const c of cases) {
    if (c.caseId === base.caseId || !bq || !c.dataQuality) continue
    if (c.dataQuality.uncharacterized_flows !== bq.uncharacterized_flows) {
      flags.push(
        `${c.name} has ${c.dataQuality.uncharacterized_flows} exchanges with no factor and ${base.name} has ${bq.uncharacterized_flows}: part of the difference may be missing data, not a real change.`,
      )
    }
    if (c.dataQuality.excluded_flows !== bq.excluded_flows) {
      flags.push(`${c.name} and ${base.name} leave out different numbers of exchanges for unit mismatches.`)
    }
  }

  return (
    <Panel
      title="Data quality"
      help="ISO 14044 compares systems only on equivalent terms: the same functional unit, boundary and impact method, and comparable data quality. This sets each run's data side by side so a difference from better or worse data is not read as a real change."
    >
      {flags.length > 0 ? (
        <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
          {flags.map((f, i) => (
            <div key={i} style={{ fontSize: 12.5, color: BAD }}>
              {f}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Muted>No data-quality gaps differ between these runs.</Muted>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Check</th>
              {cases.map((c, i) => (
                <th key={c.caseId} style={{ ...th, textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: seriesColor(i), marginRight: 6 }} />
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td style={td}>
                  {r.label}
                  <HelpTip label={`About ${r.label.toLowerCase()}`}>{r.help}</HelpTip>
                </td>
                {cases.map((c) => (
                  <td key={c.caseId} style={tdNum}>
                    {r.value(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
