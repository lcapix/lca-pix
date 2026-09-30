/**
 * Frozen runs, end to end against the LOCAL database (audit RUN-1, STAGE-2,
 * EXP-1, RUN-6).
 *
 * Run with:  LOCAL_DB=1 npx vitest run tests/e2e-local
 * Needs migrate-026 and migrate-027 applied. Calls the real route handlers
 * (POST/GET runs, GET run detail, exports) with a token for an existing local
 * account, on a throwaway project it deletes afterwards.
 *
 * The property under test: once a run is made, deleting a step from the case
 * changes nothing the run reports, and the two same-named steps keep their own
 * stages everywhere.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import mysql from 'mysql2/promise';

const enabled = process.env.LOCAL_DB === '1';
const d = describe.skipIf(!enabled);

const MARK = `frozen-e2e-${Date.now()}`;
let conn: mysql.Connection;
let token: string;
let projectId: number;
let caseId: number;
const ids: Record<string, number> = {};
let runId: number;

let casesRoute: typeof import('@/app/api/cases/[caseId]/assessments/route');
let runRoute: typeof import('@/app/api/assessments/[runId]/route');
let exportRoute: typeof import('@/app/api/assessments/[runId]/export/route');

const req = (url: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

async function listRuns() {
  const res = await casesRoute.GET(req(`/api/cases/${caseId}/assessments`), {
    params: Promise.resolve({ caseId: String(caseId) }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).assessments as any[];
}
async function runDetail(id = runId) {
  const res = await runRoute.GET(req(`/api/assessments/${id}`), {
    params: Promise.resolve({ runId: String(id) }),
  });
  expect(res.status).toBe(200);
  return res.json();
}
async function exportRun(format: string) {
  return exportRoute.GET(req(`/api/assessments/${runId}/export?format=${format}`), {
    params: Promise.resolve({ runId: String(runId) }),
  });
}

d('frozen runs (local DB, post-migrations 026/027)', () => {
  let before: { impacts: any; breakdown: any[]; detailTotals: any[]; detailResults: number };

  beforeAll(async () => {
    conn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'lca_v3',
      port: +(process.env.DATABASE_PORT || 3306),
    });
    const { createToken } = await import('@/lib/auth');
    casesRoute = await import('@/app/api/cases/[caseId]/assessments/route');
    runRoute = await import('@/app/api/assessments/[runId]/route');
    exportRoute = await import('@/app/api/assessments/[runId]/export/route');

    const [[acct]]: any = await conn.query(
      `SELECT id, email, password_hash FROM account WHERE is_active = 1 ORDER BY id LIMIT 1`,
    );
    token = createToken({ id: acct.id, email: acct.email }, acct.password_hash);

    const [p]: any = await conn.query(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, 'frozen-run e2e throwaway', ?)`,
      [MARK, acct.id],
    );
    projectId = p.insertId;
    const [c]: any = await conn.query(
      `INSERT INTO case_table (project_id, case_name, case_type) VALUES (?, ?, 'base')`,
      [projectId, MARK],
    );
    caseId = c.insertId;

    const add = async (key: string, name: string, type: string, level: number, parent: number | null, stage: string | null) => {
      const [r]: any = await conn.query(
        `INSERT INTO component (case_id, component_name, component_type, hierarchy_level, parent_component_id, life_cycle_stage, labor_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [caseId, name, type, level, parent, stage, key === 'asm2' ? 42.5 : null],
      );
      ids[key] = r.insertId;
    };
    await add('product', `${MARK} bike`, 'product', 1, null, null);
    await add('line1', 'Frame line', 'machine_line', 2, ids.product, null);
    await add('line2', 'Paint line', 'machine_line', 2, ids.product, null);
    // Two steps with the same name under different parents (STAGE-2).
    await add('asm1', 'Assembly', 'operation', 4, ids.line1, 'materials');
    await add('asm2', 'Assembly', 'operation', 4, ids.line2, 'end_of_life');

    const sid = async (name: string) => {
      const [[row]]: any = await conn.query(`SELECT substance_id FROM substances WHERE substance_name = ? LIMIT 1`, [name]);
      return row.substance_id as number;
    };
    await conn.query(
      `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver) VALUES
       (?, ?, 'input', 10, 'kg', 1),
       (?, ?, 'input', 100, 'kWh', 1)`,
      [ids.asm1, await sid('Steel, reinforced'), ids.asm2, await sid('Electricity')],
    );

    const res = await casesRoute.POST(
      req(`/api/cases/${caseId}/assessments`, {
        method: 'POST',
        body: { run_name: MARK, calculation_method: 'CML 2001', region_code: 'Global' },
      }),
      { params: Promise.resolve({ caseId: String(caseId) }) },
    );
    expect(res.status).toBe(201);
    runId = (await res.json()).run_id;

    const runs = await listRuns();
    const run = runs.find((r) => r.run_id === runId);
    const detail = await runDetail();
    before = {
      impacts: run.impacts,
      breakdown: run.componentBreakdown,
      detailTotals: detail.total_impacts,
      detailResults: detail.results.length,
    };
  }, 30000);

  afterAll(async () => {
    if (projectId) await conn.query(`DELETE FROM project WHERE project_id = ?`, [projectId]);
    await conn.end();
    const pool = (await import('@/lib/db')).default;
    await pool.end();
  });

  it('reads a new run from its snapshot', async () => {
    const run = (await listRuns()).find((r) => r.run_id === runId);
    expect(run.results_source).toBe('snapshot');
    expect(Object.keys(run.impacts).length).toBeGreaterThan(0);
    const detail = await runDetail();
    expect(detail.results_source).toBe('snapshot');
  });

  it('keeps two same-named steps apart, each with its own stage', () => {
    const asm = before.breakdown.filter((c: any) => c.component_name === 'Assembly');
    expect(asm.map((c: any) => [c.component_id, c.life_cycle_stage]).sort()).toEqual(
      [
        [ids.asm1, 'materials'],
        [ids.asm2, 'end_of_life'],
      ].sort(),
    );
  });

  it('deleting a step changes nothing the run reports', async () => {
    const [[{ n: rowsBefore }]]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM assessment_results WHERE run_id = ?`,
      [runId],
    );
    await conn.query(`DELETE FROM component WHERE component_id = ?`, [ids.asm2]);

    const run = (await listRuns()).find((r) => r.run_id === runId);
    expect(run.impacts).toEqual(before.impacts);
    expect(run.componentBreakdown).toEqual(before.breakdown);

    const detail = await runDetail();
    expect(detail.total_impacts).toEqual(before.detailTotals);
    expect(detail.results).toHaveLength(before.detailResults);
    expect(detail.results.some((r: any) => r.component_id === ids.asm2 && r.component_name === 'Assembly')).toBe(true);

    // migrate-027: the stored rows survive the delete, detached from the step.
    const [[{ n: rowsAfter }]]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM assessment_results WHERE run_id = ?`,
      [runId],
    );
    expect(rowsAfter).toBe(rowsBefore);
    const [[{ n: detached }]]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM assessment_results WHERE run_id = ? AND component_id IS NULL`,
      [runId],
    );
    expect(detached).toBeGreaterThan(0);
  });

  it('exports the frozen inventory: deleted step, stage by id, impact_unit', async () => {
    const res = await exportRun('csv');
    expect(res.status).toBe(200);
    const csv = await res.text();
    const lines = csv.split('\n');
    const header = lines.find((l) => l.startsWith('step,'))!;
    expect(header.split(',').at(-1)).toBe('impact_unit');
    const asm = lines.filter((l) => l.startsWith('Assembly,'));
    const stages = new Set(asm.map((l) => l.split(',')[1]));
    expect(stages).toEqual(new Set(['materials', 'end_of_life']));
    expect(asm.every((l) => l.split(',').at(-1)!.length > 0)).toBe(true);
  });

  it('exports a PDF and a PPTX of the frozen run', async () => {
    const pdf = await exportRun('pdf');
    expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    const pptx = await exportRun('pptx');
    expect(pptx.status).toBe(200);
    expect(Buffer.from(await pptx.arrayBuffer()).subarray(0, 2).toString()).toBe('PK');
  });

  it('labels a legacy run (no v3 snapshot) as recomputed from current data', async () => {
    const [r]: any = await conn.query(
      `INSERT INTO assessment_runs (case_id, run_name, calculation_method, region_code, status, executed_by)
       SELECT case_id, 'legacy copy', calculation_method, region_code, 'completed', executed_by
         FROM assessment_runs WHERE run_id = ?`,
      [runId],
    );
    const legacyId = r.insertId;
    const run = (await listRuns()).find((x) => x.run_id === legacyId);
    expect(run.results_source).toBe('recomputed from current data');
    const detail = await runDetail(legacyId);
    expect(detail.results_source).toBe('recomputed from current data');
  });

  it('refuses a method the factor table does not carry (RUN-6)', async () => {
    const [[{ n: runsBefore }]]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM assessment_runs WHERE case_id = ?`,
      [caseId],
    );
    const res = await casesRoute.POST(
      req(`/api/cases/${caseId}/assessments`, { method: 'POST', body: { calculation_method: 'EF 3.1' } }),
      { params: Promise.resolve({ caseId: String(caseId) }) },
    );
    expect(res.status).toBe(400);
    const [[{ n: runsAfter }]]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM assessment_runs WHERE case_id = ?`,
      [caseId],
    );
    expect(runsAfter).toBe(runsBefore);
  });
});
