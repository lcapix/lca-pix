const mysql = require('mysql2/promise');

async function checkAssessments() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  try {
    console.log('🔍 Checking Assessment Data...\n');

    const [cases] = await connection.query('SELECT case_id, case_name, case_type FROM case_table ORDER BY case_id');
    console.log(`📊 Cases (${cases.length} total):`);
    cases.forEach(c => console.log(`   ${c.case_id}. ${c.case_name} (${c.case_type})`));

    console.log('\n📋 Assessment Runs:');
    const [assessments] = await connection.query(`
      SELECT ar.run_id, ar.case_id, ar.run_name, ar.status, ar.run_date, c.case_name
      FROM assessment_runs ar
      JOIN case_table c ON ar.case_id = c.case_id
      ORDER BY ar.case_id, ar.run_id
    `);

    if (assessments.length === 0) {
      console.log('   ❌ NO ASSESSMENT RUNS FOUND');
      console.log('\n🚨 This is why analytics shows no data!');
      console.log('\n📝 Solutions:');
      console.log('   1. Run assessments through UI for each case');
      console.log('   2. Or manually insert test assessment data');
    } else {
      console.log(`   Found ${assessments.length} assessment runs:`);
      assessments.forEach(a => {
        const statusIcon = a.status === 'completed' ? '✅' : '⏳';
        console.log(`   ${statusIcon} Run ${a.run_id}: ${a.run_name} (Case: ${a.case_name}, Status: ${a.status})`);
      });

      console.log('\n📊 Assessment Results:');
      const [results] = await connection.query(`
        SELECT ar.run_id, COUNT(*) as result_count
        FROM assessment_results ar
        GROUP BY ar.run_id
      `);
      results.forEach(r => {
        console.log(`   Run ${r.run_id}: ${r.result_count} results`);
      });
    }

    console.log('\n' + '='.repeat(60));

    if (assessments.filter(a => a.status === 'completed').length >= 2) {
      console.log('✅ Analytics should have data!');
      console.log('   If not showing, check browser console for errors');
    } else {
      console.log('❌ Need at least 2 completed assessments for comparison');
      console.log('   Current completed: ' + assessments.filter(a => a.status === 'completed').length);
    }

  } finally {
    await connection.end();
  }
}

checkAssessments().catch(console.error);
