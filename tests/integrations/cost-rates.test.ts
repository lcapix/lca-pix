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
