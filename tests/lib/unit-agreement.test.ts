/**
 * The save-time validator and the engine must agree on every unit spelling
 * (security review of the E8 alias commit: "parser differential").
 *
 * The flow routes (app/api/components/[componentId]/flows/route.ts and
 * app/api/flows/[flowId]/route.ts) accept a flow when
 *     convertQuantity(1, unit, substance.unit) !== null
 * and the engine includes it when calculateComponentImpacts produces a
 * contribution. Both now go through lib/units.ts; this test holds them to it
 * for every spelling in the unit table, their case and Unicode variants, and
 * the known-ambiguous spellings.
 */
import { describe, it, expect, vi } from 'vitest';
import { calculateComponentImpacts } from '@/lib/lca-engine';
import { convertQuantity, UNIT_TABLE_KEYS } from '@/lib/units';

const apiAccepts = (unit: string, substanceUnit: string) => convertQuantity(1, unit, substanceUnit) !== null;

async function engineQuantity(unit: string, substanceUnit: string): Promise<number | null> {
  const rows = [
    {
      flow_id: 1, substance_id: 1, substance_name: 'S', cas_number: null, flow_type: 'input',
      quantity: '1.000000', flow_unit: unit, substance_default_unit: substanceUnit,
      category_id: 1, category_name: 'Global Warming', category_unit: 'kg CO2 eq',
      factor_unit: 'kg CO2 eq', characterization_factor: '1.0000000000', factor_basis: 'embodied',
      geographic_scope: 'Global', factor_source: 'test',
    },
  ];
  let i = 0;
  const seq = [[{ component_id: 1, component_name: 'X', component_type: 'operation', hierarchy_level: 4 }], rows];
  const conn = { query: vi.fn().mockImplementation(async () => [seq[i++], null]) } as any;
  const r = await calculateComponentImpacts(1, conn, {});
  return r.flow_contributions.length ? r.flow_contributions[0].impact_contribution : null;
}

const variants = (k: string) => [k, k.toUpperCase(), ` ${k} `, k.replace(/\*/g, '·'), k.replace(/3$/, '³')];

const FLOW_UNITS = [
  ...new Set([
    ...UNIT_TABLE_KEYS.flatMap(variants),
    'ton', 'tons', 'Ton', 'mt', 'MT', 'Mt', 'Mg', 'MG', 'ML', 'Ml', 'mWh', 'mwh', 'mj', 'mJ',
    't⋅km', 't×km', 'm^3', 'ｋｇ', 'kg ', 'short ton', 'p', 'P', 'item', 'bananas', '', ' ',
  ]),
];
const SUBSTANCE_UNITS = ['kg', 'kWh', 'MMBtu', 'm3', 'tkm', 'units', 'm2', 'h', 'p', 'item', 'mg', 'mL', 'MWh', 'ton', 'Mg'];

describe('validator ⇔ engine agreement on every unit spelling', () => {
  it(`agrees for ${FLOW_UNITS.length} flow spellings × ${SUBSTANCE_UNITS.length} substance units`, async () => {
    const disagreements: string[] = [];
    for (const sub of SUBSTANCE_UNITS) {
      for (const u of FLOW_UNITS) {
        const api = apiAccepts(u, sub);
        const eng = await engineQuantity(u, sub);
        if (api !== (eng !== null)) {
          disagreements.push(`${JSON.stringify(u)} on ${sub}: api=${api} engine=${eng !== null}`);
          continue;
        }
        if (api) {
          const expected = convertQuantity(1, u, sub)!.quantity;
          if (Math.abs((eng as number) - expected) > 1e-9 * Math.max(1, Math.abs(expected))) {
            disagreements.push(`${JSON.stringify(u)} on ${sub}: api qty ${expected} engine qty ${eng}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('both reject the known-ambiguous spellings against every substance unit but their own', async () => {
    for (const u of ['ton', 'Mg', 'ML', 'mwh', 'mt']) {
      for (const sub of ['kg', 'kWh', 'm3', 'mg', 'mL', 'MWh', 't']) {
        expect(apiAccepts(u, sub), `${u} on ${sub}`).toBe(false);
        expect(await engineQuantity(u, sub), `${u} on ${sub}`).toBeNull();
      }
    }
  });
});
