'use client'

// Compact "where is this case" block for the project view: the ISO phase
// stepper, one status line, and the documents & data the case already has.
// Reports whether the case can run so the page can grey out its Run button
// with the same rule the case editor uses.

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { LAYER_LABEL, type CaseLayer } from '@/lib/ingest/doc-types'
import { caseReadiness, journeyPhases } from '@/lib/case-journey'
import { PhaseStepper } from '@/components/lcapix/case/phase-stepper'

export interface CaseRunReadiness {
  canRun: boolean
  reason: string | null
}

export function CaseJourney({
  projectId,
  caseId,
  onReadiness,
}: {
  projectId: string
  caseId: string
  onReadiness?: (r: CaseRunReadiness) => void
}) {
  const [state, setState] = useState<{
    fuSet: boolean | null
    present: string[]
    missing: Array<{ layer: string; label: string; suggestedDocs: string[] }>
    hasAssessment: boolean
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [pr, cr, ar] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/cases/${caseId}/completeness`),
          apiRequest(`/api/cases/${caseId}/assessments`),
        ])
        const p = (await pr.json())?.project ?? {}
        const report = (await cr.json())?.report ?? { present: [], missing: [] }
        // A run that produced no results does not count as assessed.
        const runs = ((await ar.json())?.assessments ?? []).filter(
          (a: any) =>
            (!a.status || a.status === 'completed') && Object.keys(a.impacts ?? {}).length > 0,
        )
        if (cancelled) return
        setState({
          fuSet: 'functional_unit' in p ? !!String(p.functional_unit ?? '').trim() : null,
          present: report.present ?? [],
          missing: report.missing ?? [],
          hasAssessment: runs.length > 0,
        })
      } catch {
        // advisory: without it the page still works and nothing is blocked
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, caseId])

  const readiness = state ? caseReadiness(state) : null
  const reason = !readiness
    ? null
    : readiness.blocker === 'functional-unit'
      ? 'Set the functional unit (Goal & scope) first.'
      : readiness.blocker === 'inventory'
        ? 'Add at least one input or emission first: a run with none would be all zeros.'
        : null
  useEffect(() => {
    if (readiness) onReadiness?.({ canRun: readiness.canRun, reason })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness?.canRun, reason])

  if (!state || !readiness) return null
  const phases = journeyPhases(state)
  const impact = phases.find((p) => p.label === 'Impact')!

  return (
    <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PhaseStepper phases={phases} accent={readiness.canRun ? undefined : '#c0392b'} />
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {reason
          ? `Can't run yet. ${reason}`
          : impact.state === 'partial'
            ? 'Assessed on partial data. Add the missing data and run it again.'
            : impact.state === 'done'
              ? 'Assessed. Next: read the results.'
              : 'Ready to run.'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
          DOCUMENTS &amp; DATA ADDED
        </span>
        {state.present.length ? (
          state.present.map((l) => (
            <span key={l} className="chip" style={{ fontSize: 10.5, background: 'oklch(from var(--accent, #4f8a6a) l c h / 0.14)' }}>
              ✓ {LAYER_LABEL[l as CaseLayer] ?? l}
            </span>
          ))
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>nothing yet</span>
        )}
        {state.missing.map((m) => (
          <span
            key={m.layer}
            className="chip"
            style={{ fontSize: 10.5 }}
            title={m.suggestedDocs.length ? `Comes from: ${m.suggestedDocs.join(' or ')}` : 'Enter it by hand on the step that uses it.'}
          >
            To add: {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}
