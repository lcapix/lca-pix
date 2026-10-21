import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/ingest/apply/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

let conn: { query: ReturnType<typeof vi.fn> };

function req(body: unknown) {
  return new Request('http://t/api/ingest/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

const nodes = [
  { name: 'Bike', tier: 'product', parent: null, quantity: 1, unit: 'unit' },
  { name: 'Weld', tier: 'operation', parent: 'Bike', description: '', quantity: null, unit: null },
];
const flow = {
  node: 'Weld', substance_text: 'Steel', substance_id: 5, substance_name: 'Steel', match_score: 1,
  candidates: [], direction: 'input', quantity: 2, unit: 'kg', conversion_note: '', provenance: 'bom.csv · row 2',
  unit_compatible: true,
};
const cost = { node: 'Weld', category: 'labor', amount: 12.5, provenance: { doc: 'bom.csv', locator: 'row 2' } };

const create = (over: Record<string, unknown> = {}) => ({
  project_id: 9, case_name: 'Ingested: Bike', nodes, flows: [flow], costs: [cost], notes: [], ...over,
});
const append = (over: Record<string, unknown> = {}) => ({
  target_case_id: 4, attach_component_id: 100, flows: [flow], costs: [cost], notes: [], ...over,
});

const sqlCalls = () => conn.query.mock.calls.map((c) => String(c[0]));

describe('POST /api/ingest/apply validation (L6, L7)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
      // A substance row, as lib/flow-fields findUsableSubstance selects it.
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: 'kg', default_unit: 'kg' }) as any,
    );
    vi.mocked(db.query).mockResolvedValue([{ component_id: 100, component_name: 'Weld' }] as any);
    let id = 500;
    conn = { query: vi.fn(async (sql: string) => (/^\s*SELECT/i.test(sql) ? [[], []] : [{ insertId: id++ }])) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn));
  });

  it('applies a valid plan (create mode)', async () => {
    const res = await POST(req(create()) as any);
    expect(res.status).toBe(201);
    expect(sqlCalls().some((s) => /UPDATE component SET labor_cost = \?/.test(s))).toBe(true);
  });

  it('applies a valid plan (append mode)', async () => {
    const res = await POST(req(append()) as any);
    expect(res.status).toBe(200);
    expect(sqlCalls().some((s) => /labor_cost = COALESCE\(labor_cost, 0\) \+ \?/.test(s))).toBe(true);
  });

  it('a prototype key as a cost category never reaches SQL (create mode)', async () => {
    const res = await POST(req(create({ costs: [{ ...cost, category: 'constructor' }] })) as any);
    expect(res.status).toBe(400);
    expect(sqlCalls().some((s) => /function|constructor/i.test(s))).toBe(false);
  });

  it('a prototype key as a cost category never reaches SQL (append mode)', async () => {
    const res = await POST(req(append({ costs: [{ ...cost, category: '__proto__' }] })) as any);
    expect(res.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('a prototype key as a tier is rejected', async () => {
    const bad = [nodes[0], { ...nodes[1], tier: 'constructor' }];
    const res = await POST(req(create({ nodes: bad })) as any);
    expect(res.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('objects where scalars belong are rejected before any query (mysql escaping foot-gun)', async () => {
    for (const body of [
      create({ project_id: { toString: 'x' } }),
      create({ flows: [{ ...flow, quantity: { a: 1 } }] }),
      create({ flows: [{ ...flow, substance_id: { a: 1 } }] }),
      create({ flows: [{ ...flow, unit: ['kg'] }] }),
      create({ nodes: [nodes[0], { ...nodes[1], name: { a: 1 } }] }),
      append({ target_case_id: { a: 1 } }),
      append({ flows: [{ ...flow, attach_component_id: { a: 1 } }] }),
      create({ costs: [{ ...cost, amount: '12; DROP TABLE x' }] }),
      create({ flows: [{ ...flow, direction: 'sideways' }] }),
    ]) {
      const res = await POST(req(body) as any);
      expect(res.status, JSON.stringify(body).slice(0, 120)).toBe(400);
    }
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('says which field is wrong', async () => {
    const res = await POST(req(create({ flows: [{ ...flow, quantity: 'lots' }] })) as any);
    expect((await res.json()).error).toMatch(/flows\.0\.quantity/);
  });
});

describe('POST /api/ingest/apply unit guard agrees with the engine (lib/units)', () => {
  let factorUnit = 'mg';
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: factorUnit, default_unit: factorUnit }) as any,
    );
    vi.mocked(db.query).mockResolvedValue([{ component_id: 100, component_name: 'Weld' }] as any);
    let id = 500;
    conn = { query: vi.fn(async (sql: string) => (/^\s*SELECT/i.test(sql) ? [[], []] : [{ insertId: id++ }])) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn));
  });

  const cases: Array<[string, string, 'applied' | 'held']> = [
    ['Mg', 'mg', 'held'], // a megagram is not a milligram; the engine refuses it
    ['m³', 'm3', 'applied'],
    ['mwh', 'MWh', 'held'], // ambiguous spelling, refused by the engine
    ['MWh', 'MWh', 'applied'],
    ['g', 'kg', 'applied'],
  ];

  for (const mode of ['create', 'append'] as const) {
    it.each(cases)(`${mode}: a flow in %s on a factor per %s is %s`, async (unit, factor, outcome) => {
      factorUnit = factor;
      const body = mode === 'create' ? create({ flows: [{ ...flow, unit }] }) : append({ flows: [{ ...flow, unit }] });
      const res = await POST(req(body) as any);
      expect(res.status).toBeLessThan(300);
      const json = await res.json();
      const held = JSON.stringify(json).match(/"flows_held_for_review":(\d+)/)?.[1];
      expect(Number(held)).toBe(outcome === 'held' ? 1 : 0);
      expect(sqlCalls().some((s) => /INSERT INTO flows/.test(s))).toBe(outcome === 'applied');
    });
  }
});

