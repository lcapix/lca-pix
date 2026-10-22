/**
 * Golden end-to-end engine test against the LOCAL dev database.
 *
 * Run with:  LOCAL_DB=1 npx vitest run tests/e2e-local
 * Skipped entirely unless LOCAL_DB=1 (CI has no database).
 *
 * Requires migration 009 (factor_basis + audited factors) to be applied.
 * Verifies, against real schema + the audited factor rows:
 *   1. Region: 'US Grid' (UI label) resolves the eGRID US electricity factor;
 *      'Global' falls back to the Ember world-average row; never both.
 *   2. Units: a flow entered in grams contributes exactly as its kg value.
 *   3. Direction: embodied factors skip output flows (a steel OUTPUT adds
 *      nothing); elementary factors count outputs (CO2 out counts).
 *   4. Data quality: junk units are EXCLUDED with a warning; modeling a fuel
 *      input AND its combustion gas output raises the DOUBLE COUNT warning.
 *   5. Wood fuel (migrate-028): 1 MMBtu of Wood is 94.956 kg CO2 eq under
 *      every method, and lumber is its own kg substance at 0.187 kg/kg.
 *   6. Unit exclusion: a mass on the MMBtu fuel, an ambiguous 'ton', and the
 *      per-kg Water row on an m3 substance are EXCLUDED with a warning and
 *      change no total.
 *
 * Requires migrations 028 and 029 as well (node --env-file=.env.local
 * scripts/db/migrate.mjs).
 *
 * Creates its own throwaway project/case/rows and removes them afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { calculateCaseImpacts } from '@/lib/lca-engine';

const enabled = process.env.LOCAL_DB === '1';
const d = describe.skipIf(!enabled);

const MARK = `golden-e2e-${Date.now()}`;

let conn: mysql.Connection;
let caseId: number;
let leafId: number;
let steelId: number;
let elecId: number;
let gasId: number;
let co2Id: number;
let gwCategoryId: number;
let steelGw: number;
let elecGwGlobal: number;
let elecGwUS: number;
let gasGw: number;
let co2Gw: number;
let woodId: number;
let lumberId: number;
let waterId: number;

async function factor(substanceId: number, scope: string): Promise<number> {
  const [[row]]: any = await conn.query(
    `SELECT factor_value FROM driver_impact_factors
      WHERE substance_id=? AND category_id=? AND method_name='CML 2001' AND geographic_scope=?`,
    [substanceId, gwCategoryId, scope],
  );
  return parseFloat(row.factor_value);
}

d('engine golden E2E (local DB, post-migration-009)', () => {
  beforeAll(async () => {
    conn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'lca_v3',
      port: +(process.env.DATABASE_PORT || 3306),
    });

    const byName = async (name: string) => {
      const [[row]]: any = await conn.query(
        `SELECT substance_id FROM substances WHERE substance_name = ? LIMIT 1`,
        [name],
      );
      return row.substance_id as number;
    };
    steelId = await byName('Steel, reinforced');
    elecId = await byName('Electricity');
    gasId = await byName('Natural Gas');
    co2Id = await byName('Carbon Dioxide');
    woodId = await byName('Wood');
    lumberId = await byName('Wood, dimensional lumber');
    waterId = await byName('Water');
    const [[gw]]: any = await conn.query(
      `SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming' LIMIT 1`,
    );
    gwCategoryId = gw.category_id;

    steelGw = await factor(steelId, 'Global');
    elecGwGlobal = await factor(elecId, 'Global');
    elecGwUS = await factor(elecId, 'US'); // from migration 009 (eGRID 2023)
    gasGw = await factor(gasId, 'Global'); // 1.877, EPA hub
    co2Gw = await factor(co2Id, 'Global'); // 1.0

    const [[acct]]: any = await conn.query(`SELECT id FROM account ORDER BY id LIMIT 1`);
    const [p]: any = await conn.query(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, 'golden e2e throwaway', ?)`,
      [MARK, acct.id],
    );
    const [c]: any = await conn.query(
      `INSERT INTO case_table (project_id, case_name, case_type) VALUES (?, ?, 'base')`,
      [p.insertId, MARK],
    );
    caseId = c.insertId;

    let parent: number | null = null;
    const tiers = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'];
    for (let i = 0; i < tiers.length; i++) {
      const [r]: any = await conn.query(
        `INSERT INTO component (case_id, component_name, component_type, parent_component_id, hierarchy_level)
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, `${MARK}-${tiers[i]}`, tiers[i], parent, i + 1],
      );
      parent = r.insertId;
    }
    leafId = parent!;

    // The six probe flows:
    //   steel 850,000 g IN   → unit conversion (counts as 850 kg)
    //   electricity 120 kWh IN → region selection
    //   electricity 999 'bananas' IN → junk-unit exclusion + warning
    //   gas 100 m3 IN        → embodied fuel factor
    //   CO2 190 kg OUT       → elementary counts on output (+ co-presence warning with gas)
    //   steel 50 kg OUT      → embodied must NOT count on output
    await conn.query(
      `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver) VALUES
       (?, ?, 'input', 850000, 'g', 1),
       (?, ?, 'input', 120, 'kWh', 1),
       (?, ?, 'input', 999, 'bananas', 1),
       (?, ?, 'input', 100, 'm3', 1),
       (?, ?, 'output', 190, 'kg', 1),
       (?, ?, 'output', 50, 'kg', 1)`,
      [leafId, steelId, leafId, elecId, leafId, elecId, leafId, gasId, leafId, co2Id, leafId, steelId],
    );
  });

  afterAll(async () => {
    if (!conn) return;
    await conn.query(`DELETE FROM flows WHERE component_id = ?`, [leafId]);
    await conn.query(`DELETE FROM component WHERE case_id = ?`, [caseId]);
    await conn.query(`DELETE FROM case_table WHERE case_id = ?`, [caseId]);
    await conn.query(`DELETE FROM project WHERE project_name = ?`, [MARK]);
    await conn.end();
  });

  it('US region: converts grams, uses the eGRID US factor once, applies direction, warns on junk + co-presence', async () => {
    const result = await calculateCaseImpacts(caseId, conn as any, {
      method: 'CML 2001',
      regionCode: 'US Grid', // UI label on purpose
    });
    const gwTotal = result.total_impacts.find((t) => t.category_id === gwCategoryId)!;
    const expected = 850 * steelGw + 120 * elecGwUS + 100 * gasGw + 190 * co2Gw;
    expect(gwTotal.impact_value).toBeCloseTo(expected, 6);

    const leaf = result.component_results.find((r) => r.component_id === leafId)!;

    // Steel OUTPUT contributed nothing (embodied factor, output flow).
    const steelGwRows = leaf.flow_contributions.filter(
      (f) => f.substance_id === steelId && f.category_id === gwCategoryId,
    );
    expect(steelGwRows).toHaveLength(1);
    expect(steelGwRows[0].flow_type).toBe('input');
    expect(steelGwRows[0].unit_conversion).toContain('kg');

    // Electricity resolved the US row exactly once.
    const elecRows = leaf.flow_contributions.filter(
      (f) => f.substance_id === elecId && f.category_id === gwCategoryId,
    );
    expect(elecRows).toHaveLength(1);
    expect(elecRows[0].geographic_scope).toBe('US');
    expect(elecRows[0].characterization_factor).toBeCloseTo(elecGwUS, 9);

    // CO2 output counted (elementary on output).
    const co2Rows = leaf.flow_contributions.filter(
      (f) => f.substance_id === co2Id && f.category_id === gwCategoryId,
    );
    expect(co2Rows).toHaveLength(1);

    // Warnings: junk unit excluded + the fuel/gas co-presence call-out.
    expect(result.warnings.some((w) => w.includes("'bananas'"))).toBe(true);
    expect(result.warnings.some((w) => w.includes('DOUBLE COUNT'))).toBe(true);
  });

  it('Global region: identical case falls back to the Ember world-average electricity factor', async () => {
    const result = await calculateCaseImpacts(caseId, conn as any, {
      method: 'CML 2001',
      regionCode: 'Global',
    });
    const gwTotal = result.total_impacts.find((t) => t.category_id === gwCategoryId)!;
    const expected = 850 * steelGw + 120 * elecGwGlobal + 100 * gasGw + 190 * co2Gw;
    expect(gwTotal.impact_value).toBeCloseTo(expected, 6);
  });

  it('ISO 14044: a share on a parent scales everything below it, and the run grades its own data', async () => {
    const [[line]]: any = await conn.query(
      `SELECT component_id FROM component WHERE case_id = ? AND component_type = 'machine_line'`,
      [caseId],
    );
    const expectedFull = 850 * steelGw + 120 * elecGwGlobal + 100 * gasGw + 190 * co2Gw;
    try {
      await conn.query(
        `UPDATE component SET allocation_method = 'physical', allocation_factor = 0.5 WHERE component_id = ?`,
        [line.component_id],
      );
      const result = await calculateCaseImpacts(caseId, conn as any, {
        method: 'CML 2001',
        regionCode: 'Global',
      });
      const gwTotal = result.total_impacts.find((t) => t.category_id === gwCategoryId)!;
      expect(gwTotal.impact_value).toBeCloseTo(expectedFull * 0.5, 6);

      const dq = result.data_quality!;
      expect(dq.allocated_components).toBe(1);
      expect(dq.excluded_flows).toBeGreaterThanOrEqual(1); // the 'bananas' flow
      expect(dq.uncharacterized_examples).toContain('Steel, reinforced'); // steel OUTPUT
      const text = dq.statement.join(' ');
      expect(text).toContain('All factors are Global averages');
      expect(text).toContain('50%');
    } finally {
      await conn.query(
        `UPDATE component SET allocation_method = 'none', allocation_factor = 1 WHERE component_id = ?`,
        [line.component_id],
      );
    }
  });

  it('warns when a parent node also carries flows of its own (terminating-node rule)', async () => {
    const [[op]]: any = await conn.query(
      `SELECT component_id FROM component WHERE case_id = ? AND component_type = 'operation'`,
      [caseId],
    );
    const [ins]: any = await conn.query(
      `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver)
       VALUES (?, ?, 'output', 1, 'kg', 1)`,
      [op.component_id, co2Id],
    );
    try {
      const result = await calculateCaseImpacts(caseId, conn as any, {
        method: 'CML 2001',
        regionCode: 'Global',
      });
      expect(result.warnings.some((w) => w.includes('has steps below it'))).toBe(true);
    } finally {
      await conn.query(`DELETE FROM flows WHERE flow_id = ?`, [ins.insertId]);
    }
  });

  // Temporary extra flows on the leaf, removed afterwards so the other cases'
  // expected totals are untouched.
  async function withFlows(
    flows: Array<[number, 'input' | 'output', number, string]>,
    fn: (ids: number[]) => Promise<void>,
  ) {
    const ids: number[] = [];
    try {
      for (const [sid, dir, qty, unit] of flows) {
        const [r]: any = await conn.query(
          `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver) VALUES (?, ?, ?, ?, ?, 1)`,
          [leafId, sid, dir, qty, unit],
        );
        ids.push(r.insertId);
      }
      await fn(ids);
    } finally {
      if (ids.length) await conn.query(`DELETE FROM flows WHERE flow_id IN (?)`, [ids]);
    }
  }

  const baseline = () => 850 * steelGw + 120 * elecGwGlobal + 100 * gasGw + 190 * co2Gw;

  it.each(['CML 2001', 'TRACI 2.1', 'ReCiPe Midpoint (H)'])(
    'Wood fuel (migrate-028): 1 MMBtu and 293.071 kWh are each 94.956 kg CO2 eq under %s',
    async (method) => {
      await withFlows(
        [
          [woodId, 'input', 1, 'MMBtu'],
          [woodId, 'input', 293.071, 'kWh'],
        ],
        async (ids) => {
          const result = await calculateCaseImpacts(caseId, conn as any, { method, regionCode: 'Global' });
          const leaf = result.component_results.find((r) => r.component_id === leafId)!;
          const wood = leaf.flow_contributions.filter((c) => ids.includes(c.flow_id) && c.category_id === gwCategoryId);
          expect(wood).toHaveLength(2);
          for (const c of wood) {
            expect(c.characterization_factor).toBeCloseTo(94.956, 9);
            expect(c.impact_contribution).toBeCloseTo(94.956, 6);
          }
          expect(wood.find((c) => c.unit === 'kWh')!.unit_conversion).toContain('MMBtu');
        },
      );
    },
  );

  it('Wood fuel adds exactly 94.956 to the CML Global total; lumber is 0.187 kg/kg on its own substance', async () => {
    await withFlows(
      [
        [woodId, 'input', 1, 'MMBtu'],
        [lumberId, 'input', 100, 'kg'],
      ],
      async () => {
        const result = await calculateCaseImpacts(caseId, conn as any, { method: 'CML 2001', regionCode: 'Global' });
        const gwTotal = result.total_impacts.find((t) => t.category_id === gwCategoryId)!;
        expect(gwTotal.impact_value).toBeCloseTo(baseline() + 94.956 + 100 * 0.187, 6);
      },
    );
  });

  it('unit exclusion: kg on the MMBtu fuel, an ambiguous ton, and per-kg Water on m3 are left out with warnings', async () => {
    await withFlows(
      [
        [woodId, 'input', 500, 'kg'], // lumber typed onto the fuel
        [steelId, 'input', 2, 'ton'], // short or metric? refused
        [waterId, 'input', 10, 'm3'], // CML Water GW row is 'kg CO2 eq / kg' on an m3 substance (E11)
      ],
      async (ids) => {
        const result = await calculateCaseImpacts(caseId, conn as any, { method: 'CML 2001', regionCode: 'Global' });
        const gwTotal = result.total_impacts.find((t) => t.category_id === gwCategoryId)!;
        expect(gwTotal.impact_value).toBeCloseTo(baseline(), 6);
        const leaf = result.component_results.find((r) => r.component_id === leafId)!;
        expect(leaf.flow_contributions.filter((c) => ids.includes(c.flow_id) && c.category_id === gwCategoryId)).toEqual([]);
        const w = result.warnings.join('\n');
        expect(w).toMatch(/Wood\): unit 'kg' cannot be converted to factor unit 'MMBtu'.*EXCLUDED/);
        expect(w).toMatch(/Steel, reinforced\): ambiguous unit 'ton'.*EXCLUDED/);
        expect(w).toMatch(/Water\): factor is stated per 'kg'.*'m3'.*EXCLUDED/);
        expect(result.data_quality!.excluded_flows).toBeGreaterThanOrEqual(4); // + the 'bananas' flow
      },
    );
  });

  it('audited values are live: CH4=28, elec US=0.350, elec Global=0.473, gas=1.877', async () => {
    expect(elecGwUS).toBeCloseTo(0.35, 9);
    expect(elecGwGlobal).toBeCloseTo(0.473, 9);
    expect(gasGw).toBeCloseTo(1.877, 9);
    const [[ch4]]: any = await conn.query(
      `SELECT dif.factor_value FROM driver_impact_factors dif
        JOIN substances s ON s.substance_id=dif.substance_id
        WHERE s.substance_name='Methane' AND dif.method_name='CML 2001' AND dif.category_id=?`,
      [gwCategoryId],
    );
    expect(parseFloat(ch4.factor_value)).toBe(28);
  });
});
