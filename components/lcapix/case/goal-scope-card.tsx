'use client'

// Goal & scope (ISO 14044 4.2) on the case view. Study-level fields (functional
// unit, boundary, goal, exclusions) live on the project and every case in it
// shares them; the reference flow and data basis belong to this case (one
// alternative). Collapsed to a one-line summary; the status panel opens it
// (openSignal) when the functional unit is missing.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'

export interface GoalScopeSummary {
  functionalUnit: string
  systemBoundary: string
  referenceFlow: number
  referenceFlowUnit: string
  modeledOutput: number
}

const BOUNDARIES: Array<{ id: string; label: string }> = [
  { id: 'cradle-to-gate', label: 'Cradle-to-gate' },
  { id: 'gate-to-gate', label: 'Gate-to-gate' },
  { id: 'cradle-to-grave', label: 'Cradle-to-grave' },
]

interface FormState {
  goalStatement: string
  functionalUnit: string
  systemBoundary: string
  boundaryNotes: string
  referenceFlow: string
  referenceFlowUnit: string
  modeledOutput: string
}

const positiveString = (v: unknown): string => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? String(n) : '1'
}

const toSummary = (s: FormState): GoalScopeSummary => ({
  functionalUnit: s.functionalUnit.trim(),
  systemBoundary: s.systemBoundary,
  referenceFlow: Number(s.referenceFlow) || 1,
  referenceFlowUnit: s.referenceFlowUnit.trim(),
  modeledOutput: Number(s.modeledOutput) || 1,
})

/** Compact scale readout: 1, 0.0667, 1.92e-5. */
const fmtScale = (x: number) =>
  !Number.isFinite(x) ? '?' : Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(3)))

