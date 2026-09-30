/**
 * Server-side checks shared by the flow routes
 * (POST /api/components/[id]/flows, PUT /api/flows/[id]).
 */

import { queryOne } from '@/lib/db-helpers';

/**
 * A flow quantity: a finite number ≥ 0 (numeric strings accepted). The schema
 * has no credit/avoided-burden flag, so a negative quantity is never a
 * deliberate credit here, just a typo the engine would count as one.
 * Returns null when the value is not a valid quantity.
 */
export function parseFlowQuantity(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const QUANTITY_ERROR = 'quantity must be a number of 0 or more';

/**
 * The substance, if the caller may use it: a library row, or a custom
 * substance the caller created (security audit L3). Another user's private
 * substance reads as not found, so its name is never echoed back.
 */
export async function findUsableSubstance(
  substanceId: unknown,
  userId: number,
): Promise<{ default_unit?: string | null; substance_name?: string } | null> {
  const id = Number(substanceId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    return await queryOne<any>(
      `SELECT unit AS default_unit, substance_name FROM substances
        WHERE substance_id = ? AND (is_custom = 0 OR created_by = ?)`,
      [id, userId],
    );
  } catch (err: any) {
    // No migrate-020: there are no custom substances, so every row is library.
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    return await queryOne<any>(
      `SELECT unit AS default_unit, substance_name FROM substances WHERE substance_id = ?`,
      [id],
    );
  }
}

export const SUBSTANCE_ERROR = 'Unknown substance. Pick one from the catalog or add your own.';
