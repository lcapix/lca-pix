/**
 * Phase 1 (silent failures): a read that fails is an error, never an empty
 * answer. Each route below used to catch every error around one read and go
 * on as if it found nothing; now it tolerates only a schema gap (an older
 * database without the column or table, lib/db-errors isSchemaGap) and lets
 * anything else fail the request. Each test plants one failing read.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import * as engine from '@/lib/lca-engine';
import { GET as statusGET } from '@/app/api/integrations/status/route';
import { GET as componentsGET } from '@/app/api/cases/[caseId]/components/route';
import { GET as caseGET, PUT as casePUT } from '@/app/api/cases/[caseId]/route';
import { GET as projectGET, PUT as projectPUT } from '@/app/api/projects/[projectId]/route';
import { POST as assessPOST } from '@/app/api/cases/[caseId]/assessments/route';
import { GET as exportGET } from '@/app/api/assessments/[runId]/export/route';
import { PUT as stepPUT } from '@/app/api/components/[componentId]/route';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/lca-engine');

const dbDown = () => Object.assign(new Error('connect ECONNRESET 10.0.0.5:5432'), { code: 'ECONNRESET' });
const gap = (code: 'ER_BAD_FIELD_ERROR' | 'ER_NO_SUCH_TABLE' = 'ER_BAD_FIELD_ERROR') =>
  Object.assign(new Error('relation or column does not exist'), { code });

/** The guard row lib/route-guard reads for a case (the caller made it); matched on the
 * columns every version of that query starts with. */
const GUARD = { case_id: 3, project_id: 5, created_by: 1, members_see_own_cases: 0, hidden_from_members: 0, read_only: 0 };

type Rule = [RegExp, () => unknown];
/** queryOne / query answer by SQL; the first matching rule wins, else null / []. */
function serve(one: Rule[], many: Rule[] = []) {
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
    for (const [re, answer] of one) if (re.test(sql)) return answer() as any;
    return null;
  });
  vi.mocked(db.query).mockImplementation(async (sql: string) => {
    for (const [re, answer] of many) if (re.test(sql)) return answer() as any;
    return [] as any;
  });
}
const fail = (err: () => Error) => () => {
  throw err();
};

const req = (url: string, init: RequestInit = {}) =>
  new Request(`http://t${url}`, {
    ...init,
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
  }) as any;
const caseCtx = { params: Promise.resolve({ caseId: '3' }) } as any;
const projectCtx = { params: Promise.resolve({ projectId: '5' }) } as any;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth.requireAuth).mockResolvedValue(1);
  vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
  vi.mocked(auth.getProjectRole).mockResolvedValue('owner');
  vi.mocked(db.execute).mockResolvedValue(1 as any);
});

