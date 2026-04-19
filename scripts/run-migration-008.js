#!/usr/bin/env node
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.resolve(__dirname, '../database/migrations/008_method_aware_unique.sql');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3307, user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3', multipleStatements: true,
  });
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  // Split on semicolons that end a line (handling comment lines per-statement).
  const statements = sql.split(/;\s*$/m)
    .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
  let ok = 0, skipped = 0;
  for (const stmt of statements) {
    try { await conn.query(stmt); ok++; console.log('✓', stmt.slice(0,60).replace(/\s+/g,' '),'...'); }
    catch (e) {
      if (['ER_DUP_FIELDNAME','ER_TABLE_EXISTS_ERROR','ER_DUP_KEYNAME'].includes(e.code)) {
        skipped++; console.log('- (skip, exists)', stmt.slice(0,60).replace(/\s+/g,' '));
      } else throw e;
    }
  }
  console.log(`\nDone. ${ok} applied, ${skipped} skipped.`);
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
