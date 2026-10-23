/**
 * F13 with a real ITAC row (Phase 1, R5): WV0661 imports through preview and
 * apply with every dollar its row states, electricity as three steps, and
 * importing it again with Keep (the review screen's default) changes nothing.
 * The workbook sent is WV0661's real ASSESS row (tests/fixtures/itac), under
 * the real header names, in a sheet named ASSESS.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { api } from '../support/api';
import { sql } from '../support/db';
import { buildWorld, type World } from '../support/world';
import fixture from '../../fixtures/itac/assess-rows.json';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const WV0661 = fixture.rows.find((x) => x.row.ID === 'WV0661')!.row as Record<string, unknown>;

function workbook(): File {
  const header = Object.keys(WV0661);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, header.map((k) => WV0661[k])]), 'ASSESS');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new File([new Uint8Array(buf)], fixture.source.file, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function preview(token: string) {
  const fd = new FormData();
  fd.append('file', workbook());
  fd.append('connector', 'itac');
  fd.append('plant_id', 'WV0661');
  const res = await api.post('/api/ingest/preview', { token, form: fd });
  expect(res.status, res.text).toBe(200);
  return res.json.plan;
}

const COLUMN: Record<string, string> = { energy: 'energy_cost', opex: 'opex' };

/** What the case holds: every step's cost columns and every flow. */
async function holdings(caseId: number) {
  const steps = await sql(
    `SELECT component_name, energy_cost, opex FROM component WHERE case_id = ? ORDER BY component_id`,
    [caseId],
  );
  const flows = await sql(
    `SELECT c.component_name, f.substance_id, f.flow_type, f.quantity, f.unit
       FROM flows f JOIN component c ON c.component_id = f.component_id
      WHERE c.case_id = ? ORDER BY f.flow_id`,
    [caseId],
  );
  return { steps, flows };
}

describe('F13 ITAC import of WV0661', () => {
  let caseId: number;

  it('imports electricity as three steps adding to $78,053, and gas as $23,097', async () => {
    const t = w.users.editor.token;
    const plan = await preview(t);
    const apply = await api.post('/api/ingest/apply', {
      token: t,
      json: { project_id: w.P.id, case_name: `ITAC WV0661 ${w.tag}`, nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes },
    });
    expect(apply.status, apply.text).toBe(201);
    caseId = Number(apply.json.case_id);

    const { steps, flows } = await holdings(caseId);
    const energy = (name: string) => Number(steps.find((s: any) => s.component_name === name)?.energy_cost);
    expect(energy('Electricity consumption FY2024')).toBe(48194);
    expect(energy('Electricity demand FY2024')).toBe(21279);
    expect(energy('Electricity fees FY2024')).toBe(8580);
    expect(energy('Natural gas FY2024')).toBe(23097);
    // Only consumption carries flows: demand and fees are charges with no carbon.
    expect(flows.map((f: any) => f.component_name).sort()).toEqual(['Electricity consumption FY2024', 'Natural gas FY2024']);
  });

  it('importing it again with Keep changes nothing', async () => {
    const t = w.users.editor.token;
    const before = await holdings(caseId);
    const plan = await preview(t);
    const ids = new Map(
      (await sql('SELECT component_id, component_name FROM component WHERE case_id = ?', [caseId])).map((c: any) => [
        c.component_name,
        Number(c.component_id),
      ]),
    );
    // What the review screen sends by default: every step attached to the
    // case's step of the same name, every cost and flow already there kept.
    const node_actions = Object.fromEntries(plan.nodes.map((n: any) => [n.name, { action: 'attach', component_id: ids.get(n.name) }]));
    const cost_modes = Object.fromEntries(plan.costs.map((c: any) => [`${ids.get(c.node)}|${COLUMN[c.category]}`, 'keep']));
    const flow_modes = Object.fromEntries(
      plan.flows.filter((f: any) => f.substance_id).map((f: any) => [`${ids.get(f.node)}|${f.substance_id}|${f.direction}`, 'keep']),
    );
    const again = await api.post('/api/ingest/apply', {
      token: t,
      json: { target_case_id: caseId, nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes, node_actions, cost_modes, flow_modes },
    });
    expect(again.status, again.text).toBe(200);
    expect(await holdings(caseId)).toEqual(before);
  });
});
