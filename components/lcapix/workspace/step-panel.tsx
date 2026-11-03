'use client'

// The floating step panel (canvas.md "The step panel", E03, E03c, E14): dock
// right or left, reset, collapse; the Out of date line; the guide line when
// Guided mode is on; the step; then its flows first (E7), each as amount ×
// factor = impact with its source tag, a draft that only Save stores (B1),
// your own factor on any flow (E2), and the Global-average choice; under the
// flows, what they would cost (E5 asks before replacing a stored cost); Add a
// flow; and last "Step details", closed until opened. In the Cost view the
// panel shows the step's costs; the tree's own Impact · Cost switch is the
// only one (E7).

import { runLabel } from '@/lib/results/full-results-view'
import { useEffect, useMemo, useState } from 'react'
import type { CostBasisKind } from '@/lib/costs/cost-basis'
import { costedInLine, flowCostNotes } from '@/lib/workspace/flow-cost-text'
import { useStepCosts } from '@/lib/workspace/use-step-costs'
import { Button, Flag, FlowStatusPill, SavedLine, ConfirmDialog } from '@/components/lcapix/ds'
import { amountBox } from '@/lib/ui/format'
import { stepCountsLine, stepKicker } from '@/lib/workspace/step-text'
import { TIER_COLOURS, TIERS } from '@/lib/workspace/tier-layout'
import type { InventoryRow } from '@/lib/workspace/inventory'
import type { WorkspaceCase, WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { AddFlowInPanel } from './add-flow-in-panel'
import {
  BackToLibrary,
  DraftActions,
  FactorTag,
  OwnFactorForm,
  READ_ONLY_LINE,
  StepSelect,
  SubstanceSwap,
  deleteFlow,
  rowSum,
  sourceLine,
  sourceText,
  useFlowDraft,
} from './flow-bits'
import { CostPanel } from './cost-panel'
import { FlowCostNotes } from './flow-cost-notes'
import { FloatingPanel } from './floating-panel'
import { ExerciseSlot } from './exercise-card'
import { StepDetails, type StepActions } from './step-details'
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
  startAdding = false,
}: {
  kase: WorkspaceCase
  step: WorkspaceStep
  parent: WorkspaceStep | null
  steps: WorkspaceStep[]
  inventory: WorkspaceInventory | null
  readOnly: boolean
  view: TreeView
  onView: (v: TreeView) => void
  actions: StepActions
  onDelete: () => void
  /** Open with Add a flow already open (a step cost's "Add the flow"). */
  startAdding?: boolean
}) {
  const [guided, setGuided] = useGuidedMode()
  const [saved, setSaved] = useState<string | null>(null)
  const [adding, setAdding] = useState(startAdding && !readOnly)
  const [flowAnyway, setFlowAnyway] = useState(false)
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
  const stepOptions = useMemo(() => treeOrder(steps), [steps])
  void guided

  return (
    <FloatingPanel
      tab="Step"
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
      {readOnly && (
        <div className="ws-readonly-line" role="note">
          {READ_ONLY_LINE}
        </div>
      )}

      {view !== 'cost' && (
        <>
          <div className="ws-panel-section ws-step-head">
            <span className="ds-tile" style={{ width: 36, height: 36, borderRadius: 10, background: '#F2F4F2' }} aria-hidden>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: c.fill, border: `1.5px solid ${c.border}` }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>{stepKicker(step, parent?.name ?? null)}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--ds-text-2)' }}>
                {stepCountsLine(step.id, inventory?.rows ?? [], children.length, children[0]?.tier ?? (TIERS[TIERS.indexOf(step.tier) + 1] ?? null))}
                {step.description ? ` · ${step.description}` : ''}
              </span>
              {step.allocationFactor != null && step.allocationFactor < 1 && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-3)', marginTop: 2 }}>
                  Allocated: {Math.round(step.allocationFactor * 1000) / 10}% stays with this product{step.allocationNote ? ` (${step.allocationNote})` : ''}
                </span>
              )}
              {step.source && <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-3)', marginTop: 2 }}>From {step.source}</span>}
            </span>
          </div>
          {rows.map((r) => (
            <FlowRowWs
              key={r.flow_id}
              row={r}
              step={step}
              steps={stepOptions}
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
          {!readOnly && <StepDetails step={step} steps={steps} actions={actions} onDelete={onDelete} />}
        </>
      )}
      {view === 'cost' && <CostPanel step={step} kase={kase} readOnly={readOnly} initialOpen={costOpen} steps={steps} flowCount={rows.length} />}
    </FloatingPanel>
  )
}

