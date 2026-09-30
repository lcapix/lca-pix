/**
 * The worked example in CALCULATIONS.md, run through the engine. If the
 * engine or the example changes, this test and the document must change
 * together. Factor rows are the live CML 2001 values (lcapix_factors,
 * 2026-09-30).
 */
import { describe, it, expect, vi } from 'vitest';
import { calculateComponentImpacts, summarizeDataQuality } from '@/lib/lca-engine';
import { perFunctionalUnitScale } from '@/lib/run-snapshot';

function fakeConn(sequence: any[][]) {
  let i = 0;
  return { query: vi.fn().mockImplementation(async () => [sequence[i++], null]) } as any;
}

const row = (o: Record<string, unknown>) => ({
  cas_number: null,
  geographic_scope: 'Global',
  category_id: 1,
  category_name: 'Global Warming',
  category_unit: 'kg CO2 eq',
  ...o,
});

// Step A: electrode drying oven, electricity only.
const stepA = [
  row({ flow_id: 1, substance_id: 7, substance_name: 'Electricity', flow_type: 'input', quantity: '250.5', flow_unit: 'kWh', substance_default_unit: 'kWh', factor_unit: 'kg CO2 eq / kWh', characterization_factor: '0.473', factor_basis: 'embodied', factor_source: 'Ember Global Electricity Review [EMBER-2024]' }),
  row({ flow_id: 1, substance_id: 7, substance_name: 'Electricity', flow_type: 'input', quantity: '250.5', flow_unit: 'kWh', substance_default_unit: 'kWh', factor_unit: 'kg Sb eq / kWh', characterization_factor: '0.0000054', factor_basis: 'embodied', category_id: 8, category_name: 'Resource Depletion', category_unit: 'kg Sb eq', factor_source: 'CML 2001 - Electricity mix' }),
];
// Step B: curing vent, measured process emissions, no fuel burned on this step.
const stepB = [
  row({ flow_id: 2, substance_id: 1, substance_name: 'Carbon Dioxide', flow_type: 'output', quantity: '125.25', flow_unit: 'kg', substance_default_unit: 'kg', factor_unit: 'kg CO2 eq', characterization_factor: '1', factor_basis: 'elementary', factor_source: 'openLCA CML 2001' }),
  row({ flow_id: 3, substance_id: 2, substance_name: 'Methane', flow_type: 'output', quantity: '2.5', flow_unit: 'kg', substance_default_unit: 'kg', factor_unit: 'kg CO2 eq / kg', characterization_factor: '28', factor_basis: 'elementary', factor_source: 'IPCC AR5 GWP100 (CH4=28)' }),
];
// Step C: wood-fired dryer burner, fuel metered in kWh; a steel line typed as 'ton'.
const stepC = [
  row({ flow_id: 4, substance_id: 72, substance_name: 'Wood', flow_type: 'input', quantity: '1465.355', flow_unit: 'kWh', substance_default_unit: 'MMBtu', factor_unit: 'kg CO2 eq / MMBtu', characterization_factor: '94.956', factor_basis: 'embodied', factor_source: 'EPA GHG Emission Factors Hub, Table 1' }),
  row({ flow_id: 5, substance_id: 60, substance_name: 'Steel', flow_type: 'input', quantity: '2', flow_unit: 'ton', substance_default_unit: 'kg', factor_unit: 'kg CO2 eq', characterization_factor: '1.9', factor_basis: 'embodied', factor_source: 'worldsteel 2022' }),
];

const comp = (id: number, name: string) => [{ component_id: id, component_name: name, component_type: 'elemental_task', hierarchy_level: 5 }];
const gw = (r: Awaited<ReturnType<typeof calculateComponentImpacts>>) =>
  r.impacts.find((i) => i.category_name === 'Global Warming')?.impact_value ?? 0;

describe('CALCULATIONS.md worked example', () => {
  it('reproduces every number in the document', async () => {
    const a = await calculateComponentImpacts(1, fakeConn([comp(1, 'Electrode drying oven'), stepA]), {});
    const b = await calculateComponentImpacts(2, fakeConn([comp(2, 'Curing vent'), stepB]), {});
    const c = await calculateComponentImpacts(3, fakeConn([comp(3, 'Wood-fired dryer burner'), stepC]), {});

    expect(gw(a)).toBeCloseTo(118.4865, 9);
    expect(a.impacts.find((i) => i.category_name === 'Resource Depletion')!.impact_value).toBeCloseTo(0.0013527, 12);
    expect(gw(b)).toBeCloseTo(195.25, 9);
    expect(gw(c)).toBeCloseTo(474.78, 6);
    expect(c.flow_contributions[0].unit_conversion).toBe(`1 kWh = ${1 / 293.071} MMBtu`);
    expect(c.excluded_flows).toBe(1);
    expect(c.warnings.join(' ')).toContain("ambiguous unit 'ton'");

    // No step mixes a fuel input with its combustion gas: no double-count warning.
    for (const r of [a, b, c]) expect(r.warnings.join(' ')).not.toContain('DOUBLE COUNT');

    const total = gw(a) + gw(b) + gw(c);
    expect(total).toBeCloseTo(788.5165, 6);
    expect(total * perFunctionalUnitScale(1, 400)).toBeCloseTo(1.97129125, 8);

    // US region: electricity takes the eGRID row, 0.350.
    expect(250.5 * 0.35 + 195.25 + 474.78).toBeCloseTo(757.705, 9);

    const dq = summarizeDataQuality([a, b, c]);
    expect(dq.excluded_flows).toBe(1);
    expect(dq.statement.join(' ')).toContain('1 flow-category pair was left out');
  });
});
