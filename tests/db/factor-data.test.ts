/**
 * Factor-library sanity on the fresh database (baseline seed + migrations):
 * the audited values the engine and the reports depend on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INTEGRITY_CHECKS } from '../../scripts/db/integrity-report.mjs';
import { sameUnit, splitFactorUnit, unitFamily } from '@/lib/units';
import { SUPPORTED_METHODS } from '@/lib/run-snapshot';
import { connect, rows } from './support/db';

let conn: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => {
  conn = await connect();
});
afterAll(async () => {
  await conn?.end();
});

async function globalWarming(substance: string) {
  return rows<{ method_name: string; factor_value: string; unit: string; substance_unit: string }>(
    conn,
    `SELECT d.method_name, CAST(d.factor_value AS CHAR) AS factor_value, d.unit, s.unit AS substance_unit
       FROM driver_impact_factors d
       JOIN substances s ON s.substance_id = d.substance_id
       JOIN impact_categories ic ON ic.category_id = d.category_id
      WHERE s.substance_name = ? AND ic.category_name = 'Global Warming' AND d.geographic_scope = 'Global'
        AND d.method_name NOT LIKE 'QUARANTINE%'
      ORDER BY d.method_name`,
    [substance],
  );
}

describe('factor library', () => {
  it("has no live factor row with a 'QUARANTINE: <method>' twin (E2)", async () => {
    const c = INTEGRITY_CHECKS.find((x) => x.id === 'live_factor_with_quarantine_twin')!;
    expect(await rows(conn, c.sql)).toEqual([]);
  });

  it('has quarantined rows at all (017/024 ran), and the engine methods are the only live ones', async () => {
    const methods = await rows<{ method_name: string; n: number }>(
      conn,
      'SELECT method_name, COUNT(*) AS n FROM driver_impact_factors GROUP BY method_name ORDER BY method_name',
    );
    const live = methods.filter((m) => !m.method_name.startsWith('QUARANTINE: ')).map((m) => m.method_name);
    expect(live.sort()).toEqual([...SUPPORTED_METHODS].sort());
    expect(methods.some((m) => m.method_name.startsWith('QUARANTINE: '))).toBe(true);
  });

  it('Wood (the fuel, MMBtu) is 94.956 kg CO2 eq / MMBtu under all three methods (E1, migrate-028)', async () => {
    const wood = await globalWarming('Wood');
    expect(wood.map((w) => w.method_name)).toEqual([...SUPPORTED_METHODS].sort());
    for (const w of wood) {
      expect(w.substance_unit).toBe('MMBtu');
      expect(Number(w.factor_value), w.method_name).toBe(94.956);
      expect(w.unit, w.method_name).toBe('kg CO2 eq / MMBtu');
    }
  });

  it("'Wood, dimensional lumber' (the material, kg) is 0.187 kg CO2 eq / kg under all three methods", async () => {
    const lumber = await globalWarming('Wood, dimensional lumber');
    expect(lumber.map((w) => w.method_name)).toEqual([...SUPPORTED_METHODS].sort());
    for (const w of lumber) {
      expect(w.substance_unit).toBe('kg');
      expect(Number(w.factor_value), w.method_name).toBe(0.187);
      expect(w.unit, w.method_name).toBe('kg CO2 eq / kg');
    }
  });

  it('every live factor states a denominator in its substance unit family, except the two known zeroed rows (E11)', async () => {
    const factors = await rows<{
      factor_id: number;
      substance_name: string;
      substance_unit: string;
      unit: string;
      factor_value: string;
      method_name: string;
      category_name: string;
    }>(
      conn,
      `SELECT d.factor_id, s.substance_name, s.unit AS substance_unit, d.unit, CAST(d.factor_value AS CHAR) AS factor_value,
              d.method_name, ic.category_name
         FROM driver_impact_factors d
         JOIN substances s ON s.substance_id = d.substance_id
         JOIN impact_categories ic ON ic.category_id = d.category_id
        WHERE d.method_name NOT LIKE 'QUARANTINE%'`,
    );
    // The same test the engine applies before multiplying (lib/units
    // toFactorBasis): a denominator that is not the substance's unit must at
    // least be in its family. The engine refuses the rest with a warning.
    const disagree = factors
      .filter((f) => {
        const { denominator } = splitFactorUnit(f.unit);
        if (!denominator || sameUnit(denominator, f.substance_unit)) return false;
        const df = unitFamily(denominator);
        const sf = unitFamily(f.substance_unit);
        return !(df && sf && df === sf);
      })
      .map((f) => ({
        factor_id: f.factor_id,
        substance: f.substance_name,
        substance_unit: f.substance_unit,
        unit: f.unit,
        value: Number(f.factor_value),
        method: f.method_name,
        category: f.category_name,
      }))
      .sort((a, b) => a.factor_id - b.factor_id);

    // Known and harmless: per-kg Global Warming rows on m3 substances that
    // migrate-009 zeroed (Water "3.4 kg CO2e per kg" was absurd). The engine
    // excludes them with a warning. Any NEW disagreement fails here.
    expect(disagree).toEqual([
      { factor_id: 27, substance: 'Water', substance_unit: 'm3', unit: 'kg CO2 eq / kg', value: 0, method: 'CML 2001', category: 'Global Warming' },
      { factor_id: 34, substance: 'Wastewater', substance_unit: 'm3', unit: 'kg CO2 eq / kg', value: 0, method: 'CML 2001', category: 'Global Warming' },
    ]);
  });

  it('lcia_gwp_vintage records the GWP basis for every method (E5, migrate-029)', async () => {
    const v = await rows<{ method_name: string; n: number }>(
      conn,
      'SELECT method_name, COUNT(*) AS n FROM lcia_gwp_vintage GROUP BY method_name ORDER BY method_name',
    );
    expect(v.map((r) => r.method_name)).toEqual([...SUPPORTED_METHODS].sort());
    for (const r of v) expect(Number(r.n), r.method_name).toBeGreaterThanOrEqual(1);
    // The TRACI row was read from live values: lciafmt methane is AR4 (25),
    // which proves migrate-009 did not run after migrate-015.
    const [traci] = await rows<{ gwp_vintage: string }>(
      conn,
      `SELECT gwp_vintage FROM lcia_gwp_vintage WHERE method_name = 'TRACI 2.1' AND factor_group LIKE 'lciafmt%'`,
    );
    expect(traci?.gwp_vintage).toBe('IPCC AR4');
  });

  it('keeps the audited anchors: US grid 0.350, Global grid 0.473, EU grid 0.242, natural gas 1.877 kg CO2 eq/m3', async () => {
    const anchors = await rows<{ s: string; scope: string; method_name: string; v: string }>(
      conn,
      `SELECT s.substance_name AS s, d.geographic_scope AS scope, d.method_name, CAST(d.factor_value AS CHAR) AS v
         FROM driver_impact_factors d
         JOIN substances s ON s.substance_id = d.substance_id
         JOIN impact_categories ic ON ic.category_id = d.category_id
        WHERE ic.category_name = 'Global Warming' AND d.method_name NOT LIKE 'QUARANTINE%'
          AND s.substance_name IN ('Electricity', 'Natural Gas')`,
    );
    const value = (s: string, scope: string) =>
      new Set(anchors.filter((a) => a.s === s && a.scope === scope).map((a) => Number(a.v)));
    expect(value('Electricity', 'US')).toEqual(new Set([0.35]));
    expect(value('Electricity', 'Global')).toEqual(new Set([0.473]));
    expect(value('Electricity', 'EU')).toEqual(new Set([0.242]));
    expect(value('Natural Gas', 'Global')).toEqual(new Set([1.877]));
  });

  it("reports the legacy substances with an empty category (not an ENUM value; count only, never fixed here)", async () => {
    const c = INTEGRITY_CHECKS.find((x) => x.id === 'substance_empty_category')!;
    const found = await rows(conn, c.sql);
    // 27 rows in the July 2026 seed. A migration that fixes them should
    // lower this number (and update it here); nothing should raise it.
    expect(found.length).toBeLessThanOrEqual(27);
  });
});
