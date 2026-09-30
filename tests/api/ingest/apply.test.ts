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
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: 'kg' }) as any,
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
      (/FROM case_table/.test(sql) ? { project_id: 9 } : { unit: factorUnit }) as any,
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
