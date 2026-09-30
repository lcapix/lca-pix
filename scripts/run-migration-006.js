#!/usr/bin/env node
// scripts/run-migration-006.js — run 006_api_integrations.sql against the database named by DATABASE_* env vars

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.resolve(__dirname, '../database/migrations/006_api_integrations.sql');

// Connection settings come only from the environment: no hard-coded host,
// user or password. Load them first, e.g.  set -a; source .env.local; set +a
function dbConfigFromEnv() {
  const missing = ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_NAME'].filter((k) => !process.env[k]);
  if (process.env.DATABASE_PASSWORD === undefined) missing.push('DATABASE_PASSWORD');
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
  return {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  };
}

async function main() {
  const conn = await mysql.createConnection({ ...dbConfigFromEnv(), multipleStatements: true });

  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
    )
    .filter(s => s.length > 0);

  let ok = 0, skipped = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      ok++;
      console.log('✓', stmt.substring(0, 60).replace(/\s+/g, ' ') + '...');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME') {
        skipped++;
        console.log('- (skip, already exists)', stmt.substring(0, 60).replace(/\s+/g, ' '));
      } else {
        console.error('✗', e.message);
        throw e;
      }
    }
  }
  console.log(`\nDone. ${ok} applied, ${skipped} skipped.`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