// Stage-0 gate (2026-10-14): where an appended line goes. The reviewer's STEP
// pick beats a same-named step in the case; with no pick, the line goes to the
// step it names; with neither, to the default.
describe('POST /api/ingest/apply append: which step a line goes to', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: 'kg', default_unit: 'kg' }) as any,
    );
    vi.mocked(db.query).mockResolvedValue([
      { component_id: 100, component_name: 'Weld', hierarchy_level: 2 },
      { component_id: 101, component_name: 'Paint', hierarchy_level: 2 },
      { component_id: 102, component_name: 'Bike', hierarchy_level: 1 },
    ] as any);
    let id = 500;
    conn = { query: vi.fn(async (sql: string) => (/^\s*SELECT/i.test(sql) ? [[], []] : [{ insertId: id++ }])) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn));
  });

  const flowTargets = () =>
    conn.query.mock.calls.filter((c) => /INSERT INTO flows/.test(String(c[0]))).map((c) => (c[1] as unknown[])[0]);

  it('puts a line on the step the reviewer picked, even when the case has a step with its name', async () => {
    const res = await POST(req(append({ attach_component_id: null, flows: [{ ...flow, attach_component_id: 101 }], costs: [] })) as any);
    expect(res.status).toBe(200);
    expect(flowTargets()).toEqual([101]);
  });

  it('with no pick, puts the line on the step it names', async () => {
    const res = await POST(req(append({ attach_component_id: 102, flows: [{ ...flow, attach_component_id: null }], costs: [] })) as any);
    expect(res.status).toBe(200);
    expect(flowTargets()).toEqual([100]);
  });

  it('with no pick and no matching name, falls back to the default step', async () => {
    const res = await POST(
      req(append({ attach_component_id: 102, flows: [{ ...flow, node: 'Anodize', attach_component_id: null }], costs: [] })) as any,
    );
    expect(res.status).toBe(200);
    expect(flowTargets()).toEqual([102]);
  });

  it('puts a line on a step the document creates, by its name', async () => {
    const res = await POST(
      req(
        append({
          attach_component_id: null,
          nodes: [
            { name: 'Bike', tier: 'product', parent: null },
            { name: 'Anodize', tier: 'operation', parent: 'Bike' },
          ],
          node_actions: { Bike: { action: 'attach', component_id: 102 }, Anodize: { action: 'create' } },
          flows: [{ ...flow, node: 'Anodize', attach_component_id: null }],
          costs: [],
        }),
      ) as any,
    );
    expect(res.status).toBe(200);
    const created = conn.query.mock.calls.find((c) => /INSERT INTO component/.test(String(c[0])));
    expect((created![1] as unknown[]).slice(0, 3)).toEqual([4, 102, 'Anodize']);
    expect(flowTargets()).toEqual([500]);
  });
});

