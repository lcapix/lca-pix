import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/projects/[projectId]/compare/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import { LEGACY_RESULTS_SOURCE, ZERO_INVENTORY_WARNING } from '@/lib/run-snapshot';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

const noCost = { labor: null, energy: null, material: null, transportation: null, equipment: null, overhead: null, opex: null, capex: null, currency: 'USD' };
const gs = (scale = 1) => ({
  goal_statement: null, functional_unit: '1 bike', system_boundary: 'cradle-to-gate', boundary_notes: null,
  reference_flow: scale, reference_flow_unit: 'unit', modeled_output: 1, per_fu_scale: scale,
});

// Base (case 1): frozen run 101 over steps 10/11 and flows 100/101. Step 11
// has since been deleted, which a frozen run must survive.
const baseSnapshot = {
  version: 3, method: 'TRACI 2.1', region: 'US', captured_at: '2026-09-29T00:00:00Z', warnings: [],
  flow_detail: [
    { flow_id: 100, component_id: 10, component: 'Weld', substance: 'Aluminum', category_name: 'Global Warming', dir: 'IN', amount: 1, unit: 'kg', factor: 8, scope: 'Global', conversion: null, impact: 8 },
    { flow_id: 101, component_id: 11, component: 'Coat', substance: 'Epoxy resin', category_name: 'Global Warming', dir: 'IN', amount: 1, unit: 'kg', factor: 2, scope: 'Global', conversion: null, impact: 2 },
  ],
  goal_scope: gs(1),
  totals: [{ category_id: 1, category_name: 'Global Warming', value: 10, unit: 'kg CO2 eq', flow_count: 2 }],
  steps: [
    { component_id: 10, name: 'Weld', parent_id: null, type: 'operation', process_type: null, hierarchy_level: 4, stage: null, quantity: 1, unit: 'unit', flows_processed: 1,
      impacts: [{ category_id: 1, category_name: 'Global Warming', value: 8, unit: 'kg CO2 eq' }], costs: { ...noCost, labor: 20 } },
    { component_id: 11, name: 'Coat', parent_id: null, type: 'operation', process_type: null, hierarchy_level: 4, stage: null, quantity: 1, unit: 'unit', flows_processed: 1,
      impacts: [{ category_id: 1, category_name: 'Global Warming', value: 2, unit: 'kg CO2 eq' }], costs: { ...noCost, energy: 3 } },
  ],
  inventory: [
    { flow_id: 100, component_id: 10, component: 'Weld', substance: 'Aluminum', direction: 'input', amount: 1, unit: 'kg' },
    { flow_id: 101, component_id: 11, component: 'Coat', substance: 'Epoxy resin', direction: 'input', amount: 1, unit: 'kg' },
  ],
};

// The empty copy (case 2): its flows were deleted and it was run anyway, so
// its completed run is all zeros.
const emptySnapshot = {
  ...baseSnapshot, warnings: [ZERO_INVENTORY_WARNING], flow_detail: [], inventory: [],
  totals: [{ category_id: 1, category_name: 'Global Warming', value: 0, unit: 'kg CO2 eq', flow_count: 0 }],
  steps: [{ ...baseSnapshot.steps[0], component_id: 20, impacts: [], flows_processed: 0, costs: { ...noCost } }],
};

interface World {
  cases: any[];
  runs: Record<number, any[]>;
  comps: Record<number, any[]>;
  flows: Record<number, any[]>;
  legacyTotals?: any[];
  legacyByStep?: any[];
}

let world: World;
const sqlSeen: string[] = [];

function install() {
  vi.mocked(db.queryOne).mockImplementation(async (sql: string, params?: any[]) => {
    sqlSeen.push(sql);
    if (/FROM project WHERE project_id/.test(sql)) {
      return { project_id: 5, project_name: 'Bike', functional_unit: '1 bike', system_boundary: 'cradle-to-gate', lcia_method: 'TRACI 2.1', region_code: 'US' } as any;
    }
    if (/AS stale/.test(sql)) return { stale: 0 } as any;
    return null;
  });
  vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) => {
    sqlSeen.push(sql);
    if (/FROM case_table WHERE project_id/.test(sql)) return world.cases as any;
    if (/FROM assessment_runs/.test(sql)) return (world.runs[params![0]] ?? []) as any;
    if (/FROM component WHERE case_id/.test(sql)) return (world.comps[params![0]] ?? []) as any;
    if (/FROM flows f/.test(sql)) return (world.flows[params![0]] ?? []) as any;
    if (/GROUP BY ic.category_name, ar.unit/.test(sql)) return (world.legacyTotals ?? []) as any;
    if (/GROUP BY ar.component_id/.test(sql)) return (world.legacyByStep ?? []) as any;
    return [] as any;
  });
}

const comp = (id: number, name: string, costs: Record<string, number> = {}) => ({
  component_id: id, parent_component_id: null, component_name: name, component_type: 'operation', labor_hours: null,
  labor_cost: costs.labor ?? null, energy_cost: costs.energy ?? null, transportation_cost: null, material_cost: null,
  equipment_cost: null, overhead_cost: null, opex: null, capex: null,
});
const flow = (id: number, componentId: number) => ({ flow_id: id, component_id: componentId, substance: 'Aluminum', flow_type: 'input', quantity: 1, unit: 'kg' });

