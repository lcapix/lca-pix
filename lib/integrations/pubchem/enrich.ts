// lib/integrations/pubchem/enrich.ts
import { queryOne, execute, query } from '@/lib/db-helpers';
import { fetchCompoundByName } from './client';

export interface EnrichResult {
  /** skipped_custom: a user's own substance. It is private to them, so its
   *  name is not sent to PubChem and its fields are not overwritten. */
  status: 'enriched' | 'not_found' | 'skipped_custom';
  cid?: number;
}

/** One batch run makes one PubChem call (plus a 200 ms pause) per substance,
 *  so an unbounded run times out a serverless function. */
export const ENRICH_DEFAULT_LIMIT = 50;
export const ENRICH_MAX_LIMIT = 500;

function clampLimit(limit: unknown): number {
  const n = Number(limit);
  if (!Number.isInteger(n) || n < 1) return ENRICH_DEFAULT_LIMIT;
  return Math.min(n, ENRICH_MAX_LIMIT);
}

export async function enrichSubstance(substanceId: number): Promise<EnrichResult> {
  const sub = await queryOne<any>(
    'SELECT substance_id, substance_name, is_custom FROM substances WHERE substance_id = ?',
    [substanceId],
  );
  if (!sub) throw new Error(`Substance ${substanceId} not found`);
  if (Number(sub.is_custom) === 1) return { status: 'skipped_custom' };

  const compound = await fetchCompoundByName(sub.substance_name);

  if (!compound) {
    // Stamp enriched_at so we do not retry forever
    await execute(
      'UPDATE substances SET enriched_at = NOW() WHERE substance_id = ? AND is_custom = 0',
      [substanceId],
    );
    return { status: 'not_found' };
  }

  await execute(
    `UPDATE substances
     SET molecular_formula = ?,
         molecular_weight  = ?,
         pubchem_cid       = ?,
         iupac_name        = ?,
         enriched_at       = NOW()
     WHERE substance_id = ? AND is_custom = 0`,
    [
      compound.molecularFormula,
      compound.molecularWeight,
      compound.cid,
      compound.iupacName,
      substanceId,
    ],
  );

  return { status: 'enriched', cid: compound.cid };
}

export async function enrichAllSubstances(options: {
  onlyMissing?: boolean;
  limit?: number;
} = {}): Promise<{ enriched: number; notFound: number; failed: number; total: number }> {
  const where = options.onlyMissing
    ? 'WHERE is_custom = 0 AND enriched_at IS NULL'
    : 'WHERE is_custom = 0';
  // Inlined, not a placeholder: mysql2's execute() rejects a numeric LIMIT ?.
  // clampLimit only ever returns an integer in 1..500.
  const limit = clampLimit(options.limit);

  const ids = await query<any>(
    `SELECT substance_id FROM substances ${where} ORDER BY substance_id LIMIT ${limit}`,
  );

  let enriched = 0, notFound = 0, failed = 0;
  for (const row of ids) {
    try {
      const r = await enrichSubstance(row.substance_id);
      if (r.status === 'enriched') enriched++; else notFound++;
      // Be polite: 200ms between calls (~5 req/s cap)
      await new Promise(r => setTimeout(r, 200));
    } catch {
      failed++;
    }
  }

  return { enriched, notFound, failed, total: ids.length };
}
