if (process.env.LCAPIX_ALLOW_LEGACY_SCRIPT !== '1') { console.error('Refusing to run: legacy script that can modify a live database. See ops/legacy-scripts/README.md (override: LCAPIX_ALLOW_LEGACY_SCRIPT=1).'); process.exit(1); }
const mysql = require('mysql2/promise');

async function checkTables() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: '<DB_PASSWORD>',
    database: 'lca_v3'
  });

  console.log('🔍 Checking LCA-related tables:\n');

  const requiredTables = ['substances', 'impact_categories', 'driver_impact_factors', 'flows'];

  for (const table of requiredTables) {
    try {
      const [rows] = await connection.query('SHOW TABLES LIKE ?', [table]);
      const exists = rows.length > 0;

      if (exists) {
        const [count] = await connection.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        console.log(`✅ ${table.padEnd(25)} EXISTS  (${count[0].cnt} rows)`);
      } else {
        console.log(`❌ ${table.padEnd(25)} MISSING`);
      }
    } catch (err) {
      console.log(`❌ ${table.padEnd(25)} ERROR: ${err.message}`);
    }
  }

  await connection.end();
}

checkTables().catch(console.error);
