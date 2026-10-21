/**
 * Import lines held for review (migrate-040, E12 "lines held"). The import
 * (POST /api/ingest/apply) holds a line it cannot place; this keeps each one
 * as the document wrote it, so it can be resolved or dismissed later.
 */

import { z } from 'zod'

export type HeldReason = 'no_substance' | 'no_step' | 'unit'

export interface HeldLine {
  kind: 'flow' | 'cost'
  reason: HeldReason
  step_name?: string | null
  substance_text?: string | null
  substance_id?: number | null
  direction?: 'input' | 'output' | null
  quantity?: number | null
  unit?: string | null
  cost_category?: string | null
  amount?: number | null
  hours?: number | null
  occupation?: string | null
  provenance?: string | null
}

/** Plain words for a reason, as the response's held_details and the screens say it. */
export const HELD_REASON_TEXT: Record<HeldReason, string> = {
  no_substance: 'no confirmed substance match',
  no_step: 'no step chosen',
  unit: "the unit can't convert",
}

const cut = (v: unknown, max: number): string | null => (v == null || v === '' ? null : String(v).slice(0, max))
const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

type Conn = { query: (sql: string, params?: unknown[]) => Promise<any> }

/**
 * Keep held lines on the caller's connection (the import's transaction). A
 * database without migrate-040 keeps none: the response still lists them.
 * Returns how many were kept.
 */
export async function recordHeldLines(conn: Conn, caseId: number, userId: number, lines: HeldLine[]): Promise<number> {
  if (!lines.length) return 0
  try {
    for (const l of lines) {
      await conn.query(
        `INSERT INTO import_held_lines
           (case_id, line_kind, reason, step_name, substance_text, substance_id, direction, quantity, unit,
            cost_category, amount, hours, occupation, provenance, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          l.kind,
          l.reason,
          cut(l.step_name, 255),
          cut(l.substance_text, 500),
          num(l.substance_id),
          l.direction ?? null,
          num(l.quantity),
          cut(l.unit, 50),
          cut(l.cost_category, 20),
          num(l.amount),
          num(l.hours),
          cut(l.occupation, 10),
          cut(l.provenance, 1000),
          userId,
        ],
      )
    }
    return lines.length
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return 0
    throw err
  }
}

/** PUT /api/held-lines/[heldId]: resolve a line into a flow or a cost on a step of its case, or dismiss it. */
export const HeldLineAction = z.union([
  z.object({ action: z.literal('dismiss') }).strict(),
  z
    .object({
      action: z.literal('resolve'),
      component_id: z.number().int().positive(),
      /** Flow lines: the substance to use (defaults to the line's match). */
      substance_id: z.number().int().positive().optional(),
      /** Flow lines: override what the document said. */
      unit: z.string().trim().min(1).max(50).optional(),
      quantity: z.number().finite().min(0).optional(),
    })
    .strict(),
])
export type HeldLineAction = z.infer<typeof HeldLineAction>
