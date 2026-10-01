'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Component breakdown — one stacked horizontal bar per scenario
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
} from 'recharts'
import { fmtNum } from '@/components/lcapix'
import { buildComponentBreakdownRows } from '@/lib/analytics/chart-data'
import { COMPONENT_COLORS } from '@/lib/analytics/constants'
import type { AssessmentData } from '@/lib/analytics/types'

export function ComponentBreakdownPanel({
  assessmentData,
  allComponentNames,
}: {
  assessmentData: AssessmentData[]
  allComponentNames: string[]
}) {
  const data = useMemo(() => {
    return buildComponentBreakdownRows(assessmentData, allComponentNames)
  }, [assessmentData, allComponentNames])

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Component contribution · per scenario
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Each bar is a scenario; segments show how much each component
        contributes to its total impact.
      </div>
      <div
        style={{
          width: '100%',
          height: Math.max(140, assessmentData.length * 70 + 60),
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 8, left: 24 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="scenario"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              width={160}
            />
            <Tooltip
              formatter={(v: any, name: string) => [fmtNum(v, 2), name]}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              iconType="circle"
            />
            {allComponentNames.map((name, i) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="components"
                fill={COMPONENT_COLORS[i % COMPONENT_COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
