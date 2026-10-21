'use client'

// The step panel in Cost view (E14): the step's cost per reference unit, "N of
// 6 set", and each of the six kinds with how it was built (hours × rate, its
// source tag). Labor opens "Look up a labor rate": a reference occupation, a
// state's live BLS wage, or your own rate. Energy looks up a carrier's price.
// The other kinds take an amount. Every save goes through the costs route,
// which stores the amount and the basis together. Material and energy also
// offer the cost from the step's flows (one click, never on its own).

import { perUnit } from '@/lib/workspace/per-unit'
import { useMemo, useState, type ReactNode } from 'react'
import { Button, ErrorCard, IconButton, SavedLine } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { announceComponentsChanged } from '@/lib/case-editor/use-flows'
import { US_STATES } from '@/lib/case-editor/use-labor-rate'
import { LABOR_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates'
import { COST_BASIS_KINDS, type CostBasisKind } from '@/lib/costs/cost-basis'
import type { FlowCostSuggestion } from '@/lib/costs/from-flows'
import { amount, money } from '@/lib/ui/format'
import { stateName } from '@/lib/ui/us-states'
import { COST_KIND_LABEL, basisLine, basisTag, costLinesText, rateText, setLine } from '@/lib/workspace/cost-text'
import { costedInLine, flowCostNotes, type FlowCostKind } from '@/lib/workspace/flow-cost-text'
import { putCost, useStepCosts, type StepCosts } from '@/lib/workspace/use-step-costs'
import type { WorkspaceCase, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { FlowCostNotes, applyFlowsCost } from './flow-cost-notes'

const KIND_ICON: Record<CostBasisKind, string> = {
  labor: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  energy: 'M13 3 5 14h6l-1 7 8-11h-6z',
  material: 'M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8',
  transportation: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  equipment: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  overhead: 'M4 20V9l8-5 8 5v11zM9 20v-6h6v6',
}

export function CostPanel({
  step,
  kase,
  readOnly,
  aside,
  initialOpen = null,
  steps = [],
}: {
  step: WorkspaceStep
  kase: WorkspaceCase
  /** The case's steps, to see which kinds a step above or below already carries. */
  steps?: WorkspaceStep[]
  readOnly: boolean
  /** The Flows · Cost switch, at the end of the header line (E14). */
  aside?: ReactNode
  /** A kind to open on arrival ("No price for Argon: add its cost" opens Material). */
  initialOpen?: CostBasisKind | null
}) {
  const { data, error, load } = useStepCosts(step.id)
  const [open, setOpen] = useState<CostBasisKind | null>(readOnly ? null : initialOpen)
  const [saved, setSaved] = useState<string | null>(null)
  const total = data ? data.costs.reduce((s, c) => s + (c.amount ?? 0), 0) : null
  const unit = perUnit(kase)
  const inLine = (kind: CostBasisKind) => costedInLine(step.id, steps, kind)
  const notes = data && !readOnly ? flowCostNotes(data.costs, data.from_flows, inLine) : []

  // The page reloads on the announcement, this panel with it (useStepCosts).
  const done = (line: string) => {
    setSaved(line)
    setOpen(null)
    announceComponentsChanged()
  }
  const flowsOf = (kind: CostBasisKind) => (kind === 'material' || kind === 'energy' ? data?.from_flows?.[kind] : undefined)

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
        {aside}
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
              </span>
              <span className="ds-mono" style={{ fontWeight: 600 }}>
                {c.amount === null ? '–' : money(c.amount, data.currency)}
              </span>
            </button>
            {!isOpen && note.length > 0 && (
              <FlowCostNotes step={step} notes={note} currency={data.currency} onSaved={done} onAddCost={(k) => setOpen(k)} />
            )}
            {isOpen && !readOnly && (
              <div className="ws-cost-edit">
                {kind === 'labor' ? (
                  <LaborLookup step={step} cost={c} onDone={done} onClose={() => setOpen(null)} />
                ) : kind === 'energy' ? (
                  <EnergyLookup step={step} cost={c} fromFlows={flowsOf(kind)} elsewhere={inLine(kind)} onDone={done} onClose={() => setOpen(null)} />
                ) : (
                  <AmountEntry step={step} kind={kind} cost={c} fromFlows={flowsOf(kind)} elsewhere={inLine(kind)} onDone={done} onClose={() => setOpen(null)} />
                )}
              </div>
            )}
          </div>
        )
      })}
      {saved && (
        <div style={{ padding: '10px 18px' }}>
          <SavedLine>{saved}</SavedLine>
        </div>
      )}
    </div>
  )
}

type Cost = StepCosts['costs'][number]
type EditProps = { step: WorkspaceStep; cost: Cost; onDone: (line: string) => void; onClose: () => void }

/**
 * Inside the material or energy sheet: what the step's flows come to, line by
 * line, with Use it, and the flows with no price ("add them to the total
 * below"). Shown whatever the cost is now, so a number entered by hand can
 * still be swapped for the flows' one; not offered when a step above or
 * below carries this kind already, which would count it twice.
 */
