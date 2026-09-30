/**
 * Engine unit and quantity guards (audit 2026-09-29, E3, E9, E11).
 * A flow quantity is multiplied by a factor only when it can be expressed in
 * the unit the factor is stated per. Everything else is left out and named.
 */
import { describe, it, expect, vi } from 'vitest';
import { calculateComponentImpacts, summarizeDataQuality } from '@/lib/lca-engine';

function fakeConn(sequence: any[][]) {
  let i = 0;
  return {
    query: vi.fn().mockImplementation(async () => [sequence[i++], null]),
  } as any;
}

const COMPONENT = [{ component_id: 1, component_name: 'Step', component_type: 'operation', hierarchy_level: 4 }];

const gwRow = (over: Record<string, unknown>) => ({
  flow_id: 1,
  substance_id: 1,
  substance_name: 'Thing',
  cas_number: null,
  flow_type: 'input',
  quantity: 1,
  flow_unit: 'kg',
  substance_default_unit: 'kg',
  category_id: 1,
  category_name: 'Global Warming',
  category_unit: 'kg CO2 eq',
  factor_unit: 'kg CO2 eq',
  characterization_factor: 1,
  factor_basis: 'embodied',
  geographic_scope: 'Global',
  factor_source: 'test',
  ...over,
});

const run = (rows: any[]) => calculateComponentImpacts(1, fakeConn([COMPONENT, rows]), {});

describe('E3: no raw multiply when a unit is outside the table', () => {
  it("1000 kg on an 'item' substance is EXCLUDED with a warning (was 3000, silently)", async () => {
    const r = await run([
      gwRow({ substance_name: 'Widget', quantity: 1000, flow_unit: 'kg', substance_default_unit: 'item', characterization_factor: 3 }),
    ]);
    expect(r.flow_contributions).toHaveLength(0);
    expect(r.impacts).toHaveLength(0);
    expect(r.excluded_flows).toBe(1);
    expect(r.warnings.some((w) => w.includes('Widget') && w.includes('EXCLUDED') && w.includes("'item'"))).toBe(true);
  });

  it("1000 kg on a substance whose unit is not in the table ('bundle') is EXCLUDED, not multiplied raw", async () => {
    const r = await run([
      gwRow({ substance_name: 'Rebar', quantity: 1000, flow_unit: 'kg', substance_default_unit: 'bundle', characterization_factor: 3 }),
    ]);
    expect(r.flow_contributions).toHaveLength(0);
    expect(r.impacts).toHaveLength(0);
    expect(r.excluded_flows).toBe(1);
    expect(r.warnings.some((w) => w.includes('Rebar') && w.includes('EXCLUDED') && w.includes("'bundle'"))).toBe(true);
  });

  it("'p' flow on a 'p' substance is used as-is (was EXCLUDED as unrecognized)", async () => {
    const r = await run([
      gwRow({ substance_name: 'Pallet', quantity: 4, flow_unit: 'p', substance_default_unit: 'p', characterization_factor: 2.5 }),
    ]);
    expect(r.flow_contributions).toHaveLength(1);
    expect(r.flow_contributions[0].unit_conversion).toBeUndefined();
    expect(r.impacts[0].impact_value).toBeCloseTo(10, 12);
    expect(r.warnings).toEqual([]);
    expect(r.excluded_flows).toBe(0);
  });

  it('a flow with no unit is EXCLUDED, not assumed to be in the factor unit', async () => {
    const r = await run([gwRow({ substance_name: 'Steel', quantity: 5, flow_unit: '', characterization_factor: 1.9 })]);
    expect(r.flow_contributions).toHaveLength(0);
    expect(r.excluded_flows).toBe(1);
    expect(r.warnings.some((w) => /Steel.*no unit.*EXCLUDED/.test(w))).toBe(true);
  });
});

describe('E9: a non-finite quantity never poisons a category total', () => {
  it.each([
    ['NaN', NaN],
    ['null', null],
    ["'abc'", 'abc'],
    ["''", ''],
    ["'12abc'", '12abc'],
  ])('quantity %s is skipped with a warning; the valid flow still totals 5', async (_label, bad) => {
    const r = await run([
      gwRow({ flow_id: 1, substance_name: 'Good', quantity: '5.000000' }),
      gwRow({ flow_id: 2, substance_name: 'Bad', quantity: bad }),
    ]);
    expect(r.impacts).toHaveLength(1);
    expect(Number.isFinite(r.impacts[0].impact_value)).toBe(true);
    expect(r.impacts[0].impact_value).toBeCloseTo(5, 12);
    expect(r.flow_contributions.map((c) => c.flow_id)).toEqual([1]);
    expect(r.invalid_quantity_flows).toBe(1);
    expect(r.warnings.some((w) => w.includes('Bad') && /not a finite number/.test(w))).toBe(true);
  });

  it('warns once per flow even when the flow has factors in several categories', async () => {
    const r = await run([
      gwRow({ flow_id: 2, substance_name: 'Bad', quantity: null }),
      gwRow({ flow_id: 2, substance_name: 'Bad', quantity: null, category_id: 3, category_name: 'Acidification', factor_unit: 'kg SO2 eq' }),
    ]);
    expect(r.warnings.filter((w) => w.includes('Bad'))).toHaveLength(1);
    expect(r.invalid_quantity_flows).toBe(1);
  });

  it('the data-quality statement says how many flows were skipped', () => {
    const dq = summarizeDataQuality([
      {
        component_id: 1, component_name: 'Step', component_type: 'operation', hierarchy_level: 4,
        impacts: [], flow_contributions: [], total_flows_processed: 1, driver_flows_count: 0,
        warnings: [], invalid_quantity_flows: 2,
      },
    ]);
    expect(dq.invalid_quantity_flows).toBe(2);
    expect(dq.statement.join(' ')).toContain('2 flows were skipped because the quantity is not a number');
  });
});

