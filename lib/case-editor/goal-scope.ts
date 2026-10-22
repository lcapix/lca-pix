// Goal & scope (ISO 14044 4.2) as data. Study-level fields (functional unit,
// boundary, goal, exclusions) live on the project and every case in it shares
// them; the reference flow and data basis belong to this case (one
// alternative).

export interface GoalScopeSummary {
  functionalUnit: string
  systemBoundary: string
  referenceFlow: number
  referenceFlowUnit: string
  modeledOutput: number
}

export const BOUNDARIES: Array<{ id: string; label: string }> = [
  { id: 'cradle-to-gate', label: 'Cradle-to-gate' },
  { id: 'gate-to-gate', label: 'Gate-to-gate' },
  { id: 'cradle-to-grave', label: 'Cradle-to-grave' },
]

/** The card's form, as typed (numbers as text). */
export interface GoalScopeForm {
  goalStatement: string
  functionalUnit: string
  systemBoundary: string
  boundaryNotes: string
  referenceFlow: string
  referenceFlowUnit: string
  modeledOutput: string
}

export const positiveString = (v: unknown): string => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? String(n) : '1'
}

export const toGoalScopeSummary = (s: GoalScopeForm): GoalScopeSummary => ({
  functionalUnit: s.functionalUnit.trim(),
  systemBoundary: s.systemBoundary,
  referenceFlow: Number(s.referenceFlow) || 1,
  referenceFlowUnit: s.referenceFlowUnit.trim(),
  modeledOutput: Number(s.modeledOutput) || 1,
})

/** Compact scale readout: 1, 0.0667, 1.92e-5. */
export const fmtScale = (x: number) =>
  !Number.isFinite(x) ? '?' : Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(3)))

/**
 * The form from GET /api/projects/:id → project and GET /api/cases/:id →
 * case, or null when the database has no goal & scope fields (no
 * migrate-014): then the card hides and nothing is blocked.
 */
export function goalScopeFromApi(p: any, c: any): GoalScopeForm | null {
  if (!('functional_unit' in p) || !('reference_flow' in c)) return null
  return {
    goalStatement: p.goal_statement ?? '',
    functionalUnit: p.functional_unit ?? '',
    systemBoundary: p.system_boundary ?? 'cradle-to-gate',
    boundaryNotes: p.boundary_notes ?? '',
    referenceFlow: positiveString(c.reference_flow),
    referenceFlowUnit: c.reference_flow_unit ?? '',
    modeledOutput: positiveString(c.modeled_output),
  }
}

/**
 * What Save sends (PUT project, PUT case) and what the card then holds, or
 * an error when the reference flow or data basis is not a number above 0.
 */
export function goalScopeSave(
  form: GoalScopeForm,
):
  | { ok: false; error: string }
  | { ok: true; project: Record<string, unknown>; case: Record<string, unknown>; next: GoalScopeForm } {
  const refFlow = Number(form.referenceFlow)
  const modeled = Number(form.modeledOutput)
  if (!(refFlow > 0) || !(modeled > 0)) {
    return { ok: false, error: 'Reference flow and data basis must be numbers above 0.' }
  }
  return {
    ok: true,
    project: {
      functional_unit: form.functionalUnit.trim(),
      system_boundary: form.systemBoundary,
      goal_statement: form.goalStatement.trim(),
      boundary_notes: form.boundaryNotes.trim(),
    },
    case: {
      reference_flow: refFlow,
      reference_flow_unit: form.referenceFlowUnit.trim(),
      modeled_output: modeled,
    },
    next: {
      goalStatement: form.goalStatement.trim(),
      functionalUnit: form.functionalUnit.trim(),
      systemBoundary: form.systemBoundary,
      boundaryNotes: form.boundaryNotes.trim(),
      referenceFlow: String(refFlow),
      referenceFlowUnit: form.referenceFlowUnit.trim(),
      modeledOutput: String(modeled),
    },
  }
}
