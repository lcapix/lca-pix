// app/api/integrations/bls/fetch-wage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  occupation: z.string().regex(/^\d{2}-\d{4}$/, 'Occupation must be in BLS OEWS format e.g. 51-4121'),
  state: z.string().regex(/^([A-Z]{2}|US)$/, 'State must be a 2-letter code or "US"'),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

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
    });
    await logIntegration({
      source: 'bls', action: 'fetch_wage',
      recordsAffected: 1, executedBy: userId,
      details: { occupation, state, rate: rate.rateValue },
    });
    return NextResponse.json({ success: true, rate });
  } catch (err: any) {
    await logIntegration({
      source: 'bls', action: 'fetch_wage',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { occupation, state, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
