'use client'

import { stageLabel } from '@/lib/life-cycle'
import Link from 'next/link'

// The Inventory tab (E04, behaviour spec "Inventory tab"): a slim indented
// tree on the left (pick a step to see only its flows; a row marks its step),
// and on the right the status tabs with counts, then one table grouped by
// step (E4): each flow on one row with its impact (amount × factor = impact)
// and its cost (amount × price = cost), and under the step its own costs
// (labor, energy, material, transport, equipment, overhead not tied to a
// flow), each editable. A cost on a step with no flow says it adds no impact
// (E3).
//
// Every flow is fully editable here (E1): substance, amount, unit, direction,
// the step it is on, your own factor, delete. Nothing saves until Save (B1),
// and the Saved line shows on the row (B4). A read-only case shows the same
// numbers as plain text, with one line saying why (C4).

import { Fragment, useMemo, useState } from 'react'
import { Button, Flag, FlowStatusPill, SavedLine, ConfirmDialog } from '@/components/lcapix/ds'
import { FLOW_STATUS_WORD, type FlowStatus } from '@/lib/ui/words'
import { amount, amountBox, co2Unit, money, result3 } from '@/lib/ui/format'
import { convertQuantity } from '@/lib/units'
import { useGuidedMode } from '@/lib/shell/use-shell'
import type { CostBasisKind } from '@/lib/costs/cost-basis'
import { FROM_FLOWS } from '@/lib/costs/from-flows'
import { COST_KIND_LABEL, basisLine, basisTag } from '@/lib/workspace/cost-text'
import { flowCostCell } from '@/lib/workspace/flow-cost-text'
import { factorText, perUnitText } from '@/lib/workspace/flow-edit'
import { calculatorFits, globalAveragesLine, machineKwh, type InventoryRow } from '@/lib/workspace/inventory'
import { TIER_COLOURS } from '@/lib/workspace/tier-layout'
import { guard } from '@/lib/workspace/unsaved'
import { useCaseStepCosts, type StepCosts } from '@/lib/workspace/use-step-costs'
import type { WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { AddFlowInPanel } from './add-flow-in-panel'
import { CostKindEditor, NO_IMPACT_LINE } from './cost-panel'
import {
  BackToLibrary,
  DraftActions,
  FactorTag,
  OwnFactorForm,
  READ_ONLY_LINE,
  StageSelect,
  StepSelect,
  SubstanceSwap,
  deleteFlow,
  perOf,
  sourceLine,
  useFlowDraft,
} from './flow-bits'
import { ExerciseSlot } from './exercise-card'
import { HeldLines } from './held-lines'
import { UnsavedBar } from './floating-panel'

type Filter = 'all' | FlowStatus
const FILTERS: Filter[] = ['all', 'needs_amount', 'left_out', 'counted', 'no_factor']
const COLS = 5

/** Steps in tree order with their depth, for the slim tree. */
function flatTree(steps: WorkspaceStep[]): Array<WorkspaceStep & { depth: number }> {
  const kids = new Map<number | null, WorkspaceStep[]>()
  const ids = new Set(steps.map((s) => s.id))
  for (const s of steps) {
    const p = s.parentId != null && ids.has(s.parentId) ? s.parentId : null
    kids.set(p, [...(kids.get(p) ?? []), s])
  }
  const out: Array<WorkspaceStep & { depth: number }> = []
  const seen = new Set<number>()
  const walk = (p: number | null, depth: number) => {
    for (const s of kids.get(p) ?? []) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push({ ...s, depth })
      walk(s.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** A step and every step under it. */
function subtree(steps: WorkspaceStep[], id: number): Set<number> {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const s of steps) if (s.parentId != null && out.has(s.parentId) && !out.has(s.id)) (out.add(s.id), (grew = true))
  }
  return out
}

/** The step's costs that sit on the step, not on a flow (a cost built from the flows shows on their rows). */
function stepLevelCosts(c: StepCosts | undefined): StepCosts['costs'] {
  if (!c || !Array.isArray(c.costs)) return []
  return c.costs.filter((x) => x.amount !== null && !(x.basis?.rate_code === FROM_FLOWS && (x.basis as any)?.lines?.length))
}

export function InventoryTab({
  caseId,
  steps,
  inventory,
  readOnly,
  onOpenInsights,
  basisLine = null,
}: {
  caseId: number
  steps: WorkspaceStep[]
  inventory: WorkspaceInventory | null
  readOnly: boolean
  onOpenInsights: () => void
  /** The inventory covers more than one unit (an import): said once, as Results says it (per-fu.ts). */
  basisLine?: string | null
}) {
  const [guided, setGuided] = useGuidedMode()
  const [filter, setFilter] = useState<Filter>('all')
  const [stepId, setStepId] = useState<number | null>(null)
  const [marked, setMarked] = useState<number | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addTo, setAddTo] = useState<number | null>(null)
  void guided
  const rows = inventory?.rows ?? []
  const tree = useMemo(() => flatTree(steps), [steps])
  const stepOptions = useMemo(() => tree.map((s) => ({ id: s.id, name: s.name, depth: s.depth })), [tree])
  const byId = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps])
  const inStep = useMemo(() => (stepId == null ? null : subtree(steps, stepId)), [steps, stepId])
  const scoped = inStep ? rows.filter((r) => inStep.has(r.component_id)) : rows
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: scoped.length, counted: 0, no_factor: 0, needs_amount: 0, left_out: 0 }
    for (const r of scoped) c[r.status]++
    return c
  }, [scoped])
  const shown = filter === 'all' ? scoped : scoped.filter((r) => r.status === filter)
  const ownCount = (id: number) => rows.filter((r) => r.component_id === id).length
  const needsAt = (id: number) => rows.some((r) => r.component_id === id && (r.status === 'needs_amount' || r.status === 'left_out'))
  const method = inventory?.method ?? ''
  const region = inventory?.region ?? 'Global'
  const globalLine = globalAveragesLine(rows, region)

  // Costs for the steps with a flow or a cost of their own (E4).
  const costIds = useMemo(() => tree.filter((s) => ownCount(s.id) > 0 || Object.values(s.costs).some((v) => v != null)).map((s) => s.id), [tree, rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const costs = useCaseStepCosts(costIds)

  // One group per step, in tree order: its flows, then its own costs.
  const groups = tree
    .filter((s) => !inStep || inStep.has(s.id))
    .map((s) => ({
      step: s,
      flows: shown.filter((r) => r.component_id === s.id),
      own: filter === 'all' ? stepLevelCosts(costs.get(s.id)) : [],
      hasFlows: ownCount(s.id) > 0,
    }))
    .filter((g) => g.flows.length || g.own.length)

  // Changing what is shown would drop a row's unsaved draft: ask first (B3).
  const show = (fn: () => void) => guard(fn)

  return (
    <div className="ws-inv">
      <div className="ws-inv-side">
        <nav className="ws-slimtree" aria-label="The tree">
          <div style={{ padding: '4px 8px 10px' }}>
            <span className="ds-section-label">The tree</span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>Pick a step to see only its flows.</p>
          </div>
          <button type="button" aria-pressed={stepId == null} onClick={() => show(() => setStepId(null))}>
            <span style={{ flex: 1, fontWeight: 600 }}>All flows</span>
            <span className="ds-mono">{rows.length}</span>
          </button>
          {tree.map((s) => {
            const c = TIER_COLOURS[s.tier]
            const warn = needsAt(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={stepId === s.id}
                aria-current={marked === s.id ? 'true' : undefined}
                style={{ paddingLeft: 8 + s.depth * 16, outline: marked === s.id ? '1px dashed var(--ds-green)' : undefined }}
                onClick={() => show(() => setStepId(s.id))}
              >
                <span className="ws-swatch" style={{ background: c.fill, borderColor: c.border }} aria-hidden />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                {warn && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8F5B00" strokeWidth="2" role="img" aria-label="Needs attention">
                    <path d="M12 4 2.5 20h19z" strokeLinejoin="round" />
                    <path d="M12 10v4.5M12 17.5v.5" strokeLinecap="round" />
                  </svg>
                )}
                <span className="ds-mono" style={{ color: 'var(--ds-text-3)', minWidth: 14, textAlign: 'right' }}>
                  {ownCount(s.id)}
                </span>
              </button>
            )
          })}
        </nav>
        {/* 1.10: below the tree card, in the page's flow, so it never sits on the step list. */}
        <button type="button" className="ds-btn ds-btn--small ws-inv-magic" onClick={onOpenInsights}>
          <span className="ws-magic-dot" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
            </svg>
          </span>
          Magic Insights
        </button>
      </div>

      <section className="ds-card" aria-label="Flows" style={{ overflow: 'hidden' }}>
        <ExerciseSlot
          fallback={
            <div className="ws-guide">
              <span style={{ flex: 1 }}>
                <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
                  Guided mode · Inventory
                </span>
                <br />
                {inventoryGuide(rows, byId)}
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
        {/* UX 6: one line for the case, not a notice on every flow that uses the Global average. */}
        {basisLine && (
          <div className="ws-global-line" role="note">
            {basisLine}
          </div>
        )}
        {globalLine && (
          <div className="ws-global-line" role="note">
            {globalLine}
          </div>
        )}
        <div className="ws-pills" role="group" aria-label="Show flows" style={{ padding: '14px 18px' }}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className="ws-pill" aria-pressed={filter === f} onClick={() => show(() => setFilter(f))}>
              {f === 'all' ? 'All' : FLOW_STATUS_WORD[f]}
              <span className="ds-mono" style={{ fontWeight: 500 }}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <table className="ds-table ws-inv-table">
          <thead>
            <tr>
              <th scope="col">Flow</th>
              <th scope="col">Amount</th>
              <th scope="col">Impact: amount × factor</th>
              <th scope="col">Cost: amount × price</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.step.id}>
                <tr className="ws-inv-steprow">
                  <th scope="rowgroup" colSpan={COLS}>
                    {g.step.name}
                    {!g.hasFlows && g.own.length > 0 && <span className="ws-noimpact">{NO_IMPACT_LINE}</span>}
                  </th>
                </tr>
                {g.flows.map((r) => (
                  <InventoryRowView
                    key={r.flow_id}
                    row={r}
                    stepName={g.step.name}
                    steps={stepOptions}
                    stepCosts={costs.get(g.step.id)}
                    method={method}
                    region={region}
                    readOnly={readOnly}
                    onMark={() => setMarked(r.component_id)}
                    onSaved={setSaved}
                  />
                ))}
                {g.own.map((c) => (
                  <StepCostRow key={c.kind} step={byId.get(g.step.id)!} steps={steps} kind={c.kind} data={costs.get(g.step.id)!} hasFlows={g.hasFlows} readOnly={readOnly} />
                ))}
              </Fragment>
            ))}
            {!groups.length && (
              <tr>
                <td colSpan={COLS} style={{ color: 'var(--ds-text-3)' }}>
                  {rows.length ? 'No flow here has that status.' : 'No flows yet. Add one to a step.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {saved && (
          <div style={{ padding: '10px 18px' }}>
            <SavedLine>{saved}</SavedLine>
          </div>
        )}
        <HeldLines caseId={caseId} steps={steps} readOnly={readOnly} method={method} region={region} />
        {!readOnly && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--ds-line-soft)' }}>
            {adding && (stepId ?? addTo) != null ? (
              <AddFlowInPanel
                componentId={(stepId ?? addTo)!}
                studyMethod={method}
                onDone={() => {
                  setAdding(false)
                  setAddTo(null)
                }}
              />
            ) : adding ? (
              <label className="ds-label" style={{ marginBottom: 0 }}>
                Add the flow to which step?
                <select className="ds-input" style={{ width: '100%', marginTop: 4 }} value="" onChange={(e) => setAddTo(Number(e.target.value) || null)}>
                  <option value="">Pick a step</option>
                  {tree.map((s) => (
                    <option key={s.id} value={s.id}>
                      {'  '.repeat(s.depth)}
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button type="button" className="ds-link" onClick={() => setAdding(true)}>
                + Add a flow{stepId != null ? ` to ${byId.get(stepId)?.name ?? 'this step'}` : ''}
              </button>
            )}
          </div>
        )}
      </section>
      <UnsavedBar />
    </div>
  )
}

