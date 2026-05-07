const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkComponents() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  const [components] = await connection.execute(`
    SELECT component_id, component_name, case_id, labor_cost, energy_cost, opex, capex
    FROM component
    WHERE case_id IN (1, 2, 3)
    ORDER BY case_id, component_id
  `);

  console.log('\n📊 Component Cost Data by Case:\n');

  let currentCase = null;
  components.forEach(comp => {
    if (comp.case_id !== currentCase) {
      currentCase = comp.case_id;
      console.log(`\n=== CASE ${comp.case_id} ===`);
    }
    console.log(`ID: ${comp.component_id} | ${comp.component_name}`);
    console.log(`  Labor: ${comp.labor_cost || 'NULL'}, Energy: ${comp.energy_cost || 'NULL'}, OpEx: ${comp.opex || 'NULL'}, CapEx: ${comp.capex || 'NULL'}`);
  });

  await connection.end();
}

checkComponents().catch(console.error);
