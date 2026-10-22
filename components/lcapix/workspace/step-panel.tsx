'use client'

// The floating step panel (canvas.md "The step panel", E03, E03c, E14): dock
// right or left, reset, collapse; the Out of date line; the step; each flow
// as amount × factor = impact with its source tag (the engine's own factor,
// from the case inventory); the in-row choice "Keep the Global average · Use
// my own number"; a saved line, never a toast; Add a flow; under the flows,
// what they would cost ("Material cost from these flows: $0.76 · Use it") and
// the ones with no price. In the Cost view the panel shows the step's costs.

import { useEffect, useMemo, useState } from 'react'
import type { CostBasisKind } from '@/lib/costs/cost-basis'
import { costedInLine, flowCostNotes } from '@/lib/workspace/flow-cost-text'
import { useStepCosts } from '@/lib/workspace/use-step-costs'
import { Button, FlowStatusPill, SavedLine, Segmented, SourceTag } from '@/components/lcapix/ds'
import { amountBox } from '@/lib/ui/format'
import { stepCountsLine, stepKicker } from '@/lib/workspace/step-text'
import { TIER_COLOURS, TIERS } from '@/lib/workspace/tier-layout'
import type { InventoryRow } from '@/lib/workspace/inventory'
import type { WorkspaceCase, WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { AddFlowInPanel } from './add-flow-in-panel'
import { BackToLibrary, OwnFactorForm, rowSum, saveFlowAmount, sourceText } from './flow-bits'
import { CostPanel } from './cost-panel'
import { FlowCostNotes } from './flow-cost-notes'
import { FloatingPanel } from './floating-panel'
import type { TreeView } from './tree-tab'

export function StepPanel({
  kase,
  step,
  parent,
  steps,
  inventory,
  readOnly,
  view,
  onView,
}: {
  kase: WorkspaceCase
  step: WorkspaceStep
  parent: WorkspaceStep | null
  steps: WorkspaceStep[]
  inventory: WorkspaceInventory | null
  readOnly: boolean
  view: TreeView
  onView: (v: TreeView) => void
}) {
  const [saved, setSaved] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // "No price for Argon: add its cost" opens the Cost view on that kind.
  const [costOpen, setCostOpen] = useState<CostBasisKind | null>(null)
  useEffect(() => {
    if (view !== 'cost') setCostOpen(null)
  }, [view, step.id])
  const { data: costs } = useStepCosts(step.id, !readOnly && view !== 'cost')
  const notes = costs ? flowCostNotes(costs.costs, costs.from_flows, (kind) => costedInLine(step.id, steps, kind)) : []
  const rows = useMemo(() => (inventory?.rows ?? []).filter((r) => r.component_id === step.id), [inventory, step.id])
  const children = steps.filter((s) => s.parentId === step.id)
  const changed = inventory?.latest_run?.changed_flows ?? 0
  const c = TIER_COLOURS[step.tier]

  return (
    <FloatingPanel
      label={`Step: ${step.name}`}
      title={
        <>
          <span style={{ color: 'var(--ds-text-3)' }}>{view === 'cost' ? 'Cost' : 'Step'} · </span>
          <strong>{step.name}</strong>
        </>
      }
    >
      {changed > 0 && inventory?.latest_run && (
        <div className="ws-outofdate" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8F5B00" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          <span>
            <strong style={{ color: 'var(--ds-warn)' }}>Out of date</strong>
            <br />
            You changed {changed} {changed === 1 ? 'flow' : 'flows'} after Run #{inventory.latest_run.run_id}. Run again to update.
          </span>
        </div>
      )}

      {view !== 'cost' && (
        <>
          <div className="ws-panel-section" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="ds-tile" style={{ width: 44, height: 44, borderRadius: 12, background: '#F2F4F2' }} aria-hidden>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: c.fill, border: `1.5px solid ${c.border}` }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>{stepKicker(step, parent?.name ?? null)}</span>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 600, lineHeight: '26px' }}>{step.name}</span>
            </span>
          </div>
          <div style={{ padding: '0 18px 12px', fontSize: 13, color: 'var(--ds-text-2)' }}>
            {stepCountsLine(step.id, inventory?.rows ?? [], children.length, children[0]?.tier ?? (TIERS[TIERS.indexOf(step.tier) + 1] ?? null))}
            {step.description ? ` · ${step.description}` : ''}
            {step.source && <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-3)', marginTop: 2 }}>From {step.source}</span>}
          </div>
        </>
      )}
      {view === 'cost' ? (
        <CostPanel
          step={step}
          kase={kase}
          readOnly={readOnly}
          initialOpen={costOpen}
          steps={steps}
          aside={
            <Segmented
              label="Panel shows"
              value="cost"
              onChange={(v) => onView(v === 'flows' ? 'impact' : 'cost')}
              options={[
                { value: 'flows', label: `Flows ${rows.length}` },
                { value: 'cost', label: 'Cost' },
              ]}
            />
          }
        />
      ) : (
        <>
          {rows.map((r) => (
            <FlowRowWs
              key={r.flow_id}
              row={r}
              step={step}
              region={inventory?.region ?? 'Global'}
              method={inventory?.method ?? ''}
              readOnly={readOnly}
              onSaved={setSaved}
            />
          ))}
          {!readOnly && costs && (
            <FlowCostNotes
              step={step}
              notes={notes}
              currency={costs.currency}
              onSaved={setSaved}
              onAddCost={(kind) => {
                setCostOpen(kind)
                onView('cost')
              }}
            />
          )}
          {saved && (
            <div style={{ padding: '10px 18px' }}>
              <SavedLine>{saved}</SavedLine>
            </div>
          )}
          {!readOnly && (
            <div className="ws-panel-section">
              {adding ? (
                <AddFlowInPanel componentId={step.id} studyMethod={inventory?.method} onDone={() => setAdding(false)} />
              ) : (
                <button type="button" className="ds-link" onClick={() => setAdding(true)}>
                  + Add a flow to this step
                </button>
              )}
            </div>
          )}
          {rows.length === 0 && readOnly && (
            <div className="ws-panel-section" style={{ fontSize: 13, color: 'var(--ds-text-3)' }}>
              No flows on this step.
            </div>
          )}
        </>
      )}
    </FloatingPanel>
  )
}

