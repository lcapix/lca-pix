#!/usr/bin/env node
/**
 * Stage 10.3: EXPLAIN on every query the app ran, from MySQL's own statement
 * statistics (performance_schema, on by default in 8.0). Two sources: plain
 * queries (events_statements_summary_by_digest; the engine's connection.query)
 * and prepared statements (prepared_statements_instances; every route's
 * pool.execute through lib/db-helpers), which the digest table does not hold.
 * Local throwaway databases only.
 *
 *   node scripts/perf/explain-queries.mjs --reset     clear the statistics (before measure.mjs)
 *   node scripts/perf/explain-queries.mjs             report: per statement shape, calls, mean time,
 *                                                     rows examined per call, scans without an index;
 *                                                     EXPLAIN for each SELECT that scanned without an
 *                                                     index or examined over 1,000 rows a call
 *
 * Connection from DATABASE_HOST/PORT/USER/PASSWORD/NAME; the user needs
 * access to performance_schema (root on the local CI container).
 */
import mysql from 'mysql2/promise'

const env = process.env
if (!['127.0.0.1', 'localhost', '::1'].includes(env.DATABASE_HOST ?? '')) throw new Error('explain-queries: local databases only')
if (!/^lcapix_t_/.test(env.DATABASE_NAME ?? '')) throw new Error('explain-queries: throwaway lcapix_t_* databases only')
const conn = await mysql.createConnection({ host: env.DATABASE_HOST, port: Number(env.DATABASE_PORT || 3306), user: env.DATABASE_USER, password: env.DATABASE_PASSWORD, database: env.DATABASE_NAME })

if (process.argv.includes('--reset')) {
  await conn.query('TRUNCATE TABLE performance_schema.events_statements_summary_by_digest')
  await conn.query('TRUNCATE TABLE performance_schema.prepared_statements_instances')
  console.log('statement statistics cleared')
  await conn.end()
  process.exit(0)
}

const [rows] = await conn.query(
  `SELECT DIGEST_TEXT AS shape, QUERY_SAMPLE_TEXT AS sample, COUNT_STAR AS calls,
          ROUND(AVG_TIMER_WAIT / 1e9, 2) AS mean_ms, ROUND(MAX_TIMER_WAIT / 1e9, 1) AS max_ms,
          ROUND(SUM_ROWS_EXAMINED / COUNT_STAR) AS examined, ROUND(SUM_ROWS_SENT / COUNT_STAR) AS sent,
          SUM_NO_INDEX_USED AS no_index, SUM_NO_GOOD_INDEX_USED AS no_good_index, SUM_CREATED_TMP_DISK_TABLES AS tmp_disk
     FROM performance_schema.events_statements_summary_by_digest
    WHERE SCHEMA_NAME = ? AND DIGEST_TEXT IS NOT NULL
      AND DIGEST_TEXT NOT LIKE 'SHOW%' AND DIGEST_TEXT NOT LIKE 'SET%' AND DIGEST_TEXT NOT LIKE '%performance_schema%'
    ORDER BY SUM_TIMER_WAIT DESC`,
  [env.DATABASE_NAME],
)

const short = (s, n = 150) => String(s).replace(/\s+/g, ' ').slice(0, n)
console.log(`${rows.length} statement shapes ran on ${env.DATABASE_NAME}`)
console.log('calls  mean ms  max ms  examined/call  sent/call  no-index  shape')
for (const r of rows.slice(0, 40)) {
  console.log(`${String(r.calls).padStart(5)}  ${String(r.mean_ms).padStart(7)}  ${String(r.max_ms).padStart(6)}  ${String(r.examined).padStart(13)}  ${String(r.sent).padStart(9)}  ${String(r.no_index).padStart(8)}  ${short(r.shape)}`)
}

