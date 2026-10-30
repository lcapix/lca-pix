'use client'

// The floating step panel (canvas.md "The step panel", E03, E03c, E14): dock
// right or left, reset, collapse; the Out of date line; the guide line when
// Guided mode is on; the step; each flow as amount × factor = impact with its
// source tag (the engine's own factor, from the case inventory); the in-row
// choice "Keep the Global average · Use my own number"; a saved line, never a
// toast; Add a flow; under the flows, what they would cost ("Material cost
// from these flows: $0.76 · Use it") and the ones with no price. In the Cost
// view the panel shows the step's costs.

import { runLabel } from '@/lib/results/full-results-view'
import { useEffect, useMemo, useState } from 'react'
import type { CostBasisKind } from '@/lib/costs/cost-basis'
import { costedInLine, flowCostNotes } from '@/lib/workspace/flow-cost-text'
import { useStepCosts } from '@/lib/workspace/use-step-costs'
import { Button, Flag, FlowStatusPill, SavedLine, Segmented, SourceTag, ConfirmDialog } from '@/components/lcapix/ds'
import { amountBox } from '@/lib/ui/format'
import { stepCountsLine, stepKicker } from '@/lib/workspace/step-text'
import { TIER_COLOURS, TIERS } from '@/lib/workspace/tier-layout'
import { STAGES } from '@/lib/life-cycle'
import { compatibleUnits } from '@/lib/units'
import { searchSubstances } from '@/lib/case-editor/substance-search'
import { useSubstanceCatalog } from '@/lib/case-editor/use-flows'
import { substanceSource } from '@/lib/substance-source'
import type { InventoryRow } from '@/lib/workspace/inventory'
import type { WorkspaceCase, WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { AddFlowInPanel } from './add-flow-in-panel'
import { BackToLibrary, OwnFactorForm, deleteFlow, rowSum, saveFlowAmount, saveFlowFields, saveFlowUnit, sourceText } from './flow-bits'
import { CostPanel } from './cost-panel'
import { FlowCostNotes } from './flow-cost-notes'
import { FloatingPanel } from './floating-panel'
import { ExerciseSlot } from './exercise-card'
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
  actions,
  onDelete,
}: {
  kase: WorkspaceCase
  step: WorkspaceStep
  parent: WorkspaceStep | null
  steps: WorkspaceStep[]
  inventory: WorkspaceInventory | null
  readOnly: boolean
  view: TreeView
  onView: (v: TreeView) => void
  actions: {
    busy: boolean
    rename: (id: number, name: string) => Promise<boolean>
    move: (id: number, parentId: number) => Promise<boolean>
    setStage: (id: number, stage: string) => Promise<boolean>
    scaleProduct: (from: number, to: number) => Promise<boolean>
  }
  onDelete: () => void
}) {
  const [guided, setGuided] = useGuidedMode()
  const [saved, setSaved] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [flowAnyway, setFlowAnyway] = useState(false)
  const [name, setName] = useState(step.name)
  const [scaleTo, setScaleTo] = useState(step.quantity != null ? String(step.quantity) : '1')
  useEffect(() => setName(step.name), [step.id, step.name])
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
            You changed {changed} {changed === 1 ? 'flow' : 'flows'} after {runLabel(inventory.latest_run)}. Run again to update.
          </span>
        </div>
      )}
      <ExerciseSlot
        fallback={
        <div className="ws-guide">
          <span style={{ flex: 1 }}>
            <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
              Guided mode · {step.name}
            </span>
            <br />
            {guideLine(step, rows)}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <Flag kind="beta" />
            <button type="button" className="ds-link" onClick={() => setGuided(false)}>
              Turn off
            </button>
          </span>
        </div>
        }
      />

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
          {!readOnly && (
            <StepTools step={step} steps={steps} name={name} setName={setName} scaleTo={scaleTo} setScaleTo={setScaleTo} actions={actions} onDelete={onDelete} onSaved={setSaved} />
          )}
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
              {children.length > 0 && !flowAnyway && !adding ? (
                <div>
                  <p>Flows usually go on the lowest step. This step has {children.length} steps under it.</p>
                  <button type="button" className="ds-link" onClick={() => setFlowAnyway(true)}>
                    Add a flow anyway
                  </button>
                </div>
              ) : adding ? (
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

function higherTargets(step: WorkspaceStep, steps: WorkspaceStep[]): WorkspaceStep[] {
  const rank = TIERS.indexOf(step.tier)
  const below = new Set<number>()
  const mark = (id: number) => {
    below.add(id)
    for (const s of steps) if (s.parentId === id) mark(s.id)
  }
  mark(step.id)
  return steps.filter((s) => TIERS.indexOf(s.tier) < rank && !below.has(s.id))
}

function StepTools({
  step,
  steps,
  name,
  setName,
  scaleTo,
  setScaleTo,
  actions,
  onDelete,
  onSaved,
}: {
  step: WorkspaceStep
  steps: WorkspaceStep[]
  name: string
  setName: (v: string) => void
  scaleTo: string
  setScaleTo: (v: string) => void
  actions: {
    busy: boolean
    rename: (id: number, name: string) => Promise<boolean>
    move: (id: number, parentId: number) => Promise<boolean>
    setStage: (id: number, stage: string) => Promise<boolean>
    scaleProduct: (from: number, to: number) => Promise<boolean>
  }
  onDelete: () => void
  onSaved: (line: string) => void
}) {
  const targets = higherTargets(step, steps)
  return (
    <div className="ws-panel-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label>
        <span className="ds-section-label">Step name</span>
        <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input className="ds-input" aria-label="Step name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            onClick={async () => {
              if (name.trim() && (await actions.rename(step.id, name.trim()))) onSaved(`Saved · ${name.trim()}`)
            }}
            busy={actions.busy}
          >
            Save
          </Button>
        </span>
      </label>
      {targets.length > 0 && (
        <label>
          <span className="ds-section-label">Move under</span>
          <select
            className="ds-input"
            aria-label="Move under"
            value=""
            onChange={async (e) => {
              const id = Number(e.target.value)
              if (id && (await actions.move(step.id, id))) onSaved(`Moved · ${step.name}`)
            }}
            style={{ width: '100%', marginTop: 6 }}
          >
            <option value="">Choose a step</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span className="ds-section-label">Life-cycle stage</span>
        <select
          className="ds-input"
          aria-label="Life-cycle stage"
          value={step.lifeCycleStage ?? ''}
          onChange={async (e) => {
            if (e.target.value && (await actions.setStage(step.id, e.target.value))) onSaved(`Saved · ${step.name}`)
          }}
          style={{ width: '100%', marginTop: 6 }}
        >
          <option value="">Not set</option>
          {STAGES.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
      </label>
      {step.tier === 'product' && (
        <label>
          <span className="ds-section-label">Quantity</span>
          <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input className="ds-input" aria-label="Quantity" inputMode="decimal" value={scaleTo} onChange={(e) => setScaleTo(e.target.value)} />
            <Button
              onClick={async () => {
                const to = Number(scaleTo)
                const from = step.quantity && step.quantity > 0 ? step.quantity : 1
                if (Number.isFinite(to) && to > 0 && (await actions.scaleProduct(from, to))) onSaved(`Scaled · ${step.name}`)
              }}
              busy={actions.busy}
            >
              Apply
            </Button>
          </span>
        </label>
      )}
      {step.parentId != null && (
        <Button variant="danger-quiet" onClick={onDelete}>
          Delete step
        </Button>
      )}
    </div>
  )
}

/** The guide's one or two sentences for the open step (scripted, not generated). */
function guideLine(step: WorkspaceStep, rows: InventoryRow[]): string {
  const needs = rows.filter((r) => r.status === 'needs_amount').length
  const main = [...rows].sort((a, b) => (b.climate?.impact ?? 0) - (a.climate?.impact ?? 0))[0]
  if (needs) return `${needs === 1 ? 'One flow here needs' : `${needs} flows here need`} an amount. Each amount is multiplied by its factor.`
  if (main?.climate) return `${main.substance} enters at ${step.name}. Its amount times its factor is what it adds.`
  if (rows.length) return 'These flows have no climate factor in this method, so they add nothing to the climate total.'
  return 'This step holds no flows. Its tasks below it carry them.'
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
  const [swap, setSwap] = useState(false)
  const [query, setQuery] = useState('')
  const [drop, setDrop] = useState(false)
  const { substances } = useSubstanceCatalog(method)
  const found = useMemo(() => (swap ? searchSubstances(query, substances) : []), [swap, query, substances])
  useEffect(() => setValue(amountBox(row.amount)), [row.amount])
  // The amount this tab last knew (3.10): a save checks it, and a conflict moves it to the amount now.
  const [known, setKnown] = useState<number | null>(row.amount)
  useEffect(() => setKnown(row.amount), [row.amount])

  // Saves what is in the box now: on Enter right after a change (a fast
  // typist, autofill, WebKit) React may not have re-rendered yet, so the
  // state still holds the old value and nothing would be sent.
  const save = async (typed: string = value) => {
    const r = await saveFlowAmount(row, typed, known)
    if (r.current !== undefined) setKnown(r.current)
    if (r.error) return setError(r.error)
    setError(null)
    if (r.saved) setKnown(r.amount)
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
        <span className="ws-dir">
          {readOnly ? (
            <span aria-label={row.direction === 'input' ? 'In' : 'Out'}>{row.direction === 'input' ? 'IN' : 'OUT'}</span>
          ) : (
            <select
              className="ds-input"
              aria-label={`Direction for ${row.substance}`}
              value={row.direction}
              onChange={async (e) => {
                const err = await saveFlowFields(row.flow_id, { flow_type: e.target.value })
                if (err) setError(err)
                else onSaved(`Saved · ${row.substance} is ${e.target.value === 'input' ? 'in' : 'out'} on ${step.name}`)
              }}
            >
              <option value="input">In</option>
              <option value="output">Out</option>
            </select>
          )}
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
          {readOnly ? (
            row.unit
          ) : (
            <select
              className="ds-input"
              aria-label={`Unit for ${row.substance}`}
              value={row.unit}
              onChange={async (e) => {
                const err = await saveFlowUnit(row, e.target.value)
                if (err) setError(err)
                else onSaved(`Saved · ${row.substance} in ${e.target.value} on ${step.name}`)
              }}
            >
              {(compatibleUnits(row.substance_unit).includes(row.unit) ? compatibleUnits(row.substance_unit) : [row.unit, ...compatibleUnits(row.substance_unit)]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
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
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 0 8px' }}>
          <button type="button" className="ds-link" onClick={() => setSwap((v) => !v)}>
            Change substance
          </button>
          <button type="button" className="ds-link" onClick={() => setDrop(true)}>
            Delete flow
          </button>
        </div>
      )}
      {swap && !readOnly && (
        <div>
          <input className="ds-input" aria-label={`Find a substance for ${row.substance}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the library" />
          <div role="listbox" aria-label="Substances">
            {found.map((s) => (
              <button
                key={s.substance_id}
                type="button"
                role="option"
                className="ds-link"
                onClick={async () => {
                  const err = await saveFlowFields(row.flow_id, { substance_id: s.substance_id })
                  if (err) setError(err)
                  else {
                    setSwap(false)
                    onSaved(`Saved · ${s.substance_name} on ${step.name}`)
                  }
                }}
              >
                {s.substance_name}
                {' · '}
                {s.climate_factor != null ? `${s.climate_factor} ${s.climate_unit ?? ''}`.trim() : 'no climate factor'}
                {' · '}
                {s.unit ?? 'unit not set'}
                {' · '}
                {substanceSource(s).label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={drop}
        title="Delete this flow?"
        consequence={`${row.substance} is removed from ${step.name}. Cancel deletes nothing.`}
        confirmLabel="Delete flow"
        onCancel={() => setDrop(false)}
        onConfirm={async () => {
          const err = await deleteFlow(row.flow_id)
          if (err) setError(err)
          else onSaved(`Deleted · ${row.substance} on ${step.name}`)
          setDrop(false)
        }}
      />
    </div>
  )
}