describe('GET /api/integrations/status', () => {
  it('a failed read is a 500, not a dashboard of zeros', async () => {
    serve([[/FROM substances/, fail(dbDown)]]);
    const res = await statusGET(req('/api/integrations/status'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNRESET|10\.0\.0\.5/);
  });

  it('an older schema still reads as empty', async () => {
    serve([[/FROM substances/, fail(() => gap('ER_NO_SUCH_TABLE'))]], [[/FROM cost_rates/, fail(() => gap('ER_NO_SUCH_TABLE'))]]);
    const res = await statusGET(req('/api/integrations/status'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/cases/:caseId/components', () => {
  const steps = () => [{ component_id: 11, component_name: 'Cut' }];
  const flowCount = /COUNT\(\*\) AS flow_count/;

  it('a failed flow count is a 500, not every step with 0 flows', async () => {
    serve([[/SELECT case_id, project_id/, () => GUARD], [/FROM case_table/, () => ({ project_id: 5 })]], [
      [flowCount, fail(dbDown)],
      [/FROM component c/, steps],
    ]);
    expect((await componentsGET(req('/api/cases/3/components'), caseCtx)).status).toBe(500);
  });

  it('a database without the flows table still lists the steps, with 0 flows', async () => {
    serve([[/SELECT case_id, project_id/, () => GUARD], [/FROM case_table/, () => ({ project_id: 5 })]], [
      [flowCount, fail(() => gap('ER_NO_SUCH_TABLE'))],
      [/FROM component c/, steps],
    ]);
    const res = await componentsGET(req('/api/cases/3/components'), caseCtx);
    expect(res.status).toBe(200);
    expect((await res.json()).components[0].flow_count).toBe(0);
  });
});

describe('GET /api/cases/:caseId', () => {
  const base: Rule[] = [
    [/SELECT case_id, project_id/, () => GUARD],
    [/SELECT c\.\*/, () => ({ case_id: 3, project_id: 5, case_name: 'Base' })],
  ];

  it("a failed read of the study's method is a 500, not a CML default", async () => {
    serve([[/SELECT lcia_method, region_code FROM project/, fail(dbDown)], ...base]);
    expect((await caseGET(req('/api/cases/3'), caseCtx)).status).toBe(500);
  });

  it("a failed read of the study's functional unit is a 500, not a missing one", async () => {
    serve([[/SELECT functional_unit FROM project/, fail(dbDown)], ...base]);
    expect((await caseGET(req('/api/cases/3'), caseCtx)).status).toBe(500);
  });

  it('a database before migrate-018 still reads the case', async () => {
    serve([[/SELECT lcia_method, region_code FROM project/, fail(gap)], ...base]);
    const res = await caseGET(req('/api/cases/3'), caseCtx);
    expect(res.status).toBe(200);
    expect((await res.json()).case.case_name).toBe('Base');
  });
});

describe('PUT /api/cases/:caseId partial saves', () => {
  it('says exactly what was saved when a later statement cannot run', async () => {
    serve([[/SELECT case_id, project_id/, () => GUARD], [/FROM case_table WHERE case_id/, () => ({ project_id: 5 })]]);
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/interpretation = \?/.test(sql)) throw gap();
      return 1 as any;
    });
    const res = await casePUT(
      req('/api/cases/3', { method: 'PUT', body: JSON.stringify({ description: 'Steel', interpretation: 'Steel wins' }) }),
      caseCtx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Your write-up could not be saved: the database needs migration 021. Saved: the description.');
    expect(body.saved).toEqual(['the description']);
  });

  it('a reference-flow write that fails for another reason is a 500, not "not available yet"', async () => {
    serve([[/SELECT case_id, project_id/, () => GUARD], [/FROM case_table WHERE case_id/, () => ({ project_id: 5 })]]);
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/reference_flow/.test(sql)) throw dbDown();
      return 1 as any;
    });
    const res = await casePUT(req('/api/cases/3', { method: 'PUT', body: JSON.stringify({ reference_flow: 2 }) }), caseCtx);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/projects/:projectId', () => {
  const project: Rule = [/FROM project p/, () => ({ project_id: 5, project_name: 'Bikes', owner_id: 1 })];

  it('a failed members read is a 500, not "nobody else can see this"', async () => {
    serve([project], [[/project_members|project_member/, fail(dbDown)]]);
    expect((await projectGET(req('/api/projects/5'), projectCtx)).status).toBe(500);
  });

  it('a database without the members table reads as no members', async () => {
    serve([project], [[/project_members|project_member/, fail(() => gap('ER_NO_SUCH_TABLE'))]]);
    const res = await projectGET(req('/api/projects/5'), projectCtx);
    expect(res.status).toBe(200);
    expect((await res.json()).project.members).toEqual([]);
  });
});

describe('PUT /api/projects/:projectId partial saves', () => {
  it('says the name was saved when the goal and scope could not be', async () => {
    serve([]);
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/goal_statement/.test(sql)) throw gap();
      return 1 as any;
    });
    const res = await projectPUT(
      req('/api/projects/5', { method: 'PUT', body: JSON.stringify({ project_name: 'Bikes 2', functional_unit: '1 bike' }) }),
      projectCtx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      'Goal & scope fields are not available yet: the database needs migrate-014. Saved: the name.',
    );
  });

  it('a goal-and-scope write that fails for another reason is a 500', async () => {
    serve([]);
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/goal_statement/.test(sql)) throw dbDown();
      return 1 as any;
    });
    const res = await projectPUT(
      req('/api/projects/5', { method: 'PUT', body: JSON.stringify({ functional_unit: '1 bike' }) }),
      projectCtx,
    );
    expect(res.status).toBe(500);
  });
});

describe('POST /api/cases/:caseId/assessments', () => {
  const caseRow: Rule = [/SELECT project_id, case_name FROM case_table/, () => ({ project_id: 5, case_name: 'Base' })];
  const run = (body: unknown) =>
    assessPOST(req('/api/cases/3/assessments', { method: 'POST', body: JSON.stringify(body) }), caseCtx);

  // A run transaction that reaches the engine, so a route that carried on
  // past the failed read would call it (the tests check it is never called).
  beforeEach(() => {
    vi.mocked(db.transaction).mockImplementation(async (cb: any) =>
      cb({ query: vi.fn(async (sql: string) => (/INSERT INTO assessment_runs/.test(sql) ? [{ insertId: 77 }] : [[]])) }),
    );
    vi.mocked(engine.calculateCaseImpacts).mockRejectedValue(new Error('the engine was reached'));
    vi.mocked(db.insert).mockResolvedValue(78);
  });

  it("a failed read of the study's method stops the run instead of running CML", async () => {
    serve([[/AS case_region/, fail(dbDown)], [/SELECT case_id, project_id/, () => GUARD], caseRow]);
    const res = await run({});
    expect(res.status).toBe(500);
    expect(engine.calculateCaseImpacts).not.toHaveBeenCalled();
  });

  it('a failed goal-and-scope read stops the run instead of freezing it without one', async () => {
    serve([[/SELECT \* FROM project/, fail(dbDown)], [/SELECT case_id, project_id/, () => GUARD], caseRow]);
    const res = await run({ calculation_method: 'CML 2001', region_code: 'US' });
    expect(res.status).toBe(500);
    expect(engine.calculateCaseImpacts).not.toHaveBeenCalled();
  });
});

