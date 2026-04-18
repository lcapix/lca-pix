import { describe, it, expect, vi } from 'vitest';
import { calculateComponentImpacts } from '@/lib/lca-engine';

// Build a stub mysql connection whose .query returns canned data in order.
function fakeConn(sequence: any[][]) {
  let i = 0;
  return {
    query: vi.fn().mockImplementation(async () => {
      const r = sequence[i++]; return [r, null];
    }),
  } as any;
}

describe('calculateComponentImpacts — method + region filtering', () => {
  it('passes method + region to the SQL query', async () => {
    const conn = fakeConn([
      // 1st: component lookup
      [{ component_id: 1, component_name: 'X', component_type: 'elemental_task', hierarchy_level: 5 }],
      // 2nd: flows join with factors
      [{
        flow_id: 1, substance_id: 7, substance_name: 'Electricity', cas_number: null,
        flow_type: 'input', quantity: 10, flow_unit: 'kWh',
        category_id: 1, category_name: 'Global Warming',
        category_unit: 'kg CO2 eq', characterization_factor: 0.283,
      }],
    ]);

    const r = await calculateComponentImpacts(1, conn, {
      method: 'CML 2001', regionCode: 'US-NY',
    });

    expect(r.impacts[0].impact_value).toBeCloseTo(2.83, 5);
    // Second query call should have method + region in params
    const secondQueryArgs = conn.query.mock.calls[1];
    expect(secondQueryArgs[0]).toContain('method_name');
    expect(secondQueryArgs[1]).toContain('CML 2001');
    expect(secondQueryArgs[1]).toContain('US-NY');
  });

  it('falls back to Global when region not provided', async () => {
    const conn = fakeConn([
      [{ component_id: 1, component_name: 'X', component_type: 'elemental_task', hierarchy_level: 5 }],
      [{ flow_id: 1, substance_id: 1, substance_name: 'CO2', cas_number: null,
         flow_type: 'output', quantity: 5, flow_unit: 'kg',
         category_id: 1, category_name: 'Global Warming',
         category_unit: 'kg CO2 eq', characterization_factor: 1.0 }],
    ]);
    const r = await calculateComponentImpacts(1, conn, {});
    expect(r.impacts[0].impact_value).toBeCloseTo(5.0, 5);
    const secondQueryArgs = conn.query.mock.calls[1];
    expect(secondQueryArgs[1]).toContain('Global');  // region fallback
    expect(secondQueryArgs[1]).toContain('CML 2001'); // method fallback
  });
});
