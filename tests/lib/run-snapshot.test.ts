import { describe, it, expect } from 'vitest';
import { buildRunSnapshot, parseRunSnapshot, SNAPSHOT_VERSION } from '@/lib/run-snapshot';
import type { LCAResult } from '@/lib/lca-engine';

const result: LCAResult = {
  summary: {
    total_components: 1,
    components_with_flows: 1,
    total_flows_processed: 2,
    total_driver_flows: 2,
    impact_categories_calculated: 1,
    calculation_method: 'CML 2001',
    calculation_timestamp: new Date().toISOString(),
  },
  component_results: [
    {
      component_id: 1,
      component_name: 'Leaf',
      component_type: 'elemental_task',
      hierarchy_level: 5,
      impacts: [],
      flow_contributions: [
        {
          flow_id: 10,
          substance_id: 16,
          substance_name: 'Steel, reinforced',
          cas_number: null,
          flow_type: 'input',
          quantity: 850000,
          unit: 'g',
          characterization_factor: 1.8,
          impact_contribution: 1530,
          category_id: 1,
          category_name: 'Global Warming',
          geographic_scope: 'Global',
          unit_conversion: '1 g = 0.001 kg',
        },
      ],
      total_flows_processed: 1,
      driver_flows_count: 1,
      warnings: ['w1'],
    },
  ],
  algorithm_steps: [],
  total_impacts: [],
  warnings: ['w1'],
};

describe('run snapshot', () => {
  it('freezes entered amount, conversion, factor, scope, and computed impact', () => {
    const snap = buildRunSnapshot(result, 'CML 2001', 'US');
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.region).toBe('US');
    expect(snap.warnings).toEqual(['w1']);
    expect(snap.flow_detail).toHaveLength(1);
    const row = snap.flow_detail[0];
    expect(row.amount).toBe(850000);       // as entered
    expect(row.unit).toBe('g');            // as entered
    expect(row.impact).toBe(1530);         // converted × factor — NOT 1.53M
    expect(row.conversion).toContain('kg');
    expect(row.scope).toBe('Global');
    expect(row.dir).toBe('IN');
  });

  it('round-trips through JSON (MySQL column) and tolerates objects or strings', () => {
    const snap = buildRunSnapshot(result, 'CML 2001', 'Global');
    expect(parseRunSnapshot(JSON.stringify(snap))!.flow_detail[0].impact).toBe(1530);
    expect(parseRunSnapshot(snap)!.flow_detail[0].impact).toBe(1530);
  });

  it('rejects garbage instead of guessing', () => {
    expect(parseRunSnapshot(null)).toBeNull();
    expect(parseRunSnapshot('not json')).toBeNull();
    expect(parseRunSnapshot({ nope: true })).toBeNull();
  });
});
