/**
 * Setup Assessment Data for Nutroleum vs Petroleum Jelly Project
 *
 * This script adds:
 * 1. Substances (raw materials, emissions)
 * 2. Characterization factors (impact per substance)
 * 3. Environmental flows for all elemental tasks
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function setupAssessmentData() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    user: process.env.DATABASE_USER || 'lcaadmin',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'lca_v3',
    port: parseInt(process.env.DATABASE_PORT || '3307')
  });

  console.log('\n🔧 Setting up Assessment Data for LCA Calculations\n');
  console.log('='.repeat(60) + '\n');

  try {
    // ========================================
    // STEP 1: Add Substances
    // ========================================
    console.log('📦 Step 1: Adding substances...\n');

    const substances = [
      [1, 'Electricity, medium voltage', 'resource', 'kWh', 'Grid electricity mix'],
      [2, 'Carbon Dioxide', 'emission', 'kg', 'CO2 emissions to air'],
      [3, 'Glycerin', 'resource', 'kg', 'Glycerin raw material'],
      [4, 'Beeswax', 'resource', 'kg', 'Natural beeswax'],
      [5, 'Glucoside', 'resource', 'kg', 'Alkyl polyglucoside stabilizer'],
      [6, 'Natural Gas', 'resource', 'kg', 'Natural gas fuel'],
      [7, 'Water', 'resource', 'kg', 'Process water'],
      [8, 'Plastic (PET)', 'resource', 'kg', 'PET plastic for containers'],
      [9, 'Petroleum Wax', 'resource', 'kg', 'Petroleum-based wax'],
      [10, 'Mineral Oil', 'resource', 'kg', 'Mineral oil base'],
      [11, 'Methane', 'emission', 'kg', 'CH4 emissions to air'],
      [12, 'Nitrogen Oxides', 'emission', 'kg', 'NOx emissions to air'],
      [13, 'Sulfur Dioxide', 'emission', 'kg', 'SO2 emissions to air'],
      [14, 'Cardboard', 'resource', 'kg', 'Cardboard packaging'],
      [15, 'Label Paper', 'resource', 'kg', 'Label material']
    ];

    for (const sub of substances) {
      await conn.execute(`
        INSERT IGNORE INTO substances (substance_id, substance_name, category, unit, description)
        VALUES (?, ?, ?, ?, ?)
      `, sub);
    }
    console.log(`   ✓ Added/verified ${substances.length} substances\n`);

    // ========================================
    // STEP 2: Add Impact Categories
    // ========================================
    console.log('🌍 Step 2: Adding impact categories...\n');

    const categories = [
      [1, 'Global Warming Potential', 'GWP', 'kg CO2 eq', 'Climate change impact'],
      [2, 'Acidification Potential', 'AP', 'kg SO2 eq', 'Acid rain potential'],
      [3, 'Eutrophication Potential', 'EP', 'kg PO4 eq', 'Water nutrient enrichment'],
      [4, 'Photochemical Ozone Creation', 'POCP', 'kg C2H4 eq', 'Smog formation'],
      [5, 'Abiotic Depletion', 'ADP', 'kg Sb eq', 'Resource depletion']
    ];

    for (const cat of categories) {
      await conn.execute(`
        INSERT IGNORE INTO impact_categories (category_id, category_name, abbreviation, unit, description)
        VALUES (?, ?, ?, ?, ?)
      `, cat);
    }
    console.log(`   ✓ Added/verified ${categories.length} impact categories\n`);

    // ========================================
    // STEP 3: Add Characterization Factors
    // ========================================
    console.log('📊 Step 3: Adding characterization factors...\n');

    const factors = [
      // Electricity (all categories)
      [1, 1, 0.5, 'kg CO2 eq / kWh'],      // GWP
      [1, 2, 0.003, 'kg SO2 eq / kWh'],    // AP
      [1, 3, 0.0002, 'kg PO4 eq / kWh'],   // EP
      [1, 5, 0.0000054, 'kg Sb eq / kWh'], // ADP

      // CO2
      [2, 1, 1.0, 'kg CO2 eq / kg'],       // GWP

      // Glycerin
      [3, 1, 0.8, 'kg CO2 eq / kg'],       // GWP
      [3, 5, 0.001, 'kg Sb eq / kg'],      // ADP

      // Beeswax (natural, lower impact)
      [4, 1, 0.3, 'kg CO2 eq / kg'],       // GWP
      [4, 5, 0.0005, 'kg Sb eq / kg'],     // ADP

      // Glucoside
      [5, 1, 1.2, 'kg CO2 eq / kg'],       // GWP
      [5, 3, 0.001, 'kg PO4 eq / kg'],     // EP

      // Natural Gas
      [6, 1, 2.75, 'kg CO2 eq / kg'],      // GWP
      [6, 2, 0.001, 'kg SO2 eq / kg'],     // AP
      [6, 5, 0.02, 'kg Sb eq / kg'],       // ADP

      // Water
      [7, 5, 0.00001, 'kg Sb eq / kg'],    // ADP (minimal)

      // PET Plastic
      [8, 1, 3.4, 'kg CO2 eq / kg'],       // GWP
      [8, 5, 0.05, 'kg Sb eq / kg'],       // ADP

      // Petroleum Wax (fossil-based, higher impact)
      [9, 1, 2.5, 'kg CO2 eq / kg'],       // GWP
      [9, 5, 0.03, 'kg Sb eq / kg'],       // ADP

      // Mineral Oil (fossil-based)
      [10, 1, 2.8, 'kg CO2 eq / kg'],      // GWP
      [10, 5, 0.035, 'kg Sb eq / kg'],     // ADP

      // Methane
      [11, 1, 28.0, 'kg CO2 eq / kg'],     // GWP (100-year)

      // NOx
      [12, 1, 0.0, 'kg CO2 eq / kg'],      // GWP (indirect)
      [12, 2, 0.7, 'kg SO2 eq / kg'],      // AP
      [12, 3, 0.13, 'kg PO4 eq / kg'],     // EP
      [12, 4, 0.028, 'kg C2H4 eq / kg'],   // POCP

      // SO2
      [13, 2, 1.0, 'kg SO2 eq / kg'],      // AP

      // Cardboard
      [14, 1, 0.9, 'kg CO2 eq / kg'],      // GWP
      [14, 5, 0.008, 'kg Sb eq / kg'],     // ADP

      // Label Paper
      [15, 1, 1.1, 'kg CO2 eq / kg'],      // GWP
      [15, 5, 0.01, 'kg Sb eq / kg']       // ADP
    ];

    for (const factor of factors) {
      await conn.execute(`
        INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit)
        VALUES (?, ?, ?, ?)
      `, factor);
    }
    console.log(`   ✓ Added/verified ${factors.length} characterization factors\n`);

    // ========================================
    // STEP 4: Get all elemental tasks for both cases
    // ========================================
    console.log('🔍 Step 4: Finding elemental tasks...\n');

    const [petroleumTasks] = await conn.query(`
      SELECT component_id, component_name, energy_cost, material_cost, labor_cost
      FROM component
      WHERE case_id = 21 AND component_type = 'elemental_task'
      ORDER BY component_id
    `);

    const [nutroleumTasks] = await conn.query(`
      SELECT component_id, component_name, energy_cost, material_cost, labor_cost
      FROM component
      WHERE case_id = 22 AND component_type = 'elemental_task'
      ORDER BY component_id
    `);

    console.log(`   Found ${petroleumTasks.length} Petroleum Jelly elemental tasks`);
    console.log(`   Found ${nutroleumTasks.length} Nutroleum elemental tasks\n`);

    // ========================================
    // STEP 5: Create flows for Petroleum Jelly
    // ========================================
    console.log('⚡ Step 5: Creating flows for Petroleum Jelly...\n');

    // Clear existing flows for case 21
    await conn.execute(`
      DELETE FROM flows WHERE component_id IN (
        SELECT component_id FROM component WHERE case_id = 21
      )
    `);

    let petroleumFlowCount = 0;

    for (const task of petroleumTasks) {
      const flows = [];
      const energyCost = parseFloat(task.energy_cost) || 0;
      const materialCost = parseFloat(task.material_cost) || 0;
      const name = task.component_name.toLowerCase();

      // Energy-based flows (convert cost to kWh assuming $0.12/kWh)
      if (energyCost > 0) {
        const kWh = energyCost / 0.12;
        flows.push([task.component_id, 1, 'input', kWh, 'kWh', true, 'Electricity consumption']);
        // CO2 emission from electricity (indirect)
        flows.push([task.component_id, 2, 'output', kWh * 0.4, 'kg', true, 'CO2 from electricity']);
      }

      // Material-based flows
      if (materialCost > 0 || name.includes('wax') || name.includes('oil')) {
        if (name.includes('wax')) {
          // Petroleum wax at ~$2/kg
          const qty = materialCost > 0 ? materialCost / 2 : 0.05;
          flows.push([task.component_id, 9, 'input', qty, 'kg', true, 'Petroleum wax']);
        } else if (name.includes('oil')) {
          // Mineral oil at ~$1.5/kg
          const qty = materialCost > 0 ? materialCost / 1.5 : 0.04;
          flows.push([task.component_id, 10, 'input', qty, 'kg', true, 'Mineral oil']);
        } else if (name.includes('jar') || name.includes('container')) {
          // PET plastic at ~$2/kg
          const qty = materialCost > 0 ? materialCost / 2 : 0.02;
          flows.push([task.component_id, 8, 'input', qty, 'kg', true, 'PET container']);
        } else if (name.includes('label')) {
          // Label paper
          const qty = materialCost > 0 ? materialCost / 3 : 0.005;
          flows.push([task.component_id, 15, 'input', qty, 'kg', true, 'Label material']);
        } else if (name.includes('carton') || name.includes('wrap')) {
          // Cardboard
          const qty = materialCost > 0 ? materialCost / 1.5 : 0.01;
          flows.push([task.component_id, 14, 'input', qty, 'kg', true, 'Cardboard packaging']);
        }
      }

      // Default electricity flow if task has no specific flows
      if (flows.length === 0) {
        flows.push([task.component_id, 1, 'input', 0.01, 'kWh', true, 'Base electricity']);
      }

      // Insert flows
      for (const flow of flows) {
        await conn.execute(`
          INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, flow);
        petroleumFlowCount++;
      }
    }

    console.log(`   ✓ Created ${petroleumFlowCount} flows for Petroleum Jelly\n`);

    // ========================================
    // STEP 6: Create flows for Nutroleum
    // ========================================
    console.log('🌿 Step 6: Creating flows for Nutroleum...\n');

    // Clear existing flows for case 22
    await conn.execute(`
      DELETE FROM flows WHERE component_id IN (
        SELECT component_id FROM component WHERE case_id = 22
      )
    `);

    let nutroleumFlowCount = 0;

    for (const task of nutroleumTasks) {
      const flows = [];
      const energyCost = parseFloat(task.energy_cost) || 0;
      const materialCost = parseFloat(task.material_cost) || 0;
      const name = task.component_name.toLowerCase();

      // Energy-based flows
      if (energyCost > 0) {
        const kWh = energyCost / 0.12;
        flows.push([task.component_id, 1, 'input', kWh, 'kWh', true, 'Electricity consumption']);
        flows.push([task.component_id, 2, 'output', kWh * 0.4, 'kg', true, 'CO2 from electricity']);
      }

      // Material-based flows
      if (materialCost > 0 || name.includes('glycerin') || name.includes('beeswax') || name.includes('glucoside')) {
        if (name.includes('glycerin')) {
          const qty = materialCost > 0 ? materialCost / 4 : 0.025;
          flows.push([task.component_id, 3, 'input', qty, 'kg', true, 'Glycerin']);
        }
        if (name.includes('beeswax')) {
          const qty = materialCost > 0 ? materialCost / 18 : 0.015;
          flows.push([task.component_id, 4, 'input', qty, 'kg', true, 'Beeswax']);
        }
        if (name.includes('glucoside') || name.includes('stabilizer')) {
          const qty = materialCost > 0 ? materialCost / 10 : 0.01;
          flows.push([task.component_id, 5, 'input', qty, 'kg', true, 'Glucoside']);
        }
        if (name.includes('lid') || name.includes('jar')) {
          const qty = materialCost > 0 ? materialCost / 2 : 0.025;
          flows.push([task.component_id, 8, 'input', qty, 'kg', true, 'PET container/lid']);
        }
        if (name.includes('label')) {
          const qty = materialCost > 0 ? materialCost / 3 : 0.008;
          flows.push([task.component_id, 15, 'input', qty, 'kg', true, 'Label material']);
        }
      }

      // Default electricity flow
      if (flows.length === 0) {
        flows.push([task.component_id, 1, 'input', 0.01, 'kWh', true, 'Base electricity']);
      }

      // Insert flows
      for (const flow of flows) {
        await conn.execute(`
          INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, flow);
        nutroleumFlowCount++;
      }
    }

    console.log(`   ✓ Created ${nutroleumFlowCount} flows for Nutroleum\n`);

    // ========================================
    // STEP 7: Verification
    // ========================================
    console.log('✅ Step 7: Verification...\n');

    const [petroleumFlows] = await conn.query(`
      SELECT COUNT(*) as count FROM flows f
      JOIN component c ON f.component_id = c.component_id
      WHERE c.case_id = 21 AND f.is_driver = TRUE
    `);

    const [nutroleumFlows] = await conn.query(`
      SELECT COUNT(*) as count FROM flows f
      JOIN component c ON f.component_id = c.component_id
      WHERE c.case_id = 22 AND f.is_driver = TRUE
    `);

    console.log(`   Petroleum Jelly: ${petroleumFlows[0].count} driver flows`);
    console.log(`   Nutroleum: ${nutroleumFlows[0].count} driver flows\n`);

    console.log('='.repeat(60));
    console.log('\n🎉 Assessment data setup complete!\n');
    console.log('You can now run assessments for both cases.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
}

// Run the setup
setupAssessmentData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