function inventoryGuide(rows: InventoryRow[], byId: Map<number, WorkspaceStep>): string {
  const calc = rows.find((r) => r.status === 'needs_amount' && calculatorFits(r))
  if (calc) return `${byId.get(calc.component_id)?.name ?? 'A step'} needs its electricity. Work it out with the calculator on its row.`
  const needs = rows.filter((r) => r.status === 'needs_amount').length
  if (needs) return `${needs === 1 ? 'One flow needs' : `${needs} flows need`} an amount before a run counts ${needs === 1 ? 'it' : 'them'}.`
  if (rows.some((r) => r.status === 'left_out')) return "A unit can't convert. Pick the unit its factor uses on its row."
  return 'Every flow has an amount. Run the case to see the answer.'
}

/** The impact cell: "× 1.9 kg CO₂-eq per kg = 1.520 kg CO₂-eq", its tag and source. */
function ImpactCell({ row, method }: { row: InventoryRow; method: string }) {
  if (row.status === 'needs_amount') return <span className="ws-inv-math">Needs an amount</span>
  if (row.status === 'left_out') return <span className="ws-inv-math">Left out: unit can&apos;t convert</span>
  return (
    <>
      <span className="ds-mono ws-inv-math">
        {row.climate
          ? `${amountBox(row.amount)} ${row.unit}${row.climate.conversion ? ` (${row.climate.conversion})` : ''} × ${factorText(row.climate.factor)} ${perUnitText(row.climate.unit, perOf(row))} = ${result3(row.climate.impact)} ${co2Unit(row.climate.unit)}`
          : `${amountBox(row.amount)} ${row.unit} × no climate factor = 0`}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        <FactorTag row={row} />
        <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>{sourceLine(row, method)}</span>
      </span>
    </>
  )
}

