#!/usr/bin/env node
/**
 * Deploy gate: fail a production build when the database it will run against
 * was not built from this baseline (db/pg/000-schema.sql, 001-reference.sql)
 * or lacks a numbered migration from db/pg/migrations. Read-only (one SELECT on
 * schema_migrations); it never applies anything. Applying stays a person's
 * step: scripts/db/migrate.mjs, before the merge (docs/release).
 *
 * Runs as the first half of `pnpm vercel-build`, so it uses the deployment's
 * own DATABASE_URL (or DATABASE_* variables) and network path. Off Vercel it
 * does nothing unless --force is given (a local or CI build has no real database).
 *
 *   VERCEL_ENV=production  pending or missing ledger → exit 1, the deploy stops
 *   VERCEL_ENV=preview     the same findings, printed, exit 0
 *   node --env-file=.env.local scripts/db/check-migrations.mjs --force    check any database now
 */
import pg from 'pg'
import { baselineEntries, connectionFromEnv, listMigrations, MIGRATIONS_DIR, planMigrations } from './migrate.mjs'

const force = process.argv.includes('--force')
const onVercel = process.env.VERCEL === '1'
const strict = force || process.env.VERCEL_ENV === 'production'

if (!onVercel && !force) {
  console.log('[migrations] not a Vercel build: skipped (pass --force to check a database)')
  process.exit(0)
}

const say = (s) => console.log(`[migrations] ${s}`)
const stop = (s) => {
  console.error(`[migrations] ${s}`)
  process.exit(strict ? 1 : 0)
}

const conn = connectionFromEnv()
if (!conn) stop(`cannot check: neither DATABASE_URL nor DATABASE_NAME is set for ${process.env.VERCEL_ENV ?? 'this'} build`)

const files = [...baselineEntries(), ...listMigrations(MIGRATIONS_DIR)]
let rows
try {
  const client = new pg.Client({ ...conn.config, connectionTimeoutMillis: 15_000 })
  await client.connect()
  ;({ rows } = await client.query('SELECT filename, checksum FROM schema_migrations'))
  await client.end()
} catch (e) {
  stop(e?.code === '42P01' ? `${conn.database} has no schema_migrations ledger: it was not built from db/pg (scripts/db/fresh.mjs, or the load)` : `cannot read the ledger (${e?.code ?? e?.message})`)
}

const plan = planMigrations(files, new Map(rows.map((r) => [r.filename, r.checksum])))
for (const f of plan.changed) say(`note: ${f.filename} differs from the recorded copy (not re-run; new data changes need a new number)`)
const baseline = new Set(baselineEntries().map((b) => b.filename))
const noBase = plan.pending.filter((f) => baseline.has(f.filename))
if (noBase.length) stop(`${conn.database} does not record ${noBase.map((f) => f.filename).join(', ')}: it was not built from db/pg (scripts/db/fresh.mjs, or the load with --record-baseline)`)
if (plan.pending.length) stop(`${plan.pending.length} migration(s) not on ${conn.database}: ${plan.pending.map((f) => f.filename).join(', ')}. Apply them (scripts/db/migrate.mjs), then redeploy.`)
say(`all ${files.length} migrations are on ${conn.database}`)
