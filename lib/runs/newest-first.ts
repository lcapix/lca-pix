/**
 * A case's runs, newest first, without sorting their snapshots.
 *
 * A run's frozen snapshot (run_snapshot) grows with the case: 2.8 MB for a
 * 1,000-step case with 5,000 flows. MySQL sorts whole rows in a buffer of
 * sort_buffer_size (256 KB by default, on RDS too), so `SELECT ar.* ...
 * ORDER BY` over such a row fails with ER_OUT_OF_SORTMEMORY (stage 10.3
 * found it on the large case). The fix is a deferred join: sort the run ids
 * alone, then read the wide rows by id and put them back in that order.
 */
import type { RowDataPacket } from '@/lib/db';
import { query } from '@/lib/db-helpers';

/** Which runs count: completed only, or completed plus the older rows that predate status. */
export type RunStatusFilter = 'any' | 'completed' | 'completed-or-unset';
/** Newest by date with run_id breaking ties (run_date has one-second precision), or by run_id alone. */
export type RunOrder = 'date' | 'id';

const STATUS_SQL: Record<RunStatusFilter, string> = {
  any: '',
  completed: " AND status = 'completed'",
  'completed-or-unset': " AND (status IS NULL OR status = 'completed')",
};
const ORDER_SQL: Record<RunOrder, string> = {
  date: 'run_date DESC, run_id DESC',
  id: 'run_id DESC',
};

export async function newestRunIds(
  caseId: number,
  opts: { status?: RunStatusFilter; order?: RunOrder; limit?: number } = {},
): Promise<number[]> {
  const limit = opts.limit && Number.isInteger(opts.limit) && opts.limit > 0 ? ` LIMIT ${opts.limit}` : '';
  const rows = await query<RowDataPacket & { run_id: number }>(
    `SELECT run_id FROM assessment_runs
      WHERE case_id = ?${STATUS_SQL[opts.status ?? 'any']}
      ORDER BY ${ORDER_SQL[opts.order ?? 'date']}${limit}`,
    [caseId],
  );
  return rows.map((r) => Number(r.run_id));
}

/** `rows` (read by `WHERE run_id IN (ids)`) in the order of `ids`; ids with no row are skipped. */
export function inRunOrder<T extends { run_id: unknown }>(ids: number[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [Number(r.run_id), r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => r !== undefined);
}

/** "?, ?, ?" for an IN list of n ids. */
export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/**
 * Each completed run's place in its own case, oldest first: Run 1, Run 2 (2.8).
 * Screens say "Run 1 of this case"; only exports keep the site-wide run id.
 */
export async function caseRunNumbers(caseId: number): Promise<Map<number, number>> {
  const ids = await newestRunIds(caseId, { status: 'completed-or-unset', order: 'id' });
  const oldestFirst = [...ids].sort((a, b) => a - b);
  return new Map(oldestFirst.map((id, i) => [id, i + 1]));
}
