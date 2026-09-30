/**
 * Server-side parsing and writing of component fields, shared by
 * POST /api/cases/[caseId]/components and PUT /api/components/[componentId].
 *
 * Validation throws BadRequest (a 400 for the caller) before anything is
 * written. Nullable "unknown" fields are cleared when their key is sent as
 * null; an absent key leaves the column alone.
 */

import { query, execute } from '@/lib/db-helpers';
import { STAGE_IDS } from '@/lib/life-cycle';
import type { TreeRow } from '@/lib/component-tree';
import { COLUMN_LIMITS, decimalMax } from '@/lib/field-limits';

export class BadRequest extends Error {}

export const COMPONENT_TYPES = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'];
const COST_ALLOCATION_TYPES = ['manual', 'calculated', 'allocated'];

/** ABC cost-breakdown columns (a later migration; an older database may lack some). */
export const MONEY_COLUMNS = [
  'labor_cost',
  'energy_cost',
  'transportation_cost',
  'material_cost',
  'equipment_cost',
  'overhead_cost',
] as const;

export const has = (body: object, key: string) => Object.prototype.hasOwnProperty.call(body, key);

type ComponentColumns = typeof COLUMN_LIMITS.component;
/** The component columns that are DECIMAL(p, s). */
export type DecimalColumn = {
  [K in keyof ComponentColumns]: ComponentColumns[K] extends { kind: 'decimal' } ? K : never;
}[keyof ComponentColumns];

/**
 * null/undefined/'' → null; otherwise a finite number from 0 up to the largest
 * value the component's DECIMAL column holds (MySQL refuses a larger one as
 * "Out of range"), else BadRequest.
 */
export function nonNegative(column: DecimalColumn, v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0) throw new BadRequest(`${column} must be a number of 0 or more`);
  const max = decimalMax(COLUMN_LIMITS.component[column]);
  if (n > max) throw new BadRequest(`${column} must be at most ${max}`);
  return n;
}

/** life_cycle_stage from a body: undefined = not sent, null = clear, else a valid StageId. */
export function parseStage(body: Record<string, unknown>): string | null | undefined {
  if (!has(body, 'life_cycle_stage')) return undefined;
  const s = body.life_cycle_stage;
  if (s === null || s === undefined || s === '') return null;
  if (typeof s === 'string' && (STAGE_IDS as string[]).includes(s)) return s;
  throw new BadRequest(`life_cycle_stage must be one of ${STAGE_IDS.join(', ')}`);
}

/** The cost-breakdown columns a body sets, validated. */
export function parseCostColumns(body: Record<string, any>): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const col of MONEY_COLUMNS) {
    if (has(body, col)) out.push([col, nonNegative(col, body[col])]);
  }
  if (has(body, 'labor_hours')) out.push(['labor_hours', nonNegative('labor_hours', body.labor_hours)]);
  if (has(body, 'labor_occupation')) {
    const occ = body.labor_occupation;
    if (occ != null && occ !== '' && (typeof occ !== 'string' || occ.length > 10)) {
      throw new BadRequest('labor_occupation must be an SOC code such as 51-4121');
    }
    out.push(['labor_occupation', occ || null]);
  }
  if (body.currency != null) {
    if (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency)) {
      throw new BadRequest('currency must be a 3-letter ISO 4217 code');
    }
    out.push(['currency', body.currency.toUpperCase()]);
  }
  if (body.cost_allocation_type != null) {
    if (!COST_ALLOCATION_TYPES.includes(body.cost_allocation_type)) {
      throw new BadRequest('cost_allocation_type must be manual, calculated or allocated');
    }
    out.push(['cost_allocation_type', body.cost_allocation_type]);
  }
  return out;
}

/** The case's tree (ids, parents, stored depths), for placement checks. */
export async function loadCaseTree(caseId: number): Promise<TreeRow[]> {
  const rows = await query<any>(
    `SELECT component_id, parent_component_id, hierarchy_level FROM component
     WHERE case_id = ?`,
    [caseId],
  );
  return rows.map((r: any) => ({
    component_id: Number(r.component_id),
    parent_component_id: r.parent_component_id == null ? null : Number(r.parent_component_id),
    hierarchy_level: r.hierarchy_level == null ? null : Number(r.hierarchy_level),
  }));
}

/** Only the rows whose depth actually changes (updated_at feeds staleness checks). */
export function changedLevels(rows: TreeRow[], levels: Map<number, number>): Array<[number, number]> {
  const stored = new Map(rows.map((r) => [Number(r.component_id), Number(r.hierarchy_level)]));
  return [...levels].filter(([id, level]) => stored.get(id) !== level);
}

/**
 * UPDATE the given columns of one component. When the table lacks some of
 * them (an older database), retry with only the columns it has. Any other
 * error propagates: a failed edit is a 500, never a silent success.
 */
export async function updateExistingColumns(
  componentId: number,
  values: Array<[string, unknown]>,
  label = 'component',
): Promise<void> {
  if (values.length === 0) return;
  const run = (cols: Array<[string, unknown]>) =>
    execute(
      `UPDATE component SET ${cols.map(([c]) => `${c} = ?`).join(', ')} WHERE component_id = ?`,
      [...cols.map(([, v]) => v), componentId],
    );
  try {
    await run(values);
  } catch (err: any) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    const present = new Set(
      (await query<any>('SHOW COLUMNS FROM component')).map((r: any) => String(r.Field)),
    );
    const kept = values.filter(([c]) => present.has(c));
    console.warn(
      `[${label}] columns missing on this database, skipped:`,
      values.filter(([c]) => !present.has(c)).map(([c]) => c),
    );
    if (kept.length) await run(kept);
  }
}
