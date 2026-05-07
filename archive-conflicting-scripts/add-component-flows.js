const mysql = require('mysql2/promise');

async function addComponentFlows() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  try {
    console.log('🔄 Adding environmental flows to components...\n');

    // Component 2: Cell Assembly Line (machine_line)
    // Typical industrial assembly line electricity consumption
    await connection.query(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver)
      VALUES
        (2, 1, 'input', 1500.0, 'kWh', TRUE),  -- Electricity for assembly line
        (2, 2, 'output', 750.0, 'kg', TRUE),   -- CO2 from electricity
        (2, 3, 'output', 15.0, 'kg', TRUE)     -- CH4 from electricity
      ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)
    `);
    console.log('✅ Component 2 (Cell Assembly Line): Added 3 driver flows');

    // Component 3: Electrode Coating Process (subprocess)
    // Coating process with aluminum and chemicals
    await connection.query(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver)
      VALUES
        (3, 1, 'input', 800.0, 'kWh', TRUE),    -- Electricity for coating
        (3, 7, 'input', 50.0, 'kg', TRUE),      -- Aluminum
        (3, 2, 'output', 400.0, 'kg', TRUE),    -- CO2 emissions
        (3, 5, 'output', 5.0, 'kg', TRUE)       -- NOx from heating
      ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)
    `);
    console.log('✅ Component 3 (Electrode Coating Process): Added 4 driver flows');

    // Component 4: Drying Operation (operation)
    // Natural gas heated drying process
    await connection.query(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver)
      VALUES
        (4, 8, 'input', 200.0, 'm3', TRUE),     -- Natural gas
        (4, 2, 'output', 380.0, 'kg', TRUE),    -- CO2 from combustion
        (4, 3, 'output', 3.0, 'kg', TRUE),      -- CH4 leakage
        (4, 5, 'output', 2.0, 'kg', TRUE)       -- NOx from combustion
      ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)
    `);
    console.log('✅ Component 4 (Drying Operation): Added 4 driver flows');

    console.log('\n📊 Verifying all components now have flows:\n');

    // Verify flows for all components
    const [components] = await connection.query(`
      SELECT
        c.component_id,
        c.component_name,
        c.component_type,
        COUNT(f.flow_id) as flow_count,
        SUM(CASE WHEN f.is_driver = 1 THEN 1 ELSE 0 END) as driver_count
      FROM component c
      LEFT JOIN flows f ON c.component_id = f.component_id
      WHERE c.case_id = 1
      GROUP BY c.component_id, c.component_name, c.component_type
      ORDER BY c.component_id
    `);

    components.forEach(comp => {
      const status = comp.flow_count > 0 ? '✅' : '❌';
      console.log(`${status} Component ${comp.component_id}: ${comp.component_name}`);
      console.log(`   Type: ${comp.component_type}`);
      console.log(`   Total flows: ${comp.flow_count} (${comp.driver_count} drivers)\n`);
    });

    console.log('✨ Flow addition complete!\n');

  } catch (error) {
    console.error('❌ Error adding flows:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addComponentFlows().catch(console.error);
