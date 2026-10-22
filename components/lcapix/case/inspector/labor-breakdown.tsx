'use client'

// Labor = hours × rate, made visible and editable: the trade that does the
// step, the rate (a reference wage, a state's live BLS wage, or the one the
// shop types), and the wage location. Keyed by node id at the call site, so
// the trade, typed rate, location and live wage reset per node.

import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import { LABOR_RATES } from '@/lib/integrations/reference-rates'
import { isLaborNode } from '@/lib/case-editor/cost-calculators'
import { US_STATES, useLaborRate } from '@/lib/case-editor/use-labor-rate'
import type { InspectorEditFormData } from '@/lib/case-editor/types'

export function LaborBreakdown({
  node,
  editFormData,
  onChange,
}: {
  node: FlatCaseNode | null
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
}) {
  const {
    state, pickState, tradeKey, pickTrade, typedRate, typeRate,
    rate, rateLabel, wageNote, wageLoading, hoursVal, computed, setHours,
  } = useLaborRate({
    nodeLabel: (node?.label as string) ?? '',
    editFormData,
    onChange,
  })

  if (!isLaborNode((node?.type as string) ?? '', editFormData)) return null

  return (
    <div
      style={{
        marginBottom: 10,
        padding: '8px 10px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
        Labor = hours × rate
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <select
          className="input"
          style={{ height: 24, fontSize: 10.5, maxWidth: 210 }}
          value={tradeKey}
          onChange={(e) => pickTrade(e.target.value)}
          aria-label="Trade"
          title="Who does this step. The wage follows the trade, not the step's name."
        >
          <option value="">Matched on the step name</option>
          {Object.entries(LABOR_RATES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Hours
          </label>
          <input
            className="input mono"
            type="number"
            step="any"
            style={{ height: 28, fontSize: 12, width: 66 }}
            value={hoursVal ?? ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setHours(e.target.value)}
            aria-label="Labor hours"
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>×</div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Rate ($/h)
          </label>
          <input
            className="input mono"
            type="number"
            step="any"
            style={{ height: 28, fontSize: 12, width: 82 }}
            value={typedRate !== '' ? typedRate : wageLoading ? '' : rate.toFixed(2)}
            placeholder={wageLoading ? '…' : rate.toFixed(2)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => typeRate(e.target.value)}
            title={rateLabel}
            aria-label="Hourly rate"
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>=</div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Labor cost
          </label>
          <div
            className="mono"
            style={{
              fontSize: 12,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
            }}
          >
            {computed != null ? `$${computed.toFixed(2)}` : '–'}
          </div>
        </div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Location
          </label>
          <select
            className="input"
            style={{ height: 28, fontSize: 11, width: 96 }}
            value={state}
            onChange={(e) => pickState(e.target.value)}
            aria-label="Wage location"
          >
            <option value="US">National</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        {rateLabel}. Edit hours, type your own rate, or pick a trade or a state (live BLS wage); Save persists.
      </div>
      {wageNote && (
        <div role="status" style={{ fontSize: 10, color: 'var(--signal-warn, #d97706)', marginTop: 2 }}>
          {wageNote}
        </div>
      )}
    </div>
  )
}