function FromFlowsInSheet({
  step,
  kind,
  s,
  elsewhere,
  onDone,
}: {
  step: WorkspaceStep
  kind: FlowCostKind
  s?: FlowCostSuggestion
  elsewhere: string[]
  onDone: (line: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!s || (s.amount === null && !s.noPrice.length)) return null
  const use = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await applyFlowsCost(step, kind))
    } catch (e: any) {
      setError(e?.message ?? 'Not saved.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="ws-sheet-flows">
      <span className="ds-label" style={{ marginBottom: 0 }}>From this step's flows</span>
      {s.amount !== null && (
        <span className="ws-flowcost-offer">
          <span className="ds-mono" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            {costLinesText(s.lines)} = {money(s.amount)}
          </span>
          {!elsewhere.length && (
            <Button size="small" onClick={use} busy={busy} aria-label={`Use the ${COST_KIND_LABEL[kind].toLowerCase()} cost from these flows`}>
              Use it
            </Button>
          )}
        </span>
      )}
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
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
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

/** "Look up a labor rate" (E14): hours, then a reference occupation, a state's live wage, or your own rate. */
function LaborLookup({ step, cost, onDone, onClose }: EditProps) {
  const b = cost.basis
  // The hours a rate was used with, else the step's own (a routing gives them).
  const startHours = b?.driver_quantity ?? step.laborHours
  const [hours, setHours] = useState(startHours != null ? amount(startHours) : '')
  const [q, setQ] = useState('')
  const [state, setState] = useState('US')
  const [preview, setPreview] = useState<{ soc: string; state: string; rate: number; source: string; live: boolean } | null>(null)
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

  // A US row is the dated reference it shows; a state row is the live wage it previewed.
  const use = async (soc: string, region: string) => {
    if (!need()) return
    setBusy(`${soc}-${region}`)
    const err = await putCost(step.id, {
      kind: 'labor',
      mode: 'lookup',
      rate_code: soc,
      region,
      driver_quantity: h,
      driver_unit: 'h',
      ...(region === 'US' ? { prefer: 'reference' } : {}),
    })
    setBusy(null)
    if (err) return setError(err)
    onDone(`Saved · labor on ${step.name}`)
  }

  const look = async (st: string) => {
    setState(st)
    setPreview(null)
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
    setPreview({ soc: forState.soc, state: st, rate: Number(d?.rate?.rateValue), source, live: !/reference/i.test(source) })
  }

  const useOwn = async () => {
    const r = num(own)
    if (!need()) return
    if (!Number.isFinite(r) || r < 0) return setError('Enter your rate in dollars per hour, for example 24.50.')
    setBusy('own')
    const err = await putCost(step.id, {
      kind: 'labor',
      mode: 'entered',
      driver_quantity: h,
      driver_unit: 'h',
      rate: r,
      rate_unit: '$/h',
      rate_label: 'Own rate',
    })
    setBusy(null)
    if (err) return setError(err)
    onDone(`Saved · your own labor rate on ${step.name}`)
  }

  return (
    <div className="ws-lookup">
      <SheetHead title="Look up a labor rate" sub={`For ${step.name}${hoursOk ? ` · ${amount(h)} h` : ''}`} onClose={onClose} />
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Hours per unit
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={hours} placeholder="0.015" onChange={(e) => setHours(e.target.value)} />
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
            busy={busy === `${o.soc}-US`}
            onUse={() => use(o.soc, 'US')}
          />
        ))}
        {preview && forState && (
          <RateRow
            title={`${name(forState.label)} · ${stateName(preview.state)}`}
            code={preview.soc}
            tag={preview.live ? { kind: 'regional', text: `${preview.source} · live` } : { kind: 'reference', text: `Reference ${REFERENCE_VINTAGE}, no state figure` }}
            rate={rateText(preview.rate, '$/h')}
            inUse={inUse(preview.soc, preview.state)}
            busy={busy === `${preview.soc}-${preview.state}`}
            onUse={() => use(preview.soc, preview.state)}
          />
        )}
        {!list.length && <li style={{ fontSize: 13, color: 'var(--ds-text-3)', padding: '8px 0' }}>No occupation matches. Enter your own rate below.</li>}
      </ul>
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
        <span style={{ display: 'flex', gap: 8 }}>
          <span className="ws-money-input">
            <span aria-hidden>$</span>
            <input aria-label="Your rate in dollars per hour" inputMode="decimal" value={own} placeholder="0.00" onChange={(e) => setOwn(e.target.value)} />
            <span aria-hidden>/ h</span>
          </span>
          <Button onClick={useOwn} busy={busy === 'own'}>
            Use
          </Button>
        </span>
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
  busy,
  onUse,
}: {
  title: string
  code: string
  tag: { kind: string; text: string }
  rate: string
  inUse: boolean
  busy: boolean
  onUse: () => void
}) {
  return (
    <li className={`ws-rate${inUse ? ' ws-rate--in-use' : ''}`}>
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
      ) : (
        <Button size="small" onClick={onUse} busy={busy} aria-label={`Use ${title}`}>
          Use
        </Button>
      )}
    </li>
  )
}

