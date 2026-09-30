/**
 * Referential-integrity queries (scripts/db/integrity-report.mjs), on a small
 * valid world seeded into the suite's fresh database.
 *
 * 1. Every tenant check returns 0 rows on valid data.
 * 2. Each core check is proven to FIRE: the defect is created inside a
 *    transaction (foreign-key checks off where the schema would refuse it),
 *    the check must return exactly that row, and the transaction is rolled
 *    back, so nothing is left behind.
 *
 * The same queries run read-only against any local restore with:
 *   node --env-file=.env.local scripts/db/integrity-report.mjs --db=NAME --rows
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INTEGRITY_CHECKS } from '../../scripts/db/integrity-report.mjs';
import { connect, rows } from './support/db';
import { seedWorld, type World } from './support/world';

let conn: Awaited<ReturnType<typeof connect>>;
let world: World;

const check = (id: string) => {
  const c = INTEGRITY_CHECKS.find((x) => x.id === id);
  if (!c) throw new Error(`No integrity check ${id}`);
  return c;
};
const run = (id: string) => rows<Record<string, unknown>>(conn, check(id).sql);

/** Run `body` in a transaction that is always rolled back. */
async function inRollback(body: () => Promise<void>, { fkOff = false } = {}) {
  await conn.query('START TRANSACTION');
  if (fkOff) await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await body();
  } finally {
    await conn.query('ROLLBACK');
    if (fkOff) await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

const MISSING = 2_000_000_000; // an id no test row will have

beforeAll(async () => {
  conn = await connect();
  world = await seedWorld(conn);
  // A completed run with one result row per step that has a flow.
  const [r] = await conn.query(
    `INSERT INTO assessment_runs (case_id, run_name, calculation_method, region_code, status, executed_by)
     VALUES (?, 'integrity', 'CML 2001', 'US', 'completed', ?)`,
    [world.cases[0].caseId, world.ownerId],
  );
  const runId = (r as { insertId: number }).insertId;
  await conn.query(
    `INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
     SELECT ?, ?, category_id, 0.875, unit FROM impact_categories WHERE category_name = 'Global Warming'`,
    [runId, world.cases[0].leafId],
  );
});

afterAll(async () => {
  await world?.cleanup();
  await conn?.end();
});

describe('integrity checks on a valid world', () => {
  const tenant = INTEGRITY_CHECKS.filter((c) => c.kind === 'tenant');

  it.each(tenant.map((c) => [c.id, c] as const))('%s returns 0 rows', async (_id, c) => {
    const found = await rows(conn, c.sql);
    expect(found, c.title).toEqual([]);
  });

  it.each(
    ['live_factor_with_quarantine_twin', 'duplicate_factor_keys', 'factors_missing_substance_or_category', 'mojibake_text'].map(
      (id) => [id] as const,
    ),
  )('reference check %s returns 0 rows on the seeded library', async (id) => {
    expect(await run(id), check(id).title).toEqual([]);
  });
});

describe('each core check detects its defect', () => {
  it('orphan_components: a step whose case does not exist', async () => {
    await inRollback(
      async () => {
        await conn.query(
          `INSERT INTO component (case_id, component_name, component_type, hierarchy_level) VALUES (?, 'orphan', 'product', 1)`,
          [MISSING],
        );
        expect(await run('orphan_components')).toEqual([expect.objectContaining({ case_id: MISSING })]);
      },
      { fkOff: true },
    );
  });

  it('orphan_flows: a flow whose step does not exist', async () => {
    const [[sub]] = (await conn.query(`SELECT substance_id FROM substances WHERE substance_name = 'Electricity'`)) as any;
    await inRollback(
      async () => {
        await conn.query(
          `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit) VALUES (?, ?, 'input', 1, 'kWh')`,
          [MISSING, sub.substance_id],
        );
        expect(await run('orphan_flows')).toEqual([expect.objectContaining({ component_id: MISSING })]);
      },
      { fkOff: true },
    );
  });

  it('parent_other_case: a step whose parent lives in another case (no key prevents this)', async () => {
    const [a, b] = world.cases;
    await inRollback(async () => {
      await conn.query('UPDATE component SET parent_component_id = ? WHERE component_id = ?', [a.componentIds[0], b.componentIds[1]]);
      expect(await run('parent_other_case')).toEqual([
        expect.objectContaining({ component_id: b.componentIds[1], parent_id: a.componentIds[0] }),
      ]);
    });
  });

  it('parent_cycles: two steps that are each other\'s ancestor (no key prevents this)', async () => {
    const ids = world.cases[0].componentIds; // root .. leaf
    await inRollback(async () => {
      // root -> leaf makes root .. leaf a loop of five.
      await conn.query('UPDATE component SET parent_component_id = ? WHERE component_id = ?', [ids[4], ids[0]]);
      const found = (await run('parent_cycles')).map((r) => Number(r.component_id)).sort((x, y) => x - y);
      expect(found).toEqual([...ids].sort((x, y) => x - y));
    });
  });

  it('parent_cycles: a step that is its own parent', async () => {
    const leaf = world.cases[1].leafId;
    await inRollback(async () => {
      await conn.query('UPDATE component SET parent_component_id = component_id WHERE component_id = ?', [leaf]);
      expect((await run('parent_cycles')).map((r) => Number(r.component_id))).toEqual([leaf]);
    });
  });

  it('hierarchy_level_mismatch: a step whose level is not its depth', async () => {
    const leaf = world.cases[0].leafId;
    await inRollback(async () => {
      await conn.query('UPDATE component SET hierarchy_level = 2 WHERE component_id = ?', [leaf]);
      expect(await run('hierarchy_level_mismatch')).toEqual([
        expect.objectContaining({ component_id: leaf, hierarchy_level: 2 }),
      ]);
    });
  });

  it('results_missing_run: a result row whose run does not exist', async () => {
    await inRollback(
      async () => {
        await conn.query(
          `INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES (?, NULL, 1, 1, 'kg CO2 eq')`,
          [MISSING],
        );
        expect(await run('results_missing_run')).toEqual([expect.objectContaining({ run_id: MISSING })]);
      },
      { fkOff: true },
    );
  });

  it('members_missing_account: a membership whose account does not exist', async () => {
    await inRollback(
      async () => {
        await conn.query(`INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, 4)`, [
          world.projectId,
          MISSING,
        ]);
        expect(await run('members_missing_account')).toEqual([expect.objectContaining({ user_id: MISSING })]);
      },
      { fkOff: true },
    );
  });

  it('owner_member_not_owner: an owner membership for someone who does not own the project', async () => {
    await inRollback(async () => {
      await conn.query(
        `UPDATE project_members SET permission_id = (SELECT permission_id FROM permissions WHERE permission_name = 'owner')
          WHERE project_id = ? AND user_id = ?`,
        [world.projectId, world.memberId],
      );
      expect(await run('owner_member_not_owner')).toEqual([expect.objectContaining({ user_id: world.memberId })]);
    });
  });

  it('multiple_final_cases: two hand-in cases in one project', async () => {
    await inRollback(async () => {
      await conn.query('UPDATE case_table SET is_final = 1 WHERE project_id = ?', [world.projectId]);
      expect(await run('multiple_final_cases')).toEqual([expect.objectContaining({ project_id: world.projectId })]);
    });
  });

  it('deleting a step cascades to its flows and leaves nothing dangling', async () => {
    await inRollback(async () => {
      const leaf = world.cases[1].leafId;
      await conn.query('DELETE FROM component WHERE component_id = ?', [world.cases[1].componentIds[2]]);
      const [f] = (await conn.query('SELECT COUNT(*) AS n FROM flows WHERE component_id = ?', [leaf])) as any;
      expect(Number(f[0].n)).toBe(0);
      for (const id of ['orphan_flows', 'parent_missing', 'results_missing_component']) {
        expect(await run(id), id).toEqual([]);
      }
    });
  });

  it('the data is back to valid after every rollback', async () => {
    for (const c of INTEGRITY_CHECKS.filter((x) => x.kind === 'tenant')) {
      expect(await rows(conn, c.sql), c.id).toEqual([]);
    }
  });
});
