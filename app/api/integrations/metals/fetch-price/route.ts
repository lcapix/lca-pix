// app/api/integrations/metals/fetch-price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { fetchMetalPrice, METAL_SYMBOL_TO_SUBSTANCE } from '@/lib/integrations/metals/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { logIntegration } from '@/lib/integrations/log';

const VALID_SYMBOLS = Object.keys(METAL_SYMBOL_TO_SUBSTANCE) as [string, ...string[]];

const Body = z.object({
  symbol: z.enum(VALID_SYMBOLS),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({
      error: `Invalid symbol. Supported: ${VALID_SYMBOLS.join(', ')}`,
    }, { status: 400 });
  }

  const { symbol } = parsed.data;

  try {
    const rate = await getOrFetchRate({
      type: 'material',
      key: symbol,
      region: 'Global',
      maxAgeDays: 1,   // metal prices move daily
      fetcher: async () => {
        const p = await fetchMetalPrice(symbol);
        if (!p) throw new Error(`Metals-API returned no data for ${symbol}`);
        return {
          rateValue: p.pricePerKg,
          unit: '$/kg',
          source: `Metals-API ${new Date().toISOString().slice(0,10)}`,
          effectiveDate: new Date().toISOString().slice(0,10),
        };
      },
    });
    await logIntegration({
      source: 'metals', action: 'fetch_price',
      recordsAffected: 1, executedBy: userId,
      details: { symbol, rate: rate.rateValue },
    });
    return NextResponse.json({ success: true, rate });
  } catch (err: any) {
    await logIntegration({
      source: 'metals', action: 'fetch_price',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { symbol, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
