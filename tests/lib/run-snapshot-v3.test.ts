import { describe, it, expect } from 'vitest';
import {
  buildRunSnapshot,
  parseRunSnapshot,
  hasFrozenResults,
  snapshotImpacts,
  snapshotComponentBreakdown,
  snapshotResultRows,
  snapshotReportParts,
  canonicalMethod,
  SUPPORTED_METHODS,
  SNAPSHOT_VERSION,
  ZERO_INVENTORY_WARNING,
} from '@/lib/run-snapshot';
import type { LCAResult } from '@/lib/lca-engine';

// Two steps named "Assembly" under different parents: the name collision
// STAGE-2 describes. One of them carries a credit (negative value).
const components = [
  { component_id: 1, component_name: 'Bike', component_type: 'product', process_type: 'Product', parent_component_id: null, hierarchy_level: 1, life_cycle_stage: null, quantity: '1.000000', unit: 'unit', labor_cost: null, energy_cost: null, material_cost: null, transportation_cost: null, equipment_cost: null, overhead_cost: null, opex: null, capex: '1500.00', currency: 'USD' },
  { component_id: 2, component_name: 'Assembly', component_type: 'operation', process_type: 'Operation', parent_component_id: 1, hierarchy_level: 4, life_cycle_stage: 'materials', quantity: '2.500000', unit: 'kg', labor_cost: '12.50', energy_cost: '3.25', material_cost: null, transportation_cost: null, equipment_cost: null, overhead_cost: null, opex: '15.75', capex: null, currency: 'USD' },
  { component_id: 3, component_name: 'Assembly', component_type: 'operation', process_type: 'Operation', parent_component_id: 1, hierarchy_level: 4, life_cycle_stage: 'end_of_life', quantity: '1.000000', unit: 'unit', labor_cost: null, energy_cost: null, material_cost: null, transportation_cost: null, equipment_cost: null, overhead_cost: null, opex: '4.00', capex: null, currency: 'USD' },
];
const flows = [
  { flow_id: 10, component_id: 2, component_name: 'Assembly', substance_name: 'Aluminum', flow_type: 'input', quantity: '2.200000', unit: 'kg' },
  { flow_id: 11, component_id: 3, component_name: 'Assembly', substance_name: 'Aluminum scrap', flow_type: 'output', quantity: '0.500000', unit: 'kg' },
  { flow_id: 12, component_id: 3, component_name: 'Assembly', substance_name: 'Argon', flow_type: 'input', quantity: '0.000400', unit: 'kg' },
];

const contribution = (over: Record<string, unknown>) => ({
  substance_id: 1,
  cas_number: null,
  flow_type: 'input' as const,
  unit: 'kg',
  category_id: 1,
  category_name: 'Global Warming',
  geographic_scope: 'Global',
  ...over,
});

