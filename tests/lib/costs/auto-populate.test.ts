import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoPopulateCosts } from '@/lib/costs/auto-populate';
import * as db from '@/lib/db-helpers';
import * as rates from '@/lib/integrations/cost-rates';

vi.mock('@/lib/db-helpers');
vi.mock('@/lib/integrations/cost-rates');
vi.mock('@/lib/integrations/bls/client');
vi.mock('@/lib/integrations/eia/client');

describe('autoPopulateCosts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets labor_cost when occupation + hours set, using BLS rate via cache', async () => {
    // component + case region lookup
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      component_id: 42, labor_occupation: '51-4121', labor_hours: '0.5',
      driver_type: null, quantity: 1, region_code: 'NY',
    } as any);
    // flows lookup — no flows in this test
    vi.mocked(db.query).mockResolvedValueOnce([] as any);
    // labor rate from cache
    vi.mocked(rates.getOrFetchRate).mockResolvedValueOnce({
      rateValue: 28.15, unit: '$/hr', source: 'BLS 2024', effectiveDate: '2024-05-01',
    });
    vi.mocked(db.execute).mockResolvedValue(1);

    const r = await autoPopulateCosts(42);
    expect(r.laborSet).toBe(true);
    expect(r.energySet).toBe(false);

    // The UPDATE should have used rate * hours = 28.15 * 0.5 = 14.075
    const executeCall = vi.mocked(db.execute).mock.calls.find(
      c => String(c[0]).includes('labor_cost')
    );
    expect(executeCall).toBeTruthy();
    expect(executeCall![1]).toEqual([expect.closeTo(14.075, 3), 42]);
  });

  it('sets energy_cost for electricity flows using EIA rate', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      component_id: 50, labor_occupation: null, labor_hours: null,
      driver_type: null, quantity: 1, region_code: 'NY',
    } as any);
    // Two flows: one electricity, one CO2
    vi.mocked(db.query).mockResolvedValueOnce([
      { quantity: 18.7, substance_name: 'Electricity' },
      { quantity: 7.3, substance_name: 'Carbon Dioxide' },
    ] as any);
    vi.mocked(rates.getOrFetchRate).mockResolvedValueOnce({
      rateValue: 0.128, unit: '$/kWh', source: 'EIA 2026-01', effectiveDate: '2026-01-01',
    });
    vi.mocked(db.execute).mockResolvedValue(1);

    const r = await autoPopulateCosts(50);
    expect(r.energySet).toBe(true);
    expect(r.laborSet).toBe(false);

    // 18.7 kWh × $0.128 = $2.3936
    const executeCall = vi.mocked(db.execute).mock.calls.find(
      c => String(c[0]).includes('energy_cost')
    );
    expect(executeCall![1]).toEqual([expect.closeTo(2.3936, 3), 50]);
  });

  it('throws when component does not exist', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce(null);
    await expect(autoPopulateCosts(999)).rejects.toThrow(/not found/);
  });

  it('skips gracefully when BLS rate fetch fails', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      component_id: 42, labor_occupation: '51-4121', labor_hours: '0.5',
      driver_type: null, quantity: 1, region_code: 'NY',
    } as any);
    vi.mocked(db.query).mockResolvedValueOnce([] as any);
    vi.mocked(rates.getOrFetchRate).mockRejectedValueOnce(new Error('BLS down'));
    vi.mocked(db.execute).mockResolvedValue(1);

    const r = await autoPopulateCosts(42);
    expect(r.laborSet).toBe(false);
    expect(r.energySet).toBe(false);
  });
});
