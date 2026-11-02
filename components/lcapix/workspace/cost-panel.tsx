'use client'

// The step panel in Cost view (E14): the step's cost per reference unit, "N of
// 6 set", and each of the six kinds with how it was built (hours × rate, its
// source tag). Labor opens "Look up a labor rate": a reference occupation, a
// state's live BLS wage, or your own rate. Energy looks up a carrier's price,
// material a metal's price per kg (Metals-API). The other kinds take an amount.
//
// Nothing is stored until Save (B1): a lookup or a picked rate shows its
// number first ("0.8 kg × $0.95/kg = $0.76"), and Save stores it through the
// costs route, which keeps the amount and the basis together. The Saved line
// shows on that cost, in view (B4). A cost on a step with no flow says it adds
// no impact (E3). The flows' number never replaces a stored cost in one click
// (E5). The kind editors are shared with the Inventory (E4).

import { perUnit } from '@/lib/workspace/per-unit'
import { useMemo, useState } from 'react'
import { Button, ErrorCard, IconButton, SavedLine } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { announceComponentsChanged } from '@/lib/case-editor/use-flows'
import { US_STATES } from '@/lib/case-editor/use-labor-rate'
import { LABOR_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates'
import { METAL_NAME } from '@/lib/integrations/metals/client'
import { COST_BASIS_KINDS, costAmount, type CostBasisKind } from '@/lib/costs/cost-basis'
import type { FlowCostSuggestion } from '@/lib/costs/from-flows'
import { amount, money } from '@/lib/ui/format'
import { stateName } from '@/lib/ui/us-states'
import { COST_KIND_LABEL, basisLine, basisTag, costLinesText, rateText, setLine } from '@/lib/workspace/cost-text'
import { costedInLine, flowCostNotes, type FlowCostKind } from '@/lib/workspace/flow-cost-text'
import { useUnsavedEdit } from '@/lib/workspace/unsaved'
import { previewCost, putCost, useStepCosts, type CostPreview, type StepCosts } from '@/lib/workspace/use-step-costs'
import type { WorkspaceCase, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { FlowCostNotes, FlowsCostChoice } from './flow-cost-notes'

const KIND_ICON: Record<CostBasisKind, string> = {
  labor: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  energy: 'M13 3 5 14h6l-1 7 8-11h-6z',
  material: 'M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8',
  transportation: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  equipment: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  overhead: 'M4 20V9l8-5 8 5v11zM9 20v-6h6v6',
}

/** E3: what a cost on a step with no flow says, on that cost. */
export const NO_IMPACT_LINE = 'Adds no impact: no flow on this step'

export function CostPanel({
  step,
  kase,
  readOnly,
  initialOpen = null,
  steps = [],
  flowCount,
}: {
  step: WorkspaceStep
  kase: WorkspaceCase
  /** The case's steps, to see which kinds a step above or below already carries. */
  steps?: WorkspaceStep[]
  readOnly: boolean
  /** A kind to open on arrival ("No price for Argon: add its cost" opens Material). */
  initialOpen?: CostBasisKind | null
  /** How many flows sit on this step; 0 flags each cost "adds no impact" (E3). Unknown when left out. */
  flowCount?: number
}) {
  const { data, error, load } = useStepCosts(step.id)
  const [open, setOpen] = useState<CostBasisKind | null>(readOnly ? null : initialOpen)
  const [saved, setSaved] = useState<{ kind: CostBasisKind | null; line: string } | null>(null)
  const total = data ? data.costs.reduce((s, c) => s + (c.amount ?? 0), 0) : null
  const unit = perUnit(kase)
  const inLine = (kind: CostBasisKind) => costedInLine(step.id, steps, kind)
  const notes = data && !readOnly ? flowCostNotes(data.costs, data.from_flows, inLine) : []

  // The page reloads on the announcement, this panel with it (useStepCosts).
  const done = (kind: CostBasisKind | null) => (line: string) => {
    setSaved({ kind, line })
    setOpen(null)
    announceComponentsChanged()
  }

  if (error) {
    return (
      <div className="ws-panel-section">
        <ErrorCard title="The costs did not load" cause={error} onRetry={load} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="ws-panel-section" style={{ color: 'var(--ds-text-3)', fontSize: 13 }} role="status">
        Loading the costs…
      </div>
    )
  }
  return (
    <div>
      <div className="ws-panel-section" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <strong>{step.name} ·</strong>
            <span className="ds-mono" style={{ fontWeight: 600 }}>
              {money(total, data.currency)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
              {data.currency} per {unit}
            </span>
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-3)', marginTop: 2 }}>{setLine(data.set, data.of)}</span>
        </span>
      </div>
      {COST_BASIS_KINDS.map((kind) => {
        const c = data.costs.find((x) => x.kind === kind)!
        const line = c.basis ? basisLine(c.basis) : null
        const tag = c.basis ? basisTag(c.basis) : null
        const isOpen = open === kind
        const note = notes.filter((n) => n.kind === kind)
        return (
          <div key={kind} className={`ws-cost${isOpen ? ' ws-cost--open' : ''}`}>
            <button
              type="button"
              className="ws-cost-row ds-focusable"
              aria-expanded={readOnly ? undefined : isOpen}
              disabled={readOnly && c.amount === null}
              onClick={() => !readOnly && setOpen(isOpen ? null : kind)}
            >
              <span className="ws-cost-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                  <path d={KIND_ICON[kind]} />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{COST_KIND_LABEL[kind]}</span>
                {line && <span className="ds-mono ws-cost-line">{line}</span>}
                {tag && <span className={`ds-tag ds-tag--${tag.kind}`} style={{ marginTop: 4, display: 'inline-block' }}>{tag.text}</span>}
                {c.amount === null && <span className="ws-cost-line">{readOnly ? 'Not set' : 'Not set · add it'}</span>}
                {c.amount !== null && flowCount === 0 && <span className="ws-noimpact">{NO_IMPACT_LINE}</span>}
              </span>
              <span className="ds-mono" style={{ fontWeight: 600 }}>
                {c.amount === null ? '–' : money(c.amount, data.currency)}
              </span>
            </button>
            {saved && saved.kind === kind && !isOpen && (
              <div style={{ padding: '0 18px 10px' }}>
                <SavedLine>{saved.line}</SavedLine>
              </div>
            )}
            {!isOpen && note.length > 0 && (
              <FlowCostNotes step={step} notes={note} currency={data.currency} onSaved={done(kind)} onAddCost={(k) => setOpen(k)} />
            )}
            {isOpen && !readOnly && (
              <div className="ws-cost-edit">
                <CostKindEditor step={step} kind={kind} cost={c} data={data} steps={steps} onDone={done(kind)} onClose={() => setOpen(null)} />
              </div>
            )}
          </div>
        )
      })}
      {saved && saved.kind === null && (
        <div style={{ padding: '10px 18px' }}>
          <SavedLine>{saved.line}</SavedLine>
        </div>
      )}
    </div>
  )
}

type Cost = StepCosts['costs'][number]
type EditProps = { step: WorkspaceStep; cost: Cost; onDone: (line: string) => void; onClose: () => void }

/** The editor for one kind of cost: shared by the Cost view and the Inventory's step-cost rows (E4). */
export function CostKindEditor({
  step,
  kind,
  cost,
  data,
  steps = [],
  onDone,
  onClose,
}: {
  step: WorkspaceStep
  kind: CostBasisKind
  cost: Cost
  data: StepCosts
  steps?: WorkspaceStep[]
  onDone: (line: string) => void
  onClose: () => void
}) {
  const elsewhere = costedInLine(step.id, steps, kind)
  const fromFlows = kind === 'material' || kind === 'energy' ? data.from_flows?.[kind] : undefined
  if (kind === 'labor') return <LaborLookup step={step} cost={cost} onDone={onDone} onClose={onClose} />
  if (kind === 'energy') return <EnergyLookup step={step} cost={cost} fromFlows={fromFlows} elsewhere={elsewhere} onDone={onDone} onClose={onClose} />
  return <AmountEntry step={step} kind={kind} cost={cost} fromFlows={fromFlows} elsewhere={elsewhere} onDone={onDone} onClose={onClose} />
}

/** "0.8 kg × $0.95/kg = $0.76 · Steel, hot-rolled", from a preview's basis. */
export function previewText(p: CostPreview): string {
  const b = p.basis
  if (b && b.driver_quantity != null && b.rate != null) {
    const label = b.rate_label ? ` · ${b.rate_label}` : ''
    return `${amount(b.driver_quantity)}${b.driver_unit ? ` ${b.driver_unit}` : ''} × ${rateText(b.rate, b.rate_unit)} = ${money(p.amount)}${label}`
  }
  if (p.lines?.length) return `${costLinesText(p.lines)} = ${money(p.amount)}`
  return money(p.amount)
}

/** A worked-out cost waiting for Save, with its source tag; Save stores it, Cancel drops it. */
function PreviewSave({
  text,
  tag,
  saveLabel,
  busy,
  onSave,
  onCancel,
}: {
  text: string
  tag?: { kind: string; text: string } | null
  saveLabel: string
  busy: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="ws-preview" role="group" aria-label="Not saved yet">
      <span className="ds-mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
        {text}
      </span>
      {tag && <span className={`ds-tag ds-tag--${tag.kind}`}>{tag.text}</span>}
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="dark" size="small" onClick={onSave} busy={busy} aria-label={saveLabel}>
          Save
        </Button>
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ws-draft-note">Not saved yet</span>
      </span>
    </div>
  )
}

/** Save one cost; the line says what was stored ("Saved · labor $0.39 on 20. Weld tab"). */
async function saveCost(step: WorkspaceStep, kind: CostBasisKind, body: Record<string, unknown>, what?: string): Promise<{ line: string | null; error: string | null }> {
  const res = await apiRequest(`/api/components/${step.id}/costs`, { method: 'PUT', body: JSON.stringify(body) })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) return { line: null, error: d?.error ?? `Not saved (${res.status}).` }
  const stored = (d?.costs as Cost[] | undefined)?.find((c) => c.kind === kind)?.amount
  const label = what ?? COST_KIND_LABEL[kind].toLowerCase()
  return { line: `Saved · ${label}${stored != null ? ` ${money(stored)}` : ''} on ${step.name}`, error: null }
}

/**
 * Inside the material or energy sheet: what the step's flows come to, line by
 * line, with Save (E5 asks first when a cost is stored), and the flows with no
 * price ("add them to the total below"). Not offered when a step above or
 * below carries this kind already, which would count it twice.
 */
function FromFlowsInSheet({
  step,
  kind,
  s,
  stored,
  elsewhere,
  onDone,
}: {
  step: WorkspaceStep
  kind: FlowCostKind
  s?: FlowCostSuggestion
  stored: number | null
  elsewhere: string[]
  onDone: (line: string) => void
}) {
  if (!s || (s.amount === null && !s.noPrice.length)) return null
  return (
    <div className="ws-sheet-flows">
      <span className="ds-label" style={{ marginBottom: 0 }}>From this step&apos;s flows</span>
      {s.amount !== null &&
        (elsewhere.length ? (
          <span className="ds-mono" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            {costLinesText(s.lines)} = {money(s.amount)}
          </span>
        ) : (
          <FlowsCostChoice step={step} kind={kind} offer={s.amount} stored={stored} text={`${costLinesText(s.lines)} = ${money(s.amount)}`} onSaved={onDone} />
        ))}
      {elsewhere.length > 0 && (
        <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
          {COST_KIND_LABEL[kind]} is costed on {elsewhere.join(', ')}. Costing these flows here too would count it twice.
        </span>
      )}
      {s.noPrice.length > 0 && !elsewhere.length && (
        <span className="ws-flowcost-noprice">
          No price for {s.noPrice.join(', ')}. {s.amount === null ? 'Enter the cost below.' : 'To count it, enter the whole cost below.'}
        </span>
      )}
    </div>
  )
}

function SheetHead({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>{sub}</span>
      </span>
      <IconButton label="Close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </IconButton>
    </div>
  )
}

function ClearCost({ step, kind, onDone }: { step: WorkspaceStep; kind: CostBasisKind; onDone: (line: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="ds-link"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const res = await apiRequest(`/api/components/${step.id}/costs?kind=${kind}`, { method: 'DELETE' })
        setBusy(false)
        if (res.ok) onDone(`Saved · ${COST_KIND_LABEL[kind].toLowerCase()} cleared on ${step.name}`)
      }}
    >
      Clear this cost
    </button>
  )
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

/** "Look up a labor rate" (E14): hours, then a reference occupation, a state's live wage, or your own rate; Save stores the one picked. */
function LaborLookup({ step, cost, onDone, onClose }: EditProps) {
  const b = cost.basis
  // The hours a rate was used with, else the step's own (a routing gives them).
  const startHours = b?.driver_quantity ?? step.laborHours
  const [hours, setHours] = useState(startHours != null ? amount(startHours) : '')
  const [q, setQ] = useState('')
  const [state, setState] = useState('US')
  const [stateRate, setStateRate] = useState<{ soc: string; state: string; rate: number; source: string; live: boolean } | null>(null)
  const [picked, setPicked] = useState<{ soc: string; region: string; title: string; preview: CostPreview } | null>(null)
  const [own, setOwn] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const occupations = useMemo(() => Object.values(LABOR_RATES), [])
  // "Welders/cutters (51-4121)" → "Welders/cutters"; "(avg)" reads ", average".
  const name = (label: string) => label.replace(/\s*\(avg\)\s*$/, ', average').replace(/\s*\([^)]*\)\s*$/, '')
  const list = occupations.filter((o) => !q.trim() || `${o.label} ${o.soc}`.toLowerCase().includes(q.trim().toLowerCase()))
  // In use: the same occupation and place, and the same kind of figure (the US row is the reference).
  const inUse = (soc: string, region: string) =>
    b?.rate_code === soc && (b.region ?? 'US') === region && b.source_kind === (region === 'US' ? 'reference' : 'live')
  const forState = list.find((o) => o.soc === b?.rate_code) ?? list[0]

  const h = num(hours)
  const hoursOk = Number.isFinite(h) && h >= 0
  const need = () => {
    if (!hoursOk) {
      setError('Enter the hours this step takes per unit first, for example 0.015.')
      return false
    }
    setError(null)
    return true
  }
  const body = (soc: string, region: string) => ({
    kind: 'labor',
    mode: 'lookup',
    rate_code: soc,
    region,
    driver_quantity: h,
    driver_unit: 'h',
    ...(region === 'US' ? { prefer: 'reference' } : {}),
  })

  // Pick a rate: the server works the cost out, and nothing is stored until Save.
  const pick = async (soc: string, region: string, title: string) => {
    if (!need()) return
    setBusy(`${soc}-${region}`)
    const r = await previewCost(step.id, body(soc, region))
    setBusy(null)
    if (r.error || !r.preview) return setError(r.error ?? 'The rate did not work out.')
    setPicked({ soc, region, title, preview: r.preview })
  }

  const savePicked = async (): Promise<boolean> => {
    if (!picked || !need()) return false
    setBusy('save')
    const r = await saveCost(step, 'labor', body(picked.soc, picked.region))
    setBusy(null)
    if (r.error) return setError(r.error), false
    onDone(r.line!)
    return true
  }

  const look = async (st: string) => {
    setState(st)
    setStateRate(null)
    if (st === 'US' || !forState) return
    setBusy('preview')
    setError(null)
    const res = await apiRequest('/api/integrations/bls/fetch-wage', {
      method: 'POST',
      body: JSON.stringify({ occupation: forState.soc, state: st }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return setError(d?.error ?? `The wage lookup failed (${res.status}).`)
    const source = String(d?.rate?.source ?? '')
    setStateRate({ soc: forState.soc, state: st, rate: Number(d?.rate?.rateValue), source, live: !/reference/i.test(source) })
  }

  const r = num(own)
  const ownOk = own.trim() !== '' && Number.isFinite(r) && r >= 0
  const saveOwn = async (): Promise<boolean> => {
    if (!need()) return false
    if (!ownOk) return setError('Enter your rate in dollars per hour, for example 24.50.'), false
    setBusy('own')
    const res = await saveCost(step, 'labor', { kind: 'labor', mode: 'entered', driver_quantity: h, driver_unit: 'h', rate: r, rate_unit: '$/h', rate_label: 'Own rate' }, 'your own labor rate')
    setBusy(null)
    if (res.error) return setError(res.error), false
    onDone(res.line!)
    return true
  }

  useUnsavedEdit(`labor-${step.id}`, !!picked || ownOk, {
    label: `the labor cost on ${step.name}`,
    save: () => (picked ? savePicked() : saveOwn()),
    discard: () => (setPicked(null), setOwn('')),
  })

  return (
    <div className="ws-lookup">
      <SheetHead title="Look up a labor rate" sub={`For ${step.name}${hoursOk ? ` · ${amount(h)} h` : ''}`} onClose={onClose} />
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Hours per unit
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={hours} placeholder="0.015" onChange={(e) => (setHours(e.target.value), setPicked(null))} />
      </label>
      <div className="ws-lookup-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input aria-label="Find an occupation" value={q} placeholder="welder" onChange={(e) => setQ(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>Wages · BLS</span>
      </div>
      <ul className="ws-lookup-list" aria-label="Occupations">
        {list.map((o) => (
          <RateRow
            key={o.soc}
            title={`${name(o.label)} · US`}
            code={o.soc}
            tag={{ kind: 'reference', text: `Reference ${REFERENCE_VINTAGE}` }}
            rate={rateText(o.rate, '$/h')}
            inUse={inUse(o.soc, 'US')}
            picked={picked?.soc === o.soc && picked.region === 'US'}
            busy={busy === `${o.soc}-US`}
            onPick={() => pick(o.soc, 'US', `${name(o.label)} · US`)}
          />
        ))}
        {stateRate && forState && (
          <RateRow
            title={`${name(forState.label)} · ${stateName(stateRate.state)}`}
            code={stateRate.soc}
            tag={stateRate.live ? { kind: 'regional', text: `${stateRate.source} · live` } : { kind: 'reference', text: `Reference ${REFERENCE_VINTAGE}, no state figure` }}
            rate={rateText(stateRate.rate, '$/h')}
            inUse={inUse(stateRate.soc, stateRate.state)}
            picked={picked?.soc === stateRate.soc && picked.region === stateRate.state}
            busy={busy === `${stateRate.soc}-${stateRate.state}`}
            onPick={() => pick(stateRate.soc, stateRate.state, `${name(forState.label)} · ${stateName(stateRate.state)}`)}
          />
        )}
        {!list.length && <li style={{ fontSize: 13, color: 'var(--ds-text-3)', padding: '8px 0' }}>No occupation matches. Enter your own rate below.</li>}
      </ul>
      {picked && (
        <PreviewSave
          text={previewText(picked.preview)}
          tag={picked.preview.basis ? basisTag(picked.preview.basis) : null}
          saveLabel={`Save the labor cost: ${picked.title}`}
          busy={busy === 'save'}
          onSave={() => void savePicked()}
          onCancel={() => setPicked(null)}
        />
      )}
      {forState && (
        <label className="ds-label" style={{ marginBottom: 0 }}>
          Wages for {name(forState.label).toLowerCase()} in
          <select className="ds-input" style={{ width: '100%', marginTop: 4 }} value={state} onChange={(e) => look(e.target.value)} disabled={busy === 'preview'}>
            <option value="US">The whole US (reference)</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {stateName(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      {busy === 'preview' && (
        <span role="status" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
          Asking BLS…
        </span>
      )}
      <div>
        <span className="ds-label">Or enter your own rate</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ws-money-input">
            <span aria-hidden>$</span>
            <input aria-label="Your rate in dollars per hour" inputMode="decimal" value={own} placeholder="0.00" onChange={(e) => (setOwn(e.target.value), setPicked(null))} />
            <span aria-hidden>/ h</span>
          </span>
          <Button onClick={() => void saveOwn()} busy={busy === 'own'} disabled={!ownOk} aria-label="Save your own labor rate">
            Save
          </Button>
        </span>
        {ownOk && hoursOk && (
          <span className="ds-mono ws-preview-line">
            {amount(h)} h × {rateText(r, '$/h')} = {money(costAmount(h, r))} · not saved yet
          </span>
        )}
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>
        Live from BLS when it answers. If not, the dated reference rate is used and tagged Reference.
      </p>
      {cost.amount !== null && <ClearCost step={step} kind="labor" onDone={onDone} />}
    </div>
  )
}

function RateRow({
  title,
  code,
  tag,
  rate,
  inUse,
  picked,
  busy,
  onPick,
}: {
  title: string
  code: string
  tag: { kind: string; text: string }
  rate: string
  inUse: boolean
  picked: boolean
  busy: boolean
  onPick: () => void
}) {
  return (
    <li className={`ws-rate${inUse ? ' ws-rate--in-use' : ''}${picked ? ' ws-rate--picked' : ''}`}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{title}</span>
        <span className="ds-mono" style={{ fontSize: 12, color: 'var(--ds-text-2)', marginRight: 8 }}>
          {code}
        </span>
        <span className={`ds-tag ds-tag--${tag.kind}`}>{tag.text}</span>
      </span>
      <span className="ds-mono" style={{ fontWeight: 600 }}>
        {rate}
      </span>
      {inUse ? (
        <span style={{ color: 'var(--ds-green)', fontWeight: 600, fontSize: 13, minWidth: 64 }}>✓ In use</span>
      ) : picked ? (
        <span style={{ color: 'var(--ds-text-2)', fontWeight: 600, fontSize: 13, minWidth: 64 }}>Picked</span>
      ) : (
        <Button size="small" onClick={onPick} busy={busy} aria-label={`Pick ${title}`}>
          Pick
        </Button>
      )}
    </li>
  )
}

const ENERGY_UNITS: Record<'electricity' | 'natural_gas', string[]> = {
  electricity: ['kWh', 'MWh', 'MJ'],
  natural_gas: ['m3', 'MMBtu', 'kWh'],
}

/** Energy: an amount of a carrier, priced live by EIA when it answers, else the dated reference; Save stores it. */
function EnergyLookup({ step, cost, fromFlows, elsewhere = [], onDone, onClose }: EditProps & { fromFlows?: FlowCostSuggestion; elsewhere?: string[] }) {
  const b = cost.basis
  const [carrier, setCarrier] = useState<'electricity' | 'natural_gas'>(b?.rate_code === 'natural_gas' ? 'natural_gas' : 'electricity')
  const [qty, setQty] = useState(b?.driver_quantity != null ? amount(b.driver_quantity) : '')
  const [unit, setUnit] = useState(b?.driver_unit && ENERGY_UNITS[carrier].includes(b.driver_unit) ? b.driver_unit : ENERGY_UNITS[carrier][0])
  const [region, setRegion] = useState(b?.region ?? 'US')
  const [own, setOwn] = useState('')
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const q = num(qty)
  const lookupBody = { kind: 'energy', mode: 'lookup', rate_code: carrier, region, driver_quantity: q, driver_unit: unit }
  const r = num(own)
  const ownOk = own.trim() !== '' && Number.isFinite(r) && r >= 0
  const qtyOk = Number.isFinite(q) && q >= 0
  const needQty = () => (qtyOk ? true : (setError(`Enter the ${carrier === 'electricity' ? 'electricity' : 'gas'} this step uses per unit.`), false))

  const look = async () => {
    if (!needQty()) return
    setBusy('lookup')
    setError(null)
    const res = await previewCost(step.id, lookupBody)
    setBusy(null)
    if (res.error || !res.preview) return setError(res.error ?? 'The price did not work out.')
    setPreview(res.preview)
  }
  const saveLookup = async (): Promise<boolean> => {
    if (!needQty()) return false
    setBusy('save')
    const res = await saveCost(step, 'energy', lookupBody)
    setBusy(null)
    if (res.error) return setError(res.error), false
    onDone(res.line!)
    return true
  }
  const saveOwn = async (): Promise<boolean> => {
    if (!needQty()) return false
    if (!ownOk) return setError(`Enter your price in dollars per ${unit}.`), false
    setBusy('entered')
    setError(null)
    const res = await saveCost(step, 'energy', {
      kind: 'energy',
      mode: 'entered',
      driver_quantity: q,
      driver_unit: unit,
      rate: r,
      rate_unit: `$/${unit}`,
      rate_label: carrier === 'electricity' ? 'Electricity, own price' : 'Natural gas, own price',
    })
    setBusy(null)
    if (res.error) return setError(res.error), false
    onDone(res.line!)
    return true
  }
  const changed = () => setPreview(null)

  useUnsavedEdit(`energy-${step.id}`, !!preview || ownOk, {
    label: `the energy cost on ${step.name}`,
    save: () => (preview ? saveLookup() : saveOwn()),
    discard: () => (setPreview(null), setOwn('')),
  })

  return (
    <div className="ws-lookup">
      <SheetHead title="Price the energy" sub={`For ${step.name}`} onClose={onClose} />
      <FromFlowsInSheet step={step} kind="energy" s={fromFlows} stored={cost.amount} elsewhere={elsewhere} onDone={onDone} />
      <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="ds-label" style={{ marginBottom: 0 }}>
          Carrier
          <select
            className="ds-input"
            style={{ width: '100%', marginTop: 4 }}
            value={carrier}
            onChange={(e) => {
              const c = e.target.value as 'electricity' | 'natural_gas'
              setCarrier(c)
              setUnit(ENERGY_UNITS[c][0])
              changed()
            }}
          >
            <option value="electricity">Electricity</option>
            <option value="natural_gas">Natural gas</option>
          </select>
        </label>
        <label className="ds-label" style={{ marginBottom: 0 }}>
          Where
          <select className="ds-input" style={{ width: '100%', marginTop: 4 }} value={region} onChange={(e) => (setRegion(e.target.value), changed())}>
            <option value="US">The whole US</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {stateName(s)}
              </option>
            ))}
          </select>
        </label>
      </span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label className="ds-label" style={{ marginBottom: 0, flex: 1 }}>
          Amount per unit
          <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={qty} onChange={(e) => (setQty(e.target.value), changed())} />
        </label>
        <select className="ds-input" aria-label="Energy unit" value={unit} onChange={(e) => (setUnit(e.target.value), changed())}>
          {ENERGY_UNITS[carrier].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <Button variant="dark" onClick={look} busy={busy === 'lookup'}>
          Look up the price
        </Button>
      </span>
      {preview && (
        <PreviewSave
          text={previewText(preview)}
          tag={preview.basis ? basisTag(preview.basis) : null}
          saveLabel="Save the energy cost"
          busy={busy === 'save'}
          onSave={() => void saveLookup()}
          onCancel={() => setPreview(null)}
        />
      )}
      <div>
        <span className="ds-label">Or enter your own price</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ws-money-input">
            <span aria-hidden>$</span>
            <input aria-label={`Your price in dollars per ${unit}`} inputMode="decimal" value={own} placeholder="0.00" onChange={(e) => (setOwn(e.target.value), changed())} />
            <span aria-hidden>/ {unit}</span>
          </span>
          <Button onClick={() => void saveOwn()} busy={busy === 'entered'} disabled={!ownOk} aria-label="Save your own energy price">
            Save
          </Button>
        </span>
        {ownOk && qtyOk && (
          <span className="ds-mono ws-preview-line">
            {amount(q)} {unit} × {rateText(r, `$/${unit}`)} = {money(costAmount(q, r))} · not saved yet
          </span>
        )}
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>
        Live from EIA when it answers. If not, the dated reference price is used and tagged Reference.
      </p>
      {cost.amount !== null && <ClearCost step={step} kind="energy" onDone={onDone} />}
    </div>
  )
}

const METALS = Object.entries(METAL_NAME).map(([symbol, name]) => ({ symbol, name }))

/**
 * Material: kilograms of a metal, priced live by Metals-API when it answers,
 * else the metal's dated reference price. A metal with neither (lead, tin) is
 * refused by the server with a reason, and your own price per kg is the way on.
 * Looking it up shows the number; Save stores it.
 */
function MetalLookup({ step, cost, onDone }: EditProps) {
  const b = cost.basis
  const [metal, setMetal] = useState(b?.rate_code && METAL_NAME[b.rate_code] ? b.rate_code : METALS[0].symbol)
  const [qty, setQty] = useState(b?.driver_unit === 'kg' && b.driver_quantity != null ? amount(b.driver_quantity) : '')
  const [own, setOwn] = useState('')
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = METAL_NAME[metal]
  const q = num(qty)
  const qtyOk = Number.isFinite(q) && q >= 0
  const r = num(own)
  const ownOk = own.trim() !== '' && Number.isFinite(r) && r >= 0
  const lookupBody = { kind: 'material', mode: 'lookup', rate_code: metal, driver_quantity: q, driver_unit: 'kg' }
  const needQty = () => (qtyOk ? true : (setError(`Enter the kilograms of ${name.toLowerCase()} this step uses per unit.`), false))

  const look = async () => {
    if (!needQty()) return
    setBusy('lookup')
    setError(null)
    const res = await previewCost(step.id, lookupBody)
    setBusy(null)
    if (res.error || !res.preview) return setError(res.error ?? 'The price did not work out.')
    setPreview(res.preview)
  }
  const saveLookup = async (): Promise<boolean> => {
    if (!needQty()) return false
    setBusy('save')
    const res = await saveCost(step, 'material', lookupBody)
    setBusy(null)
    if (res.error) return setError(res.error), false
    onDone(res.line!)
    return true
  }
  const saveOwn = async (): Promise<boolean> => {
    if (!needQty()) return false
    if (!ownOk) return setError('Enter your price in dollars per kg.'), false
    setBusy('entered')
    setError(null)
    const res = await saveCost(step, 'material', { kind: 'material', mode: 'entered', driver_quantity: q, driver_unit: 'kg', rate: r, rate_unit: '$/kg', rate_label: `${name}, own price` })
    setBusy(null)
    if (res.error) return setError(res.error), false
    onDone(res.line!)
    return true
  }

  useUnsavedEdit(`metal-${step.id}`, !!preview || ownOk, {
    label: `the material cost on ${step.name}`,
    save: () => (preview ? saveLookup() : saveOwn()),
    discard: () => (setPreview(null), setOwn('')),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="ds-label" style={{ marginBottom: 0 }}>
          Metal
          <select className="ds-input" style={{ width: '100%', marginTop: 4 }} value={metal} onChange={(e) => (setMetal(e.target.value), setPreview(null), setError(null))}>
            {METALS.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ds-label" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
          Kilograms per unit
          <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={qty} placeholder="0.8" onChange={(e) => (setQty(e.target.value), setPreview(null))} />
        </label>
        <Button variant="dark" onClick={look} busy={busy === 'lookup'} aria-label={`Look up the price of ${name.toLowerCase()}`}>
          Look up the price
        </Button>
      </span>
      {preview && (
        <PreviewSave
          text={previewText(preview)}
          tag={preview.basis ? basisTag(preview.basis) : null}
          saveLabel={`Save the price of ${name.toLowerCase()}`}
          busy={busy === 'save'}
          onSave={() => void saveLookup()}
          onCancel={() => setPreview(null)}
        />
      )}
      <div>
        <span className="ds-label">Or enter your own price</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ws-money-input">
            <span aria-hidden>$</span>
            <input aria-label={`Your price for ${name.toLowerCase()} in dollars per kg`} inputMode="decimal" value={own} placeholder="0.00" onChange={(e) => (setOwn(e.target.value), setPreview(null))} />
            <span aria-hidden>/ kg</span>
          </span>
          <Button onClick={() => void saveOwn()} busy={busy === 'entered'} disabled={!ownOk} aria-label={`Save your price for ${name.toLowerCase()}`}>
            Save
          </Button>
        </span>
        {ownOk && qtyOk && (
          <span className="ds-mono ws-preview-line">
            {amount(q)} kg × {rateText(r, '$/kg')} = {money(costAmount(q, r))} · not saved yet
          </span>
        )}
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>
        Live from Metals-API when it answers. If not, the dated reference price is used and tagged Reference.
      </p>
    </div>
  )
}

/** Material, transport, equipment, overhead: the amount, and where it comes from. */
function AmountEntry({
  step,
  kind,
  cost,
  fromFlows,
  elsewhere = [],
  onDone,
  onClose,
}: EditProps & { kind: CostBasisKind; fromFlows?: FlowCostSuggestion; elsewhere?: string[] }) {
  const start = cost.amount != null ? amount(cost.amount) : ''
  const startSource = cost.basis?.source_name ?? ''
  const [value, setValue] = useState(start)
  const [source, setSource] = useState(startSource)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = COST_KIND_LABEL[kind].toLowerCase()
  const submit = async (): Promise<boolean> => {
    const v = num(value)
    if (!Number.isFinite(v) || v < 0) return setError(`Enter the ${label} cost per unit in dollars, for example 0.12.`), false
    setBusy(true)
    setError(null)
    const err = await putCost(step.id, { kind, mode: 'entered', amount: v, ...(source.trim() ? { source_name: source.trim() } : {}) })
    setBusy(false)
    if (err) return setError(err), false
    onDone(`Saved · ${label} on ${step.name}: ${money(v)}`)
    return true
  }
  useUnsavedEdit(`amount-${step.id}-${kind}`, value !== start || source !== startSource, {
    label: `the ${label} cost on ${step.name}`,
    save: submit,
    discard: () => (setValue(start), setSource(startSource)),
  })
  return (
    <div className="ws-lookup">
      <SheetHead title={`Set the ${label} cost`} sub={`For ${step.name}, per unit`} onClose={onClose} />
      {kind === 'material' && <FromFlowsInSheet step={step} kind="material" s={fromFlows} stored={cost.amount} elsewhere={elsewhere} onDone={onDone} />}
      {kind === 'material' && <MetalLookup step={step} cost={cost} onDone={onDone} onClose={onClose} />}
      {kind === 'material' && <span className="ds-label" style={{ marginBottom: 0 }}>Or enter the whole material cost</span>}
      <span className="ws-money-input">
        <span aria-hidden>$</span>
        <input aria-label={`${COST_KIND_LABEL[kind]} cost in dollars`} inputMode="decimal" value={value} placeholder="0.00" onChange={(e) => setValue(e.target.value)} />
      </span>
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Where it comes from (optional)
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} maxLength={120} value={source} placeholder="e.g. the 2025 supplier quote" onChange={(e) => setSource(e.target.value)} />
      </label>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="dark" onClick={() => void submit()} busy={busy}>
          Save
        </Button>
        {cost.amount !== null && <ClearCost step={step} kind={kind} onDone={onDone} />}
      </span>
    </div>
  )
}