// Stage-0 gate E1b: re-importing onto a step that already has the cost.
describe('POST /api/ingest/apply append: keep, replace or add an existing cost', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: 'kg', default_unit: 'kg' }) as any,
    );
    vi.mocked(db.query).mockResolvedValue([{ component_id: 100, component_name: 'Weld', hierarchy_level: 2 }] as any);
    conn = { query: vi.fn(async (sql: string) => (/^\s*SELECT/i.test(sql) ? [[], []] : [{ insertId: 1 }])) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn));
  });

  const laborWrites = () =>
    conn.query.mock.calls.filter((c) => /UPDATE component SET labor_cost/.test(String(c[0]))).map((c) => [String(c[0]).replace(/\s+/g, ' '), c[1]]);

  it('keep writes nothing to that column and says so', async () => {
    const res = await POST(req(append({ flows: [], cost_modes: { '100|labor_cost': 'keep' } })) as any);
    expect(res.status).toBe(200);
    expect(laborWrites()).toEqual([]);
    expect((await res.json()).costs_kept).toBe(1);
  });

  it('replace sets the column to the document figure', async () => {
    const res = await POST(req(append({ flows: [], cost_modes: { '100|labor_cost': 'replace' } })) as any);
    expect(res.status).toBe(200);
    expect(laborWrites()).toEqual([['UPDATE component SET labor_cost = ? WHERE component_id = ?', [12.5, 100]]]);
    expect((await res.json()).costs_replaced).toBe(1);
  });

  it('hours follow a labor cost: replaced with it, added to it, untouched on keep', async () => {
    const withHours = { ...cost, hours: 0.5, occupation: '51-4121' };
    const hoursWrites = () =>
      conn.query.mock.calls.filter((c) => /labor_hours/.test(String(c[0]))).map((c) => [String(c[0]).replace(/\s+/g, ' '), c[1]]);
    await POST(req(append({ flows: [], costs: [withHours], cost_modes: { '100|labor_cost': 'replace' } })) as any);
    expect(hoursWrites()).toEqual([['UPDATE component SET labor_hours = ?, labor_occupation = ? WHERE component_id = ?', [0.5, '51-4121', 100]]]);
    conn.query.mockClear();
    await POST(req(append({ flows: [], costs: [withHours], cost_modes: { '100|labor_cost': 'add' } })) as any);
    expect(hoursWrites()).toEqual([[
      'UPDATE component SET labor_hours = COALESCE(labor_hours, 0) + ?, labor_occupation = COALESCE(labor_occupation, ?) WHERE component_id = ?',
      [0.5, '51-4121', 100],
    ]]);
    conn.query.mockClear();
    await POST(req(append({ flows: [], costs: [withHours], cost_modes: { '100|labor_cost': 'keep' } })) as any);
    expect(hoursWrites()).toEqual([]);
  });

  it('add (or no decision, the API default) adds to what is there', async () => {
    for (const modes of [{ '100|labor_cost': 'add' }, {}]) {
      conn.query.mockClear();
      const res = await POST(req(append({ flows: [], cost_modes: modes })) as any);
      expect(res.status).toBe(200);
      expect(laborWrites()).toEqual([['UPDATE component SET labor_cost = COALESCE(labor_cost, 0) + ? WHERE component_id = ?', [12.5, 100]]]);
    }
  });

  it('refuses a malformed decision key or mode before any write', async () => {
    for (const modes of [{ 'x|labor_cost': 'keep' }, { '100|labor_cost': 'overwrite' }, { '100|labor_cost; DROP': 'keep' }]) {
      conn.query.mockClear();
      const res = await POST(req(append({ flows: [], cost_modes: modes })) as any);
      expect(res.status).toBe(400);
      expect(conn.query).not.toHaveBeenCalled();
    }
  });
});

// Stage-0 gate E2b: re-importing a flow a step already has.
describe('POST /api/ingest/apply append: keep, replace or add an existing flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: 'kg', default_unit: 'kg' }) as any,
    );
    vi.mocked(db.query).mockResolvedValue([{ component_id: 100, component_name: 'Weld', hierarchy_level: 2 }] as any);
    conn = {
      query: vi.fn(async (sql: string) =>
        /^\s*SELECT/i.test(sql) ? [[], []] : /^\s*DELETE/i.test(sql) ? [{ affectedRows: 1 }] : [{ insertId: 1 }],
      ),
    };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn));
  });

  const writes = (re: RegExp) => conn.query.mock.calls.filter((c) => re.test(String(c[0]))).map((c) => c[1]);
  const two = [flow, { ...flow, provenance: 'bom.csv · row 3', quantity: 1 }];

  it('keep inserts nothing for that step and substance', async () => {
    const res = await POST(req(append({ costs: [], flows: two, attach_component_id: 100, flow_modes: { '100|5|input': 'keep' } })) as any);
    expect(res.status).toBe(200);
    expect(writes(/INSERT INTO flows/)).toEqual([]);
    expect((await res.json()).flows_kept).toBe(2);
  });

  it('replace clears the step\'s flows of that substance once, then inserts the document\'s', async () => {
    const res = await POST(req(append({ costs: [], flows: two, attach_component_id: 100, flow_modes: { '100|5|input': 'replace' } })) as any);
    expect(res.status).toBe(200);
    expect(writes(/DELETE FROM flows/)).toEqual([[100, 5, 'input']]);
    expect(writes(/INSERT INTO flows/)).toHaveLength(2);
    expect((await res.json()).flows_replaced).toBe(1);
  });

  it('add (or no decision) inserts as before', async () => {
    const res = await POST(req(append({ costs: [], flows: two, attach_component_id: 100 })) as any);
    expect(res.status).toBe(200);
    expect(writes(/DELETE FROM flows/)).toEqual([]);
    expect(writes(/INSERT INTO flows/)).toHaveLength(2);
  });

  it('refuses a malformed flow decision before any write', async () => {
    for (const modes of [{ '100|5|sideways': 'keep' }, { '100|x|input': 'keep' }, { '100|5|input': 'merge' }]) {
      conn.query.mockClear();
      const res = await POST(req(append({ costs: [], flows: two, flow_modes: modes })) as any);
      expect(res.status).toBe(400);
      expect(conn.query).not.toHaveBeenCalled();
    }
  });
});
