'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Cost analysis — cost breakdown by category + cost-vs-impact pairing
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
import {
  buildCostBreakdownRows,
  buildCostVsImpactRows,
  costPanelCurrency,
  fmtMoney,
  hasAnyCost as anyCaseHasCost,
} from '@/lib/analytics/costs'
import { COST_COLORS, COST_TYPES } from '@/lib/analytics/constants'
import type { AssessmentData } from '@/lib/analytics/types'

export function CostAnalysisPanel({
  assessmentData,
}: {
  assessmentData: AssessmentData[]
}) {
  const currency = costPanelCurrency(assessmentData)
  const hasAnyCost = anyCaseHasCost(assessmentData)

  // Stacked cost-breakdown bar — one bar per scenario, segmented by cost type.
  const breakdownData = useMemo(
    () => buildCostBreakdownRows(assessmentData),
    [assessmentData],
  )

  // Cost-vs-impact — pairs each scenario's total cost with its total impact so
  // the user can see the trade-off LCAPIX exists to surface.
  const costVsImpact = useMemo(
    () => buildCostVsImpactRows(assessmentData),
    [assessmentData],
  )

  if (!hasAnyCost) {
    return (
      <div className="card" style={{ padding: 32, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Cost analysis
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          No costs entered yet. Add labor / energy / material / transport costs on
          components (or use Suggest in the inspector) to populate cost analysis.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Cost analysis · per scenario
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Activity-based cost broken down by type, paired with environmental impact
        so you can weigh the cost ↔ impact trade-off.
      </div>

      {/* Stacked cost breakdown */}
      <div style={{ width: '100%', height: Math.max(160, assessmentData.length * 64 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={breakdownData}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 8, left: 24 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtMoney(v, currency)}
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
              formatter={(v: any, name: string) => [fmtMoney(Number(v), currency), name]}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" />
            {COST_TYPES.map((name) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="cost"
                fill={COST_COLORS[name]}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost-vs-impact table */}
      <div
        style={{
          marginTop: 20,
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
            padding: '10px 16px',
            background: 'var(--surface-overlay)',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
        >
          <div>Scenario</div>
          <div style={{ textAlign: 'right' }}>Total cost</div>
          <div style={{ textAlign: 'right' }}>Total impact</div>
          <div style={{ textAlign: 'right' }}>Cost / impact</div>
        </div>
        {costVsImpact.map((r) => (
          <div
            key={r.scenario}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 13,
            }}
          >
            <div style={{ color: 'var(--text-primary)' }}>{r.scenario}</div>
            <div className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
              {r.cost > 0 ? fmtMoney(r.cost, currency) : '—'}
            </div>
            <div className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
              {r.impact !== 0 ? fmtNum(r.impact, 2) : '—'}
            </div>
            <div
              className="mono"
              style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}
              title="Cost per unit of total environmental impact — lower is more cost-efficient"
            >
              {r.intensity > 0 ? fmtMoney(r.intensity, currency) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
