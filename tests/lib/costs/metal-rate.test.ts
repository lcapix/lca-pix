// The metal price for a step's material cost (E21): live from Metals-API when
// it answers, else the metal's own dated reference price from MATERIAL_RATES,
// tagged reference. A metal with no reference (lead, tin) and an unknown
// symbol get no rate at all, never the "Generic material (avg)" default.
// The real cache and Metals-API client run; only the database and fetch are stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateNotFound, isMetalSymbol, metalReferenceRate, resolveMetalRate } from '@/lib/costs/rate-resolve';
import { MATERIAL_DEFAULT, MATERIAL_RATES, REFERENCE_VINTAGE, materialReferencePrice } from '@/lib/integrations/reference-rates';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');
vi.mock('@/lib/observability/log');

const metalsAnswer = (symbol: string, perTonne: number) =>
  new Response(JSON.stringify({ success: true, base: 'USD', rates: { [symbol]: perTonne } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('resolveMetalRate', () => {
  const key = process.env.METALS_API_KEY;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.queryOne).mockResolvedValue(null); // nothing cached
    vi.mocked(db.insert).mockResolvedValue(1 as any);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (key === undefined) delete process.env.METALS_API_KEY;
    else process.env.METALS_API_KEY = key;
  });

  it('live: Metals-API $2385.50/t is $2.3855/kg, tagged live with its date, cached a day under Global', async () => {
    process.env.METALS_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => metalsAnswer('ALU', 2385.5));
    vi.stubGlobal('fetch', fetchMock);

    const r = await resolveMetalRate('ALU');
    const today = new Date().toISOString().slice(0, 10);
    expect(r).toEqual({
      rate: 2.3855,
      rate_unit: '$/kg',
      driver_unit: 'kg',
      rate_label: 'Aluminum',
      rate_code: 'ALU',
      region: 'Global',
      source_kind: 'live',
      source_name: `Metals-API ${today}`,
      vintage: today.slice(0, 7),
    });
    expect(String((fetchMock.mock.calls[0] as any[])[0])).toContain('symbols=ALU');
    const cached = vi.mocked(db.insert).mock.calls[0][1] as any[];
    expect(cached.slice(0, 5)).toEqual(['material', 'ALU', 'Global', 2.3855, '$/kg']);
  });

  it('no key: the reference price from MATERIAL_RATES for that metal, tagged Reference 2026-06', async () => {
    delete process.env.METALS_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const cases: Array<[string, number, string]> = [
      ['ALU', 2.1, 'Aluminum, primary'],
      ['XCU', 9.5, 'Copper'],
      ['ZNC', 2.8, 'Zinc'],
      ['NIK', 18, 'Nickel'],
      ['STL', 0.95, 'Steel, hot-rolled'],
    ];
    for (const [symbol, rate, label] of cases) {
      const r = await resolveMetalRate(symbol);
      expect(r).toMatchObject({ rate, rate_label: label, rate_code: symbol, driver_unit: 'kg', rate_unit: '$/kg' });
      expect(r).toMatchObject({ source_kind: 'reference', source_name: 'Reference', vintage: REFERENCE_VINTAGE, region: null });
      // Straight from the dated table, never a number of its own.
      expect(MATERIAL_RATES.some((m) => m.rate === r.rate && m.label === r.rate_label)).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    // The reference value is never written to the shared cache.
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('a Metals-API failure with a key set also falls to the reference, not the default', async () => {
    process.env.METALS_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const r = await resolveMetalRate('XCU');
    expect(r).toMatchObject({ rate: 9.5, source_kind: 'reference' });
  });

  it('a metal with no reference and no live price gets no rate, never the generic material average', async () => {
    delete process.env.METALS_API_KEY;
    for (const symbol of ['LEA', 'TIN']) {
      const err = await resolveMetalRate(symbol).catch((e) => e);
      expect(err).toBeInstanceOf(RateNotFound);
      expect(err.message).toMatch(/Enter your own price per kg/);
      expect(err.message).not.toContain(MATERIAL_DEFAULT.label);
    }
    expect(() => metalReferenceRate('LEA')).toThrow(RateNotFound);
  });

  it('an unknown symbol gets no rate and asks nothing of Metals-API or the cache', async () => {
    process.env.METALS_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const symbol of ['XAU', 'alu', 'GOLD', '']) {
      expect(isMetalSymbol(symbol)).toBe(false);
      await expect(resolveMetalRate(symbol)).rejects.toBeInstanceOf(RateNotFound);
      expect(() => metalReferenceRate(symbol)).toThrow(RateNotFound);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.queryOne).not.toHaveBeenCalled();
  });
});

describe('materialReferencePrice', () => {
  it('finds a dated row or returns null, where pickMaterialRate would give the default', () => {
    expect(materialReferencePrice('Copper, primary')).toMatchObject({ rate: 9.5, label: 'Copper' });
    expect(materialReferencePrice('Lead')).toBeNull();
    expect(materialReferencePrice('Tin')).toBeNull();
  });
});
