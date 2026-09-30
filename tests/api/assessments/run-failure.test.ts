import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/cases/[caseId]/assessments/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import * as engine from '@/lib/lca-engine';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/lca-engine');

function req(body: unknown) {
  return new Request('http://t/api/cases/3/assessments', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ caseId: '3' }) };

describe('POST /api/cases/:id/assessments when the run fails (RUN-3)', () => {
  let connQueries: string[];

  beforeEach(() => {
    vi.resetAllMocks();
    connQueries = [];
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
      /FROM case_table WHERE case_id/.test(sql) && /case_name/.test(sql)
        ? ({ project_id: 5, case_name: 'Case' } as any)
        : // caseAccessDenied (lib/route-guard): the case, its creator and the project's own-cases setting
          /members_see_own_cases/.test(sql)
          ? ({ case_id: 3, project_id: 5, created_by: 1, members_see_own_cases: 0 } as any)
          : null,
    );
    // A transaction that rolls back: whatever the callback wrote is gone.
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      const conn = {
        query: vi.fn(async (sql: string) => {
          connQueries.push(sql);
          return /INSERT INTO assessment_runs/.test(sql) ? [{ insertId: 77 }] : [[]];
        }),
      };
      return cb(conn); // a throw propagates as after rollback
    });
    vi.mocked(engine.calculateCaseImpacts).mockRejectedValue(new Error('engine exploded'));
    vi.mocked(db.insert).mockResolvedValue(78);
  });

  it('records the failed run on its own connection after the rollback', async () => {
    const res = await POST(req({ calculation_method: 'CML 2001', region_code: 'Global' }) as any, params as any);
    expect(res.status).toBe(500);

    const failed = vi.mocked(db.insert).mock.calls.find(([sql]) => /'failed'/.test(sql));
    expect(failed).toBeTruthy();
    expect(failed![1]).toEqual(expect.arrayContaining([3, 'CML 2001', 'Global', 'engine exploded', 1]));

    const body = await res.json();
    expect(body).toMatchObject({ error: 'Failed to run assessment', details: 'engine exploded', run_id: 78, status: 'failed' });
  });

  it('still answers 500 when recording the failure fails too', async () => {
    vi.mocked(db.insert).mockRejectedValue(new Error('db down'));
    const res = await POST(req({ calculation_method: 'CML 2001' }) as any, params as any);
    expect(res.status).toBe(500);
    expect((await res.json()).details).toBe('engine exploded');
  });
});

describe('POST /api/cases/:id/assessments input checks (RUN-6)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 5, case_name: 'Case' } as any);
  });

  it('refuses an unknown method before any run is written', async () => {
    const res = await POST(req({ calculation_method: 'EF 3.1', region_code: 'Global' }) as any, params as any);
    expect(res.status).toBe(400);
    expect((await res.json()).supported_methods).toEqual(['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1']);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('refuses a non-string method (no object expansion into SQL)', async () => {
    const res = await POST(req({ calculation_method: { a: 1 }, region_code: 'Global' }) as any, params as any);
    expect(res.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
