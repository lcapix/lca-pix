'use client'

// Goal & scope (ISO 14044 4.2) on the case view. Study-level fields (functional
// unit, boundary, goal, exclusions) live on the project and every case in it
// shares them; the reference flow and data basis belong to this case (one
// alternative). Collapsed to a one-line summary; the status panel opens it
// (openSignal) when the functional unit is missing.

import type { ReactNode } from 'react'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { BOUNDARIES, fmtScale, type GoalScopeSummary } from '@/lib/case-editor/goal-scope'
import { useGoalScope } from '@/lib/case-editor/use-goal-scope'

export type { GoalScopeSummary } from '@/lib/case-editor/goal-scope'

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
  const { saved, form, open, saving, rootRef, set, toggle, cancel, save } = useGoalScope({
    projectId,
    caseId,
    openSignal,
    onChange,
    onSaved,
  })

  if (!saved || !form) return null

  const fuSet = !!saved.functionalUnit.trim()
  const unit = saved.referenceFlowUnit || 'unit'
  const boundaryLabel =
    BOUNDARIES.find((b) => b.id === saved.systemBoundary)?.label ?? saved.systemBoundary
  const scale = (Number(form.referenceFlow) || 0) / (Number(form.modeledOutput) || 1)

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
          onClick={toggle}
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
              onClick={cancel}
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
