'use client'

// "Step details" in the step panel, below the flows and closed until opened
// (E7): the name, the step it sits under (E6), its life-cycle stage, its own
// words (E23), ISO 14044 4.3.4 allocation (E24), the product's quantity, and
// Delete step. Every field is a draft until its Save, and its Saved line
// shows beside that Save (B1, B4); a draft left behind asks first (B3).

import { useEffect, useState, type ReactNode } from 'react'
import { Button, SavedLine } from '@/components/lcapix/ds'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { allocationSharePatch, allocationView, type AllocationChoice } from '@/lib/case-editor/cost-calculators'
import { STAGES } from '@/lib/life-cycle'
import { joinSource } from '@/lib/workspace/step-text'
import { TIER_LABEL, TIERS } from '@/lib/workspace/tier-layout'
import { useUnsavedEdit } from '@/lib/workspace/unsaved'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'
import { HelpTip } from './help-tip'

const METHODS: Array<{ value: AllocationChoice; label: string }> = [
  { value: 'none', label: 'Not shared: all of it is this product' },
  { value: 'physical', label: 'Shared by a physical basis (mass, volume)' },
  { value: 'economic', label: 'Shared by economic value' },
]

export interface StepActions {
  busy: boolean
  error?: string | null
  rename: (id: number, name: string) => Promise<boolean>
  move: (id: number, parentId: number) => Promise<boolean>
  setStage: (id: number, stage: string) => Promise<boolean>
  saveFields: (id: number, fields: Record<string, unknown>) => Promise<boolean>
  scaleProduct: (from: number, to: number) => Promise<boolean>
}

/** The steps a step can sit under: a higher tier, never itself or a step below it (E6). */
export function parentChoices(step: WorkspaceStep, steps: WorkspaceStep[]): WorkspaceStep[] {
  const rank = TIERS.indexOf(step.tier)
  const below = new Set<number>()
  const mark = (id: number) => {
    below.add(id)
    for (const s of steps) if (s.parentId === id) mark(s.id)
  }
  mark(step.id)
  return steps.filter((s) => TIERS.indexOf(s.tier) < rank && !below.has(s.id))
}

/** One field with its Save, its error and its Saved line, in that order. */
function Field({
  label,
  children,
  dirty,
  onSave,
  onDiscard,
  busy,
  saved,
  error,
  saveLabel,
}: {
  label: string
  children: ReactNode
  dirty: boolean
  onSave: () => void
  onDiscard: () => void
  busy: boolean
  saved: string | null
  error: string | null
  saveLabel: string
}) {
  return (
    <div className="ws-detail-field">
      <span className="ds-section-label">{label}</span>
      <span style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
        <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
        <Button onClick={onSave} busy={busy} disabled={!dirty} aria-label={saveLabel}>
          Save
        </Button>
      </span>
      {dirty && (
        <span className="ws-draft-buttons" style={{ marginTop: 4 }}>
          <span className="ws-draft-note">Not saved yet</span>
          <button type="button" className="ds-link" onClick={onDiscard}>
            Discard
          </button>
        </span>
      )}
      {error && (
        <span role="alert" className="ws-draft-error">
          {error}
        </span>
      )}
      {!dirty && saved && <SavedLine>{saved}</SavedLine>}
    </div>
  )
}

/** A draft that only Save stores, registered as unsaved while it differs. */
function useDraft<T>(key: string, stored: T, label: string, store: (v: T) => Promise<string | null>) {
  const [value, setValue] = useState<T>(stored)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setValue(stored), [stored]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = value !== stored
  const save = async () => {
    setError(null)
    const line = await store(value)
    if (line === null) {
      setError('Not saved. Check the value and try again.')
      return false
    }
    setSaved(line)
    return true
  }
  const discard = () => {
    setValue(stored)
    setError(null)
  }
  useUnsavedEdit(key, dirty, { label, save, discard })
  return { value, set: (v: T) => (setValue(v), setSaved(null)), dirty, save, discard, saved, error, setError }
}

