import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');

describe('getOrFetchRate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns cached rate when newer than TTL', async () => {
    const now = Date.now();
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      rate_value: 28.15, rate_unit: '$/hr', source: 'BLS 2024',
      effective_date: '2024-05-01', fetched_at: new Date(now - 1000 * 60 * 60 * 24), // 1 day old
    } as any);
    const fetcher = vi.fn();

    const r = await getOrFetchRate({
      type: 'labor', key: '51-4121', region: 'NY',
      maxAgeDays: 30, fetcher,
    });
    expect(r.rateValue).toBe(28.15);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches fresh when cache is stale, inserts new row', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      rate_value: 25.00, rate_unit: '$/hr', source: 'old',
      effective_date: '2020-05-01',
      fetched_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year old
    } as any);
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);
    const fetcher = vi.fn().mockResolvedValue({
      rateValue: 30.50, unit: '$/hr',
      source: 'BLS 2025', effectiveDate: '2025-05-01',
    });

    const r = await getOrFetchRate({
      type: 'labor', key: '51-4121', region: 'NY',
      maxAgeDays: 30, fetcher,
    });
    expect(r.rateValue).toBe(30.50);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(insertSpy).toHaveBeenCalledOnce();
  });

  it('does not write the static fallback into the shared cache', async () => {
    // Any signed-in user can trigger a lookup, so the shared cost_rates cache
    // only ever holds values an upstream API returned. A reference value would
    // otherwise shadow the live rate for 30 days once a key is configured.
    vi.mocked(db.queryOne).mockResolvedValueOnce(null);
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);
    const fetcher = vi.fn().mockRejectedValue(new Error('BLS_API_KEY not configured'));

    const r = await getOrFetchRate({
      type: 'labor', key: '51-4121', region: 'NY', fetcher,
      staticFallback: () => ({ rateValue: 25.83, unit: '$/hr', source: 'Reference 2024', effectiveDate: '2024-01' }),
    });
    expect(r.rateValue).toBe(25.83);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('still throws when the fetcher fails and there is no fallback', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce(null);
    await expect(
      getOrFetchRate({ type: 'labor', key: '51-4121', region: 'NY', fetcher: vi.fn().mockRejectedValue(new Error('down')) }),
    ).rejects.toThrow('down');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('fetches fresh when nothing cached', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce(null);
    vi.mocked(db.insert).mockResolvedValue(1);
    const fetcher = vi.fn().mockResolvedValue({
      rateValue: 0.283, unit: '$/kWh', source: 'EIA 2026-01', effectiveDate: '2026-01-01',
    });

    const r = await getOrFetchRate({
      type: 'electricity', key: 'grid', region: 'NY', fetcher,
    });
    expect(r.rateValue).toBe(0.283);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
