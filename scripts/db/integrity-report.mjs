#!/usr/bin/env node
/**
 * Referential-integrity and data-sanity checks, shared by the database tests
 * (tests/db/integrity.test.ts) and a read-only report for any LOCAL database.
 *
 *   node --env-file=.env.local scripts/db/integrity-report.mjs            report on DATABASE_NAME
 *   node --env-file=.env.local scripts/db/integrity-report.mjs --db=NAME  report on another local database
 *   ... --rows                                                            also print up to 10 offending rows each
 *
 * Every check is one SELECT that returns the offending rows, so "0 rows" means
 * clean. The report only reads. It refuses any host but 127.0.0.1 /
 * localhost / ::1: run it on a local restore, never on RDS.
 *
 * kind:
 *   tenant     user data (projects, cases, steps, flows, runs, members). The
 *              test suite seeds a small world and asserts every one is 0.
 *   reference  library data (substances, factors). Asserted where the
 *              expectation is exact, reported otherwise.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isLocalHost } from './migrate.mjs';

/**
 * Walks each step's parent chain. A row comes back for a step whose chain
 * revisits a step (a cycle) or runs deeper than 100 levels.
 */
const PARENT_CYCLES = `
WITH RECURSIVE walk (start_id, cur_id, depth, path) AS (
  SELECT component_id, parent_component_id, 1, CAST(CONCAT(',', component_id, ',') AS CHAR(4000))
    FROM component
   WHERE parent_component_id IS NOT NULL
  UNION ALL
  SELECT w.start_id, c.parent_component_id, w.depth + 1, CONCAT(w.path, w.cur_id, ',')
    FROM walk w
    JOIN component c ON c.component_id = w.cur_id
   WHERE LOCATE(CONCAT(',', w.cur_id, ','), w.path) = 0 AND w.depth < 100
)
SELECT DISTINCT start_id AS component_id
  FROM walk
 WHERE cur_id IS NOT NULL
   AND (LOCATE(CONCAT(',', cur_id, ','), path) > 0 OR depth >= 100)`;

/** Depth from the root (1) versus the stored hierarchy_level (EDIT-9). */
const LEVEL_MISMATCH = `
WITH RECURSIVE tree (component_id, depth) AS (
  SELECT component_id, 1 FROM component WHERE parent_component_id IS NULL
  UNION ALL
  SELECT c.component_id, t.depth + 1
    FROM tree t JOIN component c ON c.parent_component_id = t.component_id
   WHERE t.depth < 100
)
SELECT c.component_id, c.hierarchy_level, t.depth
  FROM component c JOIN tree t ON t.component_id = c.component_id
 WHERE c.hierarchy_level <> t.depth`;

