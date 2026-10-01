// Request body for POST /api/ingest/apply, built from the plan and the
// reviewer's decisions: which flows go (and to which step), which notes are
// kept, and whether a new case is created or lines are appended to one. Pure.

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import { costKey, flowKey, type FlowEdit } from '@/lib/import/review'

/** A flow as sent to apply: the mapped flow with the reviewer's substance, unit and step. */
export type ApplyFlow = MappedFlow & {
  attach_component_id: number | null | undefined
  substance_id: number | null
  substance_name: string | null
  unit: string
}

/** A case of the project, as listed in the ADD TO picker. */
export interface ProjectCase {
  case_id: number
  case_name: string
}

/** The error shown when apply is tried while lines still have no step. */
export function unplacedError(unplacedCount: number): string {
  return `${unplacedCount} line(s) still need a step: pick one in the STEP column, or set a default step above.`
}

/**
 * The flows to apply: ticked lines that have a substance, in plan order. When
 * appending, each goes to its placed step, else the default step; when
 * creating, attach_component_id is left undefined. A non-blank unit override
 * (trimmed) replaces the flow's unit.
 */
export function buildApplyFlows(args: {
  plan: IngestPlan
  edits: Record<number, FlowEdit>
  appending: boolean
  placement: Record<string, number | null>
  attachComponentId: number | null
}): ApplyFlow[] {
  const { plan, edits, appending, placement, attachComponentId } = args
  return plan.flows
    .map((f, i) => ({ f, e: edits[i], i }))
    .filter(({ e }) => e?.include && e.substance_id !== null)
    .map(({ f, e, i }) => ({
      ...f,
      attach_component_id: appending ? placement[flowKey(f, i)] ?? attachComponentId : undefined,
      substance_id: e.substance_id,
      substance_name: e.substance_name,
      // Item 12a: honor a reviewer's unit override (e.g. "kg CO2e" → "kg").
      unit: e.unit && e.unit.trim() ? e.unit.trim() : f.unit,
    }))
}

/**
 * Notes the reviewer kept (item 4), plus their unmapped-column role
 * decisions (item 3), so nothing is silently dropped and choices persist.
 * A column left on 'ignore' (or with no role) adds no note.
 */
export function buildOutNotes(
  notes: string[],
  dismissedNotes: Set<number>,
  columnRoles: Record<string, string>,
): string[] {
  const keptNotes = notes.filter((_, i) => !dismissedNotes.has(i))
  const roleNotes = Object.entries(columnRoles)
    .filter(([, role]) => role && role !== 'ignore')
    .map(
      ([col, role]) =>
        `Column "${col}" — marked as ${role} by reviewer (pending a connector to map it).`,
    )
  return [...keptNotes, ...roleNotes]
}

/**
 * The apply body. Appending (a target case is set): the target case, the
 * default step, the flows and every cost on its placed step (else the default
 * step). Creating: the project, the case name (blank falls back to the plan's),
 * the plan's nodes, the flows and the plan's costs as they are.
 */
export function buildApplyBody(args: {
  plan: IngestPlan
  projectId: string
  caseName: string
  targetCaseId: number | null
  attachComponentId: number | null
  placement: Record<string, number | null>
  flows: ApplyFlow[]
  notes: string[]
}) {
  const { plan, projectId, caseName, targetCaseId, attachComponentId, placement, flows, notes } = args
  const appending = targetCaseId !== null
  return appending
    ? {
        target_case_id: targetCaseId,
        attach_component_id: attachComponentId,
        flows,
        costs: plan.costs.map((c, i) => ({
          ...c,
          attach_component_id: placement[costKey(c, i)] ?? attachComponentId,
        })),
        notes,
      }
    : {
        project_id: Number(projectId),
        case_name: caseName.trim() || plan.case_name,
        nodes: plan.nodes,
        flows,
        costs: plan.costs,
        notes,
      }
}

/** Name for a just-created case in the ADD TO picker: the typed name, else the plan's, else "Case <id>". */
export function createdCaseName(caseName: string, planCaseName: string, caseId: number): string {
  return caseName.trim() || planCaseName || `Case ${caseId}`
}

/** The project's cases with a just-created case added at the end (unchanged if already listed). */
export function withCreatedCase(prev: ProjectCase[], caseId: number, caseName: string): ProjectCase[] {
  return prev.some((c) => c.case_id === caseId)
    ? prev
    : [
        ...prev,
        {
          case_id: caseId,
          case_name: caseName,
        },
      ]
}
