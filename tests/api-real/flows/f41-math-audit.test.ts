/**
 * F41. The math audit: every number a run freezes, worked out a second time
 * from the case's own rows with plain arithmetic, never through lib/lca-engine
 * or lib/units. Per flow and category: the factor for the run's region, else
 * the Global one, one row only; an embodied factor counts on an input, an
 * elementary one on an output; a person's own number replaces the library's
 * when its unit is the method's; the amount is put in the factor's unit with
 * this file's own table; a step's allocated share multiplies down the tree.
 * Then each step's own value, the case totals, and the per-functional-unit
 * scale must match the snapshot.
 *
 * Real data only: the sample study (its two cases), the touring bike built
 * from the three bundled documents, and DOE ITAC plant WV0661. Each run under
 * the three methods and the three regions.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sql, sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';
import { createProject } from '../support/world';
import { SAMPLE_DOCS } from '@/lib/ingest/sample-docs';
import fixture from '../../fixtures/itac/assess-rows.json';
import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

const METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'];
const REGIONS = ['Global', 'US', 'EU'];

// This file's own unit table, to the base unit of each family. Kept apart
// from lib/units on purpose: the audit must not share the engine's tables.
const TO_BASE: Record<string, [string, number]> = {
  kg: ['mass', 1], g: ['mass', 0.001], mg: ['mass', 1e-6], t: ['mass', 1000], tonne: ['mass', 1000], lb: ['mass', 0.45359237],
  kwh: ['energy', 1], wh: ['energy', 0.001], mwh: ['energy', 1000], mj: ['energy', 1 / 3.6], gj: ['energy', 1000 / 3.6],
  mmbtu: ['energy', 293.0710701722222], btu: ['energy', 0.0002930710701722222], therm: ['energy', 29.30710701722222],
  m3: ['volume', 1], l: ['volume', 0.001], gal: ['volume', 0.003785411784],
  tkm: ['transport', 1],
};
const norm = (u: string | null | undefined) => String(u ?? '').trim().toLowerCase().replace(/³/g, '3').replace(/\s+/g, '');

function convert(q: number, from: string | null, to: string | null): number | null {
  const a = TO_BASE[norm(from)];
  const b = TO_BASE[norm(to)];
  if (norm(from) && norm(from) === norm(to)) return q;
  if (!a || !b || a[0] !== b[0]) return null;
  return (q * a[1]) / b[1];
}

/** "kg CO2 eq / kWh" → kWh; "kg CO2 eq" → null. */
const perUnitOf = (factorUnit: string | null) => (String(factorUnit ?? '').includes('/') ? String(factorUnit).split('/').pop()!.trim() : null);
const impactUnitOf = (factorUnit: string | null) => String(factorUnit ?? '').split('/')[0].trim().toLowerCase();

interface Expected {
  totals: Map<string, number>;
  steps: Map<number, Map<string, number>>;
  perFu: number;
  excluded: string[];
}

