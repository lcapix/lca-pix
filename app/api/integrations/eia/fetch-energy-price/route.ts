// app/api/integrations/eia/fetch-energy-price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { fetchElectricityPrice, fetchNaturalGasPrice } from '@/lib/integrations/eia/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  fuel: z.enum(['electricity', 'natural_gas']),
  state: z.string().regex(/^[A-Z]{2}$/, 'State must be 2-letter US code'),
  sector: z.enum(['IND', 'COM', 'RES', 'ALL']).optional(),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

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
    });
    await logIntegration({
      source: 'eia', action: 'fetch_energy_price',
      recordsAffected: 1, executedBy: userId,
      details: { fuel, state, sector, rate: rate.rateValue },
    });
    return NextResponse.json({ success: true, rate });
  } catch (err: any) {
    await logIntegration({
      source: 'eia', action: 'fetch_energy_price',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { fuel, state, sector, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
