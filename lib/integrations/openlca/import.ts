// lib/integrations/openlca/import.ts
import { query, queryOne, insert } from '@/lib/db-helpers';
import type { FactorSeed } from './data/cml-2001-v4';

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
  errors: string[];
}

export async function importFactorMethod(
  methodName: string,
  seeds: FactorSeed[],
): Promise<ImportResult> {
  const result: ImportResult = {
    method: methodName,
    inserted: 0,
    substancesMatched: 0,
    skippedNoSubstance: 0,
    skippedNoCategory: 0,
    errors: [],
  };

  // Cache impact_categories by lowercase name
  const categories = await query<any>(
    'SELECT category_id, category_name FROM impact_categories',
  );
  const catByName = new Map<string, number>(
    categories.map((c: any) => [c.category_name.toLowerCase(), c.category_id]),
  );

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
      try {
        await insert(
          `INSERT INTO driver_impact_factors
             (substance_id, category_id, method_name, factor_value, unit,
              geographic_scope, factor_basis, source_reference)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE factor_value = VALUES(factor_value),
             unit = VALUES(unit), factor_basis = VALUES(factor_basis),
             source_reference = VALUES(source_reference)`,
          [substanceId, categoryId, methodName, f.value, f.unit,
           'Global', seed.basis, `openLCA ${methodName}`],
        );
        result.inserted++;
      } catch (e: any) {
        result.errors.push(`${seed.substanceName} → ${f.impactCategory}: ${e.message}`);
      }
    }
  }

  return result;
}