const result: LCAResult = {
  summary: {
    total_components: 3,
    components_with_flows: 2,
    total_flows_processed: 3,
    total_driver_flows: 3,
    impact_categories_calculated: 2,
    calculation_method: 'TRACI 2.1',
    calculation_timestamp: '2026-09-29T00:00:00Z',
  },
  component_results: [
    {
      component_id: 2,
      component_name: 'Assembly',
      component_type: 'operation',
      hierarchy_level: 4,
      life_cycle_stage: 'materials',
      impacts: [
        { category_id: 1, category_name: 'Global Warming', impact_value: 18.92, unit: 'kg CO2 eq', flow_count: 1 },
        { category_id: 2, category_name: 'Ozone Depletion', impact_value: 4.2e-7, unit: 'kg CFC-11 eq', flow_count: 1 },
      ],
      flow_contributions: [
        contribution({ flow_id: 10, substance_name: 'Aluminum', quantity: 2.2, characterization_factor: 8.6, impact_contribution: 18.92 }) as any,
        contribution({ flow_id: 10, substance_name: 'Aluminum', quantity: 2.2, characterization_factor: 1.909e-7, impact_contribution: 4.2e-7, category_id: 2, category_name: 'Ozone Depletion' }) as any,
      ],
      total_flows_processed: 2,
      driver_flows_count: 1,
      warnings: [],
    },
    {
      component_id: 3,
      component_name: 'Assembly',
      component_type: 'operation',
      hierarchy_level: 4,
      life_cycle_stage: 'end_of_life',
      impacts: [
        { category_id: 1, category_name: 'Global Warming', impact_value: -4.3, unit: 'kg CO2 eq', flow_count: 1 },
      ],
      flow_contributions: [
        contribution({ flow_id: 11, substance_name: 'Aluminum scrap', flow_type: 'output', quantity: 0.5, characterization_factor: -8.6, impact_contribution: -4.3 }) as any,
      ],
      total_flows_processed: 1,
      driver_flows_count: 1,
      warnings: [],
    },
  ],
  algorithm_steps: [],
  total_impacts: [
    { category_id: 1, category_name: 'Global Warming', impact_value: 14.62, unit: 'kg CO2 eq', flow_count: 2 },
    { category_id: 2, category_name: 'Ozone Depletion', impact_value: 4.2e-7, unit: 'kg CFC-11 eq', flow_count: 1 },
  ],
  warnings: ['engine warning'],
};

const snap = () => buildRunSnapshot(result, 'TRACI 2.1', 'US', null, { components, flows });

describe('run snapshot v3: totals, steps and inventory are frozen', () => {
  it('bumps the snapshot version', () => {
    expect(SNAPSHOT_VERSION).toBe(3);
    expect(snap().version).toBe(3);
  });

  it('freezes per-category totals at full precision', () => {
    expect(snap().totals).toEqual([
      { category_id: 1, category_name: 'Global Warming', value: 14.62, unit: 'kg CO2 eq', flow_count: 2 },
      { category_id: 2, category_name: 'Ozone Depletion', value: 4.2e-7, unit: 'kg CFC-11 eq', flow_count: 1 },
    ]);
  });

  it('freezes every step with id, parent, stage, per-category values and costs', () => {
    const steps = snap().steps!;
    expect(steps.map((s) => s.component_id)).toEqual([1, 2, 3]);
    const credit = steps.find((s) => s.component_id === 3)!;
    expect(credit).toMatchObject({
      name: 'Assembly',
      parent_id: 1,
      type: 'operation',
      stage: 'end_of_life',
      hierarchy_level: 4,
      flows_processed: 1,
    });
    expect(credit.impacts).toEqual([
      { category_id: 1, category_name: 'Global Warming', value: -4.3, unit: 'kg CO2 eq' },
    ]);
    const first = steps.find((s) => s.component_id === 2)!;
    expect(first.costs).toMatchObject({ labor: 12.5, energy: 3.25, opex: 15.75, material: null, currency: 'USD' });
    expect(first.quantity).toBe(2.5);
    // A step without flows is still in the tree, with no impacts.
    expect(steps[0]).toMatchObject({ component_id: 1, parent_id: null, impacts: [], flows_processed: 0 });
    expect(steps[0].costs.capex).toBe(1500);
  });

  it('keys flow detail by component id so same-named steps never collide', () => {
    const rows = snap().flow_detail;
    expect(rows.map((r) => r.component_id)).toEqual([2, 2, 3]);
  });

  it('freezes the inventory as entered, including flows no factor characterizes', () => {
    expect(snap().inventory).toEqual([
      { flow_id: 10, component_id: 2, component: 'Assembly', substance: 'Aluminum', direction: 'input', amount: 2.2, unit: 'kg' },
      { flow_id: 11, component_id: 3, component: 'Assembly', substance: 'Aluminum scrap', direction: 'output', amount: 0.5, unit: 'kg' },
      { flow_id: 12, component_id: 3, component: 'Assembly', substance: 'Argon', direction: 'input', amount: 0.0004, unit: 'kg' },
    ]);
  });

  it('survives the JSON column round trip', () => {
    const back = parseRunSnapshot(JSON.stringify(snap()))!;
    expect(hasFrozenResults(back)).toBe(true);
    expect(back.totals![1].value).toBe(4.2e-7);
  });
});

