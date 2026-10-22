// lib/integrations/openlca/import.ts
import { query, queryOne, insert } from '@/lib/db-helpers';
import type { FactorSeed } from './data/cml-2001-v4';
import { isSupportedMethod } from './methods';

export async function matchSubstance(seed: FactorSeed): Promise<number | null> {
  // 1. Exact CAS match
  if (seed.casNumber) {
    const byCas = await queryOne<any>(
      'SELECT substance_id FROM substances WHERE cas_number = ? LIMIT 1',
      [seed.casNumber],
    );
    if (byCas) return byCas.substance_id;
  }

  // 2. Exact canonical-name match
  const byName = await queryOne<any>(
    'SELECT substance_id FROM substances WHERE LOWER(substance_name) = LOWER(?) LIMIT 1',
    [seed.substanceName],
  );
  if (byName) return byName.substance_id;

  // 3. Alias match
  if (seed.aliases.length) {
    const likes = seed.aliases.map(() => 'LOWER(substance_name) = LOWER(?)').join(' OR ');
    const rows = await query<any>(
      `SELECT substance_id FROM substances WHERE ${likes} LIMIT 1`,
      seed.aliases,
    );
    if (rows.length) return rows[0].substance_id;
  }

  return null;
}

export interface ImportResult {
  method: string;
  inserted: number;
  substancesMatched: number;
  skippedNoSubstance: number;
  skippedNoCategory: number;
  /** A row for this (substance, category, method) is already on file; it is never updated. */
  skippedExisting: number;
  /** Migrations 017/024 moved this (substance, category) to 'QUARANTINE: <method>'. */
  skippedQuarantined: number;
  errors: string[];
}

/**
 * Seed a method's characterization factors into the shared library.
 *
 * Insert-only. The library has been audited since these seed files were
 * written (migrations 009, 011, 012, 015-017, 019, 024): values were
 * corrected and cited, and rows with the wrong unit for their category were
 * renamed to 'QUARANTINE: <method>'. So an import must never:
 *   - update a row that is already on file (it may carry an audited value), or
 *   - bring back a (substance, category, method) that has a QUARANTINE twin
 *     (the rename freed the unique key, so a plain insert would succeed).
 * It only fills (substance, category, method) rows that are missing.
 */
export async function importFactorMethod(
  methodName: string,
  seeds: FactorSeed[],
): Promise<ImportResult> {
  if (!isSupportedMethod(methodName)) {
    throw new Error(`Method "${methodName}" is not supported`);
  }

  const result: ImportResult = {
    method: methodName,
    inserted: 0,
    substancesMatched: 0,
    skippedNoSubstance: 0,
    skippedNoCategory: 0,
    skippedExisting: 0,
    skippedQuarantined: 0,
    errors: [],
  };

  // Cache impact_categories by lowercase name
  const categories = await query<any>(
    'SELECT category_id, category_name FROM impact_categories',
  );
  const catByName = new Map<string, number>(
    categories.map((c: any) => [c.category_name.toLowerCase(), c.category_id]),
  );

  // What is already on file for this method, and what was quarantined out of it.
  const quarantineName = `QUARANTINE: ${methodName}`;
  const onFile = await query<any>(
    `SELECT substance_id, category_id, method_name, geographic_scope
       FROM driver_impact_factors
      WHERE method_name IN (?, ?)`,
    [methodName, quarantineName],
  );
  const key = (substanceId: unknown, categoryId: unknown) => `${Number(substanceId)}|${Number(categoryId)}`;
  const quarantined = new Set<string>();
  const existing = new Set<string>();
  for (const r of onFile) {
    if (r.method_name === quarantineName) quarantined.add(key(r.substance_id, r.category_id));
    else if ((r.geographic_scope ?? 'Global') === 'Global') existing.add(key(r.substance_id, r.category_id));
  }

  for (const seed of seeds) {
    const substanceId = await matchSubstance(seed);
    if (!substanceId) {
      result.skippedNoSubstance++;
      continue;
    }
    result.substancesMatched++;

    for (const f of seed.factors) {
      const categoryId = catByName.get(f.impactCategory.toLowerCase());
      if (!categoryId) {
        result.skippedNoCategory++;
        continue;
      }
      const k = key(substanceId, categoryId);
      if (quarantined.has(k)) {
        result.skippedQuarantined++;
        continue;
      }
      if (existing.has(k)) {
        result.skippedExisting++;
        continue;
      }
      try {
        await insert(
          `INSERT INTO driver_impact_factors
             (substance_id, category_id, method_name, factor_value, unit,
              geographic_scope, factor_basis, source_reference)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [substanceId, categoryId, methodName, f.value, f.unit,
           'Global', seed.basis, `openLCA ${methodName}`],
        );
        existing.add(k);
        result.inserted++;
      } catch (e: any) {
        result.errors.push(`${seed.substanceName} → ${f.impactCategory}: ${e.message}`);
      }
    }
  }

  return result;
}
