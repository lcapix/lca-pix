const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

/**
 * COMPLETE DATABASE CLEANUP
 *
 * Deletes ALL test projects (Projects 6 and 7) and their associated data:
 * - Assessment results
 * - Assessment runs
 * - Environmental flows
 * - Components
 * - Cases
 * - Project members
 * - Projects
 *
 * Preserves: Users, substances, impact categories, permissions (reference data)
 */

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};

async function cleanupAllProjects() {
  let connection;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('COMPLETE DATABASE CLEANUP - Removing ALL Test Projects');
    console.log('='.repeat(80) + '\n');

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    // Start transaction
    await connection.beginTransaction();
    console.log('📝 Transaction started\n');

    // Show current state
    console.log('='.repeat(80));
    console.log('BEFORE CLEANUP - Current Projects');
    console.log('='.repeat(80) + '\n');

    const [currentProjects] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        COUNT(DISTINCT c.case_id) as cases,
        COUNT(DISTINCT comp.component_id) as components,
        COUNT(DISTINCT f.flow_id) as flows
      FROM project p
      LEFT JOIN case_table c ON p.project_id = c.project_id
      LEFT JOIN component comp ON c.case_id = comp.case_id
      LEFT JOIN flows f ON comp.component_id = f.component_id
      WHERE p.project_id IN (6, 7)
      GROUP BY p.project_id, p.project_name
    `);

    console.table(currentProjects);

    // Step 1: Delete assessment results
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: Deleting Assessment Results');
    console.log('='.repeat(80) + '\n');

    const [resultsDeleted] = await connection.execute(`
      DELETE ar FROM assessment_results ar
      JOIN assessment_runs run ON ar.run_id = run.run_id
      JOIN case_table c ON run.case_id = c.case_id
      WHERE c.project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${resultsDeleted.affectedRows} assessment result records\n`);

    // Step 2: Delete assessment runs
    console.log('='.repeat(80));
    console.log('STEP 2: Deleting Assessment Runs');
    console.log('='.repeat(80) + '\n');

    const [runsDeleted] = await connection.execute(`
      DELETE run FROM assessment_runs run
      JOIN case_table c ON run.case_id = c.case_id
      WHERE c.project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${runsDeleted.affectedRows} assessment run records\n`);

    // Step 3: Delete flows
    console.log('='.repeat(80));
    console.log('STEP 3: Deleting Environmental Flows');
    console.log('='.repeat(80) + '\n');

    const [flowsDeleted] = await connection.execute(`
      DELETE f FROM flows f
      JOIN component comp ON f.component_id = comp.component_id
      JOIN case_table c ON comp.case_id = c.case_id
      WHERE c.project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${flowsDeleted.affectedRows} flow records\n`);

    // Step 4: Delete components
    console.log('='.repeat(80));
    console.log('STEP 4: Deleting Components');
    console.log('='.repeat(80) + '\n');

    const [componentsDeleted] = await connection.execute(`
      DELETE comp FROM component comp
      JOIN case_table c ON comp.case_id = c.case_id
      WHERE c.project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${componentsDeleted.affectedRows} component records\n`);

    // Step 5: Delete cases
    console.log('='.repeat(80));
    console.log('STEP 5: Deleting Cases');
    console.log('='.repeat(80) + '\n');

    const [casesDeleted] = await connection.execute(`
      DELETE FROM case_table
      WHERE project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${casesDeleted.affectedRows} case records\n`);

    // Step 6: Delete project members
    console.log('='.repeat(80));
    console.log('STEP 6: Deleting Project Members');
    console.log('='.repeat(80) + '\n');

    const [membersDeleted] = await connection.execute(`
      DELETE FROM project_members
      WHERE project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${membersDeleted.affectedRows} project member records\n`);

    // Step 7: Delete projects
    console.log('='.repeat(80));
    console.log('STEP 7: Deleting Projects');
    console.log('='.repeat(80) + '\n');

    const [projectsDeleted] = await connection.execute(`
      DELETE FROM project
      WHERE project_id IN (6, 7)
    `);
    console.log(`✓ Deleted ${projectsDeleted.affectedRows} project records\n`);

    // Commit transaction
    await connection.commit();
    console.log('='.repeat(80));
    console.log('✅ TRANSACTION COMMITTED - All deletions saved!');
    console.log('='.repeat(80) + '\n');

    // Verify cleanup
    console.log('='.repeat(80));
    console.log('VERIFICATION - Checking for remaining data');
    console.log('='.repeat(80) + '\n');

    const [verify] = await connection.execute(`
      SELECT
        COUNT(DISTINCT project_id) as projects,
        COUNT(DISTINCT c.case_id) as cases,
        COUNT(DISTINCT comp.component_id) as components
      FROM project p
      LEFT JOIN case_table c ON p.project_id = c.project_id
      LEFT JOIN component comp ON c.case_id = comp.case_id
      WHERE p.project_id IN (6, 7)
    `);

    console.table(verify);

    const isClean = verify[0].projects === 0 &&
                     verify[0].cases === 0 &&
                     verify[0].components === 0;

    if (isClean) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS! Database is completely clean');
      console.log('='.repeat(80));
      console.log('\nReady to create:');
      console.log('  • Project 1: Electric Vehicle Manufacturing');
      console.log('  • Project 2: Nutroleum vs Vaseline\n');
    } else {
      console.log('\n⚠️  WARNING: Some data may still remain\n');
    }

    // Summary
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Projects Deleted: ${projectsDeleted.affectedRows}`);
    console.log(`Cases Deleted: ${casesDeleted.affectedRows}`);
    console.log(`Components Deleted: ${componentsDeleted.affectedRows}`);
    console.log(`Flows Deleted: ${flowsDeleted.affectedRows}`);
    console.log(`Assessment Runs Deleted: ${runsDeleted.affectedRows}`);
    console.log(`Assessment Results Deleted: ${resultsDeleted.affectedRows}`);
    console.log(`Project Members Deleted: ${membersDeleted.affectedRows}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('\n❌ ERROR - Transaction rolled back:', error.message);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

cleanupAllProjects().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
