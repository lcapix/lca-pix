import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import * as client from '@/lib/integrations/electricity-maps/client';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/integrations/electricity-maps/client');
vi.mock('@/lib/db-helpers');

const live = (zone: string, kg: number) => ({
  zone,
  carbonIntensity_gCO2eq_per_kWh: kg * 1000,
  carbonIntensity_kgCO2eq_per_kWh: kg,
  datetime: '', updatedAt: '',
});

/** elec substance, GW category, then the row already on file for zone+method (or null). */
function onFile(existing: any) {
  vi.mocked(db.queryOne)
    .mockResolvedValueOnce({ substance_id: 7 } as any)
    .mockResolvedValueOnce({ category_id: 1 } as any)
    .mockResolvedValueOnce(existing);
}

describe('syncZoneFactor', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts a live factor when nothing is on file for the zone', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('FR', 0.056));
    onFile(null);
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    const r = await syncZoneFactor('FR', 'CML 2001');
    expect(r).toMatchObject({ zone: 'FR', factorValue: 0.056, inserted: true, source: 'live' });
    expect(r.sourceRef).toMatch(/Electricity Maps API/);
    expect(insertSpy).toHaveBeenCalledOnce();
    const [sql, params] = insertSpy.mock.calls[0];
    expect(sql).not.toMatch(/ON DUPLICATE KEY UPDATE/i);
    expect(params).toContain('FR');        // geographic_scope
    expect(params).toContain('CML 2001');  // method_name
    expect(params).toContain(0.056);       // factor_value
  });

  it('defaults method to CML 2001 when not provided', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('FR', 0.056));
    onFile(null);
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    await syncZoneFactor('FR');
    expect(insertSpy.mock.calls[0][1]).toContain('CML 2001');
  });

  it('never overwrites an audited factor with a live reading', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('US', 0.41));
    onFile({ factor_id: 11, factor_value: '0.3500000000',
      source_reference: 'EPA eGRID 2023 US national average (0.350 kg CO2e/kWh) [EGRID-2023]; added by audit 2026-09-09' });
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);
    const execSpy = vi.mocked(db.execute).mockResolvedValue(1);

    const r = await syncZoneFactor('US', 'CML 2001');
    expect(r.inserted).toBe(false);
    expect(r.factorValue).toBe(0.35);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('refreshes a factor that an earlier live sync wrote', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('DE', 0.36));
    onFile({ factor_id: 12, factor_value: '0.3800000000', source_reference: 'Electricity Maps API 2026-09-01' });
    const execSpy = vi.mocked(db.execute).mockResolvedValue(1);

    const r = await syncZoneFactor('DE', 'CML 2001');
    expect(r).toMatchObject({ factorValue: 0.36, inserted: true, source: 'live' });
    expect(execSpy).toHaveBeenCalledOnce();
    const [sql, params] = execSpy.mock.calls[0];
    expect(sql).toMatch(/UPDATE driver_impact_factors/);
    expect(params).toContain(12);
    expect(params).toContain(0.36);
  });

  it('never overwrites an existing (audited) factor when the live API fails', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockRejectedValue(new Error('401 no key'));
    onFile({ factor_id: 11, factor_value: 0.35, source_reference: 'EPA eGRID 2023' });
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    const r = await syncZoneFactor('US', 'CML 2001');
    expect(r.source).toBe('reference');
    expect(r.inserted).toBe(false);
    expect(r.factorValue).toBe(0.35);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('fills a genuine gap with the curated reference when no factor exists', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockRejectedValue(new Error('401 no key'));
    onFile(null);
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    const r = await syncZoneFactor('FR', 'CML 2001');
    expect(r.source).toBe('reference');
    expect(r.inserted).toBe(true);
    expect(r.factorValue).toBe(0.05);     // FR reference from GRID_CARBON
    expect(insertSpy).toHaveBeenCalledOnce();
  });

  it('does not swallow a database error on the write', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('FR', 0.056));
    onFile(null);
    vi.mocked(db.insert).mockRejectedValue(new Error('ER_LOCK_WAIT_TIMEOUT'));

    await expect(syncZoneFactor('FR', 'CML 2001')).rejects.toThrow(/ER_LOCK_WAIT_TIMEOUT/);
    expect(db.insert).toHaveBeenCalledTimes(1);   // no silent fallback write
  });

  it.each(['XX', 'US; DROP', '', 'us'])('rejects zone %j that is not on the allowlist', async (zone) => {
    await expect(syncZoneFactor(zone, 'CML 2001')).rejects.toThrow(/zone/i);
    expect(db.insert).not.toHaveBeenCalled();
    expect(client.fetchCarbonIntensity).not.toHaveBeenCalled();
  });

  it('rejects a method outside the supported set', async () => {
    await expect(syncZoneFactor('FR', 'QUARANTINE: CML 2001')).rejects.toThrow(/method/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('throws if Electricity substance is missing', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('FR', 0.056));
    vi.mocked(db.queryOne).mockResolvedValue(null);
    await expect(syncZoneFactor('FR')).rejects.toThrow(/Electricity/);
  });

  it('throws if Global Warming category is missing', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue(live('FR', 0.056));
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ substance_id: 7 } as any)
      .mockResolvedValueOnce(null);
    await expect(syncZoneFactor('FR')).rejects.toThrow(/Global Warming/);
  });
});
