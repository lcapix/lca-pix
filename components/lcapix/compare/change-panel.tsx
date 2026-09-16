'use client'

// Where the difference between a copy and the base comes from, split by step
// or by material. The rows add up to the total change.

import { useState } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { changeBreakdown, type Grouping } from '@/lib/compare/analytics'
import type { CompareCase } from './types'
import { BAD, GOOD, Muted, Panel, Segmented, seriesColor, sig, signedPct, signedSig, td, tdNum, th } from './ui'

export function ChangePanel({
  base,
  cases,
  category,
}: {
  base: CompareCase
  cases: CompareCase[]
  category: string
}) {
  const [by, setBy] = useState<Grouping>('step')
  const copies = cases.filter((c) => c.caseId !== base.caseId)
  const unit = base.totals.find((t) => t.category === category)?.unit ?? ''

  if (!copies.length) {
    return (
      <Panel title="Where the change comes from">
        <Muted>Add a copy of the base to the comparison to see where its difference comes from.</Muted>
      </Panel>
    )
  }

  return (
    <>
      {copies.map((copy) => {
        const idx = cases.findIndex((c) => c.caseId === copy.caseId)
        if (!copy.run || !base.run) {
          return (
            <Panel key={copy.caseId} title={`Where the change comes from: ${copy.name}`}>
              <Muted>{!copy.run ? copy.name : base.name} has no run yet. Run it to see where the difference comes from.</Muted>
            </Panel>
          )
        }
        const b = changeBreakdown(base, copy, category, by)
        const chartRows = b.rows.slice(0, 12).map((r) => ({ key: r.key, delta: r.delta }))
        const rest = b.rows.length - chartRows.length
        return (
          <Panel
            key={copy.caseId}
            title={`Where the change comes from: ${copy.name}`}
            help="The difference between this copy and the base, split by the step that books it or by the material or energy behind it. Only rows that moved are listed, largest first, and they add up to the total change."
            actions={
              <Segmented
                label="Split the change by"
                value={by}
                onChange={setBy}
                options={[
                  { value: 'step', label: 'By step' },
                  { value: 'material', label: 'By material' },
                ]}
              />
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: seriesColor(idx) }} />
              {category}: <span className="mono">{sig(b.baseTotal)}</span> →{' '}
              <span className="mono">{sig(b.otherTotal)}</span> {unit}
              <span className="mono" style={{ fontWeight: 600, color: b.delta <= 0 ? GOOD : BAD }}>
                {signedSig(b.delta)} ({signedPct(b.deltaPct, 2)})
              </span>
            </div>

            {!b.available ? (
              <Muted>One of these runs was made before per-exchange results were saved, so it can only be split by step. Re-run it to split by material.</Muted>
            ) : b.rows.length === 0 ? (
              <Muted>Nothing moved in {category}: every step and material carries the same amount in both runs.</Muted>
            ) : (
              <>
                <div style={{ width: '100%', height: Math.max(120, chartRows.length * 34 + 40) }}>
                  <ResponsiveContainer>
                    <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                        tickFormatter={(v) => signedSig(Number(v), 2)}
                        domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="key"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        axisLine={false}
                        tickLine={false}
                        width={200}
                      />
                      <ReferenceLine x={0} stroke="var(--border-subtle)" />
                      <Tooltip
                        formatter={(v: any) => [`${signedSig(Number(v), 4)} ${unit}`, 'Change']}
                        contentStyle={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      />
                      <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                        {chartRows.map((r, i) => (
                          <Cell key={i} fill={r.delta <= 0 ? '#2d6a4f' : '#d98568'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {rest > 0 && <Muted>{rest} smaller rows are in the table below.</Muted>}
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>{by === 'step' ? 'Step' : 'Material or energy'}</th>
                        <th style={{ ...th, textAlign: 'right' }}>{base.name}</th>
                        <th style={{ ...th, textAlign: 'right' }}>{copy.name}</th>
                        <th style={{ ...th, textAlign: 'right' }}>Change ({unit})</th>
                        <th style={{ ...th, textAlign: 'right' }}>Share of base total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r) => (
                        <tr key={r.key}>
                          <td style={td}>{r.key}</td>
                          <td style={tdNum}>{sig(r.base)}</td>
                          <td style={tdNum}>{sig(r.other)}</td>
                          <td style={{ ...tdNum, fontWeight: 600, color: r.delta <= 0 ? GOOD : BAD }}>{signedSig(r.delta)}</td>
                          <td style={tdNum}>{signedPct(r.deltaPctOfBase, 2)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...td, fontWeight: 600 }}>Case total</td>
                        <td style={{ ...tdNum, fontWeight: 600 }}>{sig(b.baseTotal)}</td>
                        <td style={{ ...tdNum, fontWeight: 600 }}>{sig(b.otherTotal)}</td>
                        <td style={{ ...tdNum, fontWeight: 600, color: b.delta <= 0 ? GOOD : BAD }}>{signedSig(b.delta)}</td>
                        <td style={{ ...tdNum, fontWeight: 600 }}>{signedPct(b.deltaPct, 2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>
        )
      })}
    </>
  )
}
