#!/usr/bin/env node

/**
 * Execute MSWT Wind Turbine SQL Setup Script
 * Loads complete data for Project 12
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Configuration
const CONFIG = {
  SQL_FILE: path.join(__dirname, 'mswt-final.sql')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

/**
 * Load environment variables from .env.local
 */
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
      throw new Error('.env.local file not found');
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        envVars[key] = value;
      }
    });

    return envVars;
  } catch (error) {
    logError(`Failed to load .env.local: ${error.message}`);
    throw error;
  }
}

/**
 * Create database connection
 */
async function createConnection(env) {
  try {
    const connection = await mysql.createConnection({
      host: env.DATABASE_HOST || env.DB_HOST || '127.0.0.1',
      port: parseInt(env.DATABASE_PORT || env.DB_PORT || '3306'),
      user: env.DATABASE_USER || env.DB_USER || 'root',
      password: env.DATABASE_PASSWORD || env.DB_PASSWORD || '',
      database: env.DATABASE_NAME || env.DB_DATABASE || 'lca_v3',
      multipleStatements: true
    });

    logSuccess('Database connection established');
    return connection;
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute SQL file
 */
async function executeSQLFile(connection, filePath) {
  try {
    logInfo(`Reading SQL file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`SQL file not found: ${filePath}`);
    }

    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    logInfo(`Executing SQL script (${(sqlContent.length / 1024).toFixed(1)} KB)...`);

    const [results] = await connection.query(sqlContent);

    logSuccess('SQL script executed successfully');

    return results;
  } catch (error) {
    logError(`SQL execution failed: ${error.message}`);
    if (error.sql) {
      logError(`Failed SQL: ${error.sql.substring(0, 200)}...`);
    }
    throw error;
  }
}

/**
 * Run verification queries
 */
async function runVerification(connection) {
  logSection('VERIFICATION RESULTS');

  try {
    // Check cases created
    logInfo('Checking cases created...');
    const [cases] = await connection.query(`
      SELECT case_id, case_name, case_type
      FROM case_table
      WHERE project_id = 12
      ORDER BY case_id
    `);

    console.log('\n📋 Cases Created:');
    cases.forEach(c => {
      console.log(`   ${c.case_type === 'base' ? '🔵' : '🔶'} Case ${c.case_id}: ${c.case_name} (${c.case_type})`);
    });
    logSuccess(`${cases.length} cases created`);

    // Check component counts
    logInfo('\nChecking components...');
    const [compCounts] = await connection.query(`
      SELECT
        c.case_id,
        ct.case_name,
        COUNT(*) as component_count,
        SUM(c.opex) as total_opex
      FROM component c
      JOIN case_table ct ON c.case_id = ct.case_id
      WHERE ct.project_id = 12
      GROUP BY c.case_id, ct.case_name
      ORDER BY c.case_id
    `);

    console.log('\n🔧 Components by Case:');
    compCounts.forEach(cc => {
      console.log(`   Case ${cc.case_id}: ${cc.component_count} components, $${parseFloat(cc.total_opex || 0).toFixed(2)} OPEX`);
    });

    // Check flows
    logInfo('\nChecking environmental flows...');
    const [flowCounts] = await connection.query(`
      SELECT COUNT(*) as flow_count
      FROM flows f
      JOIN component c ON f.component_id = c.component_id
      JOIN case_table ct ON c.case_id = ct.case_id
      WHERE ct.project_id = 12
    `);

    logSuccess(`${flowCounts[0].flow_count} environmental flows created`);

    // Overall summary
    logSection('SUMMARY');
    console.log(`✅ Project 12 (MSWT) successfully populated`);
    console.log(`✅ ${cases.length} cases ready for LCA assessment`);
    console.log(`✅ ${compCounts.reduce((sum, cc) => sum + cc.component_count, 0)} total components`);
    console.log(`✅ ${flowCounts[0].flow_count} environmental flows`);
    console.log(`✅ Database ready for use\n`);

  } catch (error) {
    logError(`Verification failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  let connection;

  try {
    logSection('MSWT WIND TURBINE DATA LOADER');

    // Load environment
    logInfo('Loading environment variables...');
    const env = loadEnv();
    logSuccess('Environment loaded');

    // Connect to database
    connection = await createConnection(env);

    // Execute SQL script
    logSection('EXECUTING SQL SCRIPT');
    await executeSQLFile(connection, CONFIG.SQL_FILE);

    // Run verification
    await runVerification(connection);

    logSection('EXECUTION COMPLETE');
    logSuccess('MSWT project data loaded successfully!');
    console.log('\n🌐 View the project at: http://localhost:3002/project/12\n');

  } catch (error) {
    logError(`\nFatal error: ${error.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
main();
