// Auto-costs (rewritten with migrate-035): every cost it writes records how it
// was built, energy is priced in the flow's own unit, and a reference rate is
// the occupation's own, not the production-worker average.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoPopulateCosts, lookupRegion } from '@/lib/costs/auto-populate';
import * as db from '@/lib/db-helpers';
import * as rates from '@/lib/integrations/cost-rates';

vi.mock('@/lib/db-helpers');
vi.mock('@/lib/integrations/cost-rates');
vi.mock('@/lib/integrations/bls/client');
vi.mock('@/lib/integrations/eia/client');

/** db.transaction runs its callback on a recording connection. */
function recordTransactions() {
  const calls: Array<{ sql: string; params: any[] }> = [];
  vi.mocked(db.transaction).mockImplementation(async (fn: any) =>
    fn({ query: async (sql: string, params: any[] = []) => { calls.push({ sql, params }); return [{ affectedRows: 1 }]; } }),
  );
  return calls;
}
const write = (calls: Array<{ sql: string; params: any[] }>, re: RegExp) => calls.find((c) => re.test(c.sql));
const live = (rateValue: number, unit: string, source: string, effectiveDate: string) =>
  vi.mocked(rates.getOrFetchRate).mockResolvedValueOnce({ rateValue, unit, source, effectiveDate });
/** No live answer: getOrFetchRate falls back, as the real one does without an API key. */
const noLive = () =>
  vi.mocked(rates.getOrFetchRate).mockImplementationOnce(async (p: any) => {
    if (p.staticFallback) return p.staticFallback();
    throw new Error('no key');
  });

describe('autoPopulateCosts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('labor: 0.5 h x a live $28.15/h = $14.075, recorded as live BLS with its region and year', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 42, labor_occupation: '51-4121', labor_hours: '0.5', region_code: 'NY' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([] as any);
    live(28.15, '$/hr', 'BLS OEWS 2024', '2024-05-01');
    const calls = recordTransactions();

    const r = await autoPopulateCosts(42);
    expect(r).toEqual({ laborSet: true, energySet: false, totalsSet: 1, skipped: [] });
    expect(write(calls, /SET labor_cost/)!.params).toEqual([expect.closeTo(14.075, 9), 42]);
    const basis = write(calls, /INSERT INTO component_cost_basis/)!.params;
    expect(basis.slice(0, 12)).toEqual([42, 'labor', 0.5, 'h', 28.15, '$/h', 'Welders/cutters', '51-4121', 'NY', 'live', 'BLS OEWS 2024', '2024']);
  });

  it("labor with no live answer uses the occupation's own reference rate (welder $25.83, not the $21 average)", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 42, labor_occupation: '51-4121', labor_hours: '0.015', region_code: 'US' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([] as any);
    noLive();
    const calls = recordTransactions();

    await autoPopulateCosts(42);
    expect(write(calls, /SET labor_cost/)!.params[0]).toBeCloseTo(0.38745, 9);
    const basis = write(calls, /INSERT INTO component_cost_basis/)!.params;
    expect(basis.slice(4, 12)).toEqual([25.83, '$/h', 'Welders/cutters', '51-4121', 'US', 'reference', 'Reference', '2026-06']);
  });

  it('energy: 18.7 kWh x a live $0.128/kWh = $2.3936; a CO2 output is not priced', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 50, labor_occupation: null, labor_hours: null, region_code: 'NY' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([
      { quantity: 18.7, unit: 'kWh', substance_name: 'Electricity' },
      { quantity: 7.3, unit: 'kg', substance_name: 'Carbon Dioxide' },
    ] as any);
    live(0.128, '$/kWh', 'EIA 2026-01', '2026-01-01');
    const calls = recordTransactions();

    const r = await autoPopulateCosts(50);
    expect(r.energySet).toBe(true);
    expect(write(calls, /SET energy_cost/)!.params).toEqual([expect.closeTo(2.3936, 9), 50]);
    const basis = write(calls, /INSERT INTO component_cost_basis/)!.params;
    expect(basis.slice(0, 12)).toEqual([50, 'energy', 18.7, 'kWh', 0.128, '$/kWh', 'Electricity', null, 'NY', 'live', 'EIA 2026-01', '2026-01']);
  });

  it('energy in another unit than the price: 1.8 m3 of gas at a live $8.00/Mcf is priced per m3 ($0.5085), not 1.8 x 8', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 51, labor_occupation: null, labor_hours: null, region_code: 'US' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([{ quantity: 1.8, unit: 'm3', substance_name: 'Natural Gas' }] as any);
    live(8, '$/MCF', 'EIA 2026-01', '2026-01-01');
    const calls = recordTransactions();

    await autoPopulateCosts(51);
    // 1 m3 = 0.0353147 Mcf, so $8.00/Mcf = $0.282517/m3; 1.8 m3 = $0.508531.
    expect(write(calls, /SET energy_cost/)!.params[0]).toBeCloseTo(1.8 * 8 / 28.316846592, 5);
  });

  it('an energy flow no price applies to is left out and named, never multiplied across units', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 52, labor_occupation: null, labor_hours: null, region_code: 'US' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([{ quantity: 3, unit: 'kg', substance_name: 'Natural Gas' }] as any);
    vi.mocked(rates.getOrFetchRate).mockRejectedValueOnce(new Error('no key'));
    const calls = recordTransactions();

    const r = await autoPopulateCosts(52);
    expect(r).toEqual({ laborSet: false, energySet: false, totalsSet: 0, skipped: ["Natural Gas in 'kg'"] });
    expect(calls).toEqual([]);
  });

  it('a flow with no amount yet is not priced', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 53, labor_occupation: null, labor_hours: null, region_code: 'US' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([{ quantity: null, unit: 'kWh', substance_name: 'Electricity' }] as any);
    const r = await autoPopulateCosts(53);
    expect(r.energySet).toBe(false);
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('throws when the component does not exist', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce(null);
    await expect(autoPopulateCosts(999)).rejects.toThrow(/not found/);
  });

  it("asks for a state's rate only with a state code; anything else is the national figure", () => {
    expect(lookupRegion('MI')).toBe('MI');
    expect(lookupRegion('ny')).toBe('NY');
    expect(lookupRegion('US Grid')).toBe('US');
    expect(lookupRegion('EU')).toBe('US');
    expect(lookupRegion(null)).toBe('US');
  });
});

describe('a cached reference row is not live', () => {
  beforeEach(() => vi.resetAllMocks());
  it("the baseline's seeded 'BLS OEWS reference 2026-06' cache row is tagged reference", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ component_id: 42, labor_occupation: '51-4121', labor_hours: '1', region_code: 'US' } as any);
    vi.mocked(db.query).mockResolvedValueOnce([] as any);
    live(25.83, '$/hr', 'BLS OEWS reference 2026-06', '2026-06-01');
    const calls = recordTransactions();
    await autoPopulateCosts(42);
    const basis = write(calls, /INSERT INTO component_cost_basis/)!.params;
    expect(basis.slice(9, 12)).toEqual(['reference', 'Reference', '2026-06']);
  });
});
