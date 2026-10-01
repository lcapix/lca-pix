'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Delta chart — diverging bars showing % difference vs baseline per category
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { buildDeltaChartData, formatSignedPercent } from '@/lib/analytics/chart-data'
import type { BarGroup } from '@/lib/analytics/types'

export function DeltaChartPanel({
  groups,
  seriesLabels,
}: {
  groups: BarGroup[]
  seriesLabels: string[]
}) {
  const baseIndex = 0
  const others = seriesLabels.slice(1)

  const data = useMemo(() => {
    return buildDeltaChartData(groups, others, baseIndex)
  }, [groups, others])

  if (others.length === 0) return null

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Change vs baseline · per category
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Green = improvement, red = regression vs{' '}
        <strong>{seriesLabels[baseIndex]}</strong>.
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickFormatter={(v) => formatSignedPercent(v, 0)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <ReferenceLine x={0} stroke="var(--border-subtle)" />
            <Tooltip
              formatter={(v: any) => [formatSignedPercent(v, 1), '']}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              iconType="circle"
            />
            {others.map((name, i) => (
              <Bar key={name} dataKey={name} radius={[0, 4, 4, 0]}>
                {data.map((entry, idx) => {
                  const v = entry[name] as number
                  return (
                    <Cell
                      key={idx}
                      fill={v <= 0 ? '#2d6a4f' : '#d98568'}
                    />
                  )
                })}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
