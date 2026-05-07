const mysql = require('mysql2/promise');

async function updateTestData() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  console.log('🔧 Updating "Oven Heating Task" with driver data...\n');

  // First check current data
  const [before] = await connection.query(`
    SELECT component_id, component_name, component_type, driver_category, driver_type, drivers, quantity, unit, opex, capex
    FROM component
    WHERE component_name = 'Oven Heating Task'
  `);

  console.log('Before update:');
  console.table(before);

  if (before.length === 0) {
    console.log('\n❌ ERROR: Oven Heating Task not found in database');
    await connection.end();
    return;
  }

  // Update with driver information
  await connection.query(`
    UPDATE component
    SET driver_category = 'Energy',
        driver_type = 'Electricity (kWh)',
        drivers = JSON_ARRAY('Electricity (kWh)'),
        process_type = component_type,
        unit = 'kWh',
        quantity = 250.5
    WHERE component_name = 'Oven Heating Task'
      AND component_type = 'elemental_task'
  `);

  console.log('\n✅ Update completed!\n');

  // Check after update
  const [after] = await connection.query(`
    SELECT component_id, component_name, component_type, driver_category, driver_type, drivers, quantity, unit, opex, capex, process_type
    FROM component
    WHERE component_name = 'Oven Heating Task'
  `);

  console.log('After update:');
  console.table(after);

  await connection.end();

  console.log('\n✨ Done! Driver data has been added to Oven Heating Task.');
}

updateTestData().catch(console.error);
