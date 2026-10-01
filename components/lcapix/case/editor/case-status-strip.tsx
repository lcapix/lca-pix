'use client'

// Status panel — the "where am I / what's blocking me / what's next"
// orientation for a classroom user. Journey phase stepper + a plain headline
// (blocked / ready / assessed) + the single next action + the missing-layer
// checklist. Run is still gated on canRun.

import { Icon } from '@/components/lcapix'
import { PhaseStepper } from '@/components/lcapix/case/phase-stepper'
import { deriveCaseStatus } from '@/lib/case-editor/case-status'
import type { CompletenessReport } from '@/lib/case-editor/types'

export interface CaseStatusStripProps {
  completeness: CompletenessReport
  /** False until the Goal & scope card has reported. */
  goalScopeLoaded: boolean
  fuMissing: boolean
  canRun: boolean
  hasAssessment: boolean
  isRunning: boolean
  onSetFunctionalUnit: () => void
  /** "Add material inputs": the import page. */
  onAddInputs: () => void
  onRun: () => void
  onViewResults: () => void
  /** "Add a document": the import page. */
  onAddDocument: () => void
}

export function CaseStatusStrip({
  completeness,
  goalScopeLoaded,
  fuMissing,
  canRun,
  hasAssessment,
  isRunning,
  onSetFunctionalUnit,
  onAddInputs,
  onRun,
  onViewResults,
  onAddDocument,
}: CaseStatusStripProps) {
  // Phases reflect the data actually in the case: a run on half an
  // inventory shows Impact as partial, never a free tick.
  const { phases, partialRun, addedLabels, status, accent, missingPhrase, ...view } =
    deriveCaseStatus({ completeness, goalScopeLoaded, fuMissing, canRun, hasAssessment })
  const primary = {
    label: view.primary.label,
    run: view.primary.run,
    onClick:
      view.primary.action === 'set-functional-unit'
        ? onSetFunctionalUnit
        : view.primary.action === 'add-inputs'
          ? onAddInputs
          : view.primary.action === 'run'
            ? onRun
            : onViewResults,
  }
  return (
    <div
      className="card"
      style={{ margin: '0 0 12px', padding: '12px 16px', borderLeft: `3px solid ${accent}` }}
    >
      {/* Phase stepper — restores the 5-phase orientation from project setup */}
      <div style={{ marginBottom: 10 }}>
        <PhaseStepper phases={phases} accent={accent} />
      </div>
      {/* Headline + what's blocking + the next action */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {status === 'blocked'
              ? fuMissing
                ? 'Blocked — functional unit not set'
                : 'Blocked — nothing to assess yet'
              : status === 'ready'
                ? 'Ready to run'
                : partialRun
                  ? 'Assessed on partial data'
                  : 'Assessed'}{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              · Data added: {addedLabels.length ? addedLabels.join(', ') : 'nothing yet'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {status === 'blocked' && fuMissing ? (
              <>
                Every result is reported per functional unit (for example per bike, or per
                1,000 km of riding). Next: set it in Goal &amp; scope below.
              </>
            ) : status === 'blocked' ? (
              <>
                This case has no inputs or emissions, so an assessment would be 0.
                Next: add a material or energy input to a process step.
              </>
            ) : status === 'ready' ? (
              missingPhrase ? (
                <>
                  You can run now (partial). To make it complete, next add{' '}
                  <strong>{missingPhrase}</strong>.
                </>
              ) : (
                <>All the data is in. Next: run the assessment.</>
              )
            ) : missingPhrase ? (
              <>
                Results are in. To improve accuracy, add <strong>{missingPhrase}</strong>{' '}
                and re-run. Otherwise, interpret your results.
              </>
            ) : (
              <>Results are in and all the data is in. Next: interpret them.</>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={primary.onClick}
          disabled={primary.run && isRunning}
          style={{ whiteSpace: 'nowrap' }}
        >
          {primary.run && isRunning ? 'Running…' : primary.label} →
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAddDocument}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Icon name="file" size={13} /> Add a document
        </button>
      </div>
      {/* Full missing checklist: goal & scope first, then inventory layers */}
      {(fuMissing || completeness.missing.length > 0) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {fuMissing && (
            <span className="chip" style={{ fontSize: 10.5 }}>
              To add: Functional unit → Goal &amp; scope
            </span>
          )}
          {completeness.missing.map((m) => (
            <span
              key={m.layer}
              className="chip"
              title={
                m.suggestedDocs.length
                  ? `Comes from: ${m.suggestedDocs.join(' or ')}`
                  : 'No document type for this yet: enter it by hand on the step that uses it.'
              }
              style={{ fontSize: 10.5 }}
            >
              To add: {m.label}
              {m.suggestedDocs.length ? ` → ${m.suggestedDocs[0]}` : ' (by hand)'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
