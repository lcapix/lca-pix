/**
 * Student isolation (B-A1, the rule in lib/route-guard.ts): a class
 * project with `members_see_own_cases = 1`.
 *
 *   P (the standard world's project) is the class: the instructor is P's
 *   owner, the TA is P's admin member, student A is P's editor, a second
 *   editor is student B, and P's viewer is an auditing student.
 *
 * With the setting on, an editor or viewer reaches only the cases they
 * created: every other case, and everything under it, answers exactly like a
 * missing case (404, same body), whatever the action; project-level lists
 * leave those cases out. The owner and admins reach everything. Turning the
 * setting off restores the old behaviour.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api, expectStatus } from '../support/api';
import { call } from '../support/http';
import { loadHandler } from '../support/routes';
import { sql, sqlOne, tableChecksums } from '../support/db';
import { buildRowRequest, loadPermissions, MISSING_ID, type PermissionRow } from '../support/permissions';
import {
  addFlow,
  addMember,
  buildTree,
  buildWorld,
  createCase,
  createComponent,
  runAssessment,
  type Caller,
  type World,
} from '../support/world';
import { createUser, type TestUser } from '../support/users';

/** Rows whose resource hangs off one case: every case, component, flow, run and document route. */
const CASE_BODIES = new Set(['Case not found', 'Component not found', 'Flow not found', 'Assessment not found', 'Target case not found']);
const { rows } = loadPermissions();
const caseRows = rows.filter((r) => !r.own_cases && r.not_found && CASE_BODIES.has(r.not_found));

let w: World;
let instructor: TestUser;
let ta: TestUser;
let studentA: TestUser;
let studentB: TestUser;
let auditor: TestUser;
let aCase: number;
let aComponent: number;
let bCase: number;
let bEmpty: number;
let bNames: string[];
/** P's handles pointed at student B's resources. */
let toB: Record<string, number>;
let legacy: number;

const setOwnCases = async (user: TestUser, on: unknown) =>
  api.put(`/api/projects/${w.P.id}`, { token: user.token, json: { members_see_own_cases: on } });

const caseIdsIn = (res: { json: any }, key = 'cases') => (res.json[key] as any[]).map((c) => Number(c.case_id));

async function createdByOf(caseId: number): Promise<number | null> {
  const row = await sqlOne<{ created_by: number | null }>('SELECT created_by FROM case_table WHERE case_id = ?', [caseId]);
  return row?.created_by == null ? null : Number(row.created_by);
}

async function casesCreatedBy(user: TestUser): Promise<number[]> {
  const r = await sql<{ case_id: number }>('SELECT case_id FROM case_table WHERE project_id = ? AND created_by = ? ORDER BY case_id', [w.P.id, user.id]);
  return r.map((x) => Number(x.case_id));
}

async function allCasesOfP(): Promise<number[]> {
  const r = await sql<{ case_id: number }>('SELECT case_id FROM case_table WHERE project_id = ? ORDER BY case_id', [w.P.id]);
  return r.map((x) => Number(x.case_id));
}

