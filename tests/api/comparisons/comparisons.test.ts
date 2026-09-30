import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as list from '@/app/api/comparisons/route';
import * as one from '@/app/api/comparisons/[comparisonId]/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');
// The routes must not reach for a raw pool connection any more.
vi.mock('@/lib/db', () => ({ default: { getConnection: vi.fn(() => { throw new Error('raw pool used'); }) } }));

const req = (url: string, init: { method?: string; body?: string } = {}) =>
  new NextRequest(`http://t${url}`, { ...init, headers: { Authorization: 'Bearer x' } });
const idParams = (id: string) => ({ params: Promise.resolve({ comparisonId: id }) }) as any;

// mysql2 hands JSON columns back already parsed; older rows may be strings.
const savedRow = {
  comparison_id: 4,
  comparison_name: 'Frame materials',
  case_ids: [1, 2],
  base_case_id: 1,
  comparison_type: 'absolute',
  created_at: '2026-09-01T00:00:00Z',
  created_by_username: 'jo',
  total_cases_compared: 2,
  total_categories_analyzed: 5,
  base_case_name: 'Base',
};

describe('GET /api/comparisons (legacy saved comparisons)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
  });

  it.each([
    'No authentication token provided',
    'Invalid or expired token',
    'User account not found or inactive',
  ])('401 (not 500) when requireAuth says %s', async (message) => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error(message));
    const res = await list.GET(req('/api/comparisons?project_id=5'));
    expect(res.status).toBe(401);
  });

  it('400 without a numeric project_id', async () => {
    expect((await list.GET(req('/api/comparisons'))).status).toBe(400);
    expect((await list.GET(req('/api/comparisons?project_id=abc'))).status).toBe(400);
  });

  it('404 for a non-member', async () => {
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);
    const res = await list.GET(req('/api/comparisons?project_id=5'));
    expect(res.status).toBe(404);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns the saved comparisons with case_ids as arrays, JSON column or string', async () => {
    vi.mocked(db.query).mockResolvedValue([savedRow, { ...savedRow, comparison_id: 3, case_ids: '[1,3]' }] as any);
    const res = await list.GET(req('/api/comparisons?project_id=5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.comparisons.map((c: any) => c.case_ids)).toEqual([[1, 2], [1, 3]]);
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual([5]);
  });

  it('an empty project answers an empty list', async () => {
    vi.mocked(db.query).mockResolvedValue([] as any);
    const body = await (await list.GET(req('/api/comparisons?project_id=5'))).json();
    expect(body).toEqual({ success: true, comparisons: [] });
  });

  it('a malformed stored value becomes an empty list, not a 500', async () => {
    vi.mocked(db.query).mockResolvedValue([{ ...savedRow, case_ids: 'not json' }] as any);
    const res = await list.GET(req('/api/comparisons?project_id=5'));
    expect(res.status).toBe(200);
    expect((await res.json()).comparisons[0].case_ids).toEqual([]);
  });
});

describe('GET /api/comparisons/:id (legacy)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
      if (/FROM comparison_runs/.test(sql)) return { ...savedRow, project_id: 5, project_name: 'Bike' } as any;
      if (/FROM comparison_metadata/.test(sql)) {
        return { total_cases_compared: 2, total_categories_analyzed: 5, overall_best_case_id: 2, overall_worst_case_id: 1, calculation_time_ms: 9, assessment_run_ids: [11, 12] } as any;
      }
      return null;
    });
    vi.mocked(db.query).mockImplementation(async (sql: string) => {
      if (/FROM comparison_results/.test(sql)) {
        return [{ result_id: 1, category_id: 1, category_name: 'Global Warming', case_results: [{ case_id: 1, value: 3 }], best_case_id: 2, worst_case_id: 1 }] as any;
      }
      if (/FROM case_table/.test(sql)) return [{ case_id: 1, case_name: 'Base', case_description: null }, { case_id: 2, case_name: 'Steel', case_description: null }] as any;
      return [] as any;
    });
  });

  it('401 (not 500) when not signed in', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    expect((await one.GET(req('/api/comparisons/4'), idParams('4'))).status).toBe(401);
  });

  it('404 when missing, and 404 (not 403) for a non-member', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(null);
    expect((await one.GET(req('/api/comparisons/9'), idParams('9'))).status).toBe(404);

    vi.mocked(db.queryOne).mockResolvedValue({ ...savedRow, project_id: 5 } as any);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);
    expect((await one.GET(req('/api/comparisons/4'), idParams('4'))).status).toBe(404);
  });

  it('400 for a non-numeric id', async () => {
    expect((await one.GET(req('/api/comparisons/x'), idParams('x'))).status).toBe(400);
  });

  it('returns the comparison with its JSON columns read once, not parsed twice', async () => {
    const res = await one.GET(req('/api/comparisons/4'), idParams('4'));
    expect(res.status).toBe(200);
    const { comparison } = await res.json();
    expect(comparison.case_ids).toEqual([1, 2]);
    expect(comparison.category_comparisons[0].case_results).toEqual([{ case_id: 1, value: 3 }]);
    expect(comparison.metadata.assessment_run_ids).toEqual([11, 12]);
    expect(comparison.cases.map((c: any) => c.case_name)).toEqual(['Base', 'Steel']);
    // Case names only from the comparison's own project.
    const caseSql = vi.mocked(db.query).mock.calls.find(([sql]) => /FROM case_table/.test(sql))!;
    expect(caseSql[0]).toMatch(/project_id = \?/);
    expect(caseSql[1]).toEqual([1, 2, 5]);
  });
});

describe('DELETE /api/comparisons/:id (legacy)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.queryOne).mockResolvedValue({ comparison_id: 4, created_by: 9, project_id: 5 } as any);
    vi.mocked(db.execute).mockResolvedValue(1 as any);
  });

  it('401 (not 500) when not signed in', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('Invalid or expired token'));
    expect((await one.DELETE(req('/api/comparisons/4', { method: 'DELETE' }), idParams('4'))).status).toBe(401);
  });

  it('404 for a non-member, even the creator after removal', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(9);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);
    expect((await one.DELETE(req('/api/comparisons/4', { method: 'DELETE' }), idParams('4'))).status).toBe(404);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('403 for a member who is neither the creator nor a project admin', async () => {
    vi.mocked(auth.checkProjectAccess).mockImplementation(async (_u, _p, level) => level !== 'admin');
    expect((await one.DELETE(req('/api/comparisons/4', { method: 'DELETE' }), idParams('4'))).status).toBe(403);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('the creator, still a member, can delete', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(9);
    vi.mocked(auth.checkProjectAccess).mockImplementation(async (_u, _p, level) => level !== 'admin');
    const res = await one.DELETE(req('/api/comparisons/4', { method: 'DELETE' }), idParams('4'));
    expect(res.status).toBe(200);
    expect(db.execute).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM comparison_runs/), [4]);
  });
});

describe('POST /api/comparisons (legacy)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 (not 500) when not signed in', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await list.POST(req('/api/comparisons', { method: 'POST', body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });
});