function get(query = 'cases=1,2') {
  return GET(new NextRequest(`http://t/api/projects/5/compare?${query}`, { headers: { Authorization: 'Bearer x' } }), {
    params: Promise.resolve({ projectId: '5' }),
  } as any);
}

describe('GET /api/projects/:id/compare', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sqlSeen.length = 0;
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    world = {
      cases: [
        { case_id: 1, case_name: 'Base', case_type: 'base', reference_flow: 1, modeled_output: 1 },
        { case_id: 2, case_name: 'Empty copy', case_type: 'comparative', reference_flow: 1, modeled_output: 1 },
      ],
      runs: {
        1: [{ run_id: 101, calculation_method: 'TRACI 2.1', region_code: 'US', run_date: '2026-09-29T00:00:00Z', run_snapshot: JSON.stringify(baseSnapshot) }],
        2: [{ run_id: 201, calculation_method: 'TRACI 2.1', region_code: 'US', run_date: '2026-09-29T00:00:00Z', run_snapshot: emptySnapshot }],
      },
      // Step 11 was deleted after the run; the flow on it went with it.
      comps: { 1: [comp(10, 'Weld (renamed)', { labor: 99 })], 2: [comp(20, 'Weld')] },
      flows: { 1: [flow(100, 10)], 2: [] },
    };
    install();
  });

  it('401 for a deactivated account', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('User account not found or inactive'));
    expect((await get()).status).toBe(401);
  });

  it('404 for a signed-in non-member, the same as a missing project', async () => {
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);
    const res = await get();
    expect(res.status).toBe(404);
    expect(sqlSeen.some((s) => /case_table/.test(s))).toBe(false);
  });

  it('reads totals, per-step rows and costs of a frozen run from its snapshot', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    const base = body.cases.find((c: any) => c.caseId === '1');
    expect(base.run.resultsSource).toBe('snapshot');
    expect(base.run.costsSource).toBe('run');
    expect(base.totals).toEqual([{ category: 'Global Warming', unit: 'kg CO2 eq', value: 10, flowCount: 2 }]);
    // The deleted step keeps its name; the renamed one keeps the name it had.
    expect(base.byStep).toEqual([
      { step: 'Weld', category: 'Global Warming', value: 8 },
      { step: 'Coat', category: 'Global Warming', value: 2 },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/Removed step #null/);
    // The costs in force at run time, not today's 99.
    expect(base.costs.find((r: any) => r.step === 'Weld').labor).toBe(20);
    // Nothing read from the live result rows.
    expect(sqlSeen.some((s) => /FROM assessment_results/.test(s))).toBe(false);
  });

  it('flags a frozen run whose case lost a step and a flow since as stale ("Re-run to compare")', async () => {
    const body = await (await get()).json();
    const base = body.cases.find((c: any) => c.caseId === '1');
    expect(base.status).toBe('stale');
    expect(base.run.stale).toBe(true);
  });

  it('marks a case with 0 flows and a completed all-zero run incomplete, so it is never ranked', async () => {
    const body = await (await get()).json();
    const empty = body.cases.find((c: any) => c.caseId === '2');
    expect(empty.status).toBe('incomplete');
    expect(empty.statusReason).toBe('No flows yet');
  });

  it('marks a copy with no completed run incomplete', async () => {
    world.runs[2] = [];
    world.flows[2] = [flow(300, 20)];
    const body = await (await get()).json();
    const copy = body.cases.find((c: any) => c.caseId === '2');
    expect(copy.run).toBeNull();
    expect(copy).toMatchObject({ status: 'incomplete', statusReason: 'Not run yet' });
  });

  it('reads a legacy run from its stored rows, labels it, and names a deleted step "Removed step"', async () => {
    world.runs[1] = [{ run_id: 90, calculation_method: 'TRACI 2.1', region_code: 'US', run_date: '2026-01-01T00:00:00Z', run_snapshot: null }];
    world.flows[1] = [flow(100, 10), flow(101, 10)];
    world.legacyTotals = [{ category: 'Global Warming', unit: 'kg CO2 eq', value: '10' }];
    world.legacyByStep = [
      { component_id: 10, category: 'Global Warming', value: '8' },
      { component_id: null, category: 'Global Warming', value: '2' },
    ];
    const body = await (await get()).json();
    const base = body.cases.find((c: any) => c.caseId === '1');
    expect(base.run.resultsSource).toBe(LEGACY_RESULTS_SOURCE);
    expect(base.run.costsSource).toBe('current');
    expect(base.byStep).toEqual([
      { step: 'Weld (renamed)', category: 'Global Warming', value: 8 },
      { step: 'Removed step', category: 'Global Warming', value: 2 },
    ]);
    expect(base.status).toBe('ok');
  });

  it('a current frozen run over flows is ok', async () => {
    world.comps[1] = [comp(10, 'Weld'), comp(11, 'Coat')];
    world.flows[1] = [flow(100, 10), flow(101, 11)];
    const body = await (await get()).json();
    expect(body.cases.find((c: any) => c.caseId === '1')).toMatchObject({ status: 'ok', statusReason: null });
  });
});