/** One flow in the panel: IN/OUT, the amount box, the arithmetic and its source. */
function FlowRowWs({
  row,
  step,
  region,
  method,
  readOnly,
  onSaved,
}: {
  row: InventoryRow
  step: WorkspaceStep
  region: string
  method: string
  readOnly: boolean
  onSaved: (line: string) => void
}) {
  const [value, setValue] = useState(amountBox(row.amount))
  const [error, setError] = useState<string | null>(null)
  const [own, setOwn] = useState(false)
  const [kept, setKept] = useState(false)
  useEffect(() => setValue(amountBox(row.amount)), [row.amount])

  // Saves what is in the box now: on Enter right after a change (a fast
  // typist, autofill, WebKit) React may not have re-rendered yet, so the
  // state still holds the old value and nothing would be sent.
  const save = async (typed: string = value) => {
    const r = await saveFlowAmount(row, typed)
    if (r.error) return setError(r.error)
    setError(null)
    if (r.saved) onSaved(`Saved · ${row.substance} ${r.amount === null ? 'no amount' : `${amountBox(r.amount)} ${row.unit}`} on ${step.name}`)
  }

  const fallbackRegion = row.climate?.tag === 'global' && region && region.toLowerCase() !== 'global'
  const id = `amount-${row.flow_id}`
  return (
    <div className="ws-flow">
      <div className="ws-flow-top">
        <label htmlFor={id} className="ws-flow-name">
          {row.substance}
        </label>
        <span className="ws-dir" aria-label={row.direction === 'input' ? 'In' : 'Out'}>
          {row.direction === 'input' ? 'IN' : 'OUT'}
        </span>
        <input
          id={id}
          className="ds-input ws-amount"
          inputMode="decimal"
          value={value}
          placeholder="–"
          readOnly={readOnly}
          aria-invalid={!!error || undefined}
          aria-describedby={`${id}-sum`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => !readOnly && save(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !readOnly) {
              e.preventDefault()
              save(e.currentTarget.value)
            }
          }}
        />
        <span className="ds-mono" style={{ fontSize: 13, minWidth: 36 }}>
          {row.unit}
        </span>
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <div id={`${id}-sum`} className="ws-sum">
        {rowSum(row)}
      </div>
      {row.climate ? (
        <div className="ws-source">
          <span>{sourceText(row.climate.source)}{row.climate.scope && row.climate.tag !== 'hand' ? ` · ${row.climate.scope}` : ''}</span>
          <SourceTag kind={row.climate.tag} />
        </div>
      ) : (
        <div className="ws-source">
          <span>{row.status === 'counted' || row.status === 'no_factor' ? `None in ${method}` : ''}</span>
          <FlowStatusPill status={row.status} />
        </div>
      )}
      {fallbackRegion && !kept && !readOnly && row.climate && (
        <div className="ws-choice">
          <span>
            No {region} factor for {row.substance.toLowerCase()}. This uses the Global average from {sourceText(row.climate.source)}.
          </span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="dark" onClick={() => setKept(true)}>
              Keep the Global average
            </Button>
            <Button size="small" onClick={() => setOwn(true)}>
              Use my own number
            </Button>
          </span>
          {own && <OwnFactorForm row={row} onDone={(line) => (setOwn(false), line && onSaved(line))} />}
        </div>
      )}
      {row.climate?.tag === 'hand' && !readOnly && <BackToLibrary row={row} onSaved={onSaved} />}
    </div>
  )
}