describe('GET /api/assessments/:runId/export', () => {
  const runRow: Rule = [
    /FROM assessment_runs ar/,
    () => ({
      run_id: 8,
      run_name: 'Run 8',
      run_date: '2026-10-01T10:00:00Z',
      case_id: 3,
      project_id: 5,
      project_name: 'Bikes',
      case_name: 'Base',
      case_type: 'base',
      calculation_method: 'CML 2001',
      region_code: 'US',
      status: 'completed',
      run_snapshot: null,
    }),
  ];
  const ctx = { params: Promise.resolve({ runId: '8' }) } as any;

  it('a failed sources read is a 500, not a report that prints "no sources"', async () => {
    serve([runRow, [/SELECT case_id, project_id/, () => GUARD]], [[/source_reference/, fail(dbDown)]]);
    expect((await exportGET(req('/api/assessments/8/export?format=csv'), ctx)).status).toBe(500);
  });

  it('a database without cost_rates still exports', async () => {
    serve([runRow, [/SELECT case_id, project_id/, () => GUARD]], [[/FROM cost_rates/, fail(() => gap('ER_NO_SUCH_TABLE'))]]);
    expect((await exportGET(req('/api/assessments/8/export?format=csv'), ctx)).status).toBe(200);
  });
});

describe('a save that fails part way says what was saved', () => {
  const noInternals = (body: unknown) => expect(JSON.stringify(body)).not.toMatch(/ECONNRESET|10\.0\.0\.5/);

  it('case: the description went through, the reference flow did not', async () => {
    serve([[/SELECT case_id, project_id/, () => GUARD], [/FROM case_table WHERE case_id/, () => ({ project_id: 5 })]]);
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/reference_flow/.test(sql)) throw dbDown();
      return 1 as any;
    });
    const res = await casePUT(
      req('/api/cases/3', { method: 'PUT', body: JSON.stringify({ description: 'Steel', reference_flow: 2 }) }),
      caseCtx,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to update case. Saved: the description; try again to save the rest.');
    expect(body.saved).toEqual(['the description']);
    noInternals(body);
  });

  it('project: the name went through, the goal and scope did not', async () => {
    serve([]);
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/goal_statement/.test(sql)) throw dbDown();
      return 1 as any;
    });
    const res = await projectPUT(
      req('/api/projects/5', { method: 'PUT', body: JSON.stringify({ project_name: 'Bikes 2', functional_unit: '1 bike' }) }),
      projectCtx,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to update project. Saved: the name; try again to save the rest.');
    noInternals(body);
  });

  it('step: the name went through, the life-cycle stage did not', async () => {
    serve([
      [/SELECT case_id, project_id/, () => ({ ...GUARD, case_id: 10, project_id: 7, created_by: 1 })],
      [/FROM component c/, () => ({ case_id: 10, project_id: 7, component_type: 'operation', parent_component_id: 1, hierarchy_level: 2 })],
    ]);
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb({ query: vi.fn(async () => [{ affectedRows: 1 }]) }));
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/life_cycle_stage/.test(sql)) throw dbDown();
      return 1 as any;
    });
    const res = await stepPUT(
      req('/api/components/2', { method: 'PUT', body: JSON.stringify({ component_name: 'Cut blank', life_cycle_stage: 'use' }) }),
      { params: Promise.resolve({ componentId: '2' }) } as any,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe(
      "Failed to update component. Saved: the step's name, type, place and quantity; try again to save the rest.",
    );
    noInternals(body);
  });

  it('a save that fails before writing anything keeps the plain message', async () => {
    serve([]);
    vi.mocked(db.execute).mockRejectedValue(dbDown());
    const res = await projectPUT(req('/api/projects/5', { method: 'PUT', body: JSON.stringify({ project_name: 'Bikes 2' }) }), projectCtx);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Failed to update project');
  });
});
