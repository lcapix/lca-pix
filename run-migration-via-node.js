// ============================================================================
// LCA PROJECT V3 - RUN DATABASE MIGRATION VIA NODE.JS
// ============================================================================
// This script uses the existing database connection to run the migration
// ============================================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 LCA v3 Database Migration Script');
  console.log('====================================');
  console.log('');

  // Read migration SQL file
  const migrationFile = path.join(__dirname, 'migrate-add-driver-columns.sql');
  console.log(`📝 Reading migration file: ${migrationFile}`);

  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ ERROR: Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
  console.log('✅ Migration file loaded');
  console.log('');

  // Create database connection using SSH tunnel (localhost:3307)
  console.log('📡 Connecting to database via SSH tunnel...');
  console.log(`   Host: 127.0.0.1:3307`);
  console.log(`   Database: lca_v3`);
  console.log('');

  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3',
    multipleStatements: true
  });

  console.log('✅ Connected to database');
  console.log('');

  try {
    console.log('🚀 Running migration...');
    console.log('====================================');
    console.log('');

    // Execute migration
    const [results] = await connection.query(migrationSQL);

    console.log('');
    console.log('====================================');
    console.log('✅ Migration completed successfully!');
    console.log('====================================');
    console.log('');

    // Verify changes
    console.log('📊 Verifying changes...');
    console.log('');

    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'lca_v3'
        AND TABLE_NAME = 'component'
        AND COLUMN_NAME IN ('driver_category', 'driver_type', 'drivers', 'process_type')
      ORDER BY ORDINAL_POSITION
    `);

    console.log('New columns added:');
    console.table(columns);

    // Check updated component data
    const [components] = await connection.query(`
      SELECT component_id, component_name, driver_category, driver_type, drivers, quantity, unit
      FROM component
      WHERE component_name = 'Oven Heating Task'
    `);

    if (components.length > 0) {
      console.log('');
      console.log('Updated "Oven Heating Task" component:');
      console.table(components);
    }

    console.log('');
    console.log('✨ All done! The component table now has driver columns.');

  } catch (error) {
    console.error('');
    console.error('====================================');
    console.error('❌ Migration failed!');
    console.error('====================================');
    console.error('Error:', error.message);
    console.error('');
    if (error.sql) {
      console.error('SQL:', error.sql.substring(0, 200) + '...');
    }
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
