const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function analyzeProject6() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('PROJECT 6 (Nutroleum) - REFERENCE STRUCTURE ANALYSIS');
    console.log('='.repeat(80));
    
    // 1. Project Info
    console.log('\n1. PROJECT INFORMATION:');
    console.log('-'.repeat(80));
    const projectInfo = await client.query(`
      SELECT id, name, description
      FROM projects
      WHERE id = 6
    `);
    console.log(JSON.stringify(projectInfo.rows, null, 2));
    
    // 2. Cases
    console.log('\n2. CASES:');
    console.log('-'.repeat(80));
    const cases = await client.query(`
      SELECT id, name, is_base_case
      FROM cases
      WHERE project_id = 6
      ORDER BY id
    `);
    console.log(JSON.stringify(cases.rows, null, 2));
    
    // 3. Component hierarchy for each case
    for (let caseRow of cases.rows) {
      console.log(`\n3. HIERARCHY FOR CASE ${caseRow.id} (${caseRow.name}):`);
      console.log('-'.repeat(80));
      
      const hierarchy = await client.query(`
        WITH RECURSIVE comp_tree AS (
          SELECT id, name, component_type, parent_id, quantity, unit, 0 as level, ARRAY[id] as path
          FROM components
          WHERE case_id = $1 AND parent_id IS NULL
          
          UNION ALL
          
          SELECT c.id, c.name, c.component_type, c.parent_id, c.quantity, c.unit, ct.level + 1, ct.path || c.id
          FROM components c
          JOIN comp_tree ct ON c.parent_id = ct.id
          WHERE c.case_id = $1
        )
        SELECT 
          REPEAT('  ', level) || name as indented_name,
          component_type,
          quantity,
          unit,
          level,
          id,
          parent_id
        FROM comp_tree
        ORDER BY path
      `, [caseRow.id]);
      console.log(JSON.stringify(hierarchy.rows, null, 2));
      
      // Count flows per component
      console.log(`\n   Flow counts per component:`);
      const flowCounts = await client.query(`
        SELECT 
          c.id,
          c.name,
          c.component_type,
          COUNT(f.id) as flow_count
        FROM components c
        LEFT JOIN environmental_flows f ON c.id = f.component_id
        WHERE c.case_id = $1
        GROUP BY c.id, c.name, c.component_type
        ORDER BY c.id
      `, [caseRow.id]);
      console.log(JSON.stringify(flowCounts.rows, null, 2));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('REFERENCE ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error analyzing project 6:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeProject6();
