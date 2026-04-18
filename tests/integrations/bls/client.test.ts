import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMedianHourlyWage, makeSeriesId } from '@/lib/integrations/bls/client';

describe('makeSeriesId', () => {
  it('builds an OEWS series id for a state-level median hourly wage', () => {
    // Format: OEU + areaType(S=state) + areaCode(7) + industry(000000) + occ(6) + dataType(2)
    const id = makeSeriesId({ occupation: '51-4121', state: 'NY', dataType: '04' });
    expect(id.startsWith('OEU')).toBe(true);
    expect(id).toContain('514121');  // occupation code with dash removed
    expect(id.endsWith('04')).toBe(true);
  });

  it('uses N areaType and zero area code for US-wide', () => {
    const id = makeSeriesId({ occupation: '51-4121', state: 'US', dataType: '04' });
    expect(id[3]).toBe('N');  // national
  });
});

describe('fetchMedianHourlyWage', () => {
  const orig = global.fetch;
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = orig; });

  it('returns the most recent wage value from BLS', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        status: 'REQUEST_SUCCEEDED',
        Results: { series: [{ data: [{ year: '2024', period: 'A01', value: '28.15' }] }] },
      }),
    } as Response);

    const r = await fetchMedianHourlyWage('51-4121', 'NY');
    expect(r?.hourlyRate).toBe(28.15);
    expect(r?.year).toBe('2024');
  });

  it('returns null if BLS returns no data rows', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: [] }] } }),
    } as Response);
    const r = await fetchMedianHourlyWage('51-4121', 'NY');
    expect(r).toBeNull();
  });

  it('throws on HTTP non-200', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(fetchMedianHourlyWage('51-4121', 'NY')).rejects.toThrow(/500/);
  });
});
