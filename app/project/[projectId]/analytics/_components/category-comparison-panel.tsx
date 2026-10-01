'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Category visualisations — radar + normalised view + magnitude toggle
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { fmtNum } from '@/components/lcapix'
import {
  buildAbsoluteChartData,
  buildLogChartData,
  buildNormalizedChartData,
  buildRadarChartData,
  defaultCategoryView,
  formatLogTick,
} from '@/lib/analytics/chart-data'
import { SERIES_COLORS } from '@/lib/analytics/constants'
import type { BarGroup, CategoryView } from '@/lib/analytics/types'

export function CategoryComparisonPanel({
  groups,
  seriesLabels,
  demo,
}: {
  groups: BarGroup[]
  seriesLabels: string[]
  demo?: boolean
}) {
  const [view, setView] = useState<CategoryView>(
    defaultCategoryView(seriesLabels.length),
  )

  const absoluteData = useMemo(() => {
    return buildAbsoluteChartData(groups, seriesLabels)
  }, [groups, seriesLabels])

  const radarData = useMemo(() => {
    // For radar, normalise each category to its max across scenarios so the
    // shape reads at a glance (otherwise one giant category dwarfs the rest).
    return buildRadarChartData(groups, seriesLabels)
  }, [groups, seriesLabels])

  const normalizedData = useMemo(() => {
    return buildNormalizedChartData(groups, seriesLabels)
  }, [groups, seriesLabels])

  const logData = useMemo(() => {
    return buildLogChartData(groups, seriesLabels)
  }, [groups, seriesLabels])

  // No real data → render a proper empty state instead of an empty chart
  // shell. Prevents the "demo bars looked real" failure mode.
  if (groups.length === 0) {
    return (
      <div className="card" style={{ padding: 32, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Impact by category · across scenarios
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Run an assessment on at least one case to populate this chart.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 20,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Impact by category · across scenarios
          {demo && (
            <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>
              DEMO
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          {(
            [
              { id: 'absolute', label: 'Absolute' },
              { id: 'radar', label: 'Radar' },
              { id: 'log', label: 'Log scale' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              style={{
                padding: '5px 12px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                fontWeight: view === opt.id ? 600 : 450,
                background:
                  view === opt.id ? 'var(--surface-raised)' : 'transparent',
                color:
                  view === opt.id
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                boxShadow:
                  view === opt.id
                    ? '0 1px 2px rgba(15,23,42,0.06)'
                    : 'none',
                transition: 'all 160ms ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          {view === 'radar' ? (
            <RadarChart data={radarData} outerRadius="78%">
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              />
              <PolarRadiusAxis
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={(v) => `${v}%`}
              />
              {seriesLabels.map((name, i) => (
                <Radar
                  key={name}
                  name={name}
                  dataKey={name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fillOpacity={0.22}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
              />
              <Tooltip
                formatter={(_v: any, name: string, props: any) =>
                  [
                    fmtNum(props.payload[`${name}__raw`] ?? 0, 3),
                    name,
                  ] as any
                }
                contentStyle={{
                  background: '#fff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RadarChart>
          ) : (
            <BarChart
              data={
                view === 'log'
                  ? logData
                  : view === 'normalized'
                    ? normalizedData
                    : absoluteData
              }
              margin={{ top: 24, right: 16, bottom: 8, left: -8 }}
            >
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                scale={view === 'log' ? 'linear' : 'auto'}
                tickFormatter={(v) =>
                  view === 'normalized'
                    ? `${v}%`
                    : view === 'log'
                      ? formatLogTick(v)
                      : fmtNum(v, 2)
                }
              />
              <Tooltip
                formatter={(_v: any, name: string, props: any) => [
                  fmtNum(props.payload[`${name}__raw`] ?? 0, 3),
                  name,
                ]}
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
              {seriesLabels.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  label={
                    view === 'absolute'
                      ? {
                          position: 'top',
                          fontSize: 10,
                          fill: 'var(--text-secondary)',
                          formatter: (v: number) =>
                            v === 0 ? '' : Math.abs(v) < 0.01 ? v.toExponential(1) : fmtNum(v, 2),
                        }
                      : undefined
                  }
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          marginTop: 8,
        }}
      >
        {view === 'absolute' &&
          'Raw impact values per category. A single huge bar means that category dominates — switch to Log scale or Normalised to see smaller ones.'}
        {view === 'radar' &&
          'Each axis is normalised to the highest scenario in that category — bigger polygon = larger overall footprint.'}
        {view === 'normalized' &&
          'Each category is scaled 0–100% of its own maximum so small-magnitude categories stay visible.'}
        {view === 'log' &&
          'Values shown on a log scale (log₁₀ of value + 1) so categories spanning orders of magnitude all fit.'}
      </div>
    </div>
  )
}