/** The case's steps in tree order with their depth, for "On the step". */
export function treeOrder(steps: WorkspaceStep[]): Array<{ id: number; name: string; depth: number }> {
  const ids = new Set(steps.map((s) => s.id))
  const kids = new Map<number | null, WorkspaceStep[]>()
  for (const s of steps) {
    const p = s.parentId != null && ids.has(s.parentId) ? s.parentId : null
    kids.set(p, [...(kids.get(p) ?? []), s])
  }
  const out: Array<{ id: number; name: string; depth: number }> = []
  const seen = new Set<number>()
  const walk = (p: number | null, depth: number) => {
    for (const s of kids.get(p) ?? []) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push({ id: s.id, name: s.name, depth })
      walk(s.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
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

/**
 * One flow in the panel: the name, then In/Out, the amount and its unit as a
 * draft with Save beside them; the arithmetic with the factor's basis; the
 * source and its tag; then Change substance, Move to another step, Use my own
 * factor, Delete flow. A read-only case shows the same as plain text (C4).
 */
function FlowRowWs({
  row,
  step,
  steps,
  region,
  method,
  readOnly,
  onSaved,
}: {
  row: InventoryRow
  step: WorkspaceStep
  steps: Array<{ id: number; name: string; depth: number }>
  region: string
  method: string
  readOnly: boolean
  onSaved: (line: string) => void
}) {
  const draft = useFlowDraft(row, step.name, steps)
  const [own, setOwn] = useState(false)
  const [kept, setKept] = useState(false)
  const [swap, setSwap] = useState(false)
  const [moving, setMoving] = useState(false)
  const [drop, setDrop] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackRegion = row.climate?.tag === 'global' && region && region.toLowerCase() !== 'global'
  const id = `amount-${row.flow_id}`

  if (readOnly) {
    return (
      <div className="ws-flow" data-readonly>
        <div className="ws-flow-top">
          <span className="ws-flow-name">{row.substance}</span>
          <span className="ws-ro-value">{row.direction === 'input' ? 'Input' : 'Output'}</span>
          <span className="ws-ro-value ds-mono">{row.amount === null ? 'no amount' : `${amountBox(row.amount)} ${row.unit}`}</span>
        </div>
        <div className="ws-sum">{rowSum(row)}</div>
        <div className="ws-source">
          <span>{sourceLine(row, method)}</span>
          {row.climate ? <FactorTag row={row} /> : <FlowStatusPill status={row.status} />}
        </div>
      </div>
    )
  }

  return (
    <div className="ws-flow" data-dirty={draft.dirty || undefined}>
      <div className="ws-flow-top">
        <label htmlFor={id} className="ws-flow-name">
          {draft.substance ? (
            <>
              {draft.substance.name} <span className="ws-draft-note">(was {row.substance})</span>
            </>
          ) : (
            row.substance
          )}
        </label>
        <span className="ws-dir">
          <select className="ds-input" aria-label={`Direction for ${row.substance}`} value={draft.direction} onChange={(e) => draft.setDirection(e.target.value as 'input' | 'output')}>
            <option value="input">Input</option>
            <option value="output">Output</option>
          </select>
        </span>
        <input
          id={id}
          className="ds-input ws-amount"
          inputMode="decimal"
          aria-label={`${row.substance}, amount in ${draft.unit}`}
          value={draft.amount}
          placeholder="–"
          aria-invalid={!!draft.error || !!draft.unitProblem || undefined}
          aria-describedby={`${id}-sum`}
          onChange={(e) => draft.setAmount(e.target.value)}
        />
        <span className="ds-mono" style={{ fontSize: 13, minWidth: 36 }}>
          <select className="ds-input" aria-label={`Unit for ${row.substance}`} value={draft.unit} onChange={(e) => draft.setUnit(e.target.value)}>
            {draft.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </span>
      </div>
      <DraftActions draft={draft} what={`${row.substance} on ${step.name}`} />
      <div id={`${id}-sum`} className="ws-sum">
        {rowSum(row)}
      </div>
      <div className="ws-source">
        <span>{sourceLine(row, method)}</span>
        {row.climate ? <FactorTag row={row} /> : <FlowStatusPill status={row.status} />}
      </div>
      {fallbackRegion && !kept && row.climate && !own && (
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
        </div>
      )}
      {own && <OwnFactorForm row={row} method={method} onDone={(line) => (setOwn(false), line && onSaved(line))} />}
      {row.climate?.tag === 'hand' && !own && <BackToLibrary row={row} onSaved={onSaved} />}
      {swap && <SubstanceSwap row={row} method={method} draft={draft} onClose={() => setSwap(false)} />}
      {moving && <StepSelect row={row} steps={steps} draft={draft} />}
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <div className="ws-flow-links">
        <button type="button" className="ds-link" aria-expanded={swap} onClick={() => setSwap((v) => !v)}>
          Change substance
        </button>
        <button type="button" className="ds-link" aria-expanded={moving} onClick={() => setMoving((v) => !v)}>
          Move to another step
        </button>
        {!own && (
          <button type="button" className="ds-link" onClick={() => setOwn(true)}>
            {row.climate?.tag === 'hand' ? 'Edit my own factor' : 'Use my own factor'}
          </button>
        )}
        <button type="button" className="ds-link" onClick={() => setDrop(true)}>
          Delete flow
        </button>
      </div>
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
