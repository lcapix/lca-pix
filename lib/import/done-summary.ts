// The "done" step of the import page: the toast and summary sentence after an
// apply, the case-completeness hints, and which document to bring next. Pure.

import { LIVE_DOC_TYPES, type DocType } from '@/lib/ingest/doc-types'

/** What /api/ingest/apply answered, plus left_out (lines unticked at review). */
export interface ApplyResult {
  appended?: boolean
  case_id?: number
  case_name?: string
  flows_applied?: number
  flows_held_for_review?: number
  steps_used?: string[] | null
  cost_columns_updated?: number
  components_created?: number
  cost_nodes?: number
  held_details?: unknown
  left_out?: number
}

/** A layer a case still lacks, as /api/cases/:id/completeness reports it. */
export interface MissingLayer {
  layer: string
  label: string
  suggestedDocs?: string[]
}

/** The toast after a successful apply. */
export function appliedMessage(appending: boolean, caseName: string | undefined): string {
  return appending ? 'Document added to the case' : `Case created: ${caseName}`
}

/** Heading of the done card. */
export function doneTitle(applied: ApplyResult): string {
  return applied.appended ? 'Document added to the case' : 'Case created from document'
}

/** One-line summary of what an apply did (append vs create), with the left-out count only when non-zero. */
export function doneSummary(applied: ApplyResult): string {
  return applied.appended
    ? `${applied.flows_applied} flows added across ${(applied.steps_used ?? []).length} step(s)${
        (applied.steps_used ?? []).length ? ` (${applied.steps_used!.join(', ')})` : ''
      } · ${applied.flows_held_for_review} held for review${
        applied.left_out ? ` · ${applied.left_out} left out at review` : ''
      } · ${applied.cost_columns_updated} cost entries updated`
    : `${applied.components_created} steps created · ${applied.flows_applied} inputs and outputs added · ${applied.flows_held_for_review} held for review${
        applied.left_out ? ` · ${applied.left_out} left out at review` : ''
      } · costs on ${applied.cost_nodes} steps`
}

/** Where a missing layer comes from: the first two suggested documents, or the by-hand fallback. */
export function missingLayerHint(m: MissingLayer): string {
  return m.suggestedDocs?.length
    ? ` — from a ${m.suggestedDocs.slice(0, 2).join(' or ')}`
    : ' — no document type for this yet; enter it by hand on the step that uses it'
}

/**
 * The connector to preselect when continuing THIS case with the next document:
 * the one that fills the first layer still missing, tried in the order BOM,
 * equipment list, ITAC. Suggested documents are matched by their label.
 */
export function nextConnector(missing: MissingLayer[], docTypes: DocType[] = LIVE_DOC_TYPES): string | undefined {
  const ids = missing
    .flatMap((m: any) => m.suggestedDocs ?? [])
    .map((label: string) => docTypes.find((d) => d.label === label)?.id)
    .filter(Boolean) as string[]
  return ['bom', 'equipment', 'itac'].find((id) => ids.includes(id))
}