describe("E11: the factor's own denominator is checked", () => {
  it('a per-kg factor on an m3 substance is EXCLUDED with a warning (Water/Wastewater rows)', async () => {
    const r = await run([
      gwRow({ substance_name: 'Water', quantity: 10, flow_unit: 'm3', substance_default_unit: 'm3', factor_unit: 'kg CO2 eq / kg', characterization_factor: 3.4 }),
    ]);
    expect(r.flow_contributions).toHaveLength(0);
    expect(r.excluded_flows).toBe(1);
    expect(r.warnings.some((w) => w.includes('Water') && w.includes("per 'kg'") && w.includes('EXCLUDED'))).toBe(true);
  });

  it('a per-kg factor on an MMBtu fuel is EXCLUDED (the E1 Wood clobber can no longer be applied silently)', async () => {
    const r = await run([
      gwRow({ substance_name: 'Wood', quantity: 1, flow_unit: 'MMBtu', substance_default_unit: 'MMBtu', factor_unit: 'kg CO2 eq / kg', characterization_factor: 0.187 }),
    ]);
    expect(r.flow_contributions).toHaveLength(0);
    expect(r.excluded_flows).toBe(1);
  });

  it('Wood fuel: 293.071 kWh against the per-MMBtu factor is 1 MMBtu → 94.956 kg CO2 eq', async () => {
    const r = await run([
      gwRow({ substance_name: 'Wood', quantity: 293.071, flow_unit: 'kWh', substance_default_unit: 'MMBtu', factor_unit: 'kg CO2 eq / MMBtu', characterization_factor: '94.9560000000' }),
    ]);
    expect(r.impacts[0].impact_value).toBeCloseTo(94.956, 9);
    expect(r.flow_contributions[0].unit_conversion).toContain('MMBtu');
    expect(r.impacts[0].unit).toBe('kg CO2 eq');
  });

  it('a per-tonne factor on a kg substance converts the kg flow to tonnes', async () => {
    const r = await run([
      gwRow({ substance_name: 'Steel', quantity: 500, flow_unit: 'kg', substance_default_unit: 'kg', factor_unit: 'kg CO2 eq / t', characterization_factor: 1900 }),
    ]);
    expect(r.impacts[0].impact_value).toBeCloseTo(950, 9);
  });
});

describe('E10 reporting nits', () => {
  it('total_flows_processed counts flows, not flow × category pairs', async () => {
    const r = await run([
      gwRow({ flow_id: 1, substance_name: 'Electricity', flow_unit: 'kWh', substance_default_unit: 'kWh' }),
      gwRow({
        flow_id: 1, substance_name: 'Electricity', flow_unit: 'kWh', substance_default_unit: 'kWh',
        category_id: 3, category_name: 'Acidification', factor_unit: 'kg SO2 eq',
      }),
      gwRow({ flow_id: 2, substance_name: 'Steel' }),
    ]);
    expect(r.flow_contributions).toHaveLength(3);
    expect(r.total_flows_processed).toBe(2);
  });

  it('category coverage counts inputs only (an emission output is not a missing input)', () => {
    const c = (over: Record<string, unknown>) => ({
      flow_id: 1, substance_id: 1, substance_name: 'x', cas_number: null, flow_type: 'input' as const,
      quantity: 1, unit: 'kg', characterization_factor: 1, impact_contribution: 1,
      category_id: 1, category_name: 'Global Warming', geographic_scope: 'Global', ...over,
    });
    const dq = summarizeDataQuality([
      {
        component_id: 1, component_name: 'Step', component_type: 'operation', hierarchy_level: 4,
        impacts: [], total_flows_processed: 3, driver_flows_count: 3, warnings: [],
        flow_contributions: [
          c({ flow_id: 1, substance_name: 'Aluminum' }),
          c({ flow_id: 2, substance_name: 'Electricity' }),
          c({ flow_id: 2, substance_name: 'Electricity', category_id: 3, category_name: 'Acidification' }),
          c({ flow_id: 3, substance_name: 'Carbon dioxide', flow_type: 'output' }),
        ] as any,
      },
    ]);
    const acid = dq.category_coverage.find((x) => x.category === 'Acidification')!;
    expect(acid).toMatchObject({ covered: 1, total: 2, missing_examples: ['Aluminum'] });
    const gw = dq.category_coverage.find((x) => x.category === 'Global Warming')!;
    expect(gw).toMatchObject({ covered: 2, total: 2 });
    expect(dq.statement.join(' ')).toContain('Acidification covers 1 of 2 inputs');
  });
});