/** The case's numbers, from its rows. */
async function expectedFor(caseId: number, method: string, region: string): Promise<Expected> {
  const flows = await sql<any>(
    `SELECT f.flow_id, f.component_id, f.flow_type, f.quantity, f.unit, s.substance_id, s.substance_name, s.unit AS sub_unit
       FROM flows f JOIN component c ON c.component_id = f.component_id JOIN substances s ON s.substance_id = f.substance_id
      WHERE c.case_id = ?`,
    [caseId],
  );
  const comps = await sql<any>(`SELECT component_id, parent_component_id, allocation_factor FROM component WHERE case_id = ?`, [caseId]);
  const kase = await sqlOne<any>(`SELECT reference_flow, modeled_output FROM case_table WHERE case_id = ?`, [caseId]);
  const own = await sql<any>(
    `SELECT o.flow_id, o.category_id, o.factor_value, o.impact_unit, o.per_unit, ic.category_name
       FROM flow_factor_overrides o JOIN flows f ON f.flow_id = o.flow_id JOIN component c ON c.component_id = f.component_id
       JOIN impact_categories ic ON ic.category_id = o.category_id WHERE c.case_id = ?`,
    [caseId],
  );
  const subIds = [...new Set(flows.map((f) => Number(f.substance_id)))];
  const factors = subIds.length
    ? await sql<any>(
        `SELECT d.substance_id, d.category_id, ic.category_name, d.factor_value, d.unit, d.geographic_scope, d.factor_basis
           FROM driver_impact_factors d JOIN impact_categories ic ON ic.category_id = d.category_id
          WHERE d.method_name = ? AND d.substance_id IN (${subIds.map(() => '?').join(',')})`,
        [method, ...subIds],
      )
    : [];
  // The method's result unit per category, for an own number.
  const methodUnits = await sql<any>(
    `SELECT DISTINCT category_id, lower(trim(split_part(unit COLLATE "C", '/', 1))) AS u FROM driver_impact_factors WHERE method_name = ?`,
    [method],
  );

  // Allocation: a step's own share times every parent's.
  const parent = new Map(comps.map((c) => [Number(c.component_id), c.parent_component_id == null ? null : Number(c.parent_component_id)]));
  const ownShare = new Map(
    comps.map((c) => {
      const f = Number(c.allocation_factor);
      return [Number(c.component_id), Number.isFinite(f) && f > 0 && f <= 1 ? f : 1];
    }),
  );
  const share = (id: number): number => {
    let s = 1;
    for (let at: number | null = id, n = 0; at != null && n < 64; at = parent.get(at) ?? null, n++) s *= ownShare.get(at) ?? 1;
    return s;
  };

  const steps = new Map<number, Map<string, number>>();
  const totals = new Map<string, number>();
  const excluded: string[] = [];
  const add = (comp: number, cat: string, v: number) => {
    const m = steps.get(comp) ?? new Map<string, number>();
    m.set(cat, (m.get(cat) ?? 0) + v);
    steps.set(comp, m);
    totals.set(cat, (totals.get(cat) ?? 0) + v);
  };

  for (const f of flows) {
    if (f.quantity === null || f.quantity === undefined || f.quantity === '') continue;
    const q = Number(f.quantity);
    if (!Number.isFinite(q)) continue;
    const mine = new Map(own.filter((o) => Number(o.flow_id) === Number(f.flow_id)).map((o) => [Number(o.category_id), o]));
    const byCat = new Map<number, any[]>();
    for (const r of factors.filter((r) => Number(r.substance_id) === Number(f.substance_id))) byCat.set(Number(r.category_id), [...(byCat.get(Number(r.category_id)) ?? []), r]);
    const cats = new Set([...byCat.keys(), ...mine.keys()]);
    for (const cat of cats) {
      const o = mine.get(cat);
      let value: number, per: string | null, name: string;
      if (o) {
        const mu = methodUnits.find((m) => Number(m.category_id) === cat)?.u;
        if (mu && mu !== String(o.impact_unit).trim().toLowerCase()) {
          excluded.push(`own number for flow ${f.flow_id} in ${o.category_name}: unit ${o.impact_unit} is not the method's ${mu}`);
          continue;
        }
        value = Number(o.factor_value);
        per = o.per_unit;
        name = o.category_name;
      } else {
        const rows = byCat.get(cat) ?? [];
        const pick = rows.find((r) => String(r.geographic_scope).toLowerCase() === region.toLowerCase()) ?? rows.find((r) => String(r.geographic_scope).toLowerCase() === 'global');
        if (!pick) continue;
        if (pick.factor_basis === 'embodied' && f.flow_type === 'output') continue;
        if (pick.factor_basis === 'elementary' && f.flow_type === 'input') continue;
        value = Number(pick.factor_value);
        per = perUnitOf(pick.unit) ?? f.sub_unit;
        name = pick.category_name;
      }
      const inUnit = convert(q, f.unit, per);
      if (inUnit === null) {
        excluded.push(`flow ${f.flow_id} ${f.substance_name}: ${f.unit} to ${per}`);
        continue;
      }
      add(Number(f.component_id), name, inUnit * value * share(Number(f.component_id)));
    }
  }
  const pos = (v: unknown) => (Number(v) > 0 ? Number(v) : 1);
  return { totals, steps, perFu: pos(kase?.reference_flow) / pos(kase?.modeled_output), excluded };
}