export function StepDetails({
  step,
  steps,
  actions,
  onDelete,
}: {
  step: WorkspaceStep
  steps: WorkspaceStep[]
  actions: StepActions
  onDelete: () => void
}) {
  const parents = parentChoices(step, steps)
  const parentName = steps.find((s) => s.id === step.parentId)?.name ?? null
  const view = allocationView({ allocationMethod: step.allocationMethod as any, allocationFactor: step.allocationFactor ?? undefined })

  const name = useDraft(`step-name-${step.id}`, step.name, `the name of ${step.name}`, async (v) => {
    const t = v.trim()
    if (!t) return null
    return (await actions.rename(step.id, t)) ? `Saved · the name is ${t}` : null
  })
  const under = useDraft(`step-under-${step.id}`, step.parentId ?? 0, `the step ${step.name} sits under`, async (v) => {
    if (!v || v === step.parentId) return null
    const to = steps.find((s) => s.id === v)?.name ?? 'that step'
    return (await actions.move(step.id, v)) ? `Saved · ${step.name} is now under ${to}` : null
  })
  const stage = useDraft(`step-stage-${step.id}`, step.lifeCycleStage ?? '', `the life-cycle stage of ${step.name}`, async (v) => {
    if (!v) return null
    const label = STAGES.find((s) => s.id === v)?.label ?? v
    return (await actions.setStage(step.id, v)) ? `Saved · stage ${label}` : null
  })
  const description = useDraft(`step-description-${step.id}`, step.description ?? '', `the description of ${step.name}`, async (v) =>
    (await actions.saveFields(step.id, { description: joinSource(v, step.source) })) ? `Saved · ${step.name}` : null,
  )
  const quantity = useDraft(`step-quantity-${step.id}`, step.quantity != null ? String(step.quantity) : '1', `the quantity of ${step.name}`, async (v) => {
    const to = Number(v)
    const from = step.quantity && step.quantity > 0 ? step.quantity : 1
    if (!Number.isFinite(to) || to <= 0) return null
    return (await actions.scaleProduct(from, to)) ? `Scaled · ${step.name} to ${to}` : null
  })

  // Allocation: three boxes that save together.
  const [method, setMethod] = useState<AllocationChoice>(view.method)
  const [pct, setPct] = useState(view.method === 'none' ? '' : String(view.pctValue))
  const [note, setNote] = useState(step.allocationNote ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const [allocSaved, setAllocSaved] = useState<string | null>(null)
  const resetAllocation = () => {
    const v = allocationView({ allocationMethod: step.allocationMethod as any, allocationFactor: step.allocationFactor ?? undefined })
    setMethod(v.method)
    setPct(v.method === 'none' ? '' : String(v.pctValue))
    setNote(step.allocationNote ?? '')
    setProblem(null)
  }
  useEffect(resetAllocation, [step.id, step.allocationMethod, step.allocationFactor, step.allocationNote]) // eslint-disable-line react-hooks/exhaustive-deps
  const allocDirty = method !== view.method || (method !== 'none' && pct !== String(view.pctValue)) || note !== (step.allocationNote ?? '')
  const saveAllocation = async (): Promise<boolean> => {
    if (method === 'none') {
      if (await actions.saveFields(step.id, { allocation_method: 'none', allocation_factor: 1, allocation_note: note.trim() || null })) {
        setAllocSaved(`Saved · ${step.name} counts in full`)
        return true
      }
      return false
    }
    const patch = allocationSharePatch(pct.trim())
    const share = patch?.allocationFactor
    if (share == null) return setProblem('Enter the share that belongs to this product, as a percent above 0 and up to 100.'), false
    if (!note.trim()) return setProblem('Write the basis, for example "by mass: 80 kg of 100 kg output", so a reviewer can check it.'), false
    setProblem(null)
    if (await actions.saveFields(step.id, { allocation_method: method, allocation_factor: share, allocation_note: note.trim() })) {
      setAllocSaved(`Saved · ${step.name} keeps ${Math.round(share * 1000) / 10}%`)
      return true
    }
    return false
  }
  useUnsavedEdit(`step-allocation-${step.id}`, allocDirty, { label: `the allocation of ${step.name}`, save: saveAllocation, discard: resetAllocation })

  const anyDirty = name.dirty || under.dirty || stage.dirty || description.dirty || quantity.dirty || allocDirty
  const [open, setOpen] = useState(false)

  return (
    <details className="ws-panel-section ws-details" open={open || anyDirty} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="ws-details-summary">
        Step details
        <span className="ws-details-hint">
          {TIER_LABEL[step.tier]}
          {parentName ? ` under ${parentName}` : ''}
          {step.lifeCycleStage ? ` · ${STAGES.find((s) => s.id === step.lifeCycleStage)?.label ?? step.lifeCycleStage}` : ' · stage not set'}
        </span>
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
        <Field label="Step name" dirty={name.dirty} onSave={() => void name.save()} onDiscard={name.discard} busy={actions.busy} saved={name.saved} error={name.error} saveLabel="Save the step name">
          <input className="ds-input" aria-label="Step name" value={name.value} onChange={(e) => name.set(e.target.value)} style={{ width: '100%' }} />
        </Field>

        {step.parentId != null && parents.length > 0 && (
          <Field label="Step under" dirty={under.dirty} onSave={() => void under.save()} onDiscard={under.discard} busy={actions.busy} saved={under.saved} error={under.error} saveLabel="Save the step it sits under">
            <select className="ds-input" aria-label="Step under" value={under.value} onChange={(e) => under.set(Number(e.target.value))} style={{ width: '100%' }}>
              {parents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.id === step.parentId ? ' (now)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Life-cycle stage" dirty={stage.dirty} onSave={() => void stage.save()} onDiscard={stage.discard} busy={actions.busy} saved={stage.saved} error={stage.error} saveLabel="Save the life-cycle stage">
          <select className="ds-input" aria-label="Life-cycle stage" value={stage.value} onChange={(e) => stage.set(e.target.value)} style={{ width: '100%' }}>
            <option value="" disabled={!!step.lifeCycleStage}>
              Not set
            </option>
            {STAGES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" dirty={description.dirty} onSave={() => void description.save()} onDiscard={description.discard} busy={actions.busy} saved={description.saved} error={description.error} saveLabel="Save the description">
          <textarea
            className="ds-input"
            aria-label="Step description"
            rows={2}
            value={description.value}
            onChange={(e) => description.set(e.target.value)}
            placeholder="What happens here, the machine, what you assumed"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </Field>

        <div role="group" aria-label="Allocation">
          <span className="ds-section-label">
            Allocation
            <HelpTip label="What is allocation?">{ISO_HELP.allocation}</HelpTip>
          </span>
          <select
            className="ds-input"
            aria-label="Allocation method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as AllocationChoice)
              setProblem(null)
              setAllocSaved(null)
            }}
            style={{ width: '100%', marginTop: 6 }}
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {method !== 'none' && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="ds-input"
                  aria-label="Share that belongs to this product, in percent"
                  inputMode="decimal"
                  value={pct}
                  onChange={(e) => (setPct(e.target.value), setAllocSaved(null))}
                  placeholder="80"
                  style={{ width: 96 }}
                />
                <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>% stays with this product</span>
              </span>
              <input className="ds-input" aria-label="Allocation basis" value={note} onChange={(e) => (setNote(e.target.value), setAllocSaved(null))} placeholder="by mass: 80 kg of 100 kg output" />
            </span>
          )}
          {problem && (
            <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ds-error)' }}>
              {problem}
            </p>
          )}
          <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6, alignItems: 'center' }}>
            {allocDirty && <span className="ws-draft-note">Not saved yet</span>}
            <Button onClick={() => void saveAllocation()} busy={actions.busy}>
              Save allocation
            </Button>
          </span>
          {!allocDirty && allocSaved && <SavedLine>{allocSaved}</SavedLine>}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ds-text-3)' }}>It changes environmental results from the next run; costs stay as entered.</p>
        </div>

        {step.tier === 'product' && (
          <Field label="Quantity" dirty={quantity.dirty} onSave={() => void quantity.save()} onDiscard={quantity.discard} busy={actions.busy} saved={quantity.saved} error={quantity.error} saveLabel="Save the quantity and scale the product">
            <input className="ds-input" aria-label="Quantity" inputMode="decimal" value={quantity.value} onChange={(e) => quantity.set(e.target.value)} style={{ width: '100%' }} />
          </Field>
        )}

        {actions.error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--ds-error)' }}>
            {actions.error}
          </p>
        )}

        {step.parentId != null && (
          <Button variant="danger-quiet" onClick={onDelete}>
            Delete step
          </Button>
        )}
      </div>
    </details>
  )
}
