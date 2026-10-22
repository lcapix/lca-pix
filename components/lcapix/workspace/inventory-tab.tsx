'use client'

// The Inventory tab (E04, behaviour spec "Inventory tab"): a slim indented
// tree on the left (pick a step to see only its flows; a row marks its step),
// and on the right the status tabs with counts, then the table: Flow (step,
// IN/OUT) · Amount · Unit · Factor · source · Status. Rows that need an amount
// or are left out are marked; an electricity row that needs an amount gets the
// machine calculator; a left-out row says "Pick kg or g"; a factor that fell
// back to the Global average offers "Keep the Global average · Use my own
// number". Add a flow at the foot.

import { useEffect, useMemo, useState } from 'react'
import { Button, Flag, FlowStatusPill, SavedLine, SourceTag } from '@/components/lcapix/ds'
import { FLOW_STATUS_WORD, type FlowStatus } from '@/lib/ui/words'
import { amount, amountBox, fixed } from '@/lib/ui/format'
import { compatibleUnits, convertQuantity } from '@/lib/units'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { calculatorFits, machineKwh, type InventoryRow } from '@/lib/workspace/inventory'
import { TIER_COLOURS } from '@/lib/workspace/tier-layout'
import type { WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { AddFlowInPanel } from './add-flow-in-panel'
import { OwnFactorForm, saveFlowAmount, saveFlowUnit, sourceText } from './flow-bits'
import { ExerciseSlot } from './exercise-card'
import { HeldLines } from './held-lines'

type Filter = 'all' | FlowStatus
const FILTERS: Filter[] = ['all', 'needs_amount', 'left_out', 'counted', 'no_factor']

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

export function InventoryTab({
  caseId,
  steps,
  inventory,
  readOnly,
  onOpenInsights,
}: {
  caseId: number
  steps: WorkspaceStep[]
  inventory: WorkspaceInventory | null
  readOnly: boolean
  onOpenInsights: () => void
}) {
  const [guided, setGuided] = useGuidedMode()
  const [filter, setFilter] = useState<Filter>('all')
  const [stepId, setStepId] = useState<number | null>(null)
  const [marked, setMarked] = useState<number | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addTo, setAddTo] = useState<number | null>(null)
  const rows = inventory?.rows ?? []
  const tree = useMemo(() => flatTree(steps), [steps])
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

  return (
    <div className="ws-inv">
      <nav className="ws-slimtree" aria-label="The tree">
        <div style={{ padding: '4px 8px 10px' }}>
          <span className="ds-section-label">The tree</span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>Pick a step to see only its flows.</p>
        </div>
        <button type="button" aria-pressed={stepId == null} onClick={() => setStepId(null)}>
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
              onClick={() => setStepId(s.id)}
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
        <div style={{ padding: '14px 8px 4px' }}>
          <button type="button" className="ws-magic" onClick={onOpenInsights} style={{ width: 'auto' }}>
            <span className="ws-magic-dot" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
              </svg>
            </span>
            Magic Insights
          </button>
        </div>
      </nav>

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
        <div className="ws-pills" role="group" aria-label="Show flows" style={{ padding: '14px 18px' }}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className="ws-pill" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : FLOW_STATUS_WORD[f]}
              <span className="ds-mono" style={{ fontWeight: 500 }}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-table ws-inv-table">
            <thead>
              <tr>
                <th scope="col">Flow</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Amount
                </th>
                <th scope="col">Unit</th>
                <th scope="col">Factor · source</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <InventoryRowView
                  key={r.flow_id}
                  row={r}
                  stepName={byId.get(r.component_id)?.name ?? ''}
                  method={method}
                  region={region}
                  readOnly={readOnly}
                  onMark={() => setMarked(r.component_id)}
                  onSaved={setSaved}
                />
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--ds-text-3)' }}>
                    {rows.length ? 'No flow here has that status.' : 'No flows yet. Add one to a step.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {saved && (
          <div style={{ padding: '10px 18px' }}>
            <SavedLine>{saved}</SavedLine>
          </div>
        )}
        <HeldLines caseId={caseId} steps={steps} readOnly={readOnly} />
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
                <select
                  className="ds-input"
                  style={{ width: '100%', marginTop: 4 }}
                  value=""
                  onChange={(e) => setAddTo(Number(e.target.value) || null)}
                >
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

