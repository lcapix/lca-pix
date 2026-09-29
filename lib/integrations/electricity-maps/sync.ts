// lib/integrations/electricity-maps/sync.ts
import { queryOne, insert, execute } from '@/lib/db-helpers';
import { fetchCarbonIntensity } from './client';
import { getGridCarbon, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';
import { isSupportedMethod } from '@/lib/integrations/openlca/methods';
import { isSyncZone } from './zones';

export interface SyncResult {
  zone: string;
  factorValue: number;
  inserted: boolean;              // did we write/replace the factor row?
  source: 'live' | 'reference';
  sourceRef: string;
}

/**
 * Rows this sync wrote itself (an earlier live reading, or a reference gap
 * fill). Only these may be replaced. Everything else on file is a curated,
 * cited factor (e.g. the audited eGRID 2023 US value of 0.350) that every
 * run uses, and one hourly reading must never replace it.
 */
const SYNC_WRITTEN = /^(Electricity Maps API |Reference )/;

/**
 * Refresh the electricity Global-Warming factor for a zone.
 *
 *  - Nothing on file for zone + method → write the live reading, or the
 *    curated yearly-average reference when there is no live data.
 *  - A row this sync wrote earlier → replace it with a new live reading.
 *  - Any other row (curated / audited) → keep it untouched.
 *
 * Database errors are not caught: a failed write must fail the zone, not be
 * reported as "kept".
 */
export async function syncZoneFactor(zone: string, method = 'CML 2001'): Promise<SyncResult> {
  if (!isSyncZone(zone)) throw new Error(`Unsupported zone "${zone}"`);
  if (!isSupportedMethod(method)) throw new Error(`Unsupported method "${method}"`);

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

  const existing = await queryOne<any>(
    `SELECT factor_id, factor_value, source_reference FROM driver_impact_factors
      WHERE substance_id = ? AND category_id = ? AND method_name = ? AND geographic_scope = ?
      LIMIT 1`,
    [elec.substance_id, gw.category_id, method, zone],
  );

  const keep = (): SyncResult => ({
    zone,
    factorValue: Number(existing.factor_value),
    inserted: false,
    source: 'reference',
    sourceRef: `Kept existing factor: ${existing.source_reference ?? 'on record'}`,
  });

  const insertNew = (value: number, ref: string) =>
    insert(
      `INSERT INTO driver_impact_factors
         (substance_id, category_id, method_name, factor_value, unit,
          geographic_scope, source_reference)
       VALUES (?, ?, ?, ?, 'kg CO2 eq / kWh', ?, ?)`,
      [elec.substance_id, gw.category_id, method, value, zone, ref],
    );

  // Only live Electricity Maps data can replace a row, and only one this
  // sync wrote. A fetch failure (no key, API down, no reading) is the one
  // thing that falls back.
  let liveValue: number | null = null;
  try {
    const intensity = await fetchCarbonIntensity(zone);
    const v = intensity.carbonIntensity_kgCO2eq_per_kWh;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) liveValue = v;
  } catch {
    liveValue = null;
  }

  if (liveValue !== null) {
    const ref = `Electricity Maps API ${new Date().toISOString().slice(0, 10)}`;
    if (!existing) {
      await insertNew(liveValue, ref);
      return { zone, factorValue: liveValue, inserted: true, source: 'live', sourceRef: ref };
    }
    if (!SYNC_WRITTEN.test(String(existing.source_reference ?? ''))) return keep();
    await execute(
      `UPDATE driver_impact_factors
          SET factor_value = ?, source_reference = ?, unit = 'kg CO2 eq / kWh'
        WHERE factor_id = ?`,
      [liveValue, ref, existing.factor_id],
    );
    return { zone, factorValue: liveValue, inserted: true, source: 'live', sourceRef: ref };
  }

  // No live data. Never clobber an existing factor.
  if (existing) return keep();

  // No factor on file for this zone → fill the gap with the curated average.
  const refRate = getGridCarbon(zone);
  const ref = `Reference ${REFERENCE_VINTAGE} (${refRate.label})`;
  await insertNew(refRate.factor, ref);
  return { zone, factorValue: refRate.factor, inserted: true, source: 'reference', sourceRef: ref };
}