/** @type {{ id: string, kind: 'tenant' | 'reference', title: string, audit?: string, sql: string }[]} */
export const INTEGRITY_CHECKS = [
  {
    id: 'orphan_components',
    kind: 'tenant',
    title: 'components whose case is missing',
    sql: `SELECT c.component_id, c.case_id FROM component c
            LEFT JOIN case_table k ON k.case_id = c.case_id
           WHERE k.case_id IS NULL`,
  },
  {
    id: 'orphan_flows',
    kind: 'tenant',
    title: 'flows whose component is missing',
    sql: `SELECT f.flow_id, f.component_id FROM flows f
            LEFT JOIN component c ON c.component_id = f.component_id
           WHERE c.component_id IS NULL`,
  },
  {
    id: 'flows_missing_substance',
    kind: 'tenant',
    title: 'flows whose substance is missing',
    sql: `SELECT f.flow_id, f.substance_id FROM flows f
            LEFT JOIN substances s ON s.substance_id = f.substance_id
           WHERE s.substance_id IS NULL`,
  },
  {
    id: 'parent_missing',
    kind: 'tenant',
    title: 'components whose parent is missing',
    sql: `SELECT c.component_id, c.parent_component_id FROM component c
            LEFT JOIN component p ON p.component_id = c.parent_component_id
           WHERE c.parent_component_id IS NOT NULL AND p.component_id IS NULL`,
  },
  {
    id: 'parent_other_case',
    kind: 'tenant',
    title: 'components whose parent is in a different case',
    audit: 'M1 FLOW-1',
    sql: `SELECT c.component_id, c.case_id, p.component_id AS parent_id, p.case_id AS parent_case_id
            FROM component c
            JOIN component p ON p.component_id = c.parent_component_id
           WHERE p.case_id <> c.case_id`,
  },
  {
    id: 'parent_cycles',
    kind: 'tenant',
    title: 'components whose parent chain loops (or is deeper than 100)',
    audit: 'FLOW-1 EDIT-10',
    sql: PARENT_CYCLES,
  },
  {
    id: 'hierarchy_level_mismatch',
    kind: 'tenant',
    title: 'components whose hierarchy_level is not their depth in the tree',
    audit: 'EDIT-9',
    sql: LEVEL_MISMATCH,
  },
  {
    id: 'results_missing_run',
    kind: 'tenant',
    title: 'assessment_results pointing to a missing run',
    audit: 'RUN-1',
    sql: `SELECT ar.result_id, ar.run_id FROM assessment_results ar
            LEFT JOIN assessment_runs r ON r.run_id = ar.run_id
           WHERE r.run_id IS NULL`,
  },
  {
    id: 'results_missing_component',
    kind: 'tenant',
    title: 'assessment_results pointing to a missing component (NULL is allowed: a deleted step)',
    audit: 'RUN-1',
    sql: `SELECT ar.result_id, ar.component_id FROM assessment_results ar
            LEFT JOIN component c ON c.component_id = ar.component_id
           WHERE ar.component_id IS NOT NULL AND c.component_id IS NULL`,
  },
  {
    id: 'runs_missing_case',
    kind: 'tenant',
    title: 'assessment_runs whose case is missing',
    sql: `SELECT r.run_id, r.case_id FROM assessment_runs r
            LEFT JOIN case_table k ON k.case_id = r.case_id
           WHERE k.case_id IS NULL`,
  },
  {
    id: 'runs_stuck_running',
    kind: 'tenant',
    title: "runs still 'running' an hour after they started",
    audit: 'RUN-3',
    sql: `SELECT run_id, case_id, run_date FROM assessment_runs
           WHERE status = 'running' AND run_date < NOW() - INTERVAL 1 HOUR`,
  },
  {
    id: 'cases_missing_project',
    kind: 'tenant',
    title: 'cases whose project is missing',
    sql: `SELECT k.case_id, k.project_id FROM case_table k
            LEFT JOIN project p ON p.project_id = k.project_id
           WHERE p.project_id IS NULL`,
  },
  {
    id: 'projects_missing_owner',
    kind: 'tenant',
    title: 'projects whose owner account is missing',
    sql: `SELECT p.project_id, p.owner_id FROM project p
            LEFT JOIN account a ON a.id = p.owner_id
           WHERE a.id IS NULL`,
  },
  {
    id: 'members_missing_account',
    kind: 'tenant',
    title: 'project_members pointing to a missing account',
    sql: `SELECT m.member_id, m.user_id FROM project_members m
            LEFT JOIN account a ON a.id = m.user_id
           WHERE a.id IS NULL`,
  },
  {
    id: 'members_missing_project',
    kind: 'tenant',
    title: 'project_members pointing to a missing project',
    sql: `SELECT m.member_id, m.project_id FROM project_members m
            LEFT JOIN project p ON p.project_id = m.project_id
           WHERE p.project_id IS NULL`,
  },
  {
    id: 'owner_member_not_owner',
    kind: 'tenant',
    title: "members with the 'owner' permission who are not the project's owner_id",
    audit: 'L9 D2',
    sql: `SELECT m.member_id, m.project_id, m.user_id, p.owner_id FROM project_members m
            JOIN permissions pe ON pe.permission_id = m.permission_id AND pe.permission_name = 'owner'
            JOIN project p ON p.project_id = m.project_id
           WHERE m.user_id <> p.owner_id`,
  },
  {
    id: 'multiple_final_cases',
    kind: 'tenant',
    title: 'projects with more than one case marked is_final',
    audit: 'WRITE-1',
    sql: `SELECT project_id, SUM(is_final) AS finals FROM case_table
           GROUP BY project_id HAVING SUM(is_final) > 1`,
  },
  {
    id: 'case_documents_missing_case',
    kind: 'tenant',
    title: 'case_documents whose case is missing',
    sql: `SELECT d.document_id, d.case_id FROM case_documents d
            LEFT JOIN case_table k ON k.case_id = d.case_id
           WHERE k.case_id IS NULL`,
  },
  {
    id: 'comparison_runs_missing_project',
    kind: 'tenant',
    title: 'comparison_runs whose project is missing (no foreign key guards this)',
    sql: `SELECT r.comparison_id, r.project_id FROM comparison_runs r
            LEFT JOIN project p ON p.project_id = r.project_id
           WHERE p.project_id IS NULL`,
  },
  {
    id: 'flows_bad_quantity',
    kind: 'tenant',
    title: 'flows with a NULL or negative quantity',
    audit: 'E9 FLOW-4',
    sql: `SELECT flow_id, quantity FROM flows WHERE quantity IS NULL OR quantity < 0`,
  },
  {
    id: 'custom_substance_without_owner',
    kind: 'tenant',
    title: 'custom substances with no owner, or an owner account that is missing',
    audit: 'FAC-4',
    sql: `SELECT s.substance_id, s.substance_name, s.created_by FROM substances s
            LEFT JOIN account a ON a.id = s.created_by
           WHERE s.is_custom = 1 AND (s.created_by IS NULL OR a.id IS NULL)`,
  },
  {
    id: 'live_factor_with_quarantine_twin',
    kind: 'reference',
    title: "live factor rows that also have a 'QUARANTINE: <method>' twin",
    audit: 'E2',
    sql: `SELECT d.factor_id, d.substance_id, d.category_id, d.method_name, d.geographic_scope, q.factor_id AS quarantined_id
            FROM driver_impact_factors d
            JOIN driver_impact_factors q
              ON q.substance_id = d.substance_id AND q.category_id = d.category_id
             AND q.geographic_scope = d.geographic_scope
             AND q.method_name = CONCAT('QUARANTINE: ', d.method_name)
           WHERE d.method_name NOT LIKE 'QUARANTINE%'`,
  },
  {
    id: 'duplicate_factor_keys',
    kind: 'reference',
    title: 'more than one factor row per substance / category / method / scope',
    sql: `SELECT substance_id, category_id, method_name, geographic_scope, COUNT(*) AS n
            FROM driver_impact_factors
           GROUP BY substance_id, category_id, method_name, geographic_scope HAVING COUNT(*) > 1`,
  },
  {
    id: 'factors_missing_substance_or_category',
    kind: 'reference',
    title: 'factor rows whose substance or category is missing',
    sql: `SELECT d.factor_id FROM driver_impact_factors d
            LEFT JOIN substances s ON s.substance_id = d.substance_id
            LEFT JOIN impact_categories ic ON ic.category_id = d.category_id
           WHERE s.substance_id IS NULL OR ic.category_id IS NULL`,
  },
  {
    id: 'substance_empty_category',
    kind: 'reference',
    title: "substances whose category is '' (not a valid ENUM value; legacy seed rows)",
    sql: `SELECT substance_id, substance_name FROM substances WHERE category = ''`,
  },
  {
    id: 'mojibake_text',
    kind: 'reference',
    title: 'factor provenance or substance text that was UTF-8 encoded twice (â€ sequences)',
    sql: `SELECT 'factor' AS what, factor_id AS id FROM driver_impact_factors
           WHERE INSTR(CAST(source_reference AS BINARY), X'C3A2E282AC') > 0
          UNION ALL
          SELECT 'substance', substance_id FROM substances
           WHERE INSTR(CAST(description AS BINARY), X'C3A2E282AC') > 0
              OR INSTR(CAST(substance_name AS BINARY), X'C3A2E282AC') > 0`,
  },
];

// ---------------------------------------------------------------------------
// CLI: read-only report
// ---------------------------------------------------------------------------

function mysqlQuery(db, statement) {
  const args = [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    '--default-character-set=utf8mb4',
    '--batch',
    '-e',
    statement,
    db.database,
  ];
  const env = { ...process.env };
  if (db.password) env.MYSQL_PWD = db.password;
  else delete env.MYSQL_PWD;
  const r = spawnSync('mysql', args, { env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) return { error: r.stderr.trim(), rows: [] };
  const lines = r.stdout.split('\n').filter((l) => l.length);
  return { error: null, header: lines[0] ?? '', rows: lines.slice(1) };
}

function main(argv) {
  const dbArg = argv.find((a) => a.startsWith('--db='));
  const showRows = argv.includes('--rows');
  const db = {
    host: (process.env.DATABASE_HOST || '127.0.0.1').trim(),
    port: (process.env.DATABASE_PORT || '3306').trim(),
    user: (process.env.DATABASE_USER || 'root').trim(),
    password: process.env.DATABASE_PASSWORD || '',
    database: (dbArg ? dbArg.slice('--db='.length) : process.env.DATABASE_NAME || '').trim(),
  };
  if (!db.database) {
    console.error('No database: set DATABASE_NAME or pass --db=NAME.');
    return 2;
  }
  if (!isLocalHost(db.host)) {
    console.error(`Refusing: ${db.host} is not a local host. Restore the data locally and report on that copy.`);
    return 2;
  }
  console.log(`Integrity report for ${db.database}@${db.host}:${db.port} (read-only)\n`);
  let problems = 0;
  for (const c of INTEGRITY_CHECKS) {
    const r = mysqlQuery(db, c.sql);
    const label = `${c.id}${c.audit ? ` [${c.audit}]` : ''}`;
    if (r.error) {
      console.log(`  ERROR ${label}: ${r.error}`);
      problems++;
      continue;
    }
    const n = r.rows.length;
    if (n) problems++;
    console.log(`  ${String(n).padStart(6)}  ${label}: ${c.title}`);
    if (showRows && n) {
      console.log(`          ${r.header}`);
      for (const row of r.rows.slice(0, 10)) console.log(`          ${row}`);
      if (n > 10) console.log(`          ... ${n - 10} more`);
    }
  }
  console.log(`\n${problems} check(s) with findings.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
