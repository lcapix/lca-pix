// The case editor's status strip as data: where the case is in the ISO
// journey, whether it can run, and the one next action. The strip renders
// this; the copy around it stays in the component.

import { journeyPhases } from '@/lib/case-journey'
import { LAYER_LABEL, type CaseLayer } from '@/lib/ingest/doc-types'
import type { CompletenessReport } from './types'

export type CaseStatus = 'blocked' | 'ready' | 'assessed'

/** What the strip's primary button does. */
export type PrimaryAction = 'set-functional-unit' | 'add-inputs' | 'run' | 'view-results'

export interface CaseStatusView {
  phases: ReturnType<typeof journeyPhases>
  /** A run on part of the inventory: Impact shows as partial, never a free tick. */
  partialRun: boolean
  /** Labels of the data layers already in the case. */
  addedLabels: string[]
  status: CaseStatus
  /** Left border and stepper colour. */
  accent: string
  primary: { action: PrimaryAction; label: string; run: boolean }
  /** "Energy (from a utility bill)": the first missing layer and where it comes from. */
  missingPhrase: string | null
}

export function deriveCaseStatus({
  completeness,
  goalScopeLoaded,
  fuMissing,
  canRun,
  hasAssessment,
}: {
  completeness: CompletenessReport
  /** False until the Goal & scope card has reported (nothing is blocked before). */
  goalScopeLoaded: boolean
  fuMissing: boolean
  canRun: boolean
  hasAssessment: boolean
}): CaseStatusView {
  const phases = journeyPhases({
    fuSet: goalScopeLoaded ? !fuMissing : null,
    present: completeness.present,
    hasAssessment,
  })
  const partialRun = phases.find((p) => p.label === 'Impact')?.state === 'partial'
  const addedLabels = completeness.present.map((l) => LAYER_LABEL[l as CaseLayer] ?? l)
  const firstMissing = completeness.missing[0]
  const status: CaseStatus = !canRun ? 'blocked' : !hasAssessment ? 'ready' : 'assessed'
  const accent =
    status === 'blocked'
      ? '#c0392b'
      : status === 'assessed'
        ? 'var(--accent, #4f8a6a)'
        : 'var(--signal-info, #2563eb)'
  const primary: CaseStatusView['primary'] =
    status === 'blocked' && fuMissing
      ? { action: 'set-functional-unit', label: 'Set functional unit', run: false }
      : status === 'blocked'
        ? { action: 'add-inputs', label: 'Add material inputs', run: false }
        : status === 'ready'
          ? { action: 'run', label: 'Run assessment', run: true }
          : { action: 'view-results', label: 'View results', run: false }
  const missingPhrase = firstMissing
    ? `${firstMissing.label}${
        firstMissing.suggestedDocs[0]
          ? ` (from a ${firstMissing.suggestedDocs[0]})`
          : ' (enter it by hand on the step that uses it)'
      }`
    : null
  return { phases, partialRun, addedLabels, status, accent, primary, missingPhrase }
}
