#!/usr/bin/env node

/**
 * MSWT PROJECT DATA LOADER & ASSESSMENT RUNNER
 *
 * This script:
 * 1. Loads and executes the mswt-complete-test-data.sql file
 * 2. Creates user account and logs in
 * 3. Runs LCA assessments for all 4 cases via API
 * 4. Displays results
 *
 * Usage:
 *   node execute-mswt-data.js
 *
 * Requirements:
 *   - Next.js dev server running on http://localhost:3002
 *   - MySQL database accessible with credentials from .env.local
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:3002',
  SQL_FILE: path.join(__dirname, 'mswt-complete-test-data.sql'),
  USER_CREDENTIALS: {
    username: 'daniel.lerner',
    email: 'daniel.lerner@lcaproject.com',
    password: 'LCA2025!',
    fullName: 'Daniel Lerner'
  }
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

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
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

    let sqlContent = fs.readFileSync(filePath, 'utf-8');

    // Replace the password hash placeholder with actual bcrypt hash
    const passwordHash = await bcrypt.hash(CONFIG.USER_CREDENTIALS.password, 10);
    sqlContent = sqlContent.replace(
      '$2a$10$YourHashedPasswordHere123456789012345678901234567890123456',
      passwordHash
    );

    logInfo('Executing SQL script...');

    const [results] = await connection.query(sqlContent);

    logSuccess('SQL script executed successfully');

    // Display result summaries
    if (Array.isArray(results)) {
      results.forEach((result, index) => {
        if (result && typeof result === 'object') {
          if (result.affectedRows !== undefined) {
            logInfo(`Statement ${index + 1}: ${result.affectedRows} rows affected`);
          } else if (Array.isArray(result) && result.length > 0) {
            const firstRow = result[0];
            if (firstRow && Object.keys(firstRow).length > 0) {
              console.log('\nQuery Result:');
              console.table(result);
            }
          }
        }
      });
    }

    return true;
  } catch (error) {
    logError(`SQL execution failed: ${error.message}`);
    if (error.sql) {
      logError(`Failed SQL: ${error.sql.substring(0, 200)}...`);
    }
    throw error;
  }
}

/**
 * Get project and case IDs from database
 */
async function getProjectData(connection) {
  try {
    // Get project
    const [projects] = await connection.query(
      `SELECT project_id, project_name FROM project WHERE project_name LIKE '%MSWT%' ORDER BY created_at DESC LIMIT 1`
    );

    if (projects.length === 0) {
      throw new Error('MSWT project not found in database');
    }

    const project = projects[0];
    logSuccess(`Found project: ${project.project_name} (ID: ${project.project_id})`);

    // Get all cases for this project
    const [cases] = await connection.query(
      `SELECT case_id, case_name, is_base_case, functional_unit
       FROM case_table
       WHERE project_id = ?
       ORDER BY is_base_case DESC, case_id`,
      [project.project_id]
    );

    logSuccess(`Found ${cases.length} cases:`);
    cases.forEach(c => {
      const label = c.is_base_case ? '[BASE]' : '[COMP]';
      logInfo(`  ${label} ${c.case_name} (ID: ${c.case_id})`);
    });

    return { project, cases };
  } catch (error) {
    logError(`Failed to get project data: ${error.message}`);
    throw error;
  }
}

/**
 * Login to get auth token
 */
