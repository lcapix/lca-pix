/**
 * Schema invariants of the Postgres schema (db/pg/000-schema.sql, the MySQL
 * schema at migration 042), on the suite's fresh database. Each expectation
 * names the audit finding or the code path that depends on it. Index names
 * carry their table (<table>__<name>), as Postgres names are per schema.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, rows } from './support/db';

let conn: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => {
  conn = await connect();
});
afterAll(async () => {
  await conn?.end();
});

async function column(table: string, name: string) {
  const [c] = await rows<any>(
    conn,
    `SELECT data_type, format_type(a.atttypid, a.atttypmod) AS full_type, c.is_nullable, c.column_default, c.collation_name
       FROM information_schema.columns c
       JOIN pg_attribute a ON a.attrelid = ('public.' || quote_ident(c.table_name))::regclass AND a.attname = c.column_name
      WHERE c.table_schema = 'public' AND c.table_name = ? AND c.column_name = ?`,
    [table, name],
  );
  return c as { data_type: string; full_type: string; is_nullable: 'YES' | 'NO'; column_default: string | null; collation_name: string | null } | undefined;
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
 * Upserts (ON CONFLICT) on the factor key and the cost-rate key need them;
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
  ['case_table', 'created_by', 'account', 'SET NULL'], // B-A1 student isolation, migrate-032
];

describe('schema after the baseline and every migration', () => {
  it('has every expected table', async () => {
    const tables = await rows<any>(conn, `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(EXPECTED_TABLES));
  });

  it('compares text as MySQL did: every string column has the case- and accent-blind collation ci', async () => {
    const off = await rows<any>(
      conn,
      `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type IN ('character varying', 'character', 'text') AND collation_name IS DISTINCT FROM 'ci'`,
    );
    expect(off.map((r) => r.c)).toEqual([]);
  });

  it('has no table without a primary key', async () => {
    const missing = await rows<any>(
      conn,
      `SELECT t.table_name AS name FROM information_schema.tables t
         LEFT JOIN information_schema.table_constraints c
           ON c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.constraint_type = 'PRIMARY KEY'
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.constraint_name IS NULL`,
    );
    expect(missing.map((m) => m.name)).toEqual([]);
  });

  it('stores assessment_results.impact_value and contribution_percentage as double precision (RUN-2, migrate-026)', async () => {
    expect((await column('assessment_results', 'impact_value'))?.data_type).toBe('double precision');
    expect((await column('assessment_results', 'impact_value'))?.is_nullable).toBe('NO');
    expect((await column('assessment_results', 'contribution_percentage'))?.data_type).toBe('double precision');
  });

  it('keeps run results when a step is deleted: component_id is nullable, its key is ON DELETE SET NULL (RUN-1, migrate-027)', async () => {
    expect((await column('assessment_results', 'component_id'))?.is_nullable).toBe('YES');
    const keys = await rows<any>(
      conn,
      `SELECT con.conname AS name, pg_get_constraintdef(con.oid) AS def
         FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'assessment_results' AND con.contype = 'f' AND con.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'component_id')]::smallint[]`,
    );
    expect(keys).toEqual([{ name: 'fk_assessment_results_component', def: 'FOREIGN KEY (component_id) REFERENCES component(component_id) ON DELETE SET NULL' }]);
  });

  it('has the unique keys and the lookup indexes the code relies on', async () => {
    const idx = await rows<any>(
      conn,
      `SELECT t.relname AS t, i.relname AS i, ix.indisunique AS uniq, ix.indisprimary AS prim,
              array_to_string(array(SELECT a.attname FROM unnest(ix.indkey) WITH ORDINALITY k(n, o)
                                     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.n ORDER BY k.o), ',') AS cols
         FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'`,
    );
    const find = (table: string, name: string) =>
      idx.find((r) => r.t === table && (name === 'PRIMARY' ? r.prim === 1 : r.i === `${table}__${name}`));
    for (const [table, name, cols] of EXPECTED_UNIQUE) {
      const r = find(table, name);
      expect(r, `${table}.${name}`).toBeDefined();
      expect(r.uniq, `${table}.${name} is unique`).toBe(1);
      expect(r.cols, `${table}.${name} columns`).toBe(cols.join(','));
    }
    for (const [table, name, cols] of EXPECTED_INDEXES) {
      const r = find(table, name);
      expect(r, `${table}.${name}`).toBeDefined();
      expect(r.cols, `${table}.${name} columns`).toBe(cols.join(','));
    }
  });

  it('has the foreign keys and delete rules the app depends on', async () => {
    const fks = await rows<any>(
      conn,
      `SELECT rel.relname AS t, a.attname AS c, ref.relname AS r,
              CASE con.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'r' THEN 'RESTRICT' WHEN 'a' THEN 'NO ACTION' ELSE 'SET DEFAULT' END AS rule
         FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_class ref ON ref.oid = con.confrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ANY (con.conkey)
        WHERE n.nspname = 'public' AND con.contype = 'f'`,
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
      expect(c!.is_nullable, `account.${name}`).toBe('YES');
    }
  });

  it('has per-case ownership and the per-project isolation setting (B-A1 student isolation, migrate-032)', async () => {
    const createdBy = await column('case_table', 'created_by');
    expect(createdBy?.data_type).toBe('integer');
    expect(createdBy?.is_nullable).toBe('YES');
    const setting = await column('project', 'members_see_own_cases');
    expect(setting).toMatchObject({ full_type: 'smallint', is_nullable: 'NO', column_default: '0' });
  });

  it('has the columns later migrations added (spot checks across 009-042)', async () => {
    const expected: [string, string, string][] = [
      ['driver_impact_factors', 'factor_basis', 'character varying'], // 009 (an enum in MySQL)
      ['assessment_runs', 'run_snapshot', 'jsonb'], // 010
      ['component', 'equipment_cost', 'numeric'], // 010
      ['project', 'functional_unit', 'character varying'], // 014
      ['component', 'allocation_factor', 'numeric'], // 014
      ['project', 'lcia_method', 'character varying'], // 018
      ['substances', 'is_custom', 'smallint'], // 020 (tinyint(1) in MySQL)
      ['case_table', 'learning_state', 'jsonb'], // 021
      ['component', 'life_cycle_stage', 'character varying'], // 022
      ['flows', 'transport_mass_kg', 'double precision'], // added by 022, widened to DOUBLE by 030
      ['flows', 'quantity', 'double precision'], // 030
      ['substances', 'variant_of', 'integer'], // 022
      ['case_table', 'is_final', 'smallint'], // 022
      ['component_cost_basis', 'cost_lines', 'jsonb'], // 035
      ['case_table', 'hidden_from_members', 'smallint'], // 037
      ['project', 'ai_enabled', 'smallint'], // 042
    ];
    for (const [t, c, type] of expected) {
      expect((await column(t, c))?.data_type, `${t}.${c}`).toBe(type);
    }
  });

  it("keeps MySQL's ON UPDATE CURRENT_TIMESTAMP: an updated_at trigger on every table that has one, and no other function", async () => {
    const withColumn = await rows<any>(conn, `SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'updated_at' ORDER BY 1`);
    const triggers = await rows<any>(conn, `SELECT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid WHERE NOT tg.tgisinternal ORDER BY 1`);
    expect(triggers.map((r) => r.t)).toEqual(withColumn.map((r) => r.t));
    const fns = await rows<any>(conn, `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`);
    expect(fns.map((f) => f.proname)).toEqual(['set_updated_at']);
  });
});
