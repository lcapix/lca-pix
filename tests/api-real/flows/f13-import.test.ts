/**
 * F13. Document import: upload -> preview (nothing written) -> apply (one
 * transaction) -> the source document attached to the case.
 * Fixtures are built in the test: a small BOM as CSV and as XLSX, and an
 * equipment list for append mode.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { api } from '../support/api';
import { rowCounts, sql, sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const BOM_ROWS = [
  ['Part', 'Material', 'Mass (kg)'],
  ['Body', 'Steel', '0.35'],
  ['Clip', 'Steel', '0.0004'],
];

function upload(file: File, fields: Record<string, string>) {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function bomXlsx(): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(BOM_ROWS.map((r, i) => (i ? [r[0], r[1], Number(r[2])] : r))), 'BOM');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new File([new Uint8Array(buf)], 'bom.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('F13 document import', () => {
  it('F13.3-F13.6 preview a BOM CSV (writes nothing), apply it as a new case, attach the source', async () => {
    const t = w.users.editor.token;
    const csv = BOM_ROWS.map((r) => r.join(',')).join('\n') + '\n';
    const before = await rowCounts();
    const preview = await api.post('/api/ingest/preview', { token: t, form: upload(new File([csv], 'mug-bom.csv', { type: 'text/csv' }), { connector: 'bom' }) });
    expect(preview.status, preview.text).toBe(200);
    expect(await rowCounts()).toEqual(before);
    const plan = preview.json.plan;
    expect(plan.flows).toHaveLength(2);
    for (const f of plan.flows) expect(f).toMatchObject({ substance_name: 'Steel', substance_id: w.substances.steel, unit: 'kg', direction: 'input' });
    expect(plan.flows.map((f: any) => f.quantity).sort()).toEqual([0.0004, 0.35]);

    const apply = await api.post('/api/ingest/apply', {
      token: t,
      json: { project_id: w.P.id, case_name: `From BOM ${w.tag}`, nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes },
    });
    expect(apply.status, apply.text).toBe(201);
    expect(apply.json).toMatchObject({ flows_applied: 2, flows_held_for_review: 0 });
    const caseId = Number(apply.json.case_id);
    const stored = await sql(
      'SELECT f.quantity, f.unit FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ? ORDER BY f.quantity',
      [caseId],
    );
    // Full precision (ING-1 fixed): 0.0004 kg stays 0.0004.
    expect(stored).toEqual([{ quantity: 0.0004, unit: 'kg' }, { quantity: 0.35, unit: 'kg' }]);
    const levels = await sql('SELECT component_type, hierarchy_level FROM component WHERE case_id = ? ORDER BY hierarchy_level', [caseId]);
    expect(levels[0]).toEqual({ component_type: 'product', hierarchy_level: 1 });

    const doc = await api.post(`/api/cases/${caseId}/documents`, {
      token: t,
      form: upload(new File([csv], 'mug-bom.csv', { type: 'text/csv' }), { doc_type: 'bom' }),
    });
    expect(doc.status, doc.text).toBe(200);
    const docs = await api.get(`/api/cases/${caseId}/documents`, { token: w.users.viewer.token });
    expect(docs.json.documents.map((d: any) => [d.filename, d.doc_type])).toEqual([['mug-bom.csv', 'bom']]);
    const one = await api.get(`/api/cases/${caseId}/documents?id=${docs.json.documents[0].document_id}`, { token: w.users.viewer.token });
    expect(one.json.document.content).toContain('Clip\tSteel\t0.0004');
    const completeness = await api.get(`/api/cases/${caseId}/completeness`, { token: t });
    expect(completeness.status).toBe(200);
  });

  it('previews the same BOM from an XLSX workbook', async () => {
    const res = await api.post('/api/ingest/preview', { token: w.users.editor.token, form: upload(bomXlsx(), { connector: 'bom' }) });
    expect(res.status, res.text).toBe(200);
    expect(res.json.plan.flows.map((f: any) => [f.substance_name, f.quantity]).sort()).toEqual([
      ['Steel', 0.0004],
      ['Steel', 0.35],
    ]);
  });

  it('a semicolon CSV with decimal commas keeps 1,5 as 1.5 (ING-4)', async () => {
    const csv = 'Part;Material;Mass (kg)\nBody;Steel;1,5\n';
    const res = await api.post('/api/ingest/preview', { token: w.users.editor.token, form: upload(new File([csv], 'eu.csv'), { connector: 'bom' }) });
    expect(res.status, res.text).toBe(200);
    expect(res.json.plan.flows.map((f: any) => f.quantity)).toEqual([1.5]);
  });

  it('apply (append) adds flows to a chosen step of an existing case', async () => {
    const res = await api.post('/api/ingest/apply', {
      token: w.users.editor.token,
      json: {
        target_case_id: w.P.base.id,
        attach_component_id: w.P.base.op,
        flows: [{ substance_text: 'steel sheet', substance_id: w.substances.steel, direction: 'input', quantity: 0.2, unit: 'kg' }],
        costs: [{ category: 'material', amount: 1.25 }],
        notes: [],
      },
    });
    expect(res.status, res.text).toBe(200);
    expect(res.json).toMatchObject({ appended: true, flows_applied: 1, cost_columns_updated: 1 });
    const flow = await sqlOne('SELECT quantity, unit FROM flows WHERE component_id = ? AND substance_id = ?', [w.P.base.op, w.substances.steel]);
    expect(flow).toEqual({ quantity: 0.2, unit: 'kg' });
  });

  it('equipment list (append mode) needs the target case, and editor on it', async () => {
    const eq = () => new File(['Work center,Machine,kW\nWC1,Kiln,5\n'], 'machines.csv', { type: 'text/csv' });
    const ok = await api.post('/api/ingest/preview', {
      token: w.users.editor.token,
      form: upload(eq(), { connector: 'equipment', target_case_id: String(w.P.base.id) }),
    });
    expect(ok.status, ok.text).toBe(200);
    const missing = await api.post('/api/ingest/preview', { token: w.users.editor.token, form: upload(eq(), { connector: 'equipment' }) });
    expect(missing.status).toBe(400);
    const viewer = await api.post('/api/ingest/preview', {
      token: w.users.viewer.token,
      form: upload(eq(), { connector: 'equipment', target_case_id: String(w.P.base.id) }),
    });
    expect(viewer.status).toBe(403);
  });

  it('preview 400s: unknown connector, no file, a file that is not a spreadsheet; ITAC without a plant id', async () => {
    const t = w.users.editor.token;
    expect((await api.post('/api/ingest/preview', { token: t, form: upload(new File(['a,b\n'], 'x.csv'), { connector: 'crystal-ball' }) })).status).toBe(400);
    const fd = new FormData();
    fd.append('connector', 'bom');
    expect((await api.post('/api/ingest/preview', { token: t, form: fd })).status).toBe(400);
    const itac = await api.post('/api/ingest/preview', { token: t, form: upload(bomXlsx(), { connector: 'itac' }) });
    expect(itac.status).toBe(400);
    expect(itac.json.error).toMatch(/plant_id is required/);
    const noSheet = await api.post('/api/ingest/preview', { token: t, form: upload(bomXlsx(), { connector: 'itac', plant_id: 'WV0661' }) });
    expect(noSheet.status).toBe(400);
    expect(noSheet.json.error).toMatch(/No ASSESS sheet/);
  });

  it('apply 400s write nothing: bad structure, missing name, a step not in the case, a cost category that is not a column (L7)', async () => {
    const t = w.users.editor.token;
    const before = await rowCounts();
    for (const json of [
      { project_id: w.P.id, case_name: 'x', nodes: 'all of them', flows: [], costs: [], notes: [] },
      { project_id: w.P.id, case_name: '', nodes: [{ name: 'A', tier: 'product', parent: null }], flows: [], costs: [], notes: [] },
      { project_id: w.P.id, case_name: 'x', nodes: [{ name: 'A', tier: 'wizard', parent: null }], flows: [], costs: [], notes: [] },
      { target_case_id: w.P.base.id, attach_component_id: w.Q.component, flows: [], costs: [], notes: [] },
      { project_id: w.P.id, case_name: 'x', nodes: [{ name: 'A', tier: 'product', parent: null }], flows: [], costs: [{ category: 'constructor', amount: 1 }], notes: [] },
      { project_id: { $gt: 0 }, case_name: 'x', nodes: [], flows: [], costs: [], notes: [] },
    ]) {
      const r = await api.post('/api/ingest/apply', { token: t, json });
      expect(r.status, JSON.stringify(json).slice(0, 80)).toBe(400);
    }
    expect(await rowCounts()).toEqual(before);
  });

  // Fixed: the plan schema allows a node name of 200 characters, the size of
  // component.component_name, so a longer one gets 400 before anything is
  // written (it used to fail inside the transaction and answer 500).
  it('a node name longer than the column gets 400, not 500', async () => {
    const r = await api.post('/api/ingest/apply', {
      token: w.users.editor.token,
      json: { project_id: w.P.id, case_name: `Long ${w.tag}`, nodes: [{ name: 'N'.repeat(230), tier: 'product', parent: null }], flows: [], costs: [], notes: [] },
    });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/nodes\.0\.name/);
  });

  it('a failure mid-apply leaves no partial case (one transaction)', async () => {
    const before = await rowCounts();
    const r = await api.post('/api/ingest/apply', {
      token: w.users.editor.token,
      json: {
        project_id: w.P.id,
        case_name: `Atomic ${w.tag}`,
        // Each cost fits labor_cost DECIMAL(15,2); their sum on one step does
        // not, which only the UPDATE inside the transaction finds out, after
        // the case and both steps were inserted.
        nodes: [
          { name: 'Fine product', tier: 'product', parent: null },
          { name: 'Weld', tier: 'operation', parent: 'Fine product' },
        ],
        flows: [],
        costs: [
          { node: 'Weld', category: 'labor', amount: 9e12 },
          { node: 'Weld', category: 'labor', amount: 9e12 },
        ],
        notes: [],
      },
    });
    expect(r.status, r.text).toBe(400);
    expect(r.json.error).toMatch(/too large to store/);
    expect(await rowCounts()).toEqual(before);
    expect(await sql('SELECT case_id FROM case_table WHERE case_name = ?', [`Atomic ${w.tag}`])).toEqual([]);
  });
});