export function GoalScopeCard({
  projectId,
  caseId,
  openSignal = 0,
  onChange,
  onSaved,
}: {
  projectId: string
  caseId: string
  /** Increment to open the editor and scroll it into view. */
  openSignal?: number
  /** Called with what is saved, or null when the database has no goal & scope fields. */
  onChange?: (summary: GoalScopeSummary | null) => void
  /** Called after a successful save (the data basis also rewrites the product's quantity). */
  onSaved?: () => void
}) {
  const [saved, setSaved] = useState<FormState | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Latest callback without re-running the load effect on every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [pr, cr] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/cases/${caseId}`),
        ])
        const p = (await pr.json())?.project ?? {}
        const c = (await cr.json())?.case ?? {}
        if (cancelled) return
        // No migrate-014 on this database: hide the card and block nothing.
        if (!('functional_unit' in p) || !('reference_flow' in c)) {
          onChangeRef.current?.(null)
          return
        }
        const s: FormState = {
          goalStatement: p.goal_statement ?? '',
          functionalUnit: p.functional_unit ?? '',
          systemBoundary: p.system_boundary ?? 'cradle-to-gate',
          boundaryNotes: p.boundary_notes ?? '',
          referenceFlow: positiveString(c.reference_flow),
          referenceFlowUnit: c.reference_flow_unit ?? '',
          modeledOutput: positiveString(c.modeled_output),
        }
        setSaved(s)
        setForm(s)
        onChangeRef.current?.(toSummary(s))
      } catch {
        // advisory: without it the page still works and nothing is blocked
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, caseId])

  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true)
      setTimeout(
        () => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        50,
      )
    }
  }, [openSignal])

  if (!saved || !form) return null

  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  const fuSet = !!saved.functionalUnit.trim()
  const unit = saved.referenceFlowUnit || 'unit'
  const boundaryLabel =
    BOUNDARIES.find((b) => b.id === saved.systemBoundary)?.label ?? saved.systemBoundary
  const scale = (Number(form.referenceFlow) || 0) / (Number(form.modeledOutput) || 1)

  async function save() {
    if (!form) return
    const refFlow = Number(form.referenceFlow)
    const modeled = Number(form.modeledOutput)
    if (!(refFlow > 0) || !(modeled > 0)) {
      toast.error('Reference flow and data basis must be numbers above 0.')
      return
    }
    setSaving(true)
    try {
      const put = (url: string, body: object) =>
        apiRequest(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      const [pr, cr] = await Promise.all([
        put(`/api/projects/${projectId}`, {
          functional_unit: form.functionalUnit.trim(),
          system_boundary: form.systemBoundary,
          goal_statement: form.goalStatement.trim(),
          boundary_notes: form.boundaryNotes.trim(),
        }),
        put(`/api/cases/${caseId}`, {
          reference_flow: refFlow,
          reference_flow_unit: form.referenceFlowUnit.trim(),
          modeled_output: modeled,
        }),
      ])
      if (pr.status === 403) {
        throw new Error('Only the project owner can change the study goal & scope.')
      }
      for (const r of [pr, cr]) {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Could not save goal & scope.')
        }
      }
      const next: FormState = {
        goalStatement: form.goalStatement.trim(),
        functionalUnit: form.functionalUnit.trim(),
        systemBoundary: form.systemBoundary,
        boundaryNotes: form.boundaryNotes.trim(),
        referenceFlow: String(refFlow),
        referenceFlowUnit: form.referenceFlowUnit.trim(),
        modeledOutput: String(modeled),
      }
      setSaved(next)
      setForm(next)
      setOpen(false)
      onChangeRef.current?.(toSummary(next))
      onSaved?.()
      toast.success('Goal & scope saved')
    } catch (e: any) {
      toast.error(e?.message || 'Could not save goal & scope.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={rootRef}
      data-tour="case-goal-scope"
      className="card"
      style={{
        margin: '0 0 12px',
        padding: '10px 16px',
        borderLeft: fuSet ? undefined : '3px solid #c0392b',
      }}
    >
      <div
        style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            fontWeight: 600,
          }}
        >
          Goal &amp; scope
        </span>
        {fuSet ? (
          <>
            <span>
              <span style={{ color: 'var(--text-tertiary)' }}>Functional unit:</span>{' '}
              {saved.functionalUnit}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              · Reference flow {saved.referenceFlow} {unit}
              {Number(saved.modeledOutput) !== 1
                ? ` · data basis ${saved.modeledOutput} ${unit}`
                : ''}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>· {boundaryLabel}</span>
          </>
        ) : (
          <span style={{ color: '#c0392b', fontWeight: 600 }}>
            Functional unit not set: needed before a run
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (open) setForm(saved)
            setOpen(!open)
          }}
        >
          {open ? 'Close' : fuSet ? 'Edit' : 'Set it'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Functional unit" help={ISO_HELP.functionalUnit}>
              <input
                className="input"
                value={form.functionalUnit}
                onChange={(e) => set({ functionalUnit: e.target.value })}
                placeholder="e.g. One bicycle ridden 15,000 km over 10 years"
              />
            </Field>
            <Field label="System boundary" help={ISO_HELP.systemBoundary}>
              <select
                className="input"
                value={form.systemBoundary}
                onChange={(e) => set({ systemBoundary: e.target.value })}
                style={{ appearance: 'auto' }}
              >
                {BOUNDARIES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference flow" help={ISO_HELP.referenceFlow}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input mono"
                  type="number"
                  min={0}
                  step="any"
                  value={form.referenceFlow}
                  onChange={(e) => set({ referenceFlow: e.target.value })}
                  style={{ width: 110 }}
                />
                <input
                  className="input"
                  value={form.referenceFlowUnit}
                  onChange={(e) => set({ referenceFlowUnit: e.target.value })}
                  placeholder="unit, e.g. bike"
                />
              </div>
            </Field>
            <Field label="Data basis" help={ISO_HELP.dataBasis}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="input mono"
                  type="number"
                  min={0}
                  step="any"
                  value={form.modeledOutput}
                  onChange={(e) => set({ modeledOutput: e.target.value })}
                  style={{ width: 110 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {form.referenceFlowUnit.trim() || 'units'} made by the entered data
                </span>
              </div>
            </Field>
            <Field label="Goal" help={ISO_HELP.goal}>
              <textarea
                className="input"
                rows={2}
                value={form.goalStatement}
                onChange={(e) => set({ goalStatement: e.target.value })}
                placeholder="Why the study is done and who will read it"
                style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
              />
            </Field>
            <Field label="Exclusions & cut-off" help={ISO_HELP.boundaryNotes}>
              <textarea
                className="input"
                rows={2}
                value={form.boundaryNotes}
                onChange={(e) => set({ boundaryNotes: e.target.value })}
                placeholder="e.g. Excludes capital equipment and packaging"
                style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
              />
            </Field>
          </div>
          <div
            style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Results per functional unit = case total × {form.referenceFlow || '?'} ÷{' '}
              {form.modeledOutput || '?'} = <span className="mono">× {fmtScale(scale)}</span>
              <HelpTip label="Which fields do other cases share?">{ISO_HELP.sharedScope}</HelpTip>
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setForm(saved)
                setOpen(false)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" style={{ fontSize: 11 }}>
        {label}
        <HelpTip label={`About ${label.toLowerCase()}`}>{help}</HelpTip>
      </label>
      {children}
    </div>
  )
}
