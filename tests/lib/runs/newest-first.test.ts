import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db-helpers', () => ({ query: vi.fn() }));
import * as db from '@/lib/db-helpers';
import { inRunOrder, newestRunIds, placeholders } from '@/lib/runs/newest-first';

describe('runs newest first, without sorting snapshots (10.3 ER_OUT_OF_SORTMEMORY)', () => {
  beforeEach(() => vi.mocked(db.query).mockReset());

  it('sorts only run_id, never the snapshot', async () => {
    vi.mocked(db.query).mockResolvedValue([{ run_id: 9 }, { run_id: 4 }] as any);
    expect(await newestRunIds(3)).toEqual([9, 4]);
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toMatch(/SELECT run_id FROM assessment_runs/);
    expect(sql).not.toMatch(/run_snapshot|\*/);
    expect(sql).toMatch(/ORDER BY run_date DESC, run_id DESC$/);
    expect(params).toEqual([3]);
  });

  it('filters, orders and limits as asked, from fixed SQL only', async () => {
    vi.mocked(db.query).mockResolvedValue([] as any);
    await newestRunIds(3, { status: 'completed', order: 'id', limit: 1 });
    await newestRunIds(3, { status: 'completed-or-unset' });
    await newestRunIds(3, { limit: 0.5 });
    const sqls = vi.mocked(db.query).mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' '));
    expect(sqls[0]).toMatch(/AND status = 'completed' ORDER BY run_id DESC LIMIT 1$/);
    expect(sqls[1]).toMatch(/AND \(status IS NULL OR status = 'completed'\) ORDER BY run_date DESC, run_id DESC$/);
    expect(sqls[2]).not.toMatch(/LIMIT/);
  });

  it('puts rows read by id back in the sorted order, skipping ids with no row', () => {
    const rows = [{ run_id: 4, n: 'b' }, { run_id: '9', n: 'a' }];
    expect(inRunOrder([9, 7, 4], rows).map((r) => r.n)).toEqual(['a', 'b']);
    expect(placeholders(3)).toBe('?, ?, ?');
  });
});
