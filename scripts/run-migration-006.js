#!/usr/bin/env node
// scripts/run-migration-006.js — run 006_api_integrations.sql against AWS RDS via SSH tunnel

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.resolve(__dirname, '../database/migrations/006_api_integrations.sql');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3',
    multipleStatements: true,
  });

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
