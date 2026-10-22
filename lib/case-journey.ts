// Where a case is in the ISO 14040 journey, computed from what it actually
// contains — shared by the case editor and the project view so both say the
// same thing. A phase is only "done" when its data is really there: running
// an assessment on half an inventory marks Impact as partial, not done.

import { LAYER_LABEL, type CaseLayer } from '@/lib/ingest/doc-types'

/** Layers an assessment characterizes. Without one of these a run is all zeros. */
export const IMPACT_LAYERS: CaseLayer[] = ['materials', 'energy', 'emissions', 'transport']

/** What a manufactured product's inventory needs before it counts as done. */
export const CORE_LAYERS: CaseLayer[] = ['skeleton', 'materials', 'energy']

export type PhaseState = 'done' | 'partial' | 'todo'

export interface JourneyPhase {
  label: 'Goal & scope' | 'Inventory' | 'Impact' | 'Interpretation' | 'Report'
  state: PhaseState
  /** The first phase that is not done: where the student should work next. */
  current: boolean
  /** Plain-language status for the hover. */
  detail: string
}

export interface JourneyInput {
  /** true/false when known; null when goal & scope is unavailable (older database). */
  fuSet: boolean | null
  /** Layers the case contains (from the completeness report). */
  present: string[]
  hasAssessment: boolean
}

const label = (l: string) => LAYER_LABEL[l as CaseLayer] ?? l

export function caseReadiness(i: JourneyInput): {
  canRun: boolean
  blocker: 'functional-unit' | 'inventory' | null
  inventoryReady: boolean
} {
  const inventoryReady = i.present.some((l) => IMPACT_LAYERS.includes(l as CaseLayer))
  const fuMissing = i.fuSet === false
  return {
    canRun: inventoryReady && !fuMissing,
    blocker: fuMissing ? 'functional-unit' : !inventoryReady ? 'inventory' : null,
    inventoryReady,
  }
}

export function journeyPhases(i: JourneyInput): JourneyPhase[] {
  const coreMissing = CORE_LAYERS.filter((l) => !i.present.includes(l))
  const inventoryState: PhaseState = !coreMissing.length
    ? 'done'
    : i.present.length
      ? 'partial'
      : 'todo'
  const added = i.present.map(label)
  const phases: Array<Omit<JourneyPhase, 'current'>> = [
    {
      label: 'Goal & scope',
      state: i.fuSet === false ? 'todo' : 'done',
      detail: i.fuSet === false ? 'Functional unit not set yet.' : 'Functional unit and boundary are set.',
    },
    {
      label: 'Inventory',
      state: inventoryState,
      detail:
        inventoryState === 'done'
          ? `Data added: ${added.join(', ')}.`
          : `Data added: ${added.length ? added.join(', ') : 'nothing yet'}. Still needed: ${coreMissing.map(label).join(', ')}.`,
    },
    {
      label: 'Impact',
      state: !i.hasAssessment ? 'todo' : inventoryState === 'done' ? 'done' : 'partial',
      detail: !i.hasAssessment
        ? 'Not run yet.'
        : inventoryState === 'done'
          ? 'Assessed.'
          : 'Assessed on partial data: add the missing data and run it again.',
    },
    {
      label: 'Interpretation',
      state: 'todo',
      detail: i.hasAssessment ? 'Read the results: what drives them, and how far to trust them.' : 'Comes after a run.',
    },
    { label: 'Report', state: 'todo', detail: 'Export the PDF or PowerPoint report.' },
  ]
  const firstOpen = phases.findIndex((p) => p.state !== 'done')
  return phases.map((p, idx) => ({ ...p, current: idx === firstOpen }))
}