/** Run the case and check the frozen numbers against the arithmetic above. */
async function audit(user: TestUser, caseId: number, method: string, region: string) {
  const run = await api.post(`/api/cases/${caseId}/assessments`, { token: user.token, json: { calculation_method: method, region_code: region } });
  expect(run.status, run.text).toBe(201);
  const snap = await snapshotOf(run.json.run_id);
  const want = await expectedFor(caseId, method, region);
  const where = `case ${caseId}, ${method}, ${region}`;

  const close = (got: number, exp: number, what: string) =>
    expect(Math.abs(got - exp), `${where}: ${what} is ${got}, the arithmetic says ${exp}`).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(exp)));

  // Every category the arithmetic finds is in the snapshot with the same total, and no other.
  const got = new Map<string, number>((snap.totals ?? []).map((t: any) => [t.category_name, Number(t.value)]));
  for (const [cat, v] of want.totals) close(got.get(cat) ?? 0, v, `total ${cat}`);
  for (const [cat, v] of got) if (!want.totals.has(cat)) close(v, 0, `total ${cat} (the arithmetic has none)`);

  // Each step's own value, per category.
  for (const s of snap.steps ?? []) {
    const exp = want.steps.get(Number(s.component_id)) ?? new Map();
    const mine = new Map<string, number>((s.impacts ?? []).map((i: any) => [i.category_name, Number(i.value)]));
    for (const [cat, v] of exp) close(mine.get(cat) ?? 0, v, `step ${s.name} ${cat}`);
    for (const [cat, v] of mine) if (!exp.has(cat)) close(v, 0, `step ${s.name} ${cat} (the arithmetic has none)`);
  }

  // The per-functional-unit scale the screens multiply by.
  close(Number(snap.goal_scope?.per_fu_scale ?? 1), want.perFu, 'per functional unit scale');
  // Not an empty comparison: the arithmetic found numbers, and the snapshot has steps.
  expect(want.totals.size, `${where}: the arithmetic found no category`).toBeGreaterThan(0);
  expect((snap.steps ?? []).length, `${where}: the snapshot has no steps`).toBeGreaterThan(0);
  checked.push({ where, categories: want.totals.size, steps: want.steps.size, perFu: want.perFu, excluded: want.excluded.length });
  return { snap, want };
}

const checked: Array<{ where: string; categories: number; steps: number; perFu: number; excluded: number }> = [];
let u: TestUser;
const cases: Array<{ label: string; id: number }> = [];

beforeAll(async () => {
  u = await createUser('f41math');
  // The sample study: own copies of its two cases (the sample itself is read-only).
  const built = (await api.post('/api/example-project', { token: u.token })).json;
  for (const [label, id] of [['sample base', built.case_id], ['sample what-if', built.what_if_case_id]] as const) {
    const copy = await api.post(`/api/cases/${id}/duplicate`, { token: u.token, json: { case_name: `${label} (audit)` } });
    expect(copy.status, copy.text).toBe(201);
    cases.push({ label, id: Number(copy.json.case?.case_id ?? copy.json.case_id) });
  }

  // The touring bike from the three bundled documents, in one case.
  const project = await createProject(u, `Audit bike ${Date.now()}`);
  let bikeCase = 0;
  for (const kind of ['routing', 'bom', 'equipment'] as const) {
    const doc = SAMPLE_DOCS[kind];
    const fd = new FormData();
    fd.append('file', new File([doc.content], doc.filename, { type: 'text/csv' }));
    fd.append('connector', kind);
    if (bikeCase) fd.append('target_case_id', String(bikeCase));
    const pre = await api.post('/api/ingest/preview', { token: u.token, form: fd });
    expect(pre.status, pre.text).toBe(200);
    const plan = pre.json.plan;
    const body = bikeCase
      ? { target_case_id: bikeCase, nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes }
      : { project_id: project, case_name: 'Touring bike (audit)', nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes };
    const applied = await api.post('/api/ingest/apply', { token: u.token, json: body });
    expect([200, 201], applied.text).toContain(applied.status);
    bikeCase = bikeCase || Number(applied.json.case_id);
  }
  cases.push({ label: 'touring bike from the sample documents', id: bikeCase });

  // DOE ITAC plant WV0661, its real ASSESS row.
  const row = fixture.rows.find((x: any) => x.row.ID === 'WV0661')!.row as Record<string, unknown>;
  const header = Object.keys(row);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, header.map((k) => row[k])]), 'ASSESS');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array(buf)], fixture.source.file, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  fd.append('connector', 'itac');
  fd.append('plant_id', 'WV0661');
  const pre = await api.post('/api/ingest/preview', { token: u.token, form: fd });
  expect(pre.status, pre.text).toBe(200);
  const plan = pre.json.plan;
  const itac = await api.post('/api/ingest/apply', {
    token: u.token,
    json: { project_id: project, case_name: 'ITAC WV0661 (audit)', nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes },
  });
  expect(itac.status, itac.text).toBe(201);
  cases.push({ label: 'ITAC WV0661', id: Number(itac.json.case_id) });
}, 240_000);