beforeAll(async () => {
  w = await buildWorld();
  instructor = w.users.owner;
  ta = w.users.adminm;
  studentA = w.users.editor;
  auditor = w.users.viewer;
  studentB = await createUser('studentB', { fullName: `Student B ${w.tag}` });
  await addMember(instructor, w.P.id, studentB, 'editor');

  // Student A's submission.
  aCase = await createCase(studentA, w.P.id, `A submission ${w.tag}`, 'base');
  [aComponent] = await buildTree(studentA, aCase, ['A mug', 'A line', 'A casting', 'A filling', 'A cleaning'].map((n) => `${n} ${w.tag}`));

  // Student B's submission, with everything the case routes can reach.
  bNames = ['B secret mug', 'B line', 'B casting', 'B filling', 'B cleaning'].map((n) => `${n} ${w.tag}`);
  bCase = await createCase(studentB, w.P.id, `B submission ${w.tag}`, 'base');
  const [bProduct, bMachine, bSub, bOp, bTask] = await buildTree(studentB, bCase, bNames);
  const bFlow = await addFlow(studentB, bTask, { substance_id: w.substances.electricity, flow_type: 'input', quantity: 2, unit: 'kWh' });
  const bFlow2 = await addFlow(studentB, bOp, { substance_id: w.substances.naturalGas, flow_type: 'input', quantity: 1, unit: 'm3' });
  const bRun = Number((await runAssessment(studentB, bCase)).run_id);
  const fd = new FormData();
  fd.append('file', new File([`B private notes ${w.tag}\n`], 'b-notes.txt', { type: 'text/plain' }));
  const bDoc = Number(
    expectStatus(await api.post(`/api/cases/${bCase}/documents`, { token: studentB.token, form: fd }), 200, 'B doc').json.document.document_id,
  );
  const bCopy = Number(
    expectStatus(
      await api.post(`/api/cases/${bCase}/duplicate`, { token: studentB.token, json: { case_name: `B variant ${w.tag}` } }),
      201,
      'B copy',
    ).json.case_id,
  );
  bEmpty = await createCase(studentB, w.P.id, `B empty ${w.tag}`, 'comparative');
  const bLeaf = await createComponent(studentB, bCase, { component_name: `B leaf ${w.tag}`, component_type: 'operation', parent_component_id: bSub });
  const legacyRow: any = await sql(
    `INSERT INTO comparison_runs (comparison_name, project_id, case_ids, base_case_id, created_by) VALUES (?, ?, ?, ?, ?)`,
    [`A vs B ${w.tag}`, w.P.id, JSON.stringify([aCase, bCase]), aCase, instructor.id],
  );
  legacy = Number(legacyRow.insertId);

  toB = {
    '$P.base': bCase,
    '$P.comp': bCopy,
    '$P.base.product': bProduct,
    '$P.base.machine': bMachine,
    '$P.base.subprocess': bSub,
    '$P.base.op': bOp,
    '$P.base.task': bTask,
    '$P.base.flow': bFlow,
    '$P.base.run': bRun,
    '$fresh.emptyCase': bEmpty,
    '$fresh.document': bDoc,
    '$fresh.caseCopy': bCopy,
    '$fresh.leaf': bLeaf,
    '$fresh.flow': bFlow2,
  };

  // The instructor turns isolation on (through the API under test).
  expectStatus(await setOwnCases(instructor, true), 200, 'turn members_see_own_cases on');
});

/** One matrix row, replayed by `caller` against student B's resources. */
async function replay(row: PermissionRow, caller: Caller, opts: { missing?: boolean } = {}) {
  const { url, template, opts: callOpts } = buildRowRequest(row, { w, caller, fresh: {}, overrides: toB, missing: opts.missing });
  const handler = await loadHandler(template, row.method);
  return { url, res: await call(handler, row.method, url, callOpts) };
}

