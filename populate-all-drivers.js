const mysql = require('mysql2/promise');

async function populateAllDrivers() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  console.log('🔧 Populating driver data for ALL components in case_id=1...\n');

  try {
    // 1. EV Battery Pack (60 kWh) - Product
    await connection.query(`
      UPDATE component
      SET driver_category = 'Materials',
          driver_type = 'Steel (kg)',
          drivers = JSON_ARRAY('Steel (kg)'),
          process_type = component_type,
          quantity = 500.0,
          unit = 'kg',
          opex = 100000.00,
          capex = 1000000.00
      WHERE component_name = 'EV Battery Pack (60 kWh)'
        AND component_type = 'product'
        AND case_id = 1
    `);
    console.log('✅ Updated: EV Battery Pack (60 kWh) - Materials/Steel (kg)');

    // 2. Cell Assembly Line - Machine/Line
    await connection.query(`
      UPDATE component
      SET driver_category = 'Energy',
          driver_type = 'Electricity (kWh)',
          drivers = JSON_ARRAY('Electricity (kWh)'),
          process_type = component_type,
          quantity = 5000.0,
          unit = 'kWh',
          opex = 50000.00,
          capex = 500000.00
      WHERE component_name = 'Cell Assembly Line'
        AND component_type = 'machine_line'
        AND case_id = 1
    `);
    console.log('✅ Updated: Cell Assembly Line - Energy/Electricity (kWh)');

    // 3. Electrode Coating Process - Subprocess
    await connection.query(`
      UPDATE component
      SET driver_category = 'Materials',
          driver_type = 'Aluminum (kg)',
          drivers = JSON_ARRAY('Aluminum (kg)'),
          process_type = component_type,
          quantity = 200.0,
          unit = 'kg',
          opex = 25000.00,
          capex = 100000.00
      WHERE component_name = 'Electrode Coating Process'
        AND component_type = 'subprocess'
        AND case_id = 1
    `);
    console.log('✅ Updated: Electrode Coating Process - Materials/Aluminum (kg)');

    // 4. Drying Operation - Operation
    await connection.query(`
      UPDATE component
      SET driver_category = 'Energy',
          driver_type = 'Natural Gas (MJ)',
          drivers = JSON_ARRAY('Natural Gas (MJ)'),
          process_type = component_type,
          quantity = 1500.0,
          unit = 'MJ',
          opex = 10000.00,
          capex = 20000.00
      WHERE component_name = 'Drying Operation'
        AND component_type = 'operation'
        AND case_id = 1
    `);
    console.log('✅ Updated: Drying Operation - Energy/Natural Gas (MJ)');

    // 5. Oven Heating Task already has data, but let's ensure it's correct
    await connection.query(`
      UPDATE component
      SET driver_category = 'Energy',
          driver_type = 'Electricity (kWh)',
          drivers = JSON_ARRAY('Electricity (kWh)'),
          process_type = component_type,
          quantity = 250.5,
          unit = 'kWh',
          opex = 10000.00,
          capex = 20000.00
      WHERE component_name = 'Oven Heating Task'
        AND component_type = 'elemental_task'
        AND case_id = 1
    `);
    console.log('✅ Updated: Oven Heating Task - Energy/Electricity (kWh)');

    console.log('\n📊 Verifying all updates:\n');

    // Verify the updates
    const [components] = await connection.query(`
      SELECT component_id, component_name, component_type,
             driver_category, driver_type, drivers,
             quantity, unit, opex, capex
      FROM component
      WHERE case_id = 1
      ORDER BY component_id
    `);

    console.table(components);

    console.log('\n✅ All components now have driver data!');

  } catch (error) {
    console.error('❌ Error updating components:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

populateAllDrivers().catch(console.error);
