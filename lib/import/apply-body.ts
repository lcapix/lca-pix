// Request body for POST /api/ingest/apply, built from the plan and the
// reviewer's decisions: which flows go (and to which step), which notes are
// kept, and whether a new case is created or lines are appended to one. Pure.

import type { CostMode } from '@/lib/ingest/cost-columns'
import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import { correctedQuantity, costKey, flowKey, type FlowEdit } from '@/lib/import/review'

/** Maps a step's original name to its name after the reviewer's edits. */
export type FinalName = (name: string | null | undefined) => string | null

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
 * appending, each carries its own placed step (null when it has none: the
 * server then uses its document step, else the default step); when creating,
 * attach_component_id is left undefined. A non-blank unit override
 * (trimmed) replaces the flow's unit. A corrected quantity replaces the
 * document's, and the provenance records what the document said. A renamed
 * step (finalName) is carried onto the flow so it still lands on that step.
 */
export function buildApplyFlows(args: {
  plan: IngestPlan
  edits: Record<number, FlowEdit>
  appending: boolean
  placement: Record<string, number | null>
  attachComponentId: number | null
  finalName?: FinalName
}): ApplyFlow[] {
  const { plan, edits, appending, placement, finalName } = args
  return plan.flows
    .map((f, i) => ({ f, e: edits[i], i }))
    .filter(({ e }) => e?.include && e.substance_id !== null)
    .map(({ f, e, i }) => {
      const corrected = correctedQuantity(f, e)
      return {
        ...f,
        ...(finalName ? { node: finalName(f.node) ?? f.node } : {}),
        // Only the line's own step: the default goes once, as the body's
        // attach_component_id, so the server can tell the two apart and put a
        // line on its document step before falling back to the default.
        attach_component_id: appending ? placement[flowKey(f, i)] ?? null : undefined,
        substance_id: e.substance_id,
        substance_name: e.substance_name,
        // Item 12a: honor a reviewer's unit override (e.g. "kg CO2e" → "kg").
        unit: e.unit && e.unit.trim() ? e.unit.trim() : f.unit,
        ...(corrected !== null
          ? {
              quantity: corrected,
              provenance: `${f.provenance ?? ''} · quantity corrected at review (document said ${f.quantity})`.trim(),
            }
          : {}),
      }
    })
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
        `Column "${col}": marked as ${role} at review, kept until a reader maps it.`,
    )
  return [...keptNotes, ...roleNotes]
}

/**
 * The apply body. Appending (a target case is set): the target case, the
 * default step, the flows and every cost with its own placed step (null when
 * it has none; the server falls back to the document step, then the default). Creating: the project, the case name (blank falls back to the plan's),
 * the plan's nodes, the flows and the plan's costs as they are.
 *
 * With the reviewer's step edits (steps), the edited steps replace the plan's
 * and each cost follows its step's new name. Appending, the steps go with
 * their attach / create / skip decisions (nodeActions), so a routing appended
 * to a live case merges its steps instead of duplicating them.
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
  steps?: {
    nodes: IngestPlan['nodes']
    finalName: FinalName
    nodeActions: Record<string, { action: 'attach' | 'create' | 'skip'; component_id: number | null }>
  }
  /** Appending: keep / replace / add for each step that already has a cost the document writes. */
  costModes?: Record<string, CostMode>
  /** Appending: the same for each step that already has a flow of the document's substance. */
  flowModes?: Record<string, CostMode>
}) {
  const { plan, projectId, caseName, targetCaseId, attachComponentId, placement, flows, notes, steps, costModes, flowModes } = args
  const appending = targetCaseId !== null
  const costs = steps
    ? plan.costs.map((c) => ({ ...c, node: steps.finalName(c.node) ?? c.node }))
    : plan.costs
  return appending
    ? {
        target_case_id: targetCaseId,
        attach_component_id: attachComponentId,
        ...(steps ? { nodes: steps.nodes, node_actions: steps.nodeActions } : {}),
        ...(costModes ? { cost_modes: costModes } : {}),
        ...(flowModes ? { flow_modes: flowModes } : {}),
        flows,
        costs: costs.map((c, i) => ({
          ...c,
          attach_component_id: placement[costKey(c, i)] ?? null,
        })),
        notes,
      }
    : {
        project_id: Number(projectId),
        case_name: caseName.trim() || plan.case_name,
        nodes: steps ? steps.nodes : plan.nodes,
        flows,
        costs,
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
