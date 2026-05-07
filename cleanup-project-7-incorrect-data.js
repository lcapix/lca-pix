const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

/**
 * Cleanup Script for Project 7
 *
 * Purpose: Remove all incorrect data from Project 7 (cases 14, 15, 16)
 *          to prepare for correct restoration
 *
 * What this does:
 * 1. Deletes assessment_results for cases 14-16
 * 2. Deletes assessment_runs for cases 14-16
 * 3. Deletes flows for components in cases 14-16
 * 4. Deletes components for cases 14-16
 * 5. Deletes cases 14, 15, 16
 * 6. Verifies Project 7 is empty and ready for restoration
 */

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};

async function cleanupProject7() {
  let connection;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('PROJECT 7 CLEANUP - Removing Incorrect Data');
    console.log('='.repeat(80) + '\n');

    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    // Start transaction
    await connection.beginTransaction();
    console.log('📝 Transaction started\n');

    // ================================================================
    // STEP 1: Show current state before cleanup
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 1: Current State (Before Cleanup)');
    console.log('='.repeat(80) + '\n');

    const [currentState] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        COUNT(DISTINCT c.case_id) as cases,
        COUNT(DISTINCT comp.component_id) as components,
        COUNT(DISTINCT f.flow_id) as flows,
        COUNT(DISTINCT ar.run_id) as assessment_runs,
        COUNT(DISTINCT res.result_id) as assessment_results
      FROM project p
      LEFT JOIN case_table c ON p.project_id = c.project_id
      LEFT JOIN component comp ON c.case_id = comp.case_id
      LEFT JOIN flows f ON comp.component_id = f.component_id
      LEFT JOIN assessment_runs ar ON c.case_id = ar.case_id
      LEFT JOIN assessment_results res ON ar.run_id = res.run_id
      WHERE p.project_id = 7
      GROUP BY p.project_id, p.project_name
    `);

    console.log('Project 7 Current State:');
    console.table(currentState);

    const [casesList] = await connection.execute(`
      SELECT case_id, case_name, case_type
      FROM case_table
      WHERE project_id = 7
      ORDER BY case_id
    `);

    console.log('\nCases to be deleted:');
    console.table(casesList);

    // ================================================================
    // STEP 2: Delete assessment_results
    // ================================================================
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: Deleting Assessment Results');
    console.log('='.repeat(80) + '\n');

    const [resultsDeleted] = await connection.execute(`
      DELETE FROM assessment_results
      WHERE run_id IN (
        SELECT run_id FROM assessment_runs
        WHERE case_id IN (14, 15, 16)
      )
    `);

    console.log(`✓ Deleted ${resultsDeleted.affectedRows} assessment result records\n`);

    // ================================================================
    // STEP 3: Delete assessment_runs
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 3: Deleting Assessment Runs');
    console.log('='.repeat(80) + '\n');

    const [runsDeleted] = await connection.execute(`
      DELETE FROM assessment_runs
      WHERE case_id IN (14, 15, 16)
    `);

    console.log(`✓ Deleted ${runsDeleted.affectedRows} assessment run records\n`);

    // ================================================================
    // STEP 4: Delete flows
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 4: Deleting Environmental Flows');
    console.log('='.repeat(80) + '\n');

    const [flowsDeleted] = await connection.execute(`
      DELETE FROM flows
      WHERE component_id IN (
        SELECT component_id FROM component
        WHERE case_id IN (14, 15, 16)
      )
    `);

    console.log(`✓ Deleted ${flowsDeleted.affectedRows} flow records\n`);

    // ================================================================
    // STEP 5: Delete components
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 5: Deleting Components');
    console.log('='.repeat(80) + '\n');

    const [componentsDeleted] = await connection.execute(`
      DELETE FROM component
      WHERE case_id IN (14, 15, 16)
    `);

    console.log(`✓ Deleted ${componentsDeleted.affectedRows} component records\n`);

    // ================================================================
    // STEP 6: Delete cases
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 6: Deleting Cases');
    console.log('='.repeat(80) + '\n');

    const [casesDeleted] = await connection.execute(`
      DELETE FROM case_table
      WHERE case_id IN (14, 15, 16)
    `);

    console.log(`✓ Deleted ${casesDeleted.affectedRows} case records\n`);

    // ================================================================
    // COMMIT TRANSACTION
    // ================================================================
    await connection.commit();
    console.log('='.repeat(80));
    console.log('✅ TRANSACTION COMMITTED - All deletions saved!');
    console.log('='.repeat(80) + '\n');

    // ================================================================
    // STEP 7: Verify cleanup
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 7: Verification (After Cleanup)');
    console.log('='.repeat(80) + '\n');

    const [verifyState] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        COUNT(DISTINCT c.case_id) as cases,
        COUNT(DISTINCT comp.component_id) as components,
        COUNT(DISTINCT f.flow_id) as flows,
        COUNT(DISTINCT ar.run_id) as assessment_runs,
        COUNT(DISTINCT res.result_id) as assessment_results
      FROM project p
      LEFT JOIN case_table c ON p.project_id = c.project_id
      LEFT JOIN component comp ON c.case_id = comp.case_id
      LEFT JOIN flows f ON comp.component_id = f.component_id
      LEFT JOIN assessment_runs ar ON c.case_id = ar.case_id
      LEFT JOIN assessment_results res ON ar.run_id = res.run_id
      WHERE p.project_id = 7
      GROUP BY p.project_id, p.project_name
    `);

    console.log('Project 7 After Cleanup:');
    console.table(verifyState);

    // Check if cleanup was successful
    const state = verifyState[0];
    const isClean = state.cases === 0 &&
                     state.components === 0 &&
                     state.flows === 0 &&
                     state.assessment_runs === 0 &&
                     state.assessment_results === 0;

    if (isClean) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS! Project 7 is completely clean and ready for restoration');
      console.log('='.repeat(80));
      console.log('\nNext Step: Run restore-project-7-correct.js to insert correct data\n');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  WARNING: Project 7 still has data remaining');
      console.log('='.repeat(80));
      console.log('\nReview the verification table above for details\n');
    }

    // ================================================================
    // CLEANUP SUMMARY
    // ================================================================
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Assessment Results Deleted: ${resultsDeleted.affectedRows}`);
    console.log(`Assessment Runs Deleted: ${runsDeleted.affectedRows}`);
    console.log(`Flows Deleted: ${flowsDeleted.affectedRows}`);
    console.log(`Components Deleted: ${componentsDeleted.affectedRows}`);
    console.log(`Cases Deleted: ${casesDeleted.affectedRows}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
      console.error('\n❌ ERROR - Transaction rolled back:', error.message);
    }
    console.error('\nFatal error:', error.message);
    process.exit(1);
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run cleanup
cleanupProject7().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
