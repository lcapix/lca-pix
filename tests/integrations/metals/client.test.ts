import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMetalPrice } from '@/lib/integrations/metals/client';

describe('fetchMetalPrice', () => {
  const orig = global.fetch;
  beforeEach(() => {
    process.env.METALS_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => { global.fetch = orig; });

  it('returns price in USD per kg (API returns per tonne)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, base: 'USD', rates: { ALU: 2450 } }),
    } as Response);
    const r = await fetchMetalPrice('ALU');
    expect(r?.symbol).toBe('ALU');
    expect(r?.pricePerKg).toBeCloseTo(2.45, 3);  // 2450 USD/tonne ÷ 1000
  });

  it('returns null when API returns success=false', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: false, error: { info: 'quota exceeded' } }),
    } as Response);
    const r = await fetchMetalPrice('ALU');
    expect(r).toBeNull();
  });

  it('returns null when symbol missing from response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, rates: { XCU: 9200 } }),  // no ALU
    } as Response);
    const r = await fetchMetalPrice('ALU');
    expect(r).toBeNull();
  });

  it('throws on HTTP non-200', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(fetchMetalPrice('ALU')).rejects.toThrow(/500/);
  });

  it('throws when API key missing', async () => {
    delete process.env.METALS_API_KEY;
    await expect(fetchMetalPrice('ALU')).rejects.toThrow(/METALS_API_KEY/);
  });

  it('passes access_key in query string', async () => {
    const m = vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, rates: { ALU: 2450 } }),
    } as Response);
    await fetchMetalPrice('ALU');
    const url = m.mock.calls[0][0] as string;
    expect(url).toContain('access_key=test-key');
    expect(url).toContain('symbols=ALU');
  });
});
