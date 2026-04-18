import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCarbonIntensity } from '@/lib/integrations/electricity-maps/client';

describe('fetchCarbonIntensity', () => {
  const orig = global.fetch;
  beforeEach(() => {
    process.env.ELECTRICITY_MAPS_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = orig;
  });

  it('returns parsed payload for a zone', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        zone: 'US-NY', carbonIntensity: 283,
        datetime: '2026-04-13T00:00:00Z', updatedAt: '2026-04-13T00:05:00Z',
      }),
    } as Response);
    const r = await fetchCarbonIntensity('US-NY');
    expect(r.zone).toBe('US-NY');
    expect(r.carbonIntensity_gCO2eq_per_kWh).toBe(283);
    expect(r.carbonIntensity_kgCO2eq_per_kWh).toBeCloseTo(0.283, 3);
  });

  it('throws when API key is missing', async () => {
    delete process.env.ELECTRICITY_MAPS_API_KEY;
    await expect(fetchCarbonIntensity('US-NY')).rejects.toThrow(/API key/);
  });

  it('throws on non-200 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    await expect(fetchCarbonIntensity('US-NY')).rejects.toThrow(/403/);
  });

  it('passes auth-token header', async () => {
    const fetchMock = vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ zone: 'FR', carbonIntensity: 56, datetime: '', updatedAt: '' }),
    } as Response);
    await fetchCarbonIntensity('FR');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['auth-token']).toBe('test-key');
  });
});
