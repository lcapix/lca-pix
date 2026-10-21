#!/usr/bin/env node
/**
 * Deploy gate: fail a production build when a numbered migration in the repo
 * has not reached the database it will run against. Read-only (one SELECT on
 * schema_migrations); it never applies anything. Applying stays a person's
 * step: scripts/db/migrate.mjs, before the merge (docs/runbook).
 *
 * Runs as the first half of `pnpm vercel-build`, so it uses the deployment's
 * own DATABASE_* variables and network path. Off Vercel it does nothing unless
 * --force is given (a local or CI build has no real database).
 *
 *   VERCEL_ENV=production  pending or missing ledger → exit 1, the deploy stops
 *   VERCEL_ENV=preview     the same findings, printed, exit 0
 *   node --env-file=.env.local scripts/db/check-migrations.mjs --force    check any database now
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { listMigrations, planMigrations } from './migrate.mjs'

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

const env = process.env
const missing = ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_NAME'].filter((k) => !env[k]).concat(env.DATABASE_PASSWORD === undefined ? ['DATABASE_PASSWORD'] : [])
if (missing.length) stop(`cannot check: ${missing.join(', ')} not set for ${env.VERCEL_ENV ?? 'this'} build`)

const files = listMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'))
let rows
try {
  const conn = await mysql.createConnection({
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT || 3306),
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    connectTimeout: 15_000,
    ...((env.DATABASE_SSL ?? '').toLowerCase() === 'true' ? { ssl: { rejectUnauthorized: true, ...(env.DATABASE_SSL_CA?.startsWith('-----BEGIN') ? { ca: env.DATABASE_SSL_CA } : {}) } } : {}),
  })
  ;[rows] = await conn.query('SELECT filename, checksum FROM schema_migrations')
  await conn.end()
} catch (e) {
  stop(e?.code === 'ER_NO_SUCH_TABLE' ? `${env.DATABASE_NAME} has no schema_migrations ledger: run scripts/db/migrate.mjs there first` : `cannot read the ledger (${e?.code ?? e?.message})`)
}

const plan = planMigrations(files, new Map(rows.map((r) => [r.filename, r.checksum])))
for (const f of plan.changed) say(`note: ${f.filename} differs from the recorded copy (not re-run; new data changes need a new number)`)
if (plan.pending.length) stop(`${plan.pending.length} migration(s) not on ${env.DATABASE_NAME}: ${plan.pending.map((f) => f.filename).join(', ')}. Apply them (scripts/db/migrate.mjs), then redeploy.`)
say(`all ${files.length} migrations are on ${env.DATABASE_NAME}`)
