// app/api/integrations/eia/fetch-energy-price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardRateLookup, parseLookupBody, stateCode } from '@/lib/integrations/rate-lookup';
import { fetchElectricityPrice, fetchNaturalGasPrice } from '@/lib/integrations/eia/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { ENERGY_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';
import { logIntegration } from '@/lib/integrations/log';
import { logFailure } from '@/lib/integrations/route-errors';

// Open to any signed-in user (the price comes from EIA, not the caller); see
// lib/integrations/rate-lookup.ts.
const Body = z
  .object({
    fuel: z.enum(['electricity', 'natural_gas']),
    state: stateCode,
    sector: z.enum(['IND', 'COM', 'RES', 'ALL']).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const guard = await guardRateLookup(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

  const parsed = await parseLookupBody(
    request, Body, 'fuel must be electricity or natural_gas, state a US state code or US, sector IND, COM, RES or ALL',
  );
  if (parsed.response) return parsed.response;
  const { fuel, state, sector } = parsed.data;

  try {
    const rate = await getOrFetchRate({
      type: fuel === 'electricity' ? 'electricity' : 'natural_gas',
      key: fuel === 'electricity' ? (sector ?? 'IND') : 'industrial',
      region: state,
      fetcher: async () => {
        const p = fuel === 'electricity'
          ? await fetchElectricityPrice(state, sector ?? 'IND')
          : await fetchNaturalGasPrice(state);
        if (!p) throw new Error(`EIA returned no data for ${fuel} in ${state}`);
        return {
          rateValue: p.rateValue, unit: p.unit,
          source: `EIA ${p.period}`,
          effectiveDate: `${p.period}-01`,
        };
      },
      // No live key / EIA unavailable → curated EIA-average reference $/kWh.
      staticFallback: () => {
        const ref =
          fuel === 'electricity'
            ? sector === 'IND'
              ? ENERGY_RATES.electricity_industrial
              : sector === 'COM'
                ? ENERGY_RATES.electricity_commercial
                : ENERGY_RATES.electricity
            : ENERGY_RATES.natural_gas;
        return {
          rateValue: ref.rate,
          unit: '$/kWh',
          source: `Reference ${REFERENCE_VINTAGE} (${ref.label})`,
          effectiveDate: `${REFERENCE_VINTAGE}-01`,
        };
      },
    });
    await logIntegration({
      source: 'eia', action: 'fetch_energy_price',
      recordsAffected: 1, executedBy: userId,
      details: { fuel, state, sector, rate: rate.rateValue },
    });
    return NextResponse.json({ success: true, rate });
  } catch (err) {
    await logFailure(
      { source: 'eia', action: 'fetch_energy_price', executedBy: userId, details: { fuel, state, sector } },
      err, 'EIA fetch-energy-price failed',
    );
    return NextResponse.json({ error: 'Could not fetch the energy price' }, { status: 500 });
  }
}