function InventoryRowView({
  row,
  stepName,
  steps,
  stepCosts,
  method,
  region,
  readOnly,
  onMark,
  onSaved,
}: {
  row: InventoryRow
  stepName: string
  steps: Array<{ id: number; name: string; depth: number }>
  stepCosts: StepCosts | undefined
  method: string
  region: string
  readOnly: boolean
  onMark: () => void
  onSaved: (line: string) => void
}) {
  const draft = useFlowDraft(row, stepName, steps)
  const [own, setOwn] = useState(false)
  const [more, setMore] = useState(false)
  const [swap, setSwap] = useState(false)
  const [drop, setDrop] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const warn = row.status === 'needs_amount' || row.status === 'left_out'
  const id = `inv-amount-${row.flow_id}`
  const cost = flowCostCell(row, stepCosts?.costs, stepCosts?.from_flows)
  const showCalc = !readOnly && row.status === 'needs_amount' && calculatorFits(row)

  return (
    <>
      <tr className={warn ? 'ws-row-warn' : undefined} data-dirty={draft.dirty || undefined} onClick={onMark} onFocusCapture={onMark}>
        <td>
          <label htmlFor={id} style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>
            {draft.substance ? `${draft.substance.name} (was ${row.substance})` : row.substance}
          </label>
          <span style={{ fontSize: 12, color: 'var(--ds-text-2)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {stepName} ·{' '}
            {readOnly ? (
              <span className="ws-ro-value">{row.direction === 'input' ? 'Input' : 'Output'}</span>
            ) : (
              <select className="ds-input" style={{ minWidth: 96 }} aria-label={`Direction for ${row.substance}`} value={draft.direction} onChange={(e) => draft.setDirection(e.target.value as 'input' | 'output')}>
                <option value="input">Input</option>
                <option value="output">Output</option>
              </select>
            )}
          </span>
          {/* The stage this flow counts in: the rule's, or one the student set. */}
          <span className="ws-inv-stage" title={row.stage_set ? 'Set by you' : 'From the rule: a material going in is Materials; energy and outputs follow the step'}>
            {stageLabel(row.stage)}
            {row.stage_set ? ' · set by you' : ''}
          </span>
        </td>
        <td>
          {readOnly ? (
            <span className="ws-ro-value ds-mono">{row.amount === null ? 'no amount' : `${amountBox(row.amount)} ${row.unit}`}</span>
          ) : (
            <>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  id={id}
                  className="ds-input ws-amount"
                  inputMode="decimal"
                  // 3.12: the name says what the box is; the placeholder is only a dash.
                  aria-label={`${row.substance}, amount in ${draft.unit}`}
                  value={draft.amount}
                  placeholder="–"
                  aria-invalid={!!draft.error || !!draft.unitProblem || undefined}
                  onChange={(e) => draft.setAmount(e.target.value)}
                />
                <select className="ds-input" aria-label={`Unit for ${row.substance}`} value={draft.unit} onChange={(e) => draft.setUnit(e.target.value)}>
                  {draft.units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </span>
              <DraftActions draft={draft} what={`${row.substance} on ${stepName}`} />
              {row.status === 'left_out' && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-warn)', fontWeight: 600, marginTop: 4 }}>
                  Pick {row.substance_unit === 'kg' ? 'kg or g' : row.substance_unit ?? 'a unit'}
                </span>
              )}
            </>
          )}
        </td>
        <td>
          <ImpactCell row={row} method={method} />
        </td>
        <td>
          <span className={`ds-mono ws-inv-math${cost.counted ? '' : ' ws-inv-muted'}`}>{cost.text}</span>
        </td>
        <td>
          <FlowStatusPill status={row.status} />
          {!readOnly && (
            <button type="button" className="ds-link ws-inv-more" aria-expanded={more} aria-label={`Edit more of ${row.substance}`} onClick={() => setMore((v) => !v)}>
              {more ? 'Less' : 'Edit more'}
            </button>
          )}
          {error && (
            <span role="alert" style={{ display: 'block', fontSize: 12, color: 'var(--ds-error)', marginTop: 4 }}>
              {error}
            </span>
          )}
        </td>
      </tr>
      {showCalc && (
        <tr className="ws-row-warn">
          <td colSpan={COLS}>
            <MachineCalculator row={row} onUse={(v) => draft.setAmount(amount(v))} />
          </td>
        </tr>
      )}
      {(more || own) && !readOnly && (
        <tr className="ws-inv-edit">
          <td colSpan={COLS}>
            <div className="ws-inv-edit-grid">
              <div>
                <span className="ds-label" style={{ marginBottom: 4 }}>
                  Substance
                </span>
                <span style={{ display: 'block', fontSize: 13 }}>
                  {draft.substance ? `${draft.substance.name} (was ${row.substance})` : row.substance}{' '}
                  <button type="button" className="ds-link" aria-expanded={swap} onClick={() => setSwap((v) => !v)}>
                    Change substance
                  </button>
                </span>
                {swap && <SubstanceSwap row={row} method={method} draft={draft} onClose={() => setSwap(false)} />}
              </div>
              <StepSelect row={row} steps={steps} draft={draft} />
              <StageSelect row={row} draft={draft} />
              <div>
                <span className="ds-label" style={{ marginBottom: 4 }}>
                  Factor
                </span>
                {own ? (
                  <OwnFactorForm row={row} method={method} onDone={(line) => (setOwn(false), line && onSaved(line))} />
                ) : row.climate?.tag === 'hand' ? (
                  <>
                    <BackToLibrary row={row} onSaved={onSaved} />
                    <button type="button" className="ds-link" onClick={() => setOwn(true)}>
                      Edit my own factor
                    </button>
                  </>
                ) : (
                  <button type="button" className="ds-link" onClick={() => setOwn(true)}>
                    Use my own factor
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
                {draft.dirty && <span className="ws-draft-note">A new substance or step saves with the Save on the row above.</span>}
                <button type="button" className="ds-link" style={{ alignSelf: 'flex-start' }} onClick={() => setDrop(true)}>
                  Delete flow
                </button>
              </div>
            </div>
            <ConfirmDialog
              open={drop}
              title="Delete this flow?"
              consequence={`${row.substance} is removed from ${stepName}. Cancel deletes nothing.`}
              confirmLabel="Delete flow"
              onCancel={() => setDrop(false)}
              onConfirm={async () => {
                const err = await deleteFlow(row.flow_id)
                if (err) setError(err)
                else onSaved(`Deleted · ${row.substance} on ${stepName}`)
                setDrop(false)
              }}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/** A cost that sits on the step, not on a flow (E4): its math, its tag, and Edit with the same editor as the Cost view. */
/** The cost kinds a flow should carry: their impact comes from the flow, never from the cost. */
const FLOW_BACKED = new Set(['material', 'energy', 'transportation'])

function StepCostRow({
  step,
  steps,
  kind,
  data,
  hasFlows,
  readOnly,
}: {
  step: WorkspaceStep
  steps: WorkspaceStep[]
  kind: CostBasisKind
  data: StepCosts
  hasFlows: boolean
  readOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const c = data.costs.find((x) => x.kind === kind)!
  const line = c.basis ? basisLine(c.basis) : null
  const tag = c.basis ? basisTag(c.basis) : null
  return (
    <>
      <tr className="ws-inv-costrow">
        <td>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{COST_KIND_LABEL[kind]}</span>
          <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>{step.name} · a step cost</span>
        </td>
        <td>
          <span className="ds-mono ws-inv-math">{c.basis?.driver_quantity != null ? `${amount(c.basis.driver_quantity)} ${c.basis.driver_unit ?? ''}`.trim() : '–'}</span>
        </td>
        <td>
          <span className="ws-inv-math ws-inv-muted">{hasFlows ? 'Not a flow: no impact of its own' : NO_IMPACT_LINE}</span>
          {/* W8: a material, energy or transport cost with no flow behind it
              counts no impact; offer the flow that would carry it. */}
          {!hasFlows && !readOnly && FLOW_BACKED.has(kind) && c.amount != null && (
            <Link className="ds-link" style={{ display: 'block', marginTop: 4, fontSize: 13 }} href={`?componentId=${step.id}&add=flow`}>
              Add the {kind === 'energy' ? 'energy' : kind === 'transportation' ? 'transport' : 'material'} flow
            </Link>
          )}
        </td>
        <td>
          <span className="ds-mono ws-inv-math">
            {line ? `${line} = ` : ''}
            {money(c.amount, data.currency)}
          </span>
          {tag && (
            <span className={`ds-tag ds-tag--${tag.kind}`} style={{ marginTop: 2, display: 'inline-block' }}>
              {tag.text}
            </span>
          )}
        </td>
        <td>
          {!readOnly && (
            <button type="button" className="ds-link" aria-expanded={open} aria-label={`Edit the ${COST_KIND_LABEL[kind].toLowerCase()} cost on ${step.name}`} onClick={() => setOpen((v) => !v)}>
              {open ? 'Close' : 'Edit'}
            </button>
          )}
          {saved && !open && <SavedLine>{saved}</SavedLine>}
        </td>
      </tr>
      {open && !readOnly && (
        <tr className="ws-inv-edit">
          <td colSpan={COLS}>
            <CostKindEditor
              step={step}
              kind={kind}
              cost={c}
              data={data}
              steps={steps}
              onDone={(l) => {
                setSaved(l)
                setOpen(false)
              }}
              onClose={() => setOpen(false)}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/** Power × time × load = kWh; Use puts it in the amount box, and Save stores it. */
function MachineCalculator({ row, onUse }: { row: InventoryRow; onUse: (v: number) => void }) {
  const [kw, setKw] = useState('')
  const [s, setS] = useState('')
  const [load, setLoad] = useState('100')
  const kwh = kw && s ? machineKwh(Number(kw), Number(s), Number(load)) : null
  // In the flow's own unit, rounded as shown: the box gets what the button says.
  const inUnit = kwh === null ? null : convertQuantity(kwh, 'kWh', row.unit)?.quantity ?? null
  const shown = inUnit === null ? null : Number(amount(inUnit))
  return (
    <div className="ws-calc" role="group" aria-label={`Machine calculator for ${row.substance}`}>
      <span className="ds-section-label" style={{ color: 'var(--ds-warn)' }}>
        Machine calculator
      </span>
      <label>
        Power
        <input inputMode="decimal" value={kw} onChange={(e) => setKw(e.target.value)} aria-label="Power in kW" />
        kW
      </label>
      <span aria-hidden>×</span>
      <label>
        Time
        <input inputMode="decimal" value={s} onChange={(e) => setS(e.target.value)} aria-label="Time in seconds" />s
      </label>
      <span aria-hidden>×</span>
      <label>
        Load
        <input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} aria-label="Load in percent" />%
      </label>
      <span className="ds-mono" aria-live="polite">
        = {shown === null ? '–' : `${amount(shown)} ${row.unit}`}
      </span>
      <Button variant="dark" disabled={shown === null || shown <= 0} onClick={() => shown !== null && onUse(shown)}>
        {shown === null ? 'Use' : `Use ${amount(shown)} ${row.unit}`}
      </Button>
      <span style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>Use puts it in the amount box. Save stores it.</span>
    </div>
  )
}
