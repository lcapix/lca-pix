'use client'

// The pieces a flow row shares between the step panel (E03) and the Inventory
// table (E04): one draft per flow (amount, unit, direction, substance, the
// step it is on) that only Save stores, the row's arithmetic and source words,
// your own factor on any flow, and going back to the library factor.
//
// The rules (B1, A1, A2): nothing saves on Enter, on leaving a box or on
// picking from a list; Save stores the draft and its Saved line says what was
// stored. A unit change converts the amount in the box (0.035 kg becomes 35
// g) before Save; units that cannot convert are refused with the reason.

import { STAGES, stageLabel } from '@/lib/life-cycle'
import { useEffect, useMemo, useState } from 'react'
import { Button, Callout, SavedLine, SourceTag } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { announceComponentsChanged, useSubstanceCatalog } from '@/lib/case-editor/use-flows'
import { searchSubstances } from '@/lib/case-editor/substance-search'
import { substanceSource } from '@/lib/substance-source'
import { amountBox, co2Unit, result3 } from '@/lib/ui/format'
import { compatibleUnits } from '@/lib/units'
import { amountChanged, convertForUnitChange, directionWord, factorText, perUnitText, readAmount } from '@/lib/workspace/flow-edit'
import type { InventoryRow } from '@/lib/workspace/inventory'
import { useUnsavedEdit } from '@/lib/workspace/unsaved'

/** The one line a read-only case gives under its boxes (C4). */
export const READ_ONLY_LINE = 'Read-only: make your own copy to change it.'

/**
 * Save a flow's amount as typed: empty clears it ("Needs an amount"), else a
 * number of 0 or more. Nothing is sent when it did not change.
 */