async function login() {
  try {
    logInfo('Logging in...');

    const response = await fetch(`${CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: CONFIG.USER_CREDENTIALS.email,
        password: CONFIG.USER_CREDENTIALS.password
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token received from login');
    }

    logSuccess('Login successful');
    return data.token;
  } catch (error) {
    logError(`Login failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run LCA assessment for a case
 */
async function runAssessment(caseId, caseName, token) {
  try {
    logInfo(`Running assessment for: ${caseName}`);

    const response = await fetch(`${CONFIG.API_BASE_URL}/api/cases/${caseId}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        run_name: `Initial Assessment - ${new Date().toISOString().split('T')[0]}`,
        calculation_method: 'CML 2001'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Assessment failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Assessment returned success: false');
    }

    logSuccess(`Assessment completed for: ${caseName}`);

    // Display summary
    if (data.summary) {
      console.log('\n  Summary:');
      console.log(`    - Components: ${data.summary.total_components}`);
      console.log(`    - Flows Processed: ${data.summary.total_flows_processed}`);
      console.log(`    - Impact Categories: ${data.summary.impact_categories_calculated}`);
    }

    if (data.total_impacts && Array.isArray(data.total_impacts)) {
      console.log('\n  Impact Results:');
      const sortedImpacts = data.total_impacts
        .sort((a, b) => Math.abs(b.impact_value) - Math.abs(a.impact_value))
        .slice(0, 5);

      sortedImpacts.forEach(impact => {
        console.log(`    - ${impact.category_name}: ${impact.impact_value.toFixed(4)} ${impact.unit}`);
      });

      const totalImpact = data.total_impacts.reduce((sum, cat) => sum + Math.abs(cat.impact_value), 0);
      console.log(`\n  Total Impact: ${totalImpact.toFixed(2)}`);
    }

    return data;
  } catch (error) {
    logError(`Assessment failed for ${caseName}: ${error.message}`);
    return null;
  }
}

/**
 * Display final summary
 */
function displaySummary(results) {
  logSection('ASSESSMENT SUMMARY');

  console.log('\n┌─────────────────────────────────────────┬────────────┬───────────────┬─────────────────┐');
  console.log('│ Case Name                               │ Status     │ Total Impact  │ Target Impact   │');
  console.log('├─────────────────────────────────────────┼────────────┼───────────────┼─────────────────┤');

  const targets = {
    'MSWT': 37,
    'Heat Pump': 16,
    'Coastal North Sea': 37,
    'US Great Plains': 37
  };

  results.forEach(result => {
    const caseName = result.caseName.substring(0, 39).padEnd(39);
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED ';

    let totalImpact = '-';
    let targetImpact = '-';

    if (result.success && result.data?.total_impacts) {
      const total = result.data.total_impacts.reduce((sum, cat) => sum + Math.abs(cat.impact_value), 0);
      totalImpact = total.toFixed(2).padStart(13);

      // Find target
      for (const [key, value] of Object.entries(targets)) {
        if (result.caseName.includes(key)) {
          targetImpact = value.toString().padStart(15);
          break;
        }
      }
    } else {
      totalImpact = '-'.padStart(13);
    }

    console.log(`│ ${caseName} │ ${status} │ ${totalImpact} │ ${targetImpact} │`);
  });

  console.log('└─────────────────────────────────────────┴────────────┴───────────────┴─────────────────┘\n');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logInfo(`Total Cases: ${results.length} | Successful: ${successCount} | Failed: ${failCount}`);

  if (successCount === results.length) {
    logSuccess('\n🎉 ALL ASSESSMENTS COMPLETED SUCCESSFULLY!');
    logInfo('\nNext steps:');
    logInfo('  1. Visit http://localhost:3002/home to view the project');
    logInfo('  2. Navigate to the MSWT project');
    logInfo('  3. Explore the cases and compare results');
    logInfo('  4. Check the comparisons page to see side-by-side analysis');
  } else {
    logWarning(`\n⚠️  ${failCount} assessment(s) failed. Check the errors above.`);
  }
}

/**
 * Main execution
 */
async function main() {
  let connection;

  try {
    logSection('MSWT PROJECT DATA LOADER');

    // Load environment
    logInfo('Loading environment variables...');
    const env = loadEnv();
    logSuccess('Environment loaded');

    // Create connection
    connection = await createConnection(env);

    // Execute SQL
    logSection('EXECUTING SQL SCRIPT');
    await executeSQLFile(connection, CONFIG.SQL_FILE);

    // Get project data
    logSection('RETRIEVING PROJECT DATA');
    const { project, cases } = await getProjectData(connection);

    // Login
    logSection('AUTHENTICATION');
    const token = await login();

    // Run assessments for all cases
    logSection('RUNNING LCA ASSESSMENTS');
    logInfo('This may take several minutes depending on the complexity of the cases...\n');

    const results = [];

    for (const caseData of cases) {
      console.log(`\n${'─'.repeat(80)}`);
      const assessmentData = await runAssessment(caseData.case_id, caseData.case_name, token);
      results.push({
        caseId: caseData.case_id,
        caseName: caseData.case_name,
        isBase: caseData.is_base_case,
        success: assessmentData !== null,
        data: assessmentData
      });
      console.log(`${'─'.repeat(80)}\n`);

      // Add delay between assessments to avoid overwhelming the server
      if (cases.indexOf(caseData) < cases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Display summary
    displaySummary(results);

  } catch (error) {
    logError(`\nFatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      logInfo('\nDatabase connection closed');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logError(`Unhandled error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };
