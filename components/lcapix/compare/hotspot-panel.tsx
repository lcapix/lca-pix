'use client'

// Hotspots side by side: each step's or material's share of each case's
// result, with every share at or above the threshold highlighted.

import { useState } from 'react'
import { hasComparableResults, hotspotMatrix, type Grouping } from '@/lib/compare/analytics'
import { fmtNum } from '@/components/lcapix'
import type { CompareCase } from './types'
import { Muted, Panel, SelectBox, Segmented, seriesColor, sig, td, tdNum, th } from './ui'

export function HotspotPanel({ cases, category }: { cases: CompareCase[]; category: string }) {
  const [by, setBy] = useState<Grouping>('step')
  const [show, setShow] = useState<'share' | 'value'>('share')
  const [threshold, setThreshold] = useState('10')
  const withRun = cases.filter(hasComparableResults)
  if (!withRun.length) {
    return (
      <Panel title="Hotspots">
        <Muted>None of these cases has a run yet.</Muted>
      </Panel>
    )
  }
  const m = hotspotMatrix(withRun, category, by, Number(threshold))
  const unit = withRun[0].totals.find((t) => t.category === category)?.unit ?? ''

  return (
    <Panel
      title={`Hotspots in ${category}`}
      help="A hotspot is a step or material whose share of a case's result reaches the threshold. Reading the cases side by side shows whether a change removed a hotspot or only moved it."
      actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented
            label="Group by"
            value={by}
            onChange={setBy}
            options={[
              { value: 'step', label: 'By step' },
              { value: 'material', label: 'By material' },
            ]}
          />
          <Segmented
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: 'share', label: '% of case' },
              { value: 'value', label: unit || 'Values' },
            ]}
          />
          <SelectBox
            label="Hotspot from"
            value={threshold}
            onChange={setThreshold}
            options={[
              { value: '5', label: '5%' },
              { value: '10', label: '10%' },
              { value: '20', label: '20%' },
            ]}
          />
        </div>
      }
    >
      {!m.available ? (
        <Muted>A run made before per-exchange results were saved can only be grouped by step. Re-run it to group by material.</Muted>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>{by === 'step' ? 'Step' : 'Material or energy'}</th>
                {withRun.map((c) => {
                  const i = cases.findIndex((x) => x.caseId === c.caseId)
                  return (
                    <th key={c.caseId} style={{ ...th, textAlign: 'right' }}>
                      <span
                        style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: seriesColor(i), marginRight: 6 }}
                      />
                      {c.name}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.key}>
                  <td style={td}>{r.key}</td>
                  {r.cells.map((cell) => (
                    <td
                      key={cell.caseId}
                      style={{
                        ...tdNum,
                        fontWeight: cell.hot ? 600 : 400,
                        color: cell.value === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        background: cell.hot
                          ? `color-mix(in oklab, var(--brand-primary) ${Math.min(40, 10 + cell.share / 2.5)}%, transparent)`
                          : 'transparent',
                      }}
                      title={`${sig(cell.value)} ${unit} · ${fmtNum(cell.share, 1)}% of the case`}
                    >
                      {cell.value === 0 ? '—' : show === 'share' ? `${fmtNum(cell.share, 1)}%` : sig(cell.value)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 600 }}>Case total</td>
                {m.totals.map((t) => (
                  <td key={t.caseId} style={{ ...tdNum, fontWeight: 600 }}>
                    {show === 'share' ? '100%' : sig(t.value)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
