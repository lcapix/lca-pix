// app/api/integrations/bls/fetch-wage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { LABOR_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';
import { logIntegration } from '@/lib/integrations/log';
import { logFailure } from '@/lib/integrations/route-errors';

const Body = z.object({
  occupation: z.string().regex(/^\d{2}-\d{4}$/, 'Occupation must be in BLS OEWS format e.g. 51-4121'),
  state: z.string().regex(/^([A-Z]{2}|US)$/, 'State must be a 2-letter code or "US"'),
});

export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid body',
      issues: parsed.error.issues,
    }, { status: 400 });
  }

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
