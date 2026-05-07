const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function analyzeProject7() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('PROJECT 7 (EV Manufacturing) - COMPREHENSIVE ANALYSIS');
    console.log('='.repeat(80));
    
    // 1. Project Basic Info
    console.log('\n1. PROJECT INFORMATION:');
    console.log('-'.repeat(80));
    const projectInfo = await client.query(`
      SELECT id, name, description, created_at, updated_at, user_id
      FROM projects
      WHERE id = 7
    `);
    console.log(JSON.stringify(projectInfo.rows, null, 2));
    
    // 2. All Cases for Project 7
    console.log('\n2. CASES IN PROJECT 7:');
    console.log('-'.repeat(80));
    const cases = await client.query(`
      SELECT id, name, description, is_base_case, created_at
      FROM cases
      WHERE project_id = 7
      ORDER BY id
    `);
    console.log(JSON.stringify(cases.rows, null, 2));
    
    // 3. Components for each case (14, 15, 16)
    for (let caseId of [14, 15, 16]) {
      console.log(`\n3.${caseId}. COMPONENTS FOR CASE ${caseId}:`);
      console.log('-'.repeat(80));
      const components = await client.query(`
        SELECT 
          c.id,
          c.name,
          c.component_type,
          c.parent_id,
          c.quantity,
          c.unit,
          c.created_at,
          (SELECT name FROM components WHERE id = c.parent_id) as parent_name
        FROM components c
        WHERE c.case_id = $1
        ORDER BY c.id
      `, [caseId]);
      console.log(`Total components: ${components.rows.length}`);
      console.log(JSON.stringify(components.rows, null, 2));
      
      // Check hierarchy structure
      console.log(`\n   Hierarchy Structure for Case ${caseId}:`);
      const hierarchy = await client.query(`
        WITH RECURSIVE comp_tree AS (
          SELECT id, name, component_type, parent_id, 0 as level, ARRAY[id] as path
          FROM components
          WHERE case_id = $1 AND parent_id IS NULL
          
          UNION ALL
          
          SELECT c.id, c.name, c.component_type, c.parent_id, ct.level + 1, ct.path || c.id
          FROM components c
          JOIN comp_tree ct ON c.parent_id = ct.id
          WHERE c.case_id = $1
        )
        SELECT 
          REPEAT('  ', level) || name as indented_name,
          component_type,
          level,
          id,
          parent_id
        FROM comp_tree
        ORDER BY path
      `, [caseId]);
      console.log(JSON.stringify(hierarchy.rows, null, 2));
    }
    
    // 4. Environmental Flows for each case
    for (let caseId of [14, 15, 16]) {
      console.log(`\n4.${caseId}. ENVIRONMENTAL FLOWS FOR CASE ${caseId}:`);
      console.log('-'.repeat(80));
      const flows = await client.query(`
        SELECT 
          f.id,
          f.component_id,
          c.name as component_name,
          f.flow_type,
          f.flow_name,
          f.quantity,
          f.unit,
          f.impact_category
        FROM environmental_flows f
        JOIN components c ON f.component_id = c.id
        WHERE c.case_id = $1
        ORDER BY c.id, f.id
      `, [caseId]);
      console.log(`Total flows: ${flows.rows.length}`);
      console.log(JSON.stringify(flows.rows, null, 2));
    }
    
    // 5. Assessment Runs
    console.log('\n5. ASSESSMENT RUNS FOR PROJECT 7:');
    console.log('-'.repeat(80));
    const assessments = await client.query(`
      SELECT 
        ar.id,
        ar.case_id,
        c.name as case_name,
        ar.status,
        ar.created_at,
        ar.completed_at
      FROM assessment_runs ar
      JOIN cases c ON ar.case_id = c.id
      WHERE c.project_id = 7
      ORDER BY ar.id
    `);
    console.log(JSON.stringify(assessments.rows, null, 2));
    
    // 6. Assessment Results (if any)
    if (assessments.rows.length > 0) {
      console.log('\n6. ASSESSMENT RESULTS:');
      console.log('-'.repeat(80));
      for (let assessment of assessments.rows) {
        const results = await client.query(`
          SELECT 
            impact_category,
            total_impact,
            unit
          FROM assessment_results
          WHERE assessment_run_id = $1
          ORDER BY impact_category
        `, [assessment.id]);
        if (results.rows.length > 0) {
          console.log(`\n   Assessment ${assessment.id} (Case ${assessment.case_id} - ${assessment.case_name}):`);
          console.log(JSON.stringify(results.rows, null, 2));
        }
      }
    }
    
    // 7. Check for duplicates or issues
    console.log('\n7. DATA QUALITY CHECKS:');
    console.log('-'.repeat(80));
    
    // Duplicate component names in same case
    const duplicates = await client.query(`
      SELECT case_id, name, COUNT(*) as count
      FROM components
      WHERE case_id IN (14, 15, 16)
      GROUP BY case_id, name
      HAVING COUNT(*) > 1
    `);
    console.log('Duplicate component names:');
    console.log(JSON.stringify(duplicates.rows, null, 2));
    
    // Components with missing parent references
    const orphans = await client.query(`
      SELECT c.id, c.case_id, c.name, c.parent_id
      FROM components c
      WHERE c.case_id IN (14, 15, 16)
        AND c.parent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM components p 
          WHERE p.id = c.parent_id AND p.case_id = c.case_id
        )
    `);
    console.log('\nOrphaned components (invalid parent_id):');
    console.log(JSON.stringify(orphans.rows, null, 2));
    
    // Flows without components
    const orphanFlows = await client.query(`
      SELECT f.id, f.component_id, f.flow_name
      FROM environmental_flows f
      WHERE f.component_id IN (
        SELECT id FROM components WHERE case_id IN (14, 15, 16)
      )
      AND NOT EXISTS (
        SELECT 1 FROM components c WHERE c.id = f.component_id
      )
    `);
    console.log('\nOrphaned flows (invalid component_id):');
    console.log(JSON.stringify(orphanFlows.rows, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error analyzing project 7:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeProject7();
