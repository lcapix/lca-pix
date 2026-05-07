/**
 * Migration Runner Script
 * Runs database migrations without needing mysql CLI
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting migration...\n');

  // Load .env.local if available
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

  // Database connection config from .env.local
  const config = {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT || '3307'),
    user: process.env.DATABASE_USER || 'lcaadmin',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'lca_v3',
    multipleStatements: true
  };

  let connection;

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '002_comparison_system.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Connect to database
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to lca_v3 database\n');

    // Execute migration
    console.log('⚙️  Executing migration SQL...\n');
    await connection.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const [tables] = await connection.query("SHOW TABLES LIKE 'comparison%'");

    console.log('\n📊 Created tables:');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   ✓ ${tableName}`);
    });

    // Show table counts
    console.log('\n📈 Table details:');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`   ${tableName}: ${countResult[0].count} rows`);
    }

    console.log('\n🎉 Migration complete!');
    console.log('\n✨ You can now use the comparison features.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure the SSM tunnel is running on port 3307');
      console.error('   Check with: lsof -i :3307\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Check your database password');
      console.error('   Set it via: export DB_PASSWORD="your-password"\n');
    } else if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.error('\n💡 Tables already exist - migration already run!');
      console.error('   This is OK, you can proceed.\n');
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
runMigration();