describe('reading a frozen run', () => {
  it('reports totals from the snapshot, credits and tiny values intact', () => {
    expect(snapshotImpacts(snap())).toEqual({
      'Global Warming': { value: 14.62, unit: 'kg CO2 eq' },
      'Ozone Depletion': { value: 4.2e-7, unit: 'kg CFC-11 eq' },
    });
  });

  it('gives a component breakdown with stage per step id', () => {
    const cb = snapshotComponentBreakdown(snap());
    expect(cb.map((c) => [c.component_id, c.component_name, c.life_cycle_stage])).toEqual([
      [2, 'Assembly', 'materials'],
      [3, 'Assembly', 'end_of_life'],
    ]);
    expect(cb[1].impacts[0]).toEqual({ category_id: 1, category_name: 'Global Warming', impact_value: -4.3, unit: 'kg CO2 eq' });
  });

  it('gives one result row per step and category, ordered by category then level', () => {
    const rows = snapshotResultRows(snap());
    expect(rows.map((r) => [r.category_id, r.component_id, r.impact_value])).toEqual([
      [1, 2, 18.92],
      [1, 3, -4.3],
      [2, 2, 4.2e-7],
    ]);
  });

  it('builds the report inventory from the snapshot, not from live tables', () => {
    const parts = snapshotReportParts(snap())!;
    expect(parts.components).toHaveLength(3);
    expect(parts.components[1]).toMatchObject({ component_id: 2, component_name: 'Assembly', life_cycle_stage: 'materials', quantity: 2.5, unit: 'kg', opex: 15.75 });
    expect(parts.flows).toHaveLength(3);
    expect(parts.flows[2]).toEqual({ component_id: 3, component_name: 'Assembly', substance_name: 'Argon', direction: 'input', amount: 0.0004, unit: 'kg' });
    expect(parts.total_impacts[1]).toEqual({ category_name: 'Ozone Depletion', total_value: 4.2e-7, unit: 'kg CFC-11 eq' });
    expect(parts.results.find((r) => r.component_id === 3)).toMatchObject({ component_name: 'Assembly', category_name: 'Global Warming', impact_value: -4.3 });
  });

  it('treats v1/v2 snapshots as legacy (no frozen totals)', () => {
    const v2 = { version: 2, method: 'CML 2001', region: 'Global', captured_at: 'x', warnings: [], flow_detail: [] };
    const parsed = parseRunSnapshot(v2)!;
    expect(hasFrozenResults(parsed)).toBe(false);
    expect(snapshotReportParts(parsed)).toBeNull();
  });
});

describe('RUN-6: run inputs and warnings', () => {
  it('stores the zero-inventory warning in the snapshot so the refetch still shows it', () => {
    const empty: LCAResult = {
      ...result,
      summary: { ...result.summary, components_with_flows: 0 },
      component_results: [],
      total_impacts: [],
      warnings: [],
    };
    const s = buildRunSnapshot(empty, 'CML 2001', 'Global', null, { components: [components[0]], flows: [] });
    expect(ZERO_INVENTORY_WARNING).toMatch(/No process step in this case has any input or output flows/);
    expect(s.warnings).toEqual([ZERO_INVENTORY_WARNING]);
  });

  it('does not add the zero-inventory warning when steps carry flows', () => {
    expect(snap().warnings).toEqual(['engine warning']);
  });

  it('accepts only methods the factor table carries, in canonical spelling', () => {
    expect(SUPPORTED_METHODS).toEqual(['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1']);
    expect(canonicalMethod('traci 2.1')).toBe('TRACI 2.1');
    expect(canonicalMethod(' CML 2001 ')).toBe('CML 2001');
    expect(canonicalMethod('EF 3.1')).toBeNull();
    expect(canonicalMethod({ toString: () => 'CML 2001' } as any)).toBeNull();
    expect(canonicalMethod(undefined)).toBeNull();
  });
});
