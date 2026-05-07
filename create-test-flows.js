/**
 * Script to create test environmental flows for components
 * This bridges the gap between UI driver configuration and database flows
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function createTestFlows() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    user: process.env.DATABASE_USER || 'lcaadmin',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'lca_v3',
    port: parseInt(process.env.DATABASE_PORT || '3307')
  });

  console.log('\n🔬 Creating Test Environmental Flows\n');

  try {
    // Get all components
    const [components] = await connection.query(`
      SELECT component_id, component_name, hierarchy_level
      FROM component
      ORDER BY hierarchy_level
    `);

    console.log(`Found ${components.length} components\n`);

    // Get substance IDs for common materials
    const [substances] = await connection.query(`
      SELECT substance_id, substance_name, cas_number
      FROM substances
      WHERE substance_name IN (
        'Carbon dioxide', 'Electricity', 'Steel', 'Aluminum',
        'Natural gas', 'Water', 'Methane', 'Nitrogen oxides'
      )
    `);

    const substanceMap = {};
    substances.forEach(s => {
      substanceMap[s.substance_name] = s.substance_id;
    });

    console.log('Available substances:', Object.keys(substanceMap).join(', '), '\n');

    // Create flows for each component
    let flowsCreated = 0;

    for (const component of components) {
      // Delete existing flows for this component
      await connection.query(`
        DELETE FROM flows WHERE component_id = ?
      `, [component.component_id]);

      // Create 2-3 flows per component based on hierarchy level
      const flows = [];

      if (component.hierarchy_level <= 3) {
        // High-level components: energy and materials
        flows.push({
          component_id: component.component_id,
          substance_id: substanceMap['Electricity'],
          flow_type: 'input',
          quantity: Math.random() * 50 + 10, // 10-60 kWh
          unit: 'kWh',
          is_driver: true,
          driver_description: 'Electricity consumption'
        });

        flows.push({
          component_id: component.component_id,
          substance_id: substanceMap['Carbon Dioxide'],
          flow_type: 'output',
          quantity: Math.random() * 20 + 5, // 5-25 kg
          unit: 'kg',
          is_driver: true,
          driver_description: 'CO2 emissions'
        });
      }

      if (component.hierarchy_level >= 3) {
        // Lower-level components: materials and emissions
        flows.push({
          component_id: component.component_id,
          substance_id: substanceMap['Natural Gas'],
          flow_type: 'input',
          quantity: Math.random() * 10 + 1, // 1-11 m3
          unit: 'm3',
          is_driver: true,
          driver_description: 'Natural gas consumption'
        });

        flows.push({
          component_id: component.component_id,
          substance_id: substanceMap['Nitrogen Oxides'],
          flow_type: 'output',
          quantity: Math.random() * 0.5 + 0.1, // 0.1-0.6 kg
          unit: 'kg',
          is_driver: true,
          driver_description: 'NOx emissions'
        });
      }

      // Insert flows
      for (const flow of flows) {
        if (!flow.substance_id) continue; // Skip if substance not found

        await connection.query(`
          INSERT INTO flows (
            component_id, substance_id, flow_type,
            quantity, unit, is_driver, driver_description
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          flow.component_id,
          flow.substance_id,
          flow.flow_type,
          flow.quantity,
          flow.unit,
          flow.is_driver,
          flow.driver_description
        ]);

        flowsCreated++;
      }

      console.log(`✓ Created ${flows.length} flows for: ${component.component_name}`);
    }

    console.log(`\n✅ Successfully created ${flowsCreated} environmental flows!\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
createTestFlows()
  .then(() => {
    console.log('✅ Test flows creation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to create test flows:', error);
    process.exit(1);
  });