// Prepared statements, one row per statement text (mysql2 prepares per connection).
const [prep] = await conn.query(
  `SELECT SQL_TEXT AS shape, SUM(COUNT_EXECUTE) AS calls,
          ROUND(SUM(SUM_TIMER_EXECUTE) / GREATEST(SUM(COUNT_EXECUTE), 1) / 1e9, 2) AS mean_ms,
          ROUND(MAX(MAX_TIMER_EXECUTE) / 1e9, 1) AS max_ms,
          ROUND(SUM(SUM_ROWS_EXAMINED) / GREATEST(SUM(COUNT_EXECUTE), 1)) AS examined,
          ROUND(SUM(SUM_ROWS_SENT) / GREATEST(SUM(COUNT_EXECUTE), 1)) AS sent,
          SUM(SUM_NO_INDEX_USED) AS no_index
     FROM performance_schema.prepared_statements_instances
    WHERE COUNT_EXECUTE > 0
    GROUP BY SQL_TEXT
    ORDER BY SUM(SUM_TIMER_EXECUTE) DESC`,
)
console.log(`\n${prep.length} prepared statements ran`)
console.log('calls  mean ms  max ms  examined/call  sent/call  no-index  statement')
for (const r of prep.slice(0, 40)) {
  console.log(`${String(r.calls).padStart(5)}  ${String(r.mean_ms).padStart(7)}  ${String(r.max_ms).padStart(6)}  ${String(r.examined).padStart(13)}  ${String(r.sent).padStart(9)}  ${String(r.no_index).padStart(8)}  ${short(r.shape)}`)
}

const suspects = rows.filter((r) => /^SELECT/i.test(r.shape) && (Number(r.no_index) > 0 || Number(r.examined) > 1000))
console.log(`\n${suspects.length} SELECT shapes scanned without an index or examined over 1,000 rows a call`)
for (const r of suspects) {
  console.log(`\n── ${r.calls} calls, ${r.mean_ms} ms mean, ${r.examined} rows examined/call, ${r.sent} sent/call\n   ${short(r.shape, 400)}`)
  if (!r.sample || /\.\.\.$/.test(r.sample)) {
    console.log('   (no complete sample to EXPLAIN)')
    continue
  }
  try {
    const [plan] = await conn.query(`EXPLAIN ${r.sample}`)
    for (const p of plan) console.log(`   ${String(p.table).padEnd(14)} type=${String(p.type).padEnd(7)} key=${String(p.key).padEnd(28)} rows=${String(p.rows).padStart(6)} filtered=${p.filtered} ${p.Extra ?? ''}`)
  } catch (e) {
    console.log(`   EXPLAIN failed: ${e.code ?? e.message}`)
  }
}
// A prepared statement's text keeps its ? marks: EXPLAIN it as a prepared
// statement with every parameter bound to 1. The plan's access path (index or
// full scan) is what is checked; the literal values barely move it.
const prepSuspects = prep.filter((r) => /^\s*SELECT/i.test(r.shape) && (Number(r.no_index) > 0 || Number(r.examined) > 1000))
console.log(`\n${prepSuspects.length} prepared SELECTs scanned without an index or examined over 1,000 rows a call`)
for (const r of prepSuspects) {
  console.log(`\n── ${r.calls} calls, ${r.mean_ms} ms mean, ${r.examined} rows examined/call, ${r.sent} sent/call, ${r.no_index} without an index\n   ${short(r.shape, 400)}`)
  const n = (String(r.shape).match(/\?/g) ?? []).length
  try {
    await conn.query('PREPARE perf_explain FROM ?', [`EXPLAIN ${r.shape}`])
    await conn.query(`SET ${Array.from({ length: Math.max(n, 1) }, (_, i) => `@p${i} = 1`).join(', ')}`)
    const [plan] = await conn.query(n ? `EXECUTE perf_explain USING ${Array.from({ length: n }, (_, i) => `@p${i}`).join(', ')}` : 'EXECUTE perf_explain')
    for (const p of plan) console.log(`   ${String(p.table).padEnd(14)} type=${String(p.type).padEnd(7)} key=${String(p.key).padEnd(28)} rows=${String(p.rows).padStart(6)} filtered=${p.filtered} ${p.Extra ?? ''}`)
    await conn.query('DEALLOCATE PREPARE perf_explain')
  } catch (e) {
    console.log(`   EXPLAIN failed: ${e.code ?? e.message}`)
  }
}
await conn.end()
