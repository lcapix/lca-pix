const mysql = require('mysql2/promise');

async function checkFlows() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  console.log('🔍 Checking flows for case_id=1 components:\n');

  // Check components in case 1
  const [components] = await connection.query(`
    SELECT component_id, component_name, component_type
    FROM component
    WHERE case_id = 1
    ORDER BY component_id
  `);

  console.log(`Found ${components.length} components:\n`);

  for (const comp of components) {
    const [flows] = await connection.query(`
      SELECT f.*, s.substance_name
      FROM flows f
      JOIN substances s ON f.substance_id = s.substance_id
      WHERE f.component_id = ?
    `, [comp.component_id]);

    console.log(`Component ${comp.component_id}: ${comp.component_name} (${comp.component_type})`);
    if (flows.length > 0) {
      console.log(`  ✅ ${flows.length} flow(s):`);
      flows.forEach(f => {
        console.log(`     - ${f.substance_name}: ${f.quantity} ${f.unit} (${f.flow_type}, driver=${f.is_driver})`);
      });
    } else {
      console.log(`  ❌ NO FLOWS`);
    }
    console.log();
  }

  await connection.end();
}

checkFlows().catch(console.error);
