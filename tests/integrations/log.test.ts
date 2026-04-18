import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logIntegration } from '@/lib/integrations/log';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');

describe('logIntegration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts a success row with counts and details', async () => {
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(42);

    const id = await logIntegration({
      source: 'openlca',
      action: 'import_method',
      recordsAffected: 1200,
      executedBy: 1,
      details: { method: 'CML 2001' },
    });

    expect(id).toBe(42);
    expect(insertSpy).toHaveBeenCalledOnce();
    const [sql, params] = insertSpy.mock.calls[0];
    expect(sql).toContain('INSERT INTO integration_log');
    expect(params).toEqual([
      'openlca', 'import_method', 1200, 1, 'success',
      JSON.stringify({ method: 'CML 2001' }),
    ]);
  });

  it('defaults status to failed when status omitted and records=0 in failed action', async () => {
    vi.mocked(dbHelpers.insert).mockResolvedValue(1);
    await logIntegration({
      source: 'pubchem',
      action: 'enrich_substance',
      recordsAffected: 0,
      executedBy: 1,
      status: 'failed',
      details: { error: 'network' },
    });
    const params = vi.mocked(dbHelpers.insert).mock.calls[0][1];
    expect(params[4]).toBe('failed');
  });
});
