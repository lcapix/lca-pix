// lib/integrations/pubchem/enrich.ts
import { queryOne, execute, query } from '@/lib/db-helpers';
import { fetchCompoundByName } from './client';

export interface EnrichResult {
  status: 'enriched' | 'not_found';
  cid?: number;
}

export async function enrichSubstance(substanceId: number): Promise<EnrichResult> {
  const sub = await queryOne<any>(
    'SELECT substance_id, substance_name FROM substances WHERE substance_id = ?',
    [substanceId],
  );
  if (!sub) throw new Error(`Substance ${substanceId} not found`);

  const compound = await fetchCompoundByName(sub.substance_name);

  if (!compound) {
    // Stamp enriched_at so we do not retry forever
    await execute(
      'UPDATE substances SET enriched_at = NOW() WHERE substance_id = ?',
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
     WHERE substance_id = ?`,
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
  const where = options.onlyMissing ? 'WHERE enriched_at IS NULL' : '';
  const limit = options.limit ? `LIMIT ${options.limit}` : '';

  const ids = await query<any>(
    `SELECT substance_id FROM substances ${where} ORDER BY substance_id ${limit}`,
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