const ENERGY_UNITS: Record<'electricity' | 'natural_gas', string[]> = {
  electricity: ['kWh', 'MWh', 'MJ'],
  natural_gas: ['m3', 'MMBtu', 'kWh'],
}

/** Energy: an amount of a carrier, priced live by EIA when it answers, else the dated reference. */
function EnergyLookup({ step, cost, fromFlows, elsewhere = [], onDone, onClose }: EditProps & { fromFlows?: FlowCostSuggestion; elsewhere?: string[] }) {
  const b = cost.basis
  const [carrier, setCarrier] = useState<'electricity' | 'natural_gas'>(b?.rate_code === 'natural_gas' ? 'natural_gas' : 'electricity')
  const [qty, setQty] = useState(b?.driver_quantity != null ? amount(b.driver_quantity) : '')
  const [unit, setUnit] = useState(b?.driver_unit && ENERGY_UNITS[carrier].includes(b.driver_unit) ? b.driver_unit : ENERGY_UNITS[carrier][0])
  const [region, setRegion] = useState(b?.region ?? 'US')
  const [own, setOwn] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const q = num(qty)

  const submit = async (mode: 'lookup' | 'entered') => {
    if (!Number.isFinite(q) || q < 0) return setError(`Enter the ${carrier === 'electricity' ? 'electricity' : 'gas'} this step uses per unit.`)
    const r = num(own)
    if (mode === 'entered' && (!Number.isFinite(r) || r < 0)) return setError(`Enter your price in dollars per ${unit}.`)
    setBusy(mode)
    setError(null)
    const err = await putCost(
      step.id,
      mode === 'lookup'
        ? { kind: 'energy', mode, rate_code: carrier, region, driver_quantity: q, driver_unit: unit }
        : { kind: 'energy', mode, driver_quantity: q, driver_unit: unit, rate: r, rate_unit: `$/${unit}`, rate_label: carrier === 'electricity' ? 'Electricity, own price' : 'Natural gas, own price' },
    )
    setBusy(null)
    if (err) return setError(err)
    onDone(`Saved · energy on ${step.name}`)
  }

  return (
    <div className="ws-lookup">
      <SheetHead title="Price the energy" sub={`For ${step.name}`} onClose={onClose} />
      <FromFlowsInSheet step={step} kind="energy" s={fromFlows} elsewhere={elsewhere} onDone={onDone} />
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
            }}
          >
            <option value="electricity">Electricity</option>
            <option value="natural_gas">Natural gas</option>
          </select>
        </label>
        <label className="ds-label" style={{ marginBottom: 0 }}>
          Where
          <select className="ds-input" style={{ width: '100%', marginTop: 4 }} value={region} onChange={(e) => setRegion(e.target.value)}>
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
          <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <select className="ds-input" aria-label="Energy unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {ENERGY_UNITS[carrier].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <Button variant="dark" onClick={() => submit('lookup')} busy={busy === 'lookup'}>
          Look up the price
        </Button>
      </span>
      <div>
        <span className="ds-label">Or enter your own price</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <span className="ws-money-input">
            <span aria-hidden>$</span>
            <input aria-label={`Your price in dollars per ${unit}`} inputMode="decimal" value={own} placeholder="0.00" onChange={(e) => setOwn(e.target.value)} />
            <span aria-hidden>/ {unit}</span>
          </span>
          <Button onClick={() => submit('entered')} busy={busy === 'entered'}>
            Use
          </Button>
        </span>
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
  const [value, setValue] = useState(cost.amount != null ? amount(cost.amount) : '')
  const [source, setSource] = useState(cost.basis?.source_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = COST_KIND_LABEL[kind].toLowerCase()
  const submit = async () => {
    const v = num(value)
    if (!Number.isFinite(v) || v < 0) return setError(`Enter the ${label} cost per unit in dollars, for example 0.12.`)
    setBusy(true)
    setError(null)
    const err = await putCost(step.id, { kind, mode: 'entered', amount: v, ...(source.trim() ? { source_name: source.trim() } : {}) })
    setBusy(false)
    if (err) return setError(err)
    onDone(`Saved · ${label} on ${step.name}`)
  }
  return (
    <div className="ws-lookup">
      <SheetHead title={`Set the ${label} cost`} sub={`For ${step.name}, per unit`} onClose={onClose} />
      {kind === 'material' && <FromFlowsInSheet step={step} kind="material" s={fromFlows} elsewhere={elsewhere} onDone={onDone} />}
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
        <Button variant="dark" onClick={submit} busy={busy}>
          Save
        </Button>
        {cost.amount !== null && <ClearCost step={step} kind={kind} onDone={onDone} />}
      </span>
    </div>
  )
}
