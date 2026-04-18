import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import * as client from '@/lib/integrations/electricity-maps/client';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/integrations/electricity-maps/client');
vi.mock('@/lib/db-helpers');

describe('syncZoneFactor', () => {
  beforeEach(() => vi.resetAllMocks());

  it('upserts a driver_impact_factors row for Electricity + Global Warming', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue({
      zone: 'US-NY',
      carbonIntensity_gCO2eq_per_kWh: 283,
      carbonIntensity_kgCO2eq_per_kWh: 0.283,
      datetime: '', updatedAt: '',
    });
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ substance_id: 7 } as any)       // Electricity substance
      .mockResolvedValueOnce({ category_id: 1 } as any);       // Global Warming category
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    const r = await syncZoneFactor('US-NY', 'CML 2001');
    expect(r).toEqual({ zone: 'US-NY', factorValue: 0.283, inserted: true });
    expect(insertSpy).toHaveBeenCalledOnce();
    const params = insertSpy.mock.calls[0][1]!;
    expect(params).toContain('US-NY');      // geographic_scope
    expect(params).toContain('CML 2001');   // method_name
    expect(params).toContain(0.283);        // factor_value
  });

  it('defaults method to CML 2001 when not provided', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue({
      zone: 'FR',
      carbonIntensity_gCO2eq_per_kWh: 56,
      carbonIntensity_kgCO2eq_per_kWh: 0.056,
      datetime: '', updatedAt: '',
    });
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ substance_id: 7 } as any)
      .mockResolvedValueOnce({ category_id: 1 } as any);
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    await syncZoneFactor('FR');
    const params = insertSpy.mock.calls[0][1]!;
    expect(params).toContain('CML 2001');
  });

  it('throws if Electricity substance is missing', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue({
      zone: 'FR', carbonIntensity_gCO2eq_per_kWh: 56,
      carbonIntensity_kgCO2eq_per_kWh: 0.056, datetime: '', updatedAt: '',
    });
    vi.mocked(db.queryOne).mockResolvedValue(null);
    await expect(syncZoneFactor('FR')).rejects.toThrow(/Electricity/);
  });

  it('throws if Global Warming category is missing', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue({
      zone: 'FR', carbonIntensity_gCO2eq_per_kWh: 56,
      carbonIntensity_kgCO2eq_per_kWh: 0.056, datetime: '', updatedAt: '',
    });
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ substance_id: 7 } as any)  // Electricity found
      .mockResolvedValueOnce(null);                         // Global Warming missing
    await expect(syncZoneFactor('FR')).rejects.toThrow(/Global Warming/);
  });
});
