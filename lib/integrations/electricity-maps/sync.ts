// lib/integrations/electricity-maps/sync.ts
import { queryOne, insert } from '@/lib/db-helpers';
import { fetchCarbonIntensity } from './client';
import { getGridCarbon, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';

export interface SyncResult {
  zone: string;
  factorValue: number;
  inserted: boolean;              // did we write/replace the factor row?
  source: 'live' | 'reference';
  sourceRef: string;
}

/**
 * Refresh the electricity Global-Warming factor for a zone.
 *
 * Safety rule that matters: this must NEVER silently degrade a curated,
 * audited factor (e.g. the eGRID-2023 US value of 0.350) with a coarser
 * reference guess. So:
 *  - LIVE Electricity Maps data (a real key present) → upsert it; the user
 *    has explicitly opted into real-time grid carbon for this zone.
 *  - No key / API error → do NOT overwrite. If an existing factor is on file
 *    for this zone+method, return it untouched (source 'reference' = "kept the
 *    factor already on record"). Only when NO factor exists for this zone do we
 *    write the curated yearly-average reference, to fill a genuine gap.
 */
export async function syncZoneFactor(zone: string, method = 'CML 2001'): Promise<SyncResult> {
  const elec = await queryOne<any>(
    `SELECT substance_id FROM substances
      WHERE LOWER(substance_name) IN ('electricity','electricity, grid mix')
      ORDER BY substance_id LIMIT 1`,
  );
  if (!elec) throw new Error('Electricity substance not found in catalog');

  const gw = await queryOne<any>(
    `SELECT category_id FROM impact_categories
      WHERE LOWER(category_name) LIKE '%global warming%' LIMIT 1`,
  );
  if (!gw) throw new Error('Global Warming impact category not found');

  const upsert = (value: number, ref: string) =>
    insert(
      `INSERT INTO driver_impact_factors
         (substance_id, category_id, method_name, factor_value, unit,
          geographic_scope, source_reference)
       VALUES (?, ?, ?, ?, 'kg CO2 eq / kWh', ?, ?)
       ON DUPLICATE KEY UPDATE factor_value = VALUES(factor_value),
         source_reference = VALUES(source_reference), unit = VALUES(unit)`,
      [elec.substance_id, gw.category_id, method, value, zone, ref],
    );

  // 1) Try live Electricity Maps. Only live data is authoritative enough to
  //    replace whatever is on file.
  try {
    const intensity = await fetchCarbonIntensity(zone);
    const value = intensity.carbonIntensity_kgCO2eq_per_kWh;
    const ref = `Electricity Maps API ${new Date().toISOString().slice(0, 10)}`;
    await upsert(value, ref);
    return { zone, factorValue: value, inserted: true, source: 'live', sourceRef: ref };
  } catch {
    // 2) No live data. Never clobber an existing (possibly audited) factor.
    const existing = await queryOne<any>(
      `SELECT factor_value, source_reference FROM driver_impact_factors
        WHERE substance_id = ? AND category_id = ? AND method_name = ? AND geographic_scope = ?
        LIMIT 1`,
      [elec.substance_id, gw.category_id, method, zone],
    );
    if (existing) {
      return {
        zone,
        factorValue: Number(existing.factor_value),
        inserted: false,
        source: 'reference',
        sourceRef: `Kept existing factor: ${existing.source_reference ?? 'on record'}`,
      };
    }
    // 3) No factor on file for this zone → fill the gap with the curated average.
    const refRate = getGridCarbon(zone);
    const ref = `Reference ${REFERENCE_VINTAGE} (${refRate.label})`;
    await upsert(refRate.factor, ref);
    return { zone, factorValue: refRate.factor, inserted: true, source: 'reference', sourceRef: ref };
  }
}
