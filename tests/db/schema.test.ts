/**
 * Schema invariants after the full chain (baseline + every migration), on the
 * suite's fresh database. Each expectation names the audit finding or the
 * code path that depends on it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, rows, testDb } from './support/db';

let conn: Awaited<ReturnType<typeof connect>>;
let db: string;

beforeAll(async () => {
  db = testDb().database;
  conn = await connect();
});
afterAll(async () => {
  await conn?.end();
});

async function column(table: string, name: string) {
  const [c] = await rows<any>(
    conn,
    `SELECT LOWER(DATA_TYPE) AS DATA_TYPE, LOWER(COLUMN_TYPE) AS COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, name],
  );
  return c as { DATA_TYPE: string; COLUMN_TYPE: string; IS_NULLABLE: 'YES' | 'NO' } | undefined;
}

/** Every table the app, the migrations or the runner uses. */
const EXPECTED_TABLES = [
  'account', 'assessment_results', 'assessment_runs', 'audit_log', 'case_documents', 'case_table',
  'comparison_metadata', 'comparison_results', 'comparison_runs', 'component', 'cost_rates',
  'driver_impact_factors', 'flows', 'impact_categories', 'integration_log', 'lcia_gwp_vintage',
  'permissions', 'process_template_flows', 'process_templates', 'project', 'project_members',
  'schema_migrations', 'substances',
];

/**
 * Unique keys the code relies on. [table, index, columns in order].
 * Upserts (ON DUPLICATE KEY UPDATE) in migrate-015/017/028 need the factor key;
 * signup needs email/username; member invites need (project_id, user_id).
 */
const EXPECTED_UNIQUE: [string, string, string[]][] = [
  ['account', 'email', ['email']],
  ['account', 'username', ['username']],
  ['driver_impact_factors', 'unique_substance_category_method_region', ['substance_id', 'category_id', 'method_name', 'geographic_scope']],
  ['substances', 'substance_name', ['substance_name']],
  ['impact_categories', 'category_name', ['category_name']],
  ['permissions', 'permission_name', ['permission_name']],
  ['project_members', 'unique_project_user', ['project_id', 'user_id']],
  ['cost_rates', 'unique_rate', ['rate_type', 'rate_key', 'region_code', 'effective_date']],
  ['process_templates', 'process_templates_name_uq', ['template_name']],
  ['comparison_metadata', 'comparison_id', ['comparison_id']],
  ['lcia_gwp_vintage', 'PRIMARY', ['method_name', 'factor_group']],
  ['schema_migrations', 'PRIMARY', ['filename']],
];

/** Lookup indexes on the hot paths (tree loads, flow loads, run lists, factor selection). */
const EXPECTED_INDEXES: [string, string, string[]][] = [
  ['component', 'idx_case', ['case_id']],
  ['component', 'idx_parent', ['parent_component_id']],
  ['flows', 'idx_component', ['component_id']],
  ['flows', 'idx_substance', ['substance_id']],
  ['assessment_runs', 'idx_case', ['case_id']],
  ['assessment_results', 'idx_run', ['run_id']],
  ['assessment_results', 'idx_component', ['component_id']],
  ['case_table', 'idx_project', ['project_id']],
  ['project_members', 'idx_user', ['user_id']],
  ['driver_impact_factors', 'idx_method_category', ['method_name', 'category_id']],
  ['driver_impact_factors', 'idx_substance', ['substance_id']],
  ['substances', 'substances_created_by_idx', ['created_by']],
  ['case_documents', 'case_documents_case_idx', ['case_id']],
  ['process_template_flows', 'process_template_flows_template_idx', ['template_id']],
];

/** [table, column, referenced table, ON DELETE rule]. */
const EXPECTED_FKS: [string, string, string, string][] = [
  ['assessment_results', 'component_id', 'component', 'SET NULL'], // RUN-1, migrate-027
  ['assessment_results', 'run_id', 'assessment_runs', 'CASCADE'],
  ['assessment_results', 'category_id', 'impact_categories', 'RESTRICT'],
  ['assessment_runs', 'case_id', 'case_table', 'CASCADE'],
  ['case_table', 'project_id', 'project', 'CASCADE'],
  ['component', 'case_id', 'case_table', 'CASCADE'],
  ['component', 'parent_component_id', 'component', 'CASCADE'],
  ['flows', 'component_id', 'component', 'CASCADE'],
  ['flows', 'substance_id', 'substances', 'RESTRICT'],
  ['driver_impact_factors', 'substance_id', 'substances', 'RESTRICT'],
  ['project_members', 'project_id', 'project', 'CASCADE'],
  ['project_members', 'user_id', 'account', 'CASCADE'],
  ['case_documents', 'case_id', 'case_table', 'CASCADE'],
  ['process_template_flows', 'template_id', 'process_templates', 'CASCADE'],
];