describe('F41 math audit: the engine against plain arithmetic on the case rows', () => {
  it('builds four real cases, each with counted flows', async () => {
    expect(cases.map((c) => c.label)).toEqual(['sample base', 'sample what-if', 'touring bike from the sample documents', 'ITAC WV0661']);
    for (const c of cases) {
      const n = await sqlOne<any>('SELECT count(*) AS n FROM flows f JOIN component k ON k.component_id = f.component_id WHERE k.case_id = ?', [c.id]);
      expect(Number(n.n), c.label).toBeGreaterThan(0);
    }
  });

  for (const method of METHODS) {
    for (const region of REGIONS) {
      it(`${method}, ${region}: every total, every step and the per-unit scale match`, async () => {
        for (const c of cases) await audit(u, c.id, method, region);
      }, 120_000);
    }
  }

  it('the sample base under TRACI 2.1, US is the published 1.72 kg CO2-eq per bracket', async () => {
    const { snap } = await audit(u, cases[0].id, 'TRACI 2.1', 'US');
    const gw = snap.totals.find((t: any) => t.category_name === 'Global Warming');
    expect(Number(gw.value).toFixed(2)).toBe('1.72');
  });

  it('what a student does keeps the arithmetic: a unit change, a direction change, a move, an allocated share', async () => {
    const id = cases[0].id;
    const run = async () => (await audit(u, id, 'TRACI 2.1', 'US')).snap.totals.find((t: any) => t.category_name === 'Global Warming').value;
    const before = Number(await run());
    const steel = await sqlOne<any>(
      `SELECT f.flow_id, f.component_id FROM flows f JOIN component c ON c.component_id = f.component_id JOIN substances s ON s.substance_id = f.substance_id
        WHERE c.case_id = ? AND s.substance_name = 'Steel'`,
      [id],
    );
    // 0.8 kg written as 800 g: the same answer.
    expect((await api.put(`/api/flows/${steel.flow_id}`, { token: u.token, json: { quantity: 800, unit: 'g' } })).status).toBe(200);
    expect(Math.abs(Number(await run()) - before)).toBeLessThan(1e-9);
    // Moved to another step: the same total (each step re-checked inside audit()).
    const other = await sqlOne<any>(`SELECT component_id FROM component WHERE case_id = ? AND component_id <> ? AND parent_component_id IS NOT NULL LIMIT 1`, [id, steel.component_id]);
    expect((await api.put(`/api/flows/${steel.flow_id}`, { token: u.token, json: { component_id: other.component_id } })).status).toBe(200);
    expect(Math.abs(Number(await run()) - before)).toBeLessThan(1e-9);
    // Steel as an output: its embodied factor no longer counts (audit() checks the new total).
    expect((await api.put(`/api/flows/${steel.flow_id}`, { token: u.token, json: { flow_type: 'output' } })).status).toBe(200);
    expect(Number(await run())).toBeLessThan(before);
    // Half of a step allocated to this product: audit() checks the halved share down its subtree.
    expect((await api.put(`/api/components/${other.component_id}`, { token: u.token, json: { allocation_factor: 0.5 } })).status).toBe(200);
    await run();
  }, 240_000);

  it('says what it checked', () => {
    // AUDIT_OUT=<file> keeps the list of what was compared, for the person reading the audit.
    if (process.env.AUDIT_OUT) {
      writeFileSync(process.env.AUDIT_OUT, checked.map((c) => `${c.where}: ${c.categories} categories, ${c.steps} steps, per-unit scale ${c.perFu}, ${c.excluded} left out`).join('\n'))
    }
    expect(checked.length).toBeGreaterThanOrEqual(36);
  });
});
