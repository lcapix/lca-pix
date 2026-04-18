import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchElectricityPrice, fetchNaturalGasPrice,
} from '@/lib/integrations/eia/client';

describe('EIA client', () => {
  const orig = global.fetch;
  beforeEach(() => {
    process.env.EIA_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => { global.fetch = orig; });

  describe('fetchElectricityPrice', () => {
    it('returns price in $/kWh (EIA returns cents/kWh)', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          response: { data: [{ period: '2026-01', price: '12.80' }] },  // 12.80 cents/kWh
        }),
      } as Response);
      const r = await fetchElectricityPrice('NY');
      expect(r?.rateValue).toBeCloseTo(0.128, 3);   // converted to dollars/kWh
      expect(r?.unit).toBe('$/kWh');
      expect(r?.state).toBe('NY');
    });

    it('returns null when no data rows returned', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ response: { data: [] } }),
      } as Response);
      const r = await fetchElectricityPrice('NY');
      expect(r).toBeNull();
    });

    it('throws when API key missing', async () => {
      delete process.env.EIA_API_KEY;
      await expect(fetchElectricityPrice('NY')).rejects.toThrow(/EIA_API_KEY/);
    });

    it('passes state + sector as facets and api_key as query param', async () => {
      const m = vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ response: { data: [{ period: '2026-01', price: '10.00' }] } }),
      } as Response);
      await fetchElectricityPrice('NY', 'IND');
      const url = m.mock.calls[0][0] as string;
      expect(url).toContain('api_key=test-key');
      expect(url).toContain('facets%5Bstateid%5D%5B%5D=NY');
      expect(url).toContain('facets%5Bsectorid%5D%5B%5D=IND');
    });
  });

  describe('fetchNaturalGasPrice', () => {
    it('returns price in $/MCF', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          response: { data: [{ period: '2026-01', value: '10.50' }] },
        }),
      } as Response);
      const r = await fetchNaturalGasPrice('NY');
      expect(r?.rateValue).toBe(10.50);
      expect(r?.unit).toBe('$/MCF');
    });
  });
});
