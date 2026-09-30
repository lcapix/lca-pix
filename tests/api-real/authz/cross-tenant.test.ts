/**
 * Cross-tenant IDOR probes.
 *
 * Sweep: every id-bearing row of the permissions matrix is replayed
 *   - by userB (owner of Q, not a member of P) with P's ids, and
 *   - by P's owner with Q's ids (every P handle pointed at Q's resource),
 * and must answer 404 with a body that names nothing of the other tenant,
 * and write nothing.
 *
 * Body-borne ids, which a path-based matrix cannot see: a parent step, a
 * substance, a source case, an attach step, a run override, legacy case ids,
 * a document id, a member id, each taken from the other tenant (or another
 * case) and passed where the caller does have access.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api, expectStatus } from '../support/api';
import { call } from '../support/http';
import { loadHandler } from '../support/routes';
import { sql, tableChecksums } from '../support/db';
import { buildRowRequest, loadPermissions, type PermissionRow } from '../support/permissions';
import { buildWorld, createCase, createComponent, addFlow, type World } from '../support/world';

const { rows } = loadPermissions();
const idRows = rows.filter((r) => Object.keys(r.params ?? {}).length > 0 || /^(body|form)\./.test(r.primary ?? '') || r.multipart === 'equipment_csv');

let w: World;
let qOverrides: Record<string, number>;
let qDocument: number;

beforeAll(async () => {
  w = await buildWorld();
  const B = w.users.userB;
  // Q-side stand-ins for every handle and fresh builder the rows use.
  const qEmpty = await createCase(B, w.Q.id, `Q empty ${w.tag}`, 'comparative');
  const qLeaf = await createComponent(B, w.Q.caseId, {
    component_name: `Q leaf ${w.tag}`,
    component_type: 'machine_line',
    parent_component_id: w.Q.component,
  });
  const qFlow2 = await addFlow(B, w.Q.component, { substance_id: w.substances.electricity, flow_type: 'input', quantity: 1, unit: 'kWh' });
  const fd = new FormData();
  fd.append('file', new File([`Q secret notes ${w.tag}\n`], 'q-notes.txt', { type: 'text/plain' }));
  qDocument = Number(
    expectStatus(await api.post(`/api/cases/${w.Q.caseId}/documents`, { token: B.token, form: fd }), 200, 'Q doc').json.document.document_id,
  );
  const qCopy = Number(
    expectStatus(await api.post(`/api/cases/${w.Q.caseId}/duplicate`, { token: B.token, json: { case_name: `Q copy ${w.tag}` } }), 201, 'Q copy')
      .json.case_id,
  );
  const qLegacy: any = await sql(
    `INSERT INTO comparison_runs (comparison_name, project_id, case_ids, base_case_id, created_by) VALUES (?, ?, ?, ?, ?)`,
    [`Q legacy ${w.tag}`, w.Q.id, JSON.stringify([w.Q.caseId, qCopy]), w.Q.caseId, B.id],
  );
  await sql(
    `INSERT INTO project_members (project_id, user_id, permission_id)
     SELECT ?, ?, permission_id FROM permissions WHERE permission_name = 'viewer'`,
    [w.Q.id, w.users.invitee.id],
  );
  qOverrides = {
    $P: w.Q.id,
    '$P.base': w.Q.caseId,
    '$P.comp': qCopy,
    '$P.base.product': w.Q.component,
    '$P.base.machine': qLeaf,
    '$P.base.subprocess': w.Q.component,
    '$P.base.op': w.Q.component,
    '$P.base.task': w.Q.component,
    '$P.base.flow': w.Q.flow,
    '$P.base.run': w.Q.run,
    '$legacy.comparison': Number(qLegacy.insertId),
    '$fresh.project': w.Q.id,
    '$fresh.emptyCase': qEmpty,
    '$fresh.invitee': w.users.invitee.id,
    '$fresh.document': qDocument,
    '$fresh.caseCopy': qCopy,
    '$fresh.leaf': qLeaf,
    '$fresh.flow': qFlow2,
    '$fresh.legacyComparison': Number(qLegacy.insertId),
  };
});

async function probe(row: PermissionRow, direction: 'B->P' | 'owner->Q') {
  const fresh: Record<string, number> = {};
  if (direction === 'B->P' && row.fresh) fresh[row.fresh] = await w.fresh[row.fresh]();
  const caller = direction === 'B->P' ? 'userB' : 'owner';
  const { url, template, opts } = buildRowRequest(row, {
    w,
    caller,
    fresh,
    overrides: direction === 'owner->Q' ? qOverrides : undefined,
  });
  const handler = await loadHandler(template, row.method);
  const before = row.method !== 'GET' ? await tableChecksums() : null;
  const res = await call(handler, row.method, url, opts);
  expect(res.status, `${row.id} ${direction} ${row.method} ${url}: ${res.text.slice(0, 200)}`).toBe(404);
  if (row.not_found) expect(res.json).toEqual({ error: row.not_found });
  const secrets = direction === 'B->P' ? w.secretsOfP : w.secretsOfQ;
  for (const s of secrets) expect(res.text).not.toContain(s);
  if (before) expect(await tableChecksums(), `${row.id} ${direction}: nothing written`).toEqual(before);
}

describe('cross-tenant sweep over every id-bearing route', () => {
  it('covers the id-bearing rows', () => {
    expect(idRows.length).toBeGreaterThanOrEqual(40);
  });
  for (const row of idRows) {
    it(`${row.id} ${row.method} ${row.path}: userB with P's ids -> 404, nothing of P`, () => probe(row, 'B->P'));
    it(`${row.id} ${row.method} ${row.path}: P's owner with Q's ids -> 404, nothing of Q`, () => probe(row, 'owner->Q'));
  }
});

describe('body-borne ids from another case or tenant', () => {
  it('POST components: parent_component_id from another tenant -> 400, parent name not echoed', async () => {
    const owner = w.users.owner;
    const res = await api.post(`/api/cases/${w.P.base.id}/components`, {
      token: owner.token,
      json: { component_name: 'Probe', component_type: 'operation', parent_component_id: w.Q.component },
    });
    expect(res.status).toBe(400);
    expect(res.text).not.toContain(w.Q.componentName);
    expect(res.json.error).toBe('The parent must be a step in the same case.');
  });

  it('POST components: parent_component_id from another case of the same project -> 400', async () => {
    const [other] = await sql<{ component_id: number; component_name: string }>(
      'SELECT component_id, component_name FROM component WHERE case_id = ? LIMIT 1',
      [w.P.comp.id],
    );
    const res = await api.post(`/api/cases/${w.P.base.id}/components`, {
      token: w.users.editor.token,
      json: { component_name: 'Probe', component_type: 'operation', parent_component_id: other.component_id },
    });
    expect(res.status).toBe(400);
    expect(res.text).not.toContain(other.component_name);
  });

  it('PUT component: parent from another tenant, itself, or a descendant -> 400, nothing changed', async () => {
    const token = w.users.editor.token;
    const before = await sql('SELECT parent_component_id, hierarchy_level FROM component WHERE component_id = ?', [w.P.base.op]);
    for (const parent of [w.Q.component, w.P.base.op, w.P.base.task]) {
      const res = await api.put(`/api/components/${w.P.base.op}`, { token, json: { parent_component_id: parent } });
      expect(res.status, `parent ${parent}`).toBe(400);
      expect(res.text).not.toContain(w.Q.componentName);
    }
    expect(await sql('SELECT parent_component_id, hierarchy_level FROM component WHERE component_id = ?', [w.P.base.op])).toEqual(before);
  });

  it("POST flows: another user's private substance_id -> 400 without its name", async () => {
    const res = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.owner.token,
      json: { substance_id: w.Q.substance, flow_type: 'input', quantity: 1, unit: 'kg' },
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('Unknown substance. Pick one from the catalog or add your own.');
    expect(res.text).not.toContain(w.Q.substanceName);
  });

  it("PUT flows: swapping to another user's private substance -> 400 without its name", async () => {
    const res = await api.put(`/api/flows/${w.P.base.flow}`, {
      token: w.users.owner.token,
      json: { substance_id: w.Q.substance },
    });
    expect(res.status).toBe(400);
    expect(res.text).not.toContain(w.Q.substanceName);
    const [row] = await sql('SELECT substance_id FROM flows WHERE flow_id = ?', [w.P.base.flow]);
    expect(Number(row.substance_id)).toBe(w.substances.electricity);
  });

  // BUG (L3 / FLOW-5, ingest twin; app/api/ingest/apply/route.ts:169 and :301
  // look substances up with no `is_custom = 0 OR created_by = ?` scope): a
  // plan may carry another user's private substance_id; the flow is written
  // and the name then shows up in the case (GET /api/components/:id/flows).
  it.fails("ingest/apply: another user's private substance_id is held for review, never written (L3, ingest twin of FLOW-5)", async () => {
    const res = await api.post('/api/ingest/apply', {
      token: w.users.owner.token,
      json: {
        project_id: w.P.id,
        case_name: `Probe import ${w.tag}`,
        nodes: [{ name: 'Probe product', tier: 'product', parent: null }],
        flows: [{ node: 'Probe product', substance_text: 'fibre', substance_id: w.Q.substance, direction: 'input', quantity: 1, unit: 'kg' }],
        costs: [],
        notes: [],
      },
    });
    expect([201, 400]).toContain(res.status);
    const leaked = await sql(
      `SELECT f.flow_id FROM flows f JOIN component c ON c.component_id = f.component_id
         JOIN case_table ct ON ct.case_id = c.case_id WHERE ct.project_id = ? AND f.substance_id = ?`,
      [w.P.id, w.Q.substance],
    );
    expect(leaked).toEqual([]);
  });

  // BUG (ING-9 / L3; app/api/ingest/preview/route.ts:285-294 matches the
  // plan against every substance, private ones included): a BOM line that
  // resembles another user's private substance is matched to it, and the
  // plan returns its name and id.
  it.fails("ingest/preview: another user's private substance is never a match candidate (ING-9)", async () => {
    const fd = new FormData();
    // The caller types only "Bamboo fibre"; the private row is "Bamboo fibre (B) <tag>".
    fd.append('file', new File(['Part,Material,Mass (kg)\nFrame,Bamboo fibre,1.2\n'], 'bom.csv', { type: 'text/csv' }));
    fd.append('connector', 'bom');
    const res = await api.post('/api/ingest/preview', { token: w.users.owner.token, form: fd });
    expect(res.status).toBe(200);
    // Neither the chosen match nor the review screen's candidates may be
    // anyone else's private substance (the suite's database holds several
    // "Bamboo fibre (B) <tag>" rows, one per world, all private).
    const ids = (res.json.plan.flows as any[])
      .flatMap((f) => [f.substance_id, ...(f.candidates ?? []).map((c: any) => c.substance_id)])
      .filter((id) => id != null)
      .map(Number);
    expect(ids.length).toBeGreaterThan(0);
    const foreign = await sql(
      `SELECT substance_id, substance_name FROM substances
        WHERE substance_id IN (${ids.map(() => '?').join(',')}) AND is_custom = 1 AND created_by <> ?`,
      [...ids, w.users.owner.id],
    );
    expect(foreign).toEqual([]);
  });

  it('clone-from: sourceCaseId from another tenant -> 4xx, nothing copied, no names', async () => {
    const empty = await w.fresh.emptyCase();
    const res = await api.post(`/api/cases/${empty}/clone-from`, { token: w.users.owner.token, json: { sourceCaseId: w.Q.caseId } });
    expect([400, 404]).toContain(res.status);
    for (const s of w.secretsOfQ) expect(res.text).not.toContain(s);
    expect(await sql('SELECT component_id FROM component WHERE case_id = ?', [empty])).toEqual([]);
  });

  it('ingest/apply append: attach_component_id from another tenant or case -> 400, nothing written', async () => {
    const [compStep] = await sql<{ component_id: number }>('SELECT component_id FROM component WHERE case_id = ? LIMIT 1', [w.P.comp.id]);
    for (const attach of [w.Q.component, Number(compStep.component_id)]) {
      const before = await tableChecksums();
      const res = await api.post('/api/ingest/apply', {
        token: w.users.editor.token,
        json: {
          target_case_id: w.P.base.id,
          attach_component_id: attach,
          flows: [{ substance_text: 'Electricity', substance_id: w.substances.electricity, direction: 'input', quantity: 1, unit: 'kWh' }],
          costs: [],
          notes: [],
        },
      });
      expect(res.status, res.text).toBe(400);
      expect(res.text).not.toContain(w.Q.componentName);
      expect(await tableChecksums()).toEqual(before);
    }
  });

  it("compare: a runs= override naming another tenant's run is ignored", async () => {
    const res = await api.get(`/api/projects/${w.P.id}/compare?cases=${w.P.base.id},${w.P.comp.id}&runs=${w.P.base.id}:${w.Q.run}`, {
      token: w.users.viewer.token,
    });
    expect(res.status).toBe(200);
    const runIds = (res.json.cases as any[]).map((c) => c.run?.runId);
    expect(runIds).not.toContain(w.Q.run);
    for (const s of w.secretsOfQ) expect(res.text).not.toContain(s);
  });

  it('legacy comparisons POST: case_ids from another tenant -> 400', async () => {
    const res = await api.post('/api/comparisons', {
      token: w.users.owner.token,
      json: { comparison_name: 'x', project_id: w.P.id, case_ids: [w.P.base.id, w.Q.caseId] },
    });
    expect(res.status).toBe(400);
    for (const s of w.secretsOfQ) expect(res.text).not.toContain(s);
  });

  it("documents GET ?id= of a document in another tenant's case -> 404", async () => {
    const res = await api.get(`/api/cases/${w.P.base.id}/documents?id=${qDocument}`, { token: w.users.owner.token });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Document not found' });
  });

  it('documents DELETE ?id= of a document in another tenant\'s case -> 404, document kept', async () => {
    const res = await api.delete(`/api/cases/${w.P.base.id}/documents?id=${qDocument}`, { token: w.users.owner.token });
    expect(res.status).toBe(404);
    expect(await sql('SELECT document_id FROM case_documents WHERE document_id = ?', [qDocument])).toHaveLength(1);
  });

  it('members DELETE: a user who is not a member -> 404 Member not found', async () => {
    const res = await api.delete(`/api/projects/${w.P.id}/members?user_id=${w.users.userB.id}`, { token: w.users.owner.token });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Member not found' });
  });
});