function InventoryRowView({
  row,
  stepName,
  method,
  region,
  readOnly,
  onMark,
  onSaved,
}: {
  row: InventoryRow
  stepName: string
  method: string
  region: string
  readOnly: boolean
  onMark: () => void
  onSaved: (line: string) => void
}) {
  const [value, setValue] = useState(amountBox(row.amount))
  const [error, setError] = useState<string | null>(null)
  const [kept, setKept] = useState(false)
  const [own, setOwn] = useState(false)
  useEffect(() => setValue(amountBox(row.amount)), [row.amount])
  const warn = row.status === 'needs_amount' || row.status === 'left_out'
  const units = useMemo(() => {
    const list = compatibleUnits(row.substance_unit)
    return list.includes(row.unit) ? list : [row.unit, ...list]
  }, [row.substance_unit, row.unit])
  const id = `inv-amount-${row.flow_id}`
  const fallback = !!row.climate && row.climate.tag === 'global' && region.toLowerCase() !== 'global'

  // Saves what is in the box now: on Enter right after a change (a fast
  // typist, autofill, WebKit) React may not have re-rendered yet, so the
  // state still holds the old value and nothing would be sent.
  const save = async (typed: string = value) => {
    const r = await saveFlowAmount(row, typed)
    if (r.error) return setError(r.error)
    setError(null)
    if (r.saved) onSaved(`Saved · ${row.substance} ${r.amount === null ? 'no amount' : `${amountBox(r.amount)} ${row.unit}`} on ${stepName}`)
  }

  const pickUnit = async (u: string) => {
    if (u === row.unit) return
    const err = await saveFlowUnit(row, u)
    if (err) return setError(err)
    setError(null)
    onSaved(`Saved · ${row.substance} in ${u} on ${stepName}`)
  }

  const showCalc = !readOnly && row.status === 'needs_amount' && calculatorFits(row)
  const showChoice = !readOnly && fallback && !kept
  return (
    <>
      <tr className={warn ? 'ws-row-warn' : undefined} onClick={onMark} onFocusCapture={onMark}>
        <td>
          <label htmlFor={id} style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>
            {row.substance}
          </label>
          <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
            {stepName} · {row.direction === 'input' ? 'IN' : 'OUT'}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <input
            id={id}
            className="ds-input ws-amount"
            inputMode="decimal"
            value={value}
            placeholder="–"
            readOnly={readOnly}
            aria-invalid={!!error || undefined}
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => !readOnly && save(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !readOnly) {
                e.preventDefault()
                save(e.currentTarget.value)
              }
            }}
          />
        </td>
        <td>
          <select
            className="ds-input"
            aria-label={`Unit for ${row.substance}`}
            value={row.unit}
            disabled={readOnly}
            onChange={(e) => pickUnit(e.target.value)}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {row.status === 'left_out' && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-warn)', fontWeight: 600, marginTop: 4 }}>
              Pick {row.substance_unit === 'kg' ? 'kg or g' : row.substance_unit ?? 'a unit'}
            </span>
          )}
        </td>
        <td>
          {row.climate ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ds-mono">{fixed(row.climate.factor, 3)}</span>
                <SourceTag kind={row.climate.tag} />
              </span>
              <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
                {sourceText(row.climate.source)}
                {row.climate.scope && row.climate.tag !== 'hand' ? ` · ${row.climate.scope}` : ''}
              </span>
            </>
          ) : (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ds-mono">–</span>
                <span className="ds-tag ds-tag--reference">No factor</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
                {row.direction === 'output' ? 'An output, no climate factor' : `None in ${method}`}
              </span>
            </>
          )}
        </td>
        <td>
          <FlowStatusPill status={row.status} />
          {error && (
            <span role="alert" style={{ display: 'block', fontSize: 12, color: 'var(--ds-error)', marginTop: 4 }}>
              {error}
            </span>
          )}
        </td>
      </tr>
      {showCalc && (
        <tr className="ws-row-warn">
          <td colSpan={5}>
            <MachineCalculator row={row} onUse={(v) => (setValue(amountBox(v)), saveAmountValue(row, v, stepName, onSaved, setError))} />
          </td>
        </tr>
      )}
      {showChoice && (
        <tr>
          <td colSpan={5}>
            <div className="ws-choice">
              <span>
                No {region} factor for {row.substance.split(',')[0].toLowerCase()}. This uses the Global average from {sourceText(row.climate!.source)}.
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
          </td>
        </tr>
      )}
    </>
  )
}

async function saveAmountValue(
  row: InventoryRow,
  v: number,
  stepName: string,
  onSaved: (line: string) => void,
  setError: (e: string | null) => void,
) {
  const r = await saveFlowAmount(row, String(v))
  if (r.error) return setError(r.error)
  setError(null)
  if (r.saved) onSaved(`Saved · ${row.substance} ${amountBox(v)} ${row.unit} on ${stepName}`)
}

/** Power × time × load = kWh, with the button saying exactly what it saves. */
function MachineCalculator({ row, onUse }: { row: InventoryRow; onUse: (v: number) => void }) {
  const [kw, setKw] = useState('')
  const [s, setS] = useState('')
  const [load, setLoad] = useState('100')
  const kwh = kw && s ? machineKwh(Number(kw), Number(s), Number(load)) : null
  // In the flow's own unit, rounded as shown: the button saves what it says.
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
    </div>
  )
}
