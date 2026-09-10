// lib/costs/auto-populate.ts
// Auto-fill labor_cost + energy_cost on a component using cached BLS + EIA rates.

import { query, queryOne, execute } from '@/lib/db-helpers';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client';
import { fetchElectricityPrice, fetchNaturalGasPrice } from '@/lib/integrations/eia/client';
import { getLaborRate, ENERGY_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';

export interface AutoPopulateResult {
  laborSet: boolean;
  energySet: boolean;
  totalsSet: number;
}

export async function autoPopulateCosts(componentId: number): Promise<AutoPopulateResult> {
  const comp = await queryOne<any>(
    `SELECT c.component_id, c.labor_occupation, c.labor_hours, c.driver_type, c.quantity,
            ct.region_code
       FROM component c
       JOIN case_table ct ON c.case_id = ct.case_id
      WHERE c.component_id = ?`,
    [componentId],
  );
  if (!comp) throw new Error(`component ${componentId} not found`);

  const region = String(comp.region_code ?? 'US').slice(0, 2).toUpperCase();
  let laborSet = false;
  let energySet = false;
  let totalsSet = 0;

  // --- Labor cost ---------------------------------------------------
  if (comp.labor_occupation && comp.labor_hours) {
    try {
      const rate = await getOrFetchRate({
        type: 'labor',
        key: comp.labor_occupation,
        region,
        fetcher: async () => {
          const w = await fetchMedianHourlyWage(comp.labor_occupation, region);
          if (!w) throw new Error('no BLS data');
          return {
            rateValue: w.hourlyRate,
            unit: '$/hr',
            source: `BLS ${w.year}`,
            effectiveDate: `${w.year}-05-01`,
          };
        },
        staticFallback: () => {
          const lr = getLaborRate(comp.labor_occupation);
          return {
            rateValue: lr.rate,
            unit: '$/hr',
            source: `BLS OEWS reference ${REFERENCE_VINTAGE}`,
            effectiveDate: `${REFERENCE_VINTAGE}-01`,
          };
        },
      });
      const laborCost = rate.rateValue * parseFloat(String(comp.labor_hours));
      await execute(
        'UPDATE component SET labor_cost = ? WHERE component_id = ?',
        [laborCost, componentId],
      );
      laborSet = true;
      totalsSet++;
    } catch {
      /* leave labor_cost untouched */
    }
  }

  // --- Energy cost --------------------------------------------------
  // Fetch driver flows for this component
  const flows = await query<any>(
    `SELECT f.quantity, s.substance_name
       FROM flows f
       JOIN substances s ON f.substance_id = s.substance_id
      WHERE f.component_id = ? AND f.is_driver = 1`,
    [componentId],
  );

  let energyCost = 0;
  let energyFound = false;

  for (const f of flows) {
    const name = String(f.substance_name).toLowerCase();
    const qty = parseFloat(String(f.quantity));
    if (name.includes('electricity')) {
      try {
        const rate = await getOrFetchRate({
          type: 'electricity', key: 'grid', region,
          fetcher: async () => {
            const p = await fetchElectricityPrice(region);
            if (!p) throw new Error('no EIA data');
            return {
              rateValue: p.rateValue, unit: p.unit,
              source: `EIA ${p.period}`, effectiveDate: `${p.period}-01`,
            };
          },
          staticFallback: () => ({
            rateValue: ENERGY_RATES.electricity_industrial.rate,
            unit: '$/kWh',
            source: `EIA reference ${REFERENCE_VINTAGE}`,
            effectiveDate: `${REFERENCE_VINTAGE}-01`,
          }),
        });
        energyCost += rate.rateValue * qty;
        energyFound = true;
      } catch {
        /* skip this flow */
      }
    } else if (name.includes('natural gas')) {
      try {
        const rate = await getOrFetchRate({
          type: 'natural_gas', key: 'industrial', region,
          fetcher: async () => {
            const p = await fetchNaturalGasPrice(region);
            if (!p) throw new Error('no EIA data');
            return {
              rateValue: p.rateValue, unit: p.unit,
              source: `EIA ${p.period}`, effectiveDate: `${p.period}-01`,
            };
          },
          staticFallback: () => ({
            rateValue: ENERGY_RATES.natural_gas.rate,
            unit: '$/kWh',
            source: `EIA reference ${REFERENCE_VINTAGE}`,
            effectiveDate: `${REFERENCE_VINTAGE}-01`,
          }),
        });
        energyCost += rate.rateValue * qty;
        energyFound = true;
      } catch {
        /* skip this flow */
      }
    }
  }

  if (energyFound) {
    await execute(
      'UPDATE component SET energy_cost = ? WHERE component_id = ?',
      [energyCost, componentId],
    );
    energySet = true;
    totalsSet++;
  }

  return { laborSet, energySet, totalsSet };
}
