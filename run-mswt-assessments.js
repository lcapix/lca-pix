#!/usr/bin/env node

/**
 * Run LCA Assessments for All MSWT Cases
 * Authenticates as Daniel Lerner and runs assessments via API
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:3002',
  USER_CREDENTIALS: {
    email: 'daniel.lerner@lcaproject.com',
    password: 'LCA2025!'
  },
  CASES: [
    { id: 121, name: 'MSWT Base Case' },
    { id: 122, name: 'Heat Pump Alternative' },
    { id: 123, name: 'Coastal North Sea Offshore' },
    { id: 124, name: 'US Great Plains Hub & Spoke' }
  ]
};

// Colors
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
 * Authenticate user and get JWT token
 */
async function authenticate() {
  try {
    logInfo('Authenticating as Daniel Lerner...');

    const response = await fetch(`${CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(CONFIG.USER_CREDENTIALS)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token received from login');
    }

    logSuccess('Authentication successful');
    return data.token;

  } catch (error) {
    logError(`Authentication error: ${error.message}`);
    throw error;
  }
}

/**
 * Run LCA assessment for a case
 */
async function runAssessment(caseId, caseName, token) {
  try {
    logInfo(`Running assessment for Case ${caseId}: ${caseName}...`);

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

    logSuccess(`Assessment completed for Case ${caseId}`);

    // Display results if available
    if (data.impacts || data.total_impacts) {
      console.log(`   📊 Impact Results:`);

      const impacts = data.total_impacts || data.impacts;

      if (Array.isArray(impacts)) {
        impacts.slice(0, 5).forEach(impact => {
          console.log(`      • ${impact.category_name}: ${impact.impact_value?.toFixed(4) || 'N/A'} ${impact.unit || ''}`);
        });
        if (impacts.length > 5) {
          console.log(`      ... and ${impacts.length - 5} more impact categories`);
        }
      } else if (typeof impacts === 'object') {
        const entries = Object.entries(impacts).slice(0, 5);
        entries.forEach(([category, value]) => {
          const displayValue = typeof value === 'object' ? value.value : value;
          const unit = typeof value === 'object' ? value.unit : '';
          console.log(`      • ${category}: ${displayValue?.toFixed(4) || 'N/A'} ${unit}`);
        });
        if (Object.keys(impacts).length > 5) {
          console.log(`      ... and ${Object.keys(impacts).length - 5} more impact categories`);
        }
      }
    }

    return {
      case_id: caseId,
      case_name: caseName,
      run_id: data.run_id || data.id,
      status: 'completed',
      impacts: data.impacts || data.total_impacts,
      summary: data.summary
    };

  } catch (error) {
    logError(`Assessment error for Case ${caseId}: ${error.message}`);
    return {
      case_id: caseId,
      case_name: caseName,
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Display summary of all results
 */
function displaySummary(results) {
  logSection('ASSESSMENT SUMMARY');

  const successful = results.filter(r => r.status === 'completed');
  const failed = results.filter(r => r.status === 'failed');

  console.log('┌────────────┬───────────────────────────────────────┬────────────┐');
  console.log('│ Case ID    │ Case Name                             │ Status     │');
  console.log('├────────────┼───────────────────────────────────────┼────────────┤');

  results.forEach(r => {
    const status = r.status === 'completed' ?
      `${colors.green}✓ Completed${colors.reset}` :
      `${colors.red}✗ Failed${colors.reset}`;

    console.log(`│ ${String(r.case_id).padEnd(10)} │ ${r.case_name.padEnd(37)} │ ${status.padEnd(20)}│`);
  });

  console.log('└────────────┴───────────────────────────────────────┴────────────┘\n');

  logSuccess(`${successful.length}/${results.length} assessments completed successfully`);

  if (failed.length > 0) {
    logError(`${failed.length} assessments failed`);
    failed.forEach(f => {
      console.log(`   • Case ${f.case_id}: ${f.error}`);
    });
  }

  console.log('\n📍 View results at: http://localhost:3002/project/12/comparisons\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    logSection('MSWT LCA ASSESSMENT RUNNER');

    // Authenticate
    const token = await authenticate();

    // Run assessments for all cases
    logSection('RUNNING ASSESSMENTS');

    const results = [];
    for (const caseConfig of CONFIG.CASES) {
      const result = await runAssessment(caseConfig.id, caseConfig.name, token);
      results.push(result);

      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Display summary
    displaySummary(results);

    logSection('EXECUTION COMPLETE');
    logSuccess('All assessments have been processed!');

  } catch (error) {
    logError(`\nFatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
