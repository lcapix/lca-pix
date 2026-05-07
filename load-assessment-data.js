const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function loadAssessmentData() {
  console.log('🔄 Loading Assessment Test Data for Analytics...');
  console.log('================================================\n');

  // Create connection
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3',
    multipleStatements: true
  });

  try {
    console.log('✅ Connected to database\n');

    // Load base test data
    console.log('📊 Step 1: Loading base test data (Case 1 with assessment)...');
    const sql1 = fs.readFileSync(path.join(__dirname, 'create-test-data.sql'), 'utf8');
    await connection.query(sql1);
    console.log('✅ Base test data loaded successfully\n');

    // Load Case 2 test data
    console.log('📊 Step 2: Loading Case 2 test data (Renewable Energy with assessment)...');
    const sql2 = fs.readFileSync(path.join(__dirname, 'add-case2-test-data.sql'), 'utf8');
    await connection.query(sql2);
    console.log('✅ Case 2 test data loaded successfully\n');

    // Verify data
    console.log('🔍 Verifying data...');
    const [cases] = await connection.query('SELECT case_id, case_name, case_type FROM case_table');
    console.log(`   Found ${cases.length} cases:`);
    cases.forEach(c => console.log(`     - ${c.case_name} (${c.case_type})`));

    const [assessments] = await connection.query('SELECT run_id, case_id, run_name, status FROM assessment_runs');
    console.log(`\n   Found ${assessments.length} assessment runs:`);
    assessments.forEach(a => console.log(`     - ${a.run_name} (status: ${a.status})`));

    const [results] = await connection.query('SELECT COUNT(*) as count FROM assessment_results');
    console.log(`   Found ${results[0].count} assessment results\n`);

    console.log('================================================');
    console.log('✅ All Assessment Data Loaded Successfully!');
    console.log('================================================\n');
    console.log('📊 Data Summary:');
    console.log('  - Case 1: Baseline Production - 2025');
    console.log('  - Case 2: Renewable Energy Scenario');
    console.log('  - Both cases have completed assessments');
    console.log('  - Ready for analytics visualization\n');
    console.log('🌐 Next Steps:');
    console.log('  1. Navigate to: http://localhost:3002/project/1/');
    console.log('  2. Click \'Compare Cases\'');
    console.log('  3. Select both cases');
    console.log('  4. Click \'Run Comparison\'');
    console.log('  5. Analytics page will now show visualizations!\n');

  } catch (error) {
    console.error('❌ Error loading data:', error.message);
    if (error.sql) {
      console.error('SQL Error at:', error.sql.substring(0, 200));
    }
    process.exit(1);
  } finally {
    await connection.end();
  }
}

loadAssessmentData().catch(console.error);