describe('the setting', () => {
  it('GET /api/projects/:id tells every member whether it is on', async () => {
    for (const u of [instructor, ta, studentA, auditor]) {
      const res = expectStatus(await api.get(`/api/projects/${w.P.id}`, { token: u.token }), 200, 'GET project');
      expect(res.json.project.members_see_own_cases, u.label).toBe(true);
    }
  });

  it('only the owner and admins may change it: editors and viewers get 403, a non-member 404, and nothing is written', async () => {
    for (const [u, status] of [
      [studentA, 403],
      [auditor, 403],
      [w.users.nonmem, 404],
    ] as const) {
      const before = await tableChecksums();
      const res = await setOwnCases(u, false);
      expect(res.status, u.label).toBe(status);
      expect(await tableChecksums()).toEqual(before);
    }
    expectStatus(await setOwnCases(ta, true), 200, 'TA sets it');
  });

  it('accepts true/false/1/0 and refuses anything else with 400', async () => {
    for (const bad of ['yes', 2, null, 'true', {}]) {
      const res = await setOwnCases(instructor, bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    const row = await sqlOne<{ v: number }>('SELECT members_see_own_cases AS v FROM project WHERE project_id = ?', [w.P.id]);
    expect(Number(row?.v)).toBe(1);
    expectStatus(await setOwnCases(instructor, 1), 200, 'set 1');
  });
});

describe("another student's case answers exactly like a missing one", () => {
  it('covers every case-scoped route family', () => {
    const families = new Set(caseRows.map((r) => r.path.split('?')[0]));
    expect(caseRows).toHaveLength(26);
    expect(families.size).toBe(16);
  });

  for (const caller of ['editor', 'viewer'] as const) {
    for (const row of caseRows) {
      it(`${row.id} ${row.method} ${row.path} as ${caller === 'editor' ? 'student A (editor)' : 'the auditor (viewer)'} -> 404 ${row.not_found}`, async () => {
        const before = row.method !== 'GET' ? await tableChecksums() : null;
        const { url, res } = await replay(row, caller);
        expect(res.status, `${row.method} ${url}: ${res.text.slice(0, 200)}`).toBe(404);
        expect(res.json).toEqual({ error: row.not_found });
        const { res: missing } = await replay(row, caller, { missing: true });
        expect(missing.status).toBe(404);
        expect(res.text, '404 body for a hidden case vs a missing id').toBe(missing.text);
        for (const name of bNames) expect(res.text).not.toContain(name);
        if (before) expect(await tableChecksums(), `${row.id}: nothing written`).toEqual(before);
      });
    }
  }

  it("clone-from: student A's own empty case cannot copy from B's case (404), nor B's empty case from A's", async () => {
    const aEmpty = await createCase(studentA, w.P.id, `A empty ${w.tag}`, 'comparative');
    const before = await tableChecksums();
    const fromB = await api.post(`/api/cases/${aEmpty}/clone-from`, { token: studentA.token, json: { sourceCaseId: bCase } });
    expect(fromB.status).toBe(404);
    expect(fromB.json).toEqual({ error: 'Case not found' });
    const fromMissing = await api.post(`/api/cases/${aEmpty}/clone-from`, { token: studentA.token, json: { sourceCaseId: MISSING_ID } });
    expect(fromB.text).toBe(fromMissing.text);
    const intoB = await api.post(`/api/cases/${bEmpty}/clone-from`, { token: studentA.token, json: { sourceCaseId: aCase } });
    expect(intoB.status).toBe(404);
    expect(await tableChecksums()).toEqual(before);
  });

  it("the instructor's own case is hidden from students too", async () => {
    for (const u of [studentA, studentB, auditor]) {
      const res = await api.get(`/api/cases/${w.P.base.id}`, { token: u.token });
      expect(res.status, u.label).toBe(404);
      expect(res.json).toEqual({ error: 'Case not found' });
    }
  });
});

describe('each student keeps full use of their own case', () => {
  it('student A reads and edits their case and its steps', async () => {
    expectStatus(await api.get(`/api/cases/${aCase}`, { token: studentA.token }), 200, 'GET own case');
    expectStatus(await api.put(`/api/cases/${aCase}`, { token: studentA.token, json: { description: 'mine' } }), 200, 'PUT own case');
    expectStatus(await api.get(`/api/cases/${aCase}/components`, { token: studentA.token }), 200, 'own components');
    expectStatus(await api.get(`/api/components/${aComponent}`, { token: studentA.token }), 200, 'own component');
    expectStatus(await api.get(`/api/cases/${aCase}/completeness`, { token: studentA.token }), 200, 'own completeness');
  });

  it('student A can create a new case; it is recorded as theirs and B never sees it', async () => {
    const res = expectStatus(
      await api.post(`/api/projects/${w.P.id}/cases`, { token: studentA.token, json: { case_name: `A second try ${w.tag}`, case_type: 'comparative' } }),
      201,
      'student creates a case',
    );
    const id = Number(res.json.case.case_id);
    expect(await createdByOf(id)).toBe(studentA.id);
    expect(caseIdsIn(expectStatus(await api.get(`/api/projects/${w.P.id}/cases`, { token: studentA.token }), 200, 'A list'))).toContain(id);
    expect(caseIdsIn(expectStatus(await api.get(`/api/projects/${w.P.id}/cases`, { token: studentB.token }), 200, 'B list'))).not.toContain(id);
    expect((await api.get(`/api/cases/${id}`, { token: studentB.token })).status).toBe(404);
  });

  it("a duplicate belongs to whoever made it: A's copy of A's case is A's; the instructor's copy of B's case is the instructor's", async () => {
    const mine = Number(
      expectStatus(
        await api.post(`/api/cases/${aCase}/duplicate`, { token: studentA.token, json: { case_name: `A copy ${w.tag}` } }),
        201,
        'A duplicates own case',
      ).json.case_id,
    );
    expect(await createdByOf(mine)).toBe(studentA.id);
    const staff = Number(
      expectStatus(
        await api.post(`/api/cases/${bCase}/duplicate`, { token: instructor.token, json: { case_name: `Instructor copy of B ${w.tag}` } }),
        201,
        'instructor duplicates B',
      ).json.case_id,
    );
    expect(await createdByOf(staff)).toBe(instructor.id);
    expect((await api.get(`/api/cases/${staff}`, { token: studentB.token })).status).toBe(404);
  });

  it("names only clash with cases the student can see: B may reuse A's case name (and rename to it)", async () => {
    const name = `A submission ${w.tag}`;
    const created = await api.post(`/api/projects/${w.P.id}/cases`, { token: studentB.token, json: { case_name: name, case_type: 'comparative' } });
    expect(created.status, created.text).toBe(201);
    const renamed = await api.put(`/api/cases/${bEmpty}`, { token: studentB.token, json: { case_name: `A second try ${w.tag}` } });
    expect(renamed.status, renamed.text).toBe(200);
    // Within what one student sees, names still have to differ.
    const clash = await api.post(`/api/projects/${w.P.id}/cases`, { token: studentB.token, json: { case_name: name, case_type: 'base' } });
    expect(clash.status).toBe(409);
  });

  it('the example project and an imported case are recorded as the caller\'s', async () => {
    const ex = expectStatus(await api.post('/api/example-project', { token: studentA.token }), 200, 'example');
    const exCase = await sqlOne<{ created_by: number }>('SELECT created_by FROM case_table WHERE project_id = ?', [ex.json.project_id]);
    expect(Number(exCase?.created_by)).toBe(studentA.id);

    const imported = expectStatus(
      await api.post('/api/ingest/apply', {
        token: studentA.token,
        json: {
          project_id: w.P.id,
          case_name: `Imported by A ${w.tag}`,
          nodes: [{ name: `A imported mug ${w.tag}`, tier: 'product', parent: null }],
          flows: [],
          costs: [],
          notes: [],
        },
      }),
      201,
      'ingest apply create',
    );
    expect(await createdByOf(Number(imported.json.case_id))).toBe(studentA.id);
  });
});

describe('project-level lists only include reachable cases', () => {
  it('GET /api/projects/:id/cases: each student sees their own, the auditor none, instructor and TA all', async () => {
    const all = await allCasesOfP();
    for (const [u, expected] of [
      [studentA, await casesCreatedBy(studentA)],
      [studentB, await casesCreatedBy(studentB)],
      [auditor, []],
      [instructor, all],
      [ta, all],
    ] as const) {
      const res = expectStatus(await api.get(`/api/projects/${w.P.id}/cases`, { token: u.token }), 200, `${u.label} list`);
      expect(caseIdsIn(res).sort((a, b) => a - b), u.label).toEqual(expected);
    }
    expect(await casesCreatedBy(studentA)).toContain(aCase);
    expect(await casesCreatedBy(studentB)).toContain(bCase);
  });

  it('GET /api/projects/:id/progress: the same sets, and the instructor sees who wrote each case', async () => {
    const all = await allCasesOfP();
    for (const [u, expected] of [
      [studentA, await casesCreatedBy(studentA)],
      [auditor, []],
      [ta, all],
    ] as const) {
      const res = expectStatus(await api.get(`/api/projects/${w.P.id}/progress`, { token: u.token }), 200, `${u.label} progress`);
      expect(caseIdsIn(res).sort((a, b) => a - b), u.label).toEqual(expected);
    }
    const res = expectStatus(await api.get(`/api/projects/${w.P.id}/progress`, { token: instructor.token }), 200, 'instructor progress');
    expect(res.json.members_see_own_cases).toBe(true);
    const b = (res.json.cases as any[]).find((c) => Number(c.case_id) === bCase);
    expect(b.created_by).toBe(studentB.id);
    expect(b.author).toBe(`Student B ${w.tag}`);
    const base = (res.json.cases as any[]).find((c) => Number(c.case_id) === w.P.base.id);
    expect(base.created_by).toBe(instructor.id);
  });

  it("compare leaves out cases the student cannot reach; only hidden ones is the 'No such cases' 404", async () => {
    const both = expectStatus(
      await api.get(`/api/projects/${w.P.id}/compare?cases=${aCase},${bCase}`, { token: studentA.token }),
      200,
      'compare A,B',
    );
    expect((both.json.cases as any[]).map((c) => Number(c.caseId))).toEqual([aCase]);
    for (const name of bNames) expect(both.text).not.toContain(name);
    const hidden = await api.get(`/api/projects/${w.P.id}/compare?cases=${bCase}`, { token: studentA.token });
    const missing = await api.get(`/api/projects/${w.P.id}/compare?cases=${MISSING_ID}`, { token: studentA.token });
    expect(hidden.status).toBe(404);
    expect(hidden.text).toBe(missing.text);
    const staff = expectStatus(
      await api.get(`/api/projects/${w.P.id}/compare?cases=${aCase},${bCase}`, { token: ta.token }),
      200,
      'TA compare',
    );
    expect((staff.json.cases as any[]).map((c) => Number(c.caseId))).toEqual([aCase, bCase]);
  });

  it('GET /api/projects (home cards): case and step counts only count reachable cases', async () => {
    const countFor = async (u: TestUser) => {
      const res = expectStatus(await api.get('/api/projects', { token: u.token }), 200, `${u.label} projects`);
      const p = (res.json.projects as any[]).find((x) => Number(x.project_id) === w.P.id);
      return { cases: Number(p.case_count), steps: Number(p.component_count) };
    };
    const stepsOf = async (ids: number[]) =>
      ids.length
        ? Number((await sqlOne<{ n: number }>(`SELECT COUNT(*) AS n FROM component WHERE case_id IN (${ids.map(() => '?').join(',')})`, ids))?.n)
        : 0;
    const aIds = await casesCreatedBy(studentA);
    expect(await countFor(studentA)).toEqual({ cases: aIds.length, steps: await stepsOf(aIds) });
    expect(await countFor(auditor)).toEqual({ cases: 0, steps: 0 });
    const all = await allCasesOfP();
    expect(await countFor(instructor)).toEqual({ cases: all.length, steps: await stepsOf(all) });
    expect(await countFor(ta)).toEqual({ cases: all.length, steps: await stepsOf(all) });
  });

  it('legacy saved comparisons: one that includes a hidden case is left out and answers like a missing one', async () => {
    const listA = expectStatus(await api.get(`/api/comparisons?project_id=${w.P.id}`, { token: studentA.token }), 200, 'A legacy list');
    expect((listA.json.comparisons as any[]).map((c) => Number(c.comparison_id))).not.toContain(legacy);
    const listTa = expectStatus(await api.get(`/api/comparisons?project_id=${w.P.id}`, { token: ta.token }), 200, 'TA legacy list');
    expect((listTa.json.comparisons as any[]).map((c) => Number(c.comparison_id))).toContain(legacy);

    const one = await api.get(`/api/comparisons/${legacy}`, { token: studentA.token });
    const none = await api.get(`/api/comparisons/${MISSING_ID}`, { token: studentA.token });
    expect(one.status).toBe(404);
    expect(one.text).toBe(none.text);
    for (const name of bNames) expect(one.text).not.toContain(name);

    const post = await api.post('/api/comparisons', {
      token: studentA.token,
      json: { comparison_name: 'probe', project_id: w.P.id, case_ids: [aCase, bCase] },
    });
    const postMissing = await api.post('/api/comparisons', {
      token: studentA.token,
      json: { comparison_name: 'probe', project_id: w.P.id, case_ids: [aCase, MISSING_ID] },
    });
    expect(post.status).toBe(400);
    expect(post.text).toBe(postMissing.text);
  });
});

describe('members list in a restricted project', () => {
  it('a student sees the instructor, the TA and themselves, not classmates; the instructor and TA see everyone', async () => {
    const ids = (res: { json: any }) => [Number(res.json.owner.user_id), ...(res.json.members as any[]).map((m) => Number(m.user_id))].sort((a, b) => a - b);
    const everyone = ids(expectStatus(await api.get(`/api/projects/${w.P.id}/members`, { token: instructor.token }), 200, 'instructor members'));
    expect(everyone).toEqual(expect.arrayContaining([instructor.id, ta.id, studentA.id, studentB.id]));
    expect(ids(expectStatus(await api.get(`/api/projects/${w.P.id}/members`, { token: ta.token }), 200, 'TA members'))).toEqual(everyone);
    const seenByA = ids(expectStatus(await api.get(`/api/projects/${w.P.id}/members`, { token: studentA.token }), 200, 'student A members'));
    expect(seenByA).toEqual([instructor.id, ta.id, studentA.id].sort((a, b) => a - b));
    expect(seenByA).not.toContain(studentB.id);
  });
});

describe('instructor and TA reach every case', () => {
  const reads = () => caseRows.filter((r) => r.method === 'GET');
  for (const caller of ['owner', 'adminm'] as const) {
    it(`${caller === 'owner' ? 'the instructor (owner)' : 'the TA (admin)'} gets 200 on every read of B's case`, async () => {
      for (const row of reads()) {
        const { url, res } = await replay(row, caller);
        expect(res.status, `${row.id} ${url}: ${res.text.slice(0, 200)}`).toBe(200);
      }
    });
  }

  it('the TA may edit a student case', async () => {
    expectStatus(await api.put(`/api/cases/${bCase}`, { token: ta.token, json: { description: 'feedback from the TA' } }), 200, 'TA edits B');
  });
});

describe('turning the setting off restores full visibility', () => {
  it('student A reaches B\'s case again, and every list shows every case', async () => {
    expectStatus(await setOwnCases(instructor, false), 200, 'turn off');
    const project = expectStatus(await api.get(`/api/projects/${w.P.id}`, { token: studentA.token }), 200, 'GET project');
    expect(project.json.project.members_see_own_cases).toBe(false);
    for (const row of caseRows.filter((r) => r.method === 'GET')) {
      const { url, res } = await replay(row, 'editor');
      expect(res.status, `${row.id} ${url}`).toBe(200);
    }
    const all = await allCasesOfP();
    for (const u of [studentA, auditor]) {
      const list = expectStatus(await api.get(`/api/projects/${w.P.id}/cases`, { token: u.token }), 200, 'list');
      expect(caseIdsIn(list).sort((a, b) => a - b)).toEqual(all);
      const progress = expectStatus(await api.get(`/api/projects/${w.P.id}/progress`, { token: u.token }), 200, 'progress');
      expect(caseIdsIn(progress).sort((a, b) => a - b)).toEqual(all);
    }
    // Names clash across the whole project again.
    const clash = await api.post(`/api/projects/${w.P.id}/cases`, { token: studentA.token, json: { case_name: `B submission ${w.tag}`, case_type: 'base' } });
    expect(clash.status).toBe(409);
    // A viewer is back to 403 (not 404) for a write.
    const put = await api.put(`/api/cases/${bCase}`, { token: auditor.token, json: { description: 'x' } });
    expect(put.status).toBe(403);
  });
});
