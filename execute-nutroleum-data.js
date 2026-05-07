/**
 * Script to execute the Nutroleum vs Petroleum Jelly data setup SQL
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function executeSQL() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    user: process.env.DATABASE_USER || 'lcaadmin',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'lca_v3',
    port: parseInt(process.env.DATABASE_PORT || '3307'),
    multipleStatements: true
  });

  console.log('\n🔄 Executing Nutroleum vs Petroleum Jelly Data Setup\n');

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'nutroleum-petroleum-jelly-accurate.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolons and filter empty statements
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Skip comments and empty lines
      if (!stmt || stmt.startsWith('--')) continue;

      try {
        // Log what we're doing
        const preview = stmt.substring(0, 80).replace(/\n/g, ' ');

        // Execute the statement
        const [result] = await connection.query(stmt);

        if (stmt.toUpperCase().includes('DELETE')) {
          console.log(`🗑️  DELETE: ${result.affectedRows} rows removed`);
        } else if (stmt.toUpperCase().includes('INSERT')) {
          console.log(`✅ INSERT: ${result.affectedRows} rows added`);
        } else if (stmt.toUpperCase().includes('SELECT')) {
          // For SELECT statements, show the results
          if (Array.isArray(result) && result.length > 0) {
            console.log(`📊 Query result:`, result);
          }
        } else {
          console.log(`✓ Executed: ${preview}...`);
        }

        successCount++;
      } catch (err) {
        // Some errors are expected (like deleting non-existent data)
        if (err.code === 'ER_NO_REFERENCED_ROW_2' ||
            err.code === 'ER_ROW_IS_REFERENCED_2' ||
            err.message.includes('Duplicate entry')) {
          console.log(`⚠️  Warning: ${err.message.substring(0, 100)}`);
        } else {
          console.error(`❌ Error: ${err.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Execution complete: ${successCount} successful, ${errorCount} errors`);
    console.log(`${'='.repeat(60)}\n`);

    // Verification queries
    console.log('📊 Verification Results:\n');

    // Check project
    const [projects] = await connection.query(`
      SELECT project_id, project_name
      FROM project
      WHERE project_name LIKE '%Nutroleum%' OR project_name LIKE '%Petroleum%'
    `);
    console.log('Projects:', projects);

    // Check cases
    const [cases] = await connection.query(`
      SELECT case_id, project_id, case_name, case_type
      FROM case_table
      WHERE project_id = 10
    `);
    console.log('\nCases:', cases);

    // Check component counts
    const [componentCounts] = await connection.query(`
      SELECT ct.case_name, COUNT(c.component_id) as component_count
      FROM case_table ct
      LEFT JOIN component c ON ct.case_id = c.case_id
      WHERE ct.project_id = 10
      GROUP BY ct.case_id, ct.case_name
    `);
    console.log('\nComponent counts:', componentCounts);

    // Check hierarchy levels
    const [hierarchyLevels] = await connection.query(`
      SELECT
        ct.case_name,
        c.component_type,
        COUNT(*) as count
      FROM case_table ct
      JOIN component c ON ct.case_id = c.case_id
      WHERE ct.project_id = 10
      GROUP BY ct.case_id, ct.case_name, c.component_type
      ORDER BY ct.case_id, c.component_type
    `);
    console.log('\nHierarchy breakdown:', hierarchyLevels);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
executeSQL()
  .then(() => {
    console.log('\n✅ Data setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
