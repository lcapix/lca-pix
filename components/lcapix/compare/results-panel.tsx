'use client'

// LCIA results side by side: every category, every case, as values, as change
// against the base, or relative to the largest value in the row (100%).

import { useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { hasComparableResults, resultsTable } from '@/lib/compare/analytics'
import { fmtNum } from '@/components/lcapix'
import { impactCategoryHelp } from '@/components/lcapix/iso-help'
import { HelpTip } from '@/components/lcapix/help-tip'
import type { CompareCase } from './types'
import { BAD, GOOD, Panel, Segmented, seriesColor, sig, signedPct, signedSig, td, tdNum, th } from './ui'

type Mode = 'values' | 'change' | 'relative'

const tooltipStyle = {
  background: '#fff',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  fontSize: 12,
}

export function ResultsPanel({ cases, baseId }: { cases: CompareCase[]; baseId: string }) {
  const [mode, setMode] = useState<Mode>('values')
  const rows = resultsTable(cases, baseId)
  const withRun = cases.filter(hasComparableResults)
  if (!rows.length) return null

  const radarData = rows.map((r) => {
    const p: Record<string, number | string> = { category: r.category }
    r.cells.forEach((cell, i) => {
      p[cases[i].name] = cell.relMax ?? 0
      p[`${cases[i].name}__raw`] = cell.value ?? 0
    })
    return p
  })
  const others = cases.filter((c) => c.caseId !== baseId && hasComparableResults(c))
  const deltaData = rows.map((r) => {
    const p: Record<string, number | string> = { category: r.category }
    r.cells.forEach((cell, i) => {
      if (cases[i].caseId !== baseId) p[cases[i].name] = cell.deltaPct ?? 0
    })
    return p
  })

  return (
    <>
      <Panel
        title="Results by impact category"
        help="Every impact category each run computed, per functional unit. Change is against the base case. Relative sets the largest value in each row to 100%, so rows in different units read on one scale."
        actions={
          <Segmented
            label="Show results as"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'values', label: 'Values' },
              { value: 'change', label: 'Change vs base' },
              { value: 'relative', label: 'Relative (max = 100%)' },
            ]}
          />
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Impact category</th>
                <th style={th}>Unit</th>
                {cases.map((c, i) => (
                  <th key={c.caseId} style={{ ...th, textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: seriesColor(i),
                        marginRight: 6,
                      }}
                    />
                    {c.name}
                    {c.caseId === baseId ? ' (base)' : ''}
                    {c.run && c.status === 'incomplete' ? ' (incomplete, not ranked)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category}>
                  <td style={td}>
                    {r.category}
                    <HelpTip label={`What is ${r.category}?`}>{impactCategoryHelp(r.category)}</HelpTip>
                  </td>
                  <td style={{ ...td, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{mode === 'relative' ? '%' : r.unit}</td>
                  {r.cells.map((cell) => {
                    const isBase = cell.caseId === baseId
                    if (cell.value === null) return <td key={cell.caseId} style={tdNum}>—</td>
                    if (mode === 'values') return <td key={cell.caseId} style={tdNum}>{sig(cell.value)}</td>
                    if (mode === 'relative') {
                      return (
                        <td key={cell.caseId} style={tdNum}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--border-subtle)' }}>
                              <div
                                style={{
                                  width: `${cell.relMax ?? 0}%`,
                                  height: 6,
                                  borderRadius: 3,
                                  background: 'var(--brand-primary)',
                                }}
                              />
                            </div>
                            {fmtNum(cell.relMax ?? 0, 1)}%
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td
                        key={cell.caseId}
                        style={{
                          ...tdNum,
                          color: isBase ? 'var(--text-tertiary)' : (cell.delta ?? 0) <= 0 ? GOOD : BAD,
                          fontWeight: isBase ? 400 : 600,
                        }}
                      >
                        {isBase ? 'base' : `${signedPct(cell.deltaPct, 2)} (${signedSig(cell.delta)})`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {withRun.length > 0 && rows.length >= 3 && (
        <Panel
          title="Impact profile"
          help="Each axis is scaled to the largest case in that category, so a smaller shape is a smaller footprint in every category."
        >
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="78%">
                <PolarGrid stroke="var(--border-subtle)" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <PolarRadiusAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickFormatter={(v) => `${v}%`} />
                {cases.map((c, i) => hasComparableResults(c) && (
                  <Radar
                    key={c.caseId}
                    name={c.name}
                    dataKey={c.name}
                    stroke={seriesColor(i)}
                    fill={seriesColor(i)}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Tooltip
                  formatter={(_v: any, name: string, props: any) => [sig(props.payload[`${name}__raw`] ?? 0), name]}
                  contentStyle={tooltipStyle}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {others.length > 0 && (
        <Panel title="Change against the base, by category" help="Negative (green) is a smaller impact than the base case; positive (amber) is larger.">
          <div style={{ width: '100%', height: Math.max(160, rows.length * 44 + 60) }}>
            <ResponsiveContainer>
              <BarChart data={deltaData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <ReferenceLine x={0} stroke="var(--border-subtle)" />
                <Tooltip formatter={(v: any, n: string) => [signedPct(Number(v), 2), n]} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
                {others.map((c) => (
                  <Bar key={c.caseId} dataKey={c.name} radius={[0, 4, 4, 0]}>
                    {deltaData.map((e, idx) => (
                      <Cell key={idx} fill={Number(e[c.name]) <= 0 ? '#2d6a4f' : '#d98568'} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}
    </>
  )
}
