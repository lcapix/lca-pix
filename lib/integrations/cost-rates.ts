// lib/integrations/cost-rates.ts — thin cache for BLS/EIA/Metals API rate lookups.
import { queryOne, insert } from '@/lib/db-helpers';

export interface CostRate {
  rateValue: number;
  unit: string;
  source: string;
  effectiveDate: string;
}

export type CostRateType = 'labor' | 'electricity' | 'natural_gas' | 'material' | 'transport';

export interface GetOrFetchParams {
  type: CostRateType;
  key: string;
  region: string;
  maxAgeDays?: number;
  fetcher: () => Promise<CostRate>;
}

/**
 * Return a rate from cache if newer than `maxAgeDays`, otherwise call `fetcher`
 * to obtain a fresh value and cache it in cost_rates.
 */
export async function getOrFetchRate(params: GetOrFetchParams): Promise<CostRate> {
  const maxAgeDays = params.maxAgeDays ?? 30;

  const cached = await queryOne<any>(
    `SELECT rate_value, rate_unit, source, effective_date, fetched_at
       FROM cost_rates
      WHERE rate_type = ? AND rate_key = ? AND region_code = ?
      ORDER BY fetched_at DESC LIMIT 1`,
    [params.type, params.key, params.region],
  );

  if (cached) {
    const fetchedAt = new Date(cached.fetched_at).getTime();
    const ageMs = Date.now() - fetchedAt;
    if (ageMs < maxAgeDays * 24 * 60 * 60 * 1000) {
      return {
        rateValue: parseFloat(String(cached.rate_value)),
        unit: cached.rate_unit,
        source: cached.source,
        effectiveDate: String(cached.effective_date).slice(0, 10),
      };
    }
  }

  const fresh = await params.fetcher();
  await insert(
    `INSERT INTO cost_rates
       (rate_type, rate_key, region_code, rate_value, rate_unit, effective_date, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rate_value = VALUES(rate_value),
       rate_unit = VALUES(rate_unit), source = VALUES(source),
       fetched_at = CURRENT_TIMESTAMP`,
    [params.type, params.key, params.region, fresh.rateValue, fresh.unit,
     fresh.effectiveDate, fresh.source],
  );
  return fresh;
}
