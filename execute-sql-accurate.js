/**
 * Execute Nutroleum vs Petroleum Jelly SQL with better parsing
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
    multipleStatements: false
  });

  console.log('\n🔄 Executing Nutroleum vs Petroleum Jelly Data Setup\n');

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'nutroleum-petroleum-jelly-accurate.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Better parsing: split by semicolons, remove comments
    const statements = [];
    let currentStatement = '';

    for (const line of sql.split('\n')) {
      const trimmedLine = line.trim();

      // Skip pure comment lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }

      // Remove inline comments
      const withoutComment = line.split('--')[0];
      currentStatement += withoutComment + '\n';

      // Check if statement ends with semicolon
      if (trimmedLine.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && stmt !== ';') {
          statements.push(stmt.slice(0, -1)); // Remove trailing semicolon for mysql2
        }
        currentStatement = '';
      }
    }

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;
    let insertedRows = 0;
    let deletedRows = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      try {
        const [result] = await connection.query(stmt);

        if (stmt.toUpperCase().startsWith('DELETE')) {
          deletedRows += result.affectedRows;
          if (result.affectedRows > 0) {
            console.log(`🗑️  DELETE: ${result.affectedRows} rows removed`);
          }
        } else if (stmt.toUpperCase().startsWith('INSERT')) {
          insertedRows += result.affectedRows;
        } else if (stmt.toUpperCase().startsWith('SELECT')) {
          if (Array.isArray(result) && result.length > 0) {
            console.log(`\n📊 Query result:`, result);
          }
        }

        successCount++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Duplicate entry skipped`);
        } else {
          console.error(`❌ Error on statement ${i + 1}: ${err.message}`);
          console.error(`   Statement: ${stmt.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Execution complete:`);
    console.log(`   - ${successCount} statements successful`);
    console.log(`   - ${insertedRows} total rows inserted`);
    console.log(`   - ${deletedRows} total rows deleted`);
    console.log(`   - ${errorCount} errors`);
    console.log(`${'='.repeat(60)}\n`);

    // Verification queries
    console.log('📊 Verification Results:\n');

    // Check project
    const [projects] = await connection.query(`
      SELECT project_id, project_name
      FROM project
      WHERE project_id = 10
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
      ORDER BY ct.case_id, c.hierarchy_level
    `);
    console.log('\nHierarchy breakdown:', hierarchyLevels);

    // Calculate total costs
    const [costs] = await connection.query(`
      SELECT ct.case_name,
             ROUND(SUM(COALESCE(c.capex, 0) + COALESCE(c.opex, 0) + COALESCE(c.labor_cost, 0) +
                       COALESCE(c.energy_cost, 0) + COALESCE(c.transportation_cost, 0) +
                       COALESCE(c.material_cost, 0) + COALESCE(c.overhead_cost, 0)), 4) as total_cost
      FROM case_table ct
      JOIN component c ON ct.case_id = c.case_id
      WHERE ct.project_id = 10 AND c.component_type = 'elemental_task'
      GROUP BY ct.case_id, ct.case_name
    `);
    console.log('\nTotal costs:', costs);

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