export async function saveFlowAmount(
  row: Pick<InventoryRow, 'flow_id' | 'amount'> & { unit?: string },
  typed: string,
  /** The amount this tab last knew (3.10); a 409 hands back the amount now, which a second save sends. */
  known: number | null = row.amount,
): Promise<{ saved: boolean; amount: number | null; error: string | null; current?: number | null }> {
  const trimmed = typed.trim()
  const next = trimmed === '' ? null : Number(trimmed)
  if (next !== null && (!Number.isFinite(next) || next < 0)) {
    return { saved: false, amount: row.amount, error: 'Enter an amount of 0 or more, or leave it empty for now.' }
  }
  if (next === known) return { saved: false, amount: next, error: null }
  // The box shows a rounded amount (at most 4 decimals): text left as shown is
  // no change, never a save of the rounded number (0.00015 would become 0.0002).
  if (trimmed === amountBox(known)) return { saved: false, amount: known, error: null }
  const res = await apiRequest(`/api/flows/${row.flow_id}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity: next, expected_quantity: known, ...(row.unit ? { expected_unit: row.unit } : {}) }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    if (res.status === 409 && d?.current) {
      const now = d.current.quantity == null ? 'no amount' : `${d.current.quantity} ${d.current.unit ?? row.unit ?? ''}`.trim()
      return {
        saved: false,
        amount: row.amount,
        current: d.current.quantity ?? null,
        error: `This flow changed in another tab or by someone else: it is now ${now}. Save again to replace it.`,
      }
    }
    return { saved: false, amount: row.amount, error: d?.error ?? `The amount was not saved (${res.status}).` }
  }
  announceComponentsChanged()
  return { saved: true, amount: next, error: null }
}

export async function deleteFlow(flowId: number): Promise<string | null> {
  const res = await apiRequest(`/api/flows/${flowId}`, { method: 'DELETE' })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return d?.error ?? `The flow was not deleted (${res.status}).`
  }
  announceComponentsChanged()
  return null
}

/** The unit the row's factor is stated per (the engine's basis). */
export function perOf(row: InventoryRow): string {
  return row.climate?.per ?? row.unit
}

/**
 * "0.8 kg × 1.9 kg CO₂-eq per kg = 1.520 kg CO₂-eq", with the conversion when
 * the amount was in another unit; no factor: "0.02 kg × no factor = 0".
 */
export function rowSum(row: InventoryRow): string {
  if (row.status === 'needs_amount') return 'Needs an amount'
  if (row.status === 'left_out') return `Left out, unit can't convert. Pick ${row.substance_unit === 'kg' ? 'kg or g' : row.substance_unit ?? 'a unit'}.`
  const a = `${amountBox(row.amount)} ${row.unit}`
  if (!row.climate) return `${a} × no climate factor = 0 kg CO₂-eq`
  const conv = row.climate.conversion ? ` (${row.climate.conversion})` : ''
  return `${a}${conv} × ${factorText(row.climate.factor)} ${perUnitText(row.climate.unit, perOf(row))} = ${result3(row.climate.impact)} ${co2Unit(row.climate.unit)}`
}

/** The source as a person reads it: the hand-entered prefix dropped, the name kept short. */
export function sourceText(source: string | null | undefined): string {
  const s = String(source ?? '').replace(/^Entered by hand:\s*/i, '')
  const cut = s.split(/[(;]/)[0].trim()
  return cut.length > 60 ? `${cut.slice(0, 57)}…` : cut || 'no source recorded'
}

/** The tag a factor carries; your own number reads "Hand-entered" everywhere (E2). */
export function FactorTag({ row }: { row: InventoryRow }) {
  if (!row.climate) return <span className="ds-tag ds-tag--reference">No factor</span>
  if (row.climate.tag === 'hand') return <span className="ds-tag ds-tag--hand">Hand-entered</span>
  return <SourceTag kind={row.climate.tag} />
}

/** "Hand-entered: the supplier's EPD, 2024" for your own number; the library's source otherwise. */
export function sourceLine(row: InventoryRow, method: string): string {
  if (!row.climate) return row.direction === 'output' ? 'An output with no climate factor' : `No climate factor in ${method || 'this method'}`
  if (row.climate.tag === 'hand') return `Hand-entered: ${sourceText(row.climate.source)}`
  return `${sourceText(row.climate.source)}${row.climate.scope ? ` · ${row.climate.scope}` : ''}`
}

type StepOption = { id: number; name: string; depth?: number }

/**
 * One flow's draft: what the boxes hold until Save. A unit change converts
 * the amount in the box (or refuses); Save sends only what changed, with the
 * amount and unit this tab loaded (3.10), and says what was stored.
 */
export function useFlowDraft(row: InventoryRow, stepName: string, steps: StepOption[] = []) {
  const shown = amountBox(row.amount)
  const [amount, setAmountText] = useState(shown)
  const [unit, setUnitText] = useState(row.unit)
  const [direction, setDirection] = useState<'input' | 'output'>(row.direction)
  const [substance, setSubstance] = useState<{ id: number; name: string } | null>(null)
  const [stepId, setStepId] = useState(row.component_id)
  // The flow's own stage: '' hands it to the rule (materials in, else the step's stage).
  const storedStage = row.stage_set ? row.stage : ''
  const [stageChoice, setStageChoice] = useState<string>(storedStage)
  const [unitNote, setUnitNote] = useState<string | null>(null)
  const [unitProblem, setUnitProblem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Saved, and the reload with the stored row is on its way: nothing is waiting.
  const [justSaved, setJustSaved] = useState(false)
  // The amount this tab last knew (3.10): a save checks it, and a conflict moves it to the amount now.
  const [known, setKnown] = useState<number | null>(row.amount)

  const reset = () => {
    setAmountText(amountBox(row.amount))
    setUnitText(row.unit)
    setDirection(row.direction)
    setSubstance(null)
    setStepId(row.component_id)
    setStageChoice(row.stage_set ? row.stage : '')
    setUnitNote(null)
    setUnitProblem(null)
    setError(null)
    setKnown(row.amount)
    setJustSaved(false)
  }
  // A reload (after any save) puts the boxes back to what is stored.
  useEffect(reset, [row.flow_id, row.amount, row.unit, row.direction, row.substance_id, row.component_id, row.stage, row.stage_set]) // eslint-disable-line react-hooks/exhaustive-deps

  const unitChanged = unit !== row.unit
  const amountEdited = amountChanged(amount, shown)
  const dirty = !justSaved && (amountEdited || unitChanged || direction !== row.direction || substance !== null || stepId !== row.component_id || stageChoice !== storedStage)

  /** Typing an amount; after a unit that could not convert, the typed amount is the amount in that unit. */
  const setAmount = (v: string) => {
    setJustSaved(false)
    setAmountText(v)
    setUnitProblem(null)
    setUnitNote(null)
    setSaved(null)
  }

  /** A new unit converts what the box holds (A1); a unit that cannot convert says so and waits for the amount. */
  const setUnit = (u: string) => {
    setJustSaved(false)
    setSaved(null)
    setError(null)
    // The amount the box stands for: the stored one when untouched (never the rounded text).
    const typed = readAmount(amount)
    const base = !amountEdited ? row.amount : typed.ok ? typed.value : null
    const from = unit
    const change = convertForUnitChange(base, from, u)
    setUnitText(u)
    if (u === row.unit) {
      // Back to the stored unit: the stored amount again.
      if (unitChanged) setAmountText(shown)
      setUnitNote(null)
      setUnitProblem(null)
      return
    }
    if (!change.ok) {
      setUnitProblem(change.reason)
      setUnitNote(null)
      return
    }
    setUnitProblem(null)
    setAmountText(change.amount === null ? '' : String(change.amount))
    setUnitNote(change.note ? `Converted: ${change.note}. Save to keep it.` : null)
  }

  const canSave = dirty && !unitProblem && !busy

  const save = async (): Promise<boolean> => {
    if (!dirty) return true
    if (unitProblem) {
      setError(unitProblem)
      return false
    }
    const body: Record<string, unknown> = {}
    if (amountEdited || unitChanged) {
      const a = readAmount(amount)
      if (!a.ok) {
        setError(a.reason)
        return false
      }
      if (amountEdited || unitChanged) body.quantity = a.value
    }
    if (unitChanged) body.unit = unit
    if (direction !== row.direction) body.flow_type = direction
    if (substance) body.substance_id = substance.id
    if (stepId !== row.component_id) body.component_id = stepId
    if (stageChoice !== storedStage) body.life_cycle_stage = stageChoice || null
    body.expected_quantity = known
    body.expected_unit = row.unit
    setBusy(true)
    setError(null)
    const res = await apiRequest(`/api/flows/${row.flow_id}`, { method: 'PUT', body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      if (res.status === 409 && d?.current) {
        const now = d.current.quantity == null ? 'no amount' : `${d.current.quantity} ${d.current.unit ?? row.unit}`.trim()
        setKnown(d.current.quantity ?? null)
        setError(`This flow changed in another tab or by someone else: it is now ${now}. Save again to replace it.`)
      } else setError(d?.error ?? `Not saved (${res.status}).`)
      return false
    }
    const f = d?.flow ?? {}
    const q = f.quantity == null ? null : Number(f.quantity)
    const name = f.substance_name ?? substance?.name ?? row.substance
    const toStep = steps.find((s) => s.id === Number(f.component_id ?? stepId))?.name ?? stepName
    const parts = [`${name} ${q === null ? 'no amount' : `${amountBox(q)} ${f.unit ?? unit}`}`]
    if (unitChanged && row.amount !== null) parts[0] += ` (was ${amountBox(row.amount)} ${row.unit})`
    if (direction !== row.direction || (f.flow_type && f.flow_type !== row.direction)) parts.push(`${directionWord(f.flow_type ?? direction)}`)
    if (stageChoice !== storedStage) parts.push(stageChoice ? `stage ${stageLabel(stageChoice)}` : 'stage from the rule')
    const line = `Saved · ${parts.join(', ')} on ${toStep}`
    setSaved(line)
    setKnown(q)
    setUnitNote(null)
    setJustSaved(true)
    announceComponentsChanged()
    return true
  }

  useUnsavedEdit(`flow-${row.flow_id}`, dirty, {
    label: `${row.substance} on ${stepName}`,
    save,
    discard: reset,
  })

  const units = useMemo(() => {
    const list = compatibleUnits(row.substance_unit)
    return list.includes(row.unit) ? list : [row.unit, ...list]
  }, [row.substance_unit, row.unit])

  return {
    amount, setAmount, unit, setUnit, units, direction, setDirection: (d: 'input' | 'output') => (setDirection(d), setSaved(null), setJustSaved(false)),
    substance, setSubstance: (s: { id: number; name: string } | null) => (setSubstance(s), setSaved(null), setJustSaved(false)),
    stepId, setStepId: (id: number) => (setStepId(id), setSaved(null), setJustSaved(false)),
    stageChoice, setStageChoice: (v: string) => (setStageChoice(v), setSaved(null), setJustSaved(false)),
    dirty, canSave, busy, error, saved, unitNote, unitProblem, save, reset,
  }
}

export type FlowDraft = ReturnType<typeof useFlowDraft>

/** Save and Discard for a flow's draft, with what is waiting and what was saved, next to the boxes. */
export function DraftActions({ draft, what }: { draft: FlowDraft; what: string }) {
  return (
    <div className="ws-draft" aria-live="polite">
      {draft.unitNote && <span className="ws-draft-note">{draft.unitNote}</span>}
      {draft.unitProblem && (
        <span role="alert" className="ws-draft-error">
          {draft.unitProblem}
        </span>
      )}
      {draft.error && (
        <span role="alert" className="ws-draft-error">
          {draft.error}
        </span>
      )}
      {draft.dirty && (
        <span className="ws-draft-buttons">
          <Button variant="dark" size="small" onClick={() => void draft.save()} busy={draft.busy} disabled={!draft.canSave} aria-label={`Save ${what}`}>
            Save
          </Button>
          <Button size="small" onClick={draft.reset} aria-label={`Discard the changes to ${what}`}>
            Discard
          </Button>
          <span className="ws-draft-note">Not saved yet</span>
        </span>
      )}
      {!draft.dirty && draft.saved && <SavedLine>{draft.saved}</SavedLine>}
    </div>
  )
}

/** Change the substance: search the library (most relevant first) and pick; Save stores it. */
export function SubstanceSwap({ row, method, draft, onClose }: { row: InventoryRow; method: string; draft: FlowDraft; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const { substances } = useSubstanceCatalog(method)
  const found = useMemo(() => searchSubstances(query, substances).filter((s) => s.substance_id !== row.substance_id).slice(0, 8), [query, substances, row.substance_id])
  return (
    <div className="ws-swap">
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Change {row.substance} to
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} aria-label={`Find a substance for ${row.substance}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the library" />
      </label>
      <div role="listbox" aria-label="Substances" className="ws-swap-list">
        {found.map((s) => (
          <button
            key={s.substance_id}
            type="button"
            role="option"
            aria-selected={draft.substance?.id === s.substance_id}
            className="ws-swap-option"
            onClick={() => {
              draft.setSubstance({ id: s.substance_id, name: s.substance_name })
              onClose()
            }}
          >
            <span style={{ fontWeight: 600 }}>{s.substance_name}</span>
            <span className="ds-mono" style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
              {s.climate_factor != null ? `${factorText(s.climate_factor)} ${s.climate_unit ?? ''}`.trim() : 'no climate factor'} · {s.unit ?? 'unit not set'} · {substanceSource(s).label}
            </span>
          </button>
        ))}
        {!found.length && <span style={{ fontSize: 13, color: 'var(--ds-text-3)' }}>{query.trim() ? 'No match.' : 'Type a name to search the library.'}</span>}
      </div>
    </div>
  )
}

/** The step a flow sits on (E1): every step of the case, the current one picked; Save moves it. */
export function StepSelect({ row, steps, draft }: { row: InventoryRow; steps: StepOption[]; draft: FlowDraft }) {
  return (
    <label className="ds-label" style={{ marginBottom: 0 }}>
      On the step
      <select
        className="ds-input"
        style={{ width: '100%', marginTop: 4 }}
        aria-label={`Step for ${row.substance}`}
        value={draft.stepId}
        onChange={(e) => draft.setStepId(Number(e.target.value))}
      >
        {steps.map((s) => (
          <option key={s.id} value={s.id}>
            {'  '.repeat(s.depth ?? 0)}
            {s.name}
            {s.id === row.component_id ? ' (now)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * The life-cycle stage this flow counts in: the rule's choice (a material going
 * in is Materials; energy, transport and outputs follow the step), or one the
 * student sets. Save stores it with the rest of the flow.
 */
export function StageSelect({ row, draft }: { row: InventoryRow; draft: FlowDraft }) {
  const rule = row.stage_set ? null : row.stage
  return (
    <label className="ds-label" style={{ marginBottom: 0 }}>
      Life-cycle stage
      <select className="ds-input" style={{ width: '100%', marginTop: 4 }} aria-label={`Stage for ${row.substance}`} value={draft.stageChoice} onChange={(e) => draft.setStageChoice(e.target.value)}>
        <option value="">{rule ? `From the rule: ${stageLabel(rule)}` : 'From the rule'}</option>
        {STAGES.map((st) => (
          <option key={st.id} value={st.id}>
            {st.label} (set by you)
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Your own climate factor for this flow (E2): on any flow, with or without a
 * library factor. It is stated per the flow's own unit, and the label says so
 * ("kg CO₂-eq per g"). Save stores it; it reads "Hand-entered" everywhere.
 */
export function OwnFactorForm({ row, method, onDone }: { row: InventoryRow; method?: string; onDone: (savedLine: string | null) => void }) {
  const isOwn = row.climate?.tag === 'hand'
  const [value, setValue] = useState(isOwn ? String(row.climate!.factor) : '')
  const [source, setSource] = useState(isOwn ? sourceText(row.climate!.source) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const per = row.unit
  const resultUnit = row.climate?.unit ?? 'kg CO2 eq'
  const dirty = value.trim() !== (isOwn ? String(row.climate!.factor) : '') || source.trim() !== (isOwn ? sourceText(row.climate!.source) : '')
  const submit = async (): Promise<boolean> => {
    const v = Number(value)
    if (!Number.isFinite(v) || value.trim() === '') return setError('Enter the number, for example 2.1.'), false
    if (!source.trim()) return setError('Say where the number comes from.'), false
    setBusy(true)
    const res = await apiRequest(`/api/flows/${row.flow_id}/factor`, {
      method: 'PUT',
      body: JSON.stringify({ ...(row.climate ? { category_id: row.climate.category_id } : { category: 'climate' }), factor_value: v, source: source.trim() }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d?.error ?? `Not saved (${res.status}).`), false
    announceComponentsChanged()
    onDone(`Saved · your own factor for ${row.substance}: ${factorText(v)} ${perUnitText(resultUnit, per)} (Hand-entered: ${source.trim()})`)
    return true
  }
  useUnsavedEdit(`own-factor-${row.flow_id}`, dirty, {
    label: `your own factor for ${row.substance}`,
    save: submit,
    discard: () => onDone(null),
  })
  return (
    <div className="ws-ownfactor" role="group" aria-label={`Your own factor for ${row.substance}`}>
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Your factor, in {perUnitText(resultUnit, per)}
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Where it comes from
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} value={source} maxLength={255} placeholder="e.g. the supplier's EPD, 2024" onChange={(e) => setSource(e.target.value)} />
      </label>
      {method && !row.climate && <span style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>It counts in the {method} climate total from the next run.</span>}
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <span style={{ display: 'flex', gap: 8 }}>
        <Button variant="dark" onClick={() => void submit()} busy={busy} aria-label={`Save your own factor for ${row.substance}`}>
          Save
        </Button>
        <Button size="small" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </span>
    </div>
  )
}

export function BackToLibrary({ row, onSaved }: { row: InventoryRow; onSaved: (line: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Callout tone="info" lead="Hand-entered.">
      This row uses your own factor: {factorText(row.climate?.factor)} {perUnitText(row.climate?.unit, perOf(row))}.{' '}
      <button
        type="button"
        className="ds-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const res = await apiRequest(`/api/flows/${row.flow_id}/factor?category_id=${row.climate!.category_id}`, { method: 'DELETE' })
          setBusy(false)
          if (res.ok) {
            announceComponentsChanged()
            onSaved(`Saved · ${row.substance} uses the library factor again`)
          }
        }}
      >
        Use the library factor again
      </button>
    </Callout>
  )
}
