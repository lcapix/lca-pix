// app/api/integrations/bls/fetch-wage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardRateLookup, occupationCode, parseLookupBody, stateCode } from '@/lib/integrations/rate-lookup';
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { LABOR_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';
import { logIntegration } from '@/lib/integrations/log';
import { logFailure } from '@/lib/integrations/route-errors';

// Open to any signed-in user (the wage comes from BLS, not the caller); see
// lib/integrations/rate-lookup.ts.
const Body = z
  .object({ occupation: occupationCode, state: stateCode })
  .strict();

export async function POST(request: NextRequest) {
  const guard = await guardRateLookup(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

  const parsed = await parseLookupBody(
    request, Body, 'occupation must be a BLS OEWS code like 51-4121 and state a US state code or US',
  );
  if (parsed.response) return parsed.response;
  const { occupation, state } = parsed.data;

  try {
    const rate = await getOrFetchRate({
      type: 'labor',
      key: occupation,
      region: state,
      fetcher: async () => {
        const wage = await fetchMedianHourlyWage(occupation, state);
        if (!wage) throw new Error(`BLS returned no wage data for ${occupation} in ${state}`);
        return {
          rateValue: wage.hourlyRate,
          unit: '$/hr',
          source: `BLS OEWS ${wage.year}`,
          effectiveDate: `${wage.year}-05-01`,
        };
      },
      // No live data → curated BLS OEWS national-mean reference for this SOC
      // code (or the generic production-worker average).
      staticFallback: () => {
        const ref =
          Object.values(LABOR_RATES).find((r) => r.soc === occupation) ?? LABOR_RATES.generic;
        return {
          rateValue: ref.rate,
          unit: '$/hr',
          source: `Reference ${REFERENCE_VINTAGE} (${ref.label})`,
          effectiveDate: `${REFERENCE_VINTAGE}-01`,
        };
      },
    });
    await logIntegration({
      source: 'bls', action: 'fetch_wage',
      recordsAffected: 1, executedBy: userId,
      details: { occupation, state, rate: rate.rateValue },
    });
    return NextResponse.json({ success: true, rate });
  } catch (err) {
    await logFailure(
      { source: 'bls', action: 'fetch_wage', executedBy: userId, details: { occupation, state } },
      err, 'BLS fetch-wage failed',
    );
    return NextResponse.json({ error: 'Could not fetch the wage rate' }, { status: 500 });
  }
}
