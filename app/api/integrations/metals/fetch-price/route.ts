// app/api/integrations/metals/fetch-price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import { fetchMetalPrice, METAL_SYMBOL_TO_SUBSTANCE } from '@/lib/integrations/metals/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { pickMaterialRate, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';
import { logIntegration } from '@/lib/integrations/log';

const VALID_SYMBOLS = Object.keys(METAL_SYMBOL_TO_SUBSTANCE) as [string, ...string[]];

const Body = z.object({
  symbol: z.enum(VALID_SYMBOLS),
});

export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

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
      // When no live key / the API fails, use the curated USGS-derived reference
      // $/kg for this metal instead of erroring — LCA costing wants a
      // representative average anyway, and the provenance says which it is.
      staticFallback: () => {
        const ref = pickMaterialRate(METAL_SYMBOL_TO_SUBSTANCE[symbol] ?? symbol);
        return {
          rateValue: ref.rate,
          unit: '$/kg',
          source: `Reference ${REFERENCE_VINTAGE} (${ref.label})`,
          effectiveDate: `${REFERENCE_VINTAGE}-01`,
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
