// Review-screen logic for the import page: the per-flow edit state, the note
// parser that pulls unmapped columns out of the plan's notes, the keys that tie
// a line to its step, and the count of lines still without a step. Pure.

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'

/** The reviewer's decision for one extracted flow. */
export interface FlowEdit {
  include: boolean
  substance_id: number | null
  substance_name: string | null
  /** User unit override (item 12a) — replaces the flow's unit on apply when set.
   * Lets a held "kg CO2e" be corrected to "kg" instead of being silently dropped. */
  unit?: string
}

// Roles a reviewer can assign to an unmapped column (item 3). 'ignore' drops it;
// any other role is recorded on the case so the column is acknowledged, not lost.
/** [value, label] pairs for the unmapped-column role picker. */
export const COLUMN_ROLES: Array<[string, string]> = [
  ['ignore', 'Ignore'],
  ['note', 'Keep as a note'],
  ['material', 'Material'],
  ['quantity', 'Quantity'],
  ['unit', 'Unit'],
  ['cost', 'Cost'],
  ['subassembly', 'Sub-assembly'],
]
// A routing or equipment column is never a BOM field (Tooling is not a
// material): only ignore it or keep it as a note.
/** The roles offered for a connector: all of them for a BOM, else ignore / note only. */
export const rolesFor = (connector: string): Array<[string, string]> =>
  connector === 'bom' ? COLUMN_ROLES : COLUMN_ROLES.filter(([v]) => v === 'ignore' || v === 'note')

/** A plan note that names a column the connector read but did not map. */
export interface UnmappedColumnNote {
  kind: 'column'
  column: string
  sample: string
  noteIndex: number
}

/** Any other plan note. */
export interface PlainNote {
  kind: 'plain'
  note: string
  noteIndex: number
}

export type ParsedNote = UnmappedColumnNote | PlainNote

// Split the plan's notes into structured unmapped-column items (which get a
// role picker, item 3) and plain notes (dismissible, item 4). Unmapped columns
// are parsed out of the note text the connectors emit.
/** Parse one note; noteIndex is its position in plan.notes (what dismissal is keyed by). */
export function parseNote(note: string, noteIndex: number): ParsedNote {
  const m = note.match(/^Column "([^"]+)" was read but not mapped(?: \(e\.g\. "([^"]*)"\))?/)
  return m
    ? { kind: 'column' as const, column: m[1], sample: m[2] ?? '', noteIndex }
    : { kind: 'plain' as const, note, noteIndex }
}

/** All notes parsed, split into unmapped columns and plain notes (each keeps its note index). */
export function parseNotes(notes: string[]): {
  unmappedColumns: UnmappedColumnNote[]
  plainNotes: PlainNote[]
} {
  const parsedNotes = notes.map((note, noteIndex) => parseNote(note, noteIndex))
  const unmappedColumns = parsedNotes.filter(
    (n): n is UnmappedColumnNote => n.kind === 'column',
  )
  const plainNotes = parsedNotes.filter((n): n is PlainNote => n.kind === 'plain')
  return { unmappedColumns, plainNotes }
}

// A flow and the cost from the same document row share one placement.
/** Placement key of a flow: its provenance, or flow-<index> when it has none. */
export const flowKey = (f: MappedFlow, i: number) => f.provenance || `flow-${i}`

/** Placement key of a cost: "<doc> · <locator>" from its provenance, or cost-<index>. */
export const costKey = (c: IngestPlan['costs'][number], i: number) =>
  c.provenance ? `${c.provenance.doc} · ${c.provenance.locator}` : `cost-${i}`

/** The edit state a fresh plan starts with: every flow keyed by index, ticked only when confidently matched. */
export function initialEdits(flows: MappedFlow[]): Record<number, FlowEdit> {
  const init: Record<number, FlowEdit> = {}
  flows.forEach((f, i) => {
    init[i] = {
      // Only a confident match is ticked; anything below 90% waits for the
      // reviewer to confirm it (nothing uncertain is applied silently).
      include: f.substance_id !== null && (f.match_score ?? 0) >= 0.9,
      substance_id: f.substance_id,
      substance_name: f.substance_name,
    }
  })
  return init
}

/**
 * Lines (applied flows + costs) with no step yet, when appending; 0 when there
 * is no plan or a new case is being created. Lines sharing a key count once.
 */
export function countUnplaced(args: {
  plan: IngestPlan | null
  appending: boolean
  edits: Record<number, FlowEdit>
  placement: Record<string, number | null>
  attachComponentId: number | null
}): number {
  const { plan, appending, edits, placement, attachComponentId } = args
  return plan && appending
    ? new Set(
        [
          ...plan.flows.map((f, i) =>
            edits[i]?.include && edits[i]?.substance_id !== null ? flowKey(f, i) : null,
          ),
          ...plan.costs.map((c, i) => costKey(c, i)),
        ].filter((k): k is string => !!k && (placement[k] ?? attachComponentId) == null),
      ).size
    : 0
}

/** How many review lines are still showing (not dismissed). */
export function remainingReviewCount(review: string[], dismissed: Set<number>): number {
  return review.filter((_, i) => !dismissed.has(i)).length
}

/** How many parsed notes are still showing (their note index not dismissed). */
export function remainingNoteCount(notes: Array<{ noteIndex: number }>, dismissed: Set<number>): number {
  return notes.filter((n) => !dismissed.has(n.noteIndex)).length
}
