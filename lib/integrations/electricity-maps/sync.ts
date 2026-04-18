// lib/integrations/electricity-maps/sync.ts
import { queryOne, insert } from '@/lib/db-helpers';
import { fetchCarbonIntensity } from './client';

export async function syncZoneFactor(zone: string, method = 'CML 2001'): Promise<{
  zone: string; factorValue: number; inserted: boolean;
}> {
  const intensity = await fetchCarbonIntensity(zone);

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

  await insert(
    `INSERT INTO driver_impact_factors
       (substance_id, category_id, method_name, factor_value, unit,
        geographic_scope, source_reference)
     VALUES (?, ?, ?, ?, 'kg CO2 eq / kWh', ?, ?)
     ON DUPLICATE KEY UPDATE factor_value = VALUES(factor_value),
       source_reference = VALUES(source_reference),
       unit = VALUES(unit)`,
    [elec.substance_id, gw.category_id, method,
     intensity.carbonIntensity_kgCO2eq_per_kWh, zone,
     `Electricity Maps API ${new Date().toISOString().slice(0,10)}`],
  );

  return { zone, factorValue: intensity.carbonIntensity_kgCO2eq_per_kWh, inserted: true };
}
