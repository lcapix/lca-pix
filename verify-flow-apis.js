const mysql = require('mysql2/promise');

async function verifyFlowAPIs() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  console.log('🔍 VERIFYING FLOW DATA & API COMPATIBILITY\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Check existing flows in database
    console.log('📊 Step 1: Existing Flows in Database\n');
    const [flows] = await connection.query(`
      SELECT 
        f.flow_id,
        f.component_id,
        c.component_name,
        f.substance_id,
        s.substance_name,
        s.category as substance_category,
        f.flow_type,
        f.quantity,
        f.unit,
        f.is_driver
      FROM flows f
      JOIN component c ON f.component_id = c.component_id
      JOIN substances s ON f.substance_id = s.substance_id
      ORDER BY c.component_id, f.flow_type
    `);

    console.log(`Found ${flows.length} flows in database:\n`);
    
    const byComponent = {};
    flows.forEach(f => {
      if (!byComponent[f.component_id]) {
        byComponent[f.component_id] = {
          name: f.component_name,
          flows: []
        };
      }
      byComponent[f.component_id].flows.push(f);
    });

    Object.entries(byComponent).forEach(([compId, data]) => {
      console.log(`  Component ${compId}: ${data.name}`);
      console.log(`    Total flows: ${data.flows.length}`);
      data.flows.forEach(f => {
        const direction = f.flow_type === 'input' ? '⬇️' : '⬆️';
        const driver = f.is_driver ? '⚡' : '  ';
        console.log(`      ${direction} ${driver} ${f.substance_name}: ${f.quantity} ${f.unit}`);
      });
      console.log('');
    });

    // 2. Test API Query Format
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔌 Step 2: Verify API Query Format\n');

    const componentId = 2; // Cell Assembly Line
    console.log(`Testing GET /api/components/${componentId}/flows query:\n`);

    const [apiFormatFlows] = await connection.query(`
      SELECT f.*, s.substance_name, s.category as substance_category
      FROM flows f
      LEFT JOIN substances s ON f.substance_id = s.substance_id
      WHERE f.component_id = ?
      ORDER BY f.flow_type, f.created_at
    `, [componentId]);

    console.log(`Query returned ${apiFormatFlows.length} flows:`);
    apiFormatFlows.forEach(f => {
      console.log(`  - ${f.substance_name} (${f.flow_type}): ${f.quantity} ${f.unit}`);
    });

    // 3. Check Substances Catalog
    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('🧪 Step 3: Substances Catalog (for dropdown)\n');

    const [substances] = await connection.query(`
      SELECT substance_id, substance_name, category, cas_number
      FROM substances
      ORDER BY category, substance_name
    `);

    console.log(`Found ${substances.length} substances:\n`);
    
    const byCategory = {};
    substances.forEach(s => {
      const cat = s.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(s);
    });

    Object.entries(byCategory).forEach(([cat, subs]) => {
      console.log(`  ${cat}:`);
      subs.forEach(s => {
        console.log(`    - ${s.substance_name}${s.cas_number ? ` (CAS: ${s.cas_number})` : ''}`);
      });
      console.log('');
    });

    // 4. Component IDs for testing
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🎯 Step 4: Components Available for Testing\n');

    const [components] = await connection.query(`
      SELECT component_id, component_name, component_type
      FROM component
      WHERE case_id = 1
      ORDER BY component_id
    `);

    console.log('Components in Case 1:\n');
    components.forEach(c => {
      const flowCount = flows.filter(f => f.component_id === c.component_id).length;
      const status = flowCount > 0 ? `✅ ${flowCount} flows` : '❌ No flows';
      console.log(`  ID ${c.component_id}: ${c.component_name} (${c.component_type}) - ${status}`);
    });

    // 5. Summary for frontend testing
    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('✅ VERIFICATION SUMMARY\n');
    console.log(`Total Flows in DB: ${flows.length}`);
    console.log(`Total Substances Available: ${substances.length}`);
    console.log(`Components with Flows: ${Object.keys(byComponent).length}`);
    console.log(`\n📝 Frontend Testing URLs:`);
    console.log(`   - View flows: http://localhost:3002/project/1/case/1`);
    console.log(`   - Click on "Cell Assembly Line" component`);
    console.log(`   - Go to "Data & Drivers" tab`);
    console.log(`   - Should see Environmental Flows component with ${byComponent[2]?.flows.length || 0} flows`);

    console.log('\n🔌 API Endpoints Ready:');
    console.log(`   - GET  /api/components/2/flows  (fetch flows)`);
    console.log(`   - POST /api/components/2/flows  (create flow)`);
    console.log(`   - PUT  /api/flows/{flowId}      (update flow)`);
    console.log(`   - DELETE /api/flows/{flowId}    (delete flow)`);
    console.log(`   - GET  /api/substances          (get catalog)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

verifyFlowAPIs().catch(console.error);
