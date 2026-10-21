'use client'

import type { PlaceableStep } from '@/lib/ingest/placement'
import { confidenceColor } from '@/lib/import/display'
import type { PlacementWhy } from '@/lib/import/placement-suggestions'

/** What every STEP picker needs: the placements, their reasons, the steps and the default step. */
export interface StepPicker {
  placement: Record<string, number | null>
  placementWhy: Record<string, PlacementWhy>
  steps: PlaceableStep[]
  attachComponentId: number | null
  /** Lines going to a step the document creates, by key: the new step's name. */
  newStep?: Record<string, string>
  onChoose: (key: string, stepId: number | null) => void
}

// The STEP picker for one line when appending, with why it was suggested.
/** The STEP picker for the line with this placement key. */
export function StepCell({ stepKey, picker }: { stepKey: string; picker: StepPicker }) {
  const { placement, placementWhy, steps, attachComponentId, newStep = {}, onChoose } = picker
  const why = placementWhy[stepKey]
  return (
    <div>
      <select
        className="ds-input"
        style={{ minWidth: 190 }}
        data-unplaced={placement[stepKey] == null && !newStep[stepKey] && !attachComponentId ? 'true' : undefined}
        value={placement[stepKey] ?? ''}
        aria-label="Step this line is used at"
        onChange={(ev) => {
          const v = ev.target.value ? Number(ev.target.value) : null
          onChoose(stepKey, v)
        }}
      >
        <option value="">
          {newStep[stepKey]
            ? `New step: ${newStep[stepKey]}`
            : attachComponentId
              ? 'The default step'
              : 'Choose a step'}
        </option>
        {steps.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {why && (
        <div style={{ fontSize: 12, marginTop: 4, color: confidenceColor(why.confidence) }}>
          {why.reason}
        </div>
      )}
    </div>
  )
}