describe('schema after baseline + all migrations', () => {
  it('has every expected table, all InnoDB utf8mb4', async () => {
    const tables = await rows<any>(
      conn,
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS coll FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [db],
    );
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(EXPECTED_TABLES));
    for (const t of tables) {
      expect(t.engine, t.name).toBe('InnoDB');
      expect(t.coll, t.name).toMatch(/^utf8mb4_/);
    }
  });

  it('has no table without a primary key', async () => {
    const missing = await rows<any>(
      conn,
      `SELECT t.TABLE_NAME AS name FROM information_schema.TABLES t
         LEFT JOIN information_schema.TABLE_CONSTRAINTS c
           ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.CONSTRAINT_TYPE = 'PRIMARY KEY'
        WHERE t.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE' AND c.CONSTRAINT_NAME IS NULL`,
      [db],
    );
    expect(missing.map((m) => m.name)).toEqual([]);
  });

  it('stores assessment_results.impact_value and contribution_percentage as DOUBLE (RUN-2, migrate-026)', async () => {
    expect((await column('assessment_results', 'impact_value'))?.DATA_TYPE).toBe('double');
    expect((await column('assessment_results', 'impact_value'))?.IS_NULLABLE).toBe('NO');
    expect((await column('assessment_results', 'contribution_percentage'))?.DATA_TYPE).toBe('double');
  });

  it('keeps run results when a step is deleted: component_id is nullable, its key is ON DELETE SET NULL (RUN-1, migrate-027)', async () => {
    expect((await column('assessment_results', 'component_id'))?.IS_NULLABLE).toBe('YES');
    const keys = await rows<any>(
      conn,
      `SELECT rc.CONSTRAINT_NAME AS name, rc.DELETE_RULE AS rule
         FROM information_schema.REFERENTIAL_CONSTRAINTS rc
         JOIN information_schema.KEY_COLUMN_USAGE k
           ON k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND k.TABLE_NAME = rc.TABLE_NAME
        WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'assessment_results' AND k.COLUMN_NAME = 'component_id'`,
      [db],
    );
    expect(keys).toEqual([{ name: 'fk_assessment_results_component', rule: 'SET NULL' }]);
  });

  it('has the unique keys the code relies on', async () => {
    const idx = await rows<any>(
      conn,
      `SELECT TABLE_NAME AS t, INDEX_NAME AS i, NON_UNIQUE AS nu,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
         FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?
        GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE`,
      [db],
    );
    const found = new Map(idx.map((r) => [`${r.t}.${r.i}`, r]));
    for (const [table, name, cols] of EXPECTED_UNIQUE) {
      const r = found.get(`${table}.${name}`);
      expect(r, `${table}.${name}`).toBeDefined();
      expect(Number(r.nu), `${table}.${name} is unique`).toBe(0);
      expect(r.cols, `${table}.${name} columns`).toBe(cols.join(','));
    }
    for (const [table, name, cols] of EXPECTED_INDEXES) {
      const r = found.get(`${table}.${name}`);
      expect(r, `${table}.${name}`).toBeDefined();
      expect(r.cols, `${table}.${name} columns`).toBe(cols.join(','));
    }
  });

  it('has the foreign keys and delete rules the app depends on', async () => {
    const fks = await rows<any>(
      conn,
      `SELECT k.TABLE_NAME AS t, k.COLUMN_NAME AS c, k.REFERENCED_TABLE_NAME AS r, rc.DELETE_RULE AS rule
         FROM information_schema.KEY_COLUMN_USAGE k
         JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
           ON rc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND rc.TABLE_NAME = k.TABLE_NAME
        WHERE k.TABLE_SCHEMA = ?`,
      [db],
    );
    const found = fks.map((f) => `${f.t}.${f.c} -> ${f.r} ON DELETE ${f.rule}`);
    for (const [t, c, r, rule] of EXPECTED_FKS) {
      expect(found).toContain(`${t}.${c} -> ${r} ON DELETE ${rule}`);
    }
    // One key per column: a leftover cascading key next to the SET NULL one
    // would still delete results.
    const perColumn = new Map<string, number>();
    for (const f of fks) perColumn.set(`${f.t}.${f.c}`, (perColumn.get(`${f.t}.${f.c}`) ?? 0) + 1);
    expect([...perColumn].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('has the account profile columns the profile and OAuth routes use (AUTH-7, migrate-031)', async () => {
    for (const name of ['full_name', 'company', 'role', 'use_case', 'country', 'onboarded_at']) {
      const c = await column('account', name);
      expect(c, `account.${name}`).toBeDefined();
      expect(c!.IS_NULLABLE, `account.${name}`).toBe('YES');
    }
  });

  it('has the columns later migrations added (spot checks across 009-029)', async () => {
    const expected: [string, string, string][] = [
      ['driver_impact_factors', 'factor_basis', 'enum'], // 009
      ['assessment_runs', 'run_snapshot', 'json'], // 010
      ['component', 'equipment_cost', 'decimal'], // 010
      ['project', 'functional_unit', 'varchar'], // 014
      ['component', 'allocation_factor', 'decimal'], // 014
      ['project', 'lcia_method', 'varchar'], // 018
      ['substances', 'is_custom', 'tinyint'], // 020
      ['case_table', 'learning_state', 'json'], // 021
      ['component', 'life_cycle_stage', 'varchar'], // 022
      ['flows', 'transport_mass_kg', 'decimal'], // 022
      ['substances', 'variant_of', 'int'], // 022
      ['case_table', 'is_final', 'tinyint'], // 022
    ];
    for (const [t, c, type] of expected) {
      expect((await column(t, c))?.DATA_TYPE, `${t}.${c}`).toBe(type);
    }
  });

  it('leaves no helper procedure behind (014/018/020/021/022 drop lcapix_add_col)', async () => {
    const procs = await rows<any>(
      conn,
      `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?`,
      [db],
    );
    expect(procs).toEqual([]);
  });
});
