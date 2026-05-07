#!/usr/bin/env node

/**
 * COMPREHENSIVE API ENDPOINT TESTING SCRIPT
 * Tests all assessment-related API endpoints
 */

const http = require('http');

const BASE_URL = 'http://localhost:3002';
const TEST_EMAIL = 'demo@lcaproject.com';
const TEST_PASSWORD = 'demo123';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let authToken = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);

    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (authToken) {
      defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
      method,
      headers: defaultHeaders
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testServerConnection() {
  log('\n🔍 TEST 1: Server Connection', 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    const response = await makeRequest('/');
    if (response.status === 200 || response.status === 304) {
      log('✅ Server is running', 'green');
      return true;
    } else {
      log(`⚠️  Server responded with status ${response.status}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Cannot connect to server: ${error.message}`, 'red');
    log('   Make sure server is running: npm run dev', 'yellow');
    return false;
  }
}

async function testLogin() {
  log('\n🔐 TEST 2: User Login', 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    const response = await makeRequest('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      log(`✅ Login successful`, 'green');
      log(`   Token: ${authToken.substring(0, 20)}...`, 'cyan');
      log(`   User: ${response.data.user.username}`, 'cyan');
      return true;
    } else {
      log(`❌ Login failed: ${response.data.error || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Login error: ${error.message}`, 'red');
    return false;
  }
}

async function testGetProjects() {
  log('\n📁 TEST 3: Get Projects', 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    const response = await makeRequest('/api/projects', 'GET');

    if (response.status === 200) {
      const projects = response.data.projects || [];
      log(`✅ Found ${projects.length} projects`, 'green');

      if (projects.length > 0) {
        projects.forEach((project, index) => {
          log(`   ${index + 1}. ${project.project_name} (ID: ${project.project_id})`, 'cyan');
        });
      } else {
        log('   ⚠️  No projects found - run LOAD_TEST_DATA.sh', 'yellow');
      }

      return projects;
    } else {
      log(`❌ Failed to get projects: ${response.data.error}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ Error getting projects: ${error.message}`, 'red');
    return [];
  }
}

async function testGetCases(projectId) {
  log(`\n📊 TEST 4: Get Cases for Project ${projectId}`, 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    const response = await makeRequest(`/api/projects/${projectId}/cases`, 'GET');

    if (response.status === 200) {
      const cases = response.data.cases || [];
      log(`✅ Found ${cases.length} cases`, 'green');

      if (cases.length > 0) {
        cases.forEach((caseItem, index) => {
          log(`   ${index + 1}. ${caseItem.case_name} (ID: ${caseItem.case_id}, Type: ${caseItem.case_type})`, 'cyan');
        });
      }

      return cases;
    } else {
      log(`❌ Failed to get cases: ${response.data.error}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ Error getting cases: ${error.message}`, 'red');
    return [];
  }
}

async function testGetAssessments(caseId) {
  log(`\n🔬 TEST 5: Get Assessments for Case ${caseId}`, 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    const response = await makeRequest(`/api/cases/${caseId}/assessments`, 'GET');

    if (response.status === 200) {
      const assessments = response.data.assessments || [];
      log(`✅ Found ${assessments.length} assessments`, 'green');

      if (assessments.length > 0) {
        assessments.forEach((assessment, index) => {
          log(`   ${index + 1}. ${assessment.run_name} (ID: ${assessment.run_id})`, 'cyan');
          log(`      Status: ${assessment.status}`, 'cyan');
          log(`      Method: ${assessment.calculation_method}`, 'cyan');
          log(`      Date: ${new Date(assessment.run_at).toLocaleString()}`, 'cyan');
        });
      } else {
        log('   ⚠️  No assessments found for this case', 'yellow');
      }

      return assessments;
    } else {
      log(`❌ Failed to get assessments: ${response.data.error}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ Error getting assessments: ${error.message}`, 'red');
    return [];
  }
}

async function testGetAssessmentResults(runId) {
  log(`\n📈 TEST 6: Get Assessment Results for Run ${runId}`, 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    const response = await makeRequest(`/api/assessments/${runId}`, 'GET');

    if (response.status === 200) {
      log(`✅ Assessment details retrieved`, 'green');

      const assessment = response.data.assessment;
      const results = response.data.results || [];

      log(`   Run Name: ${assessment.run_name}`, 'cyan');
      log(`   Status: ${assessment.status}`, 'cyan');
      log(`   Results: ${results.length} impact values`, 'cyan');

      if (results.length > 0) {
        log(`\n   Impact Results:`, 'cyan');
        results.forEach((result, index) => {
          log(`      ${index + 1}. ${result.category_name}: ${result.impact_value} ${result.unit}`, 'cyan');
          log(`         Component: ${result.component_name}`, 'cyan');
        });
      }

      return { assessment, results };
    } else {
      log(`❌ Failed to get assessment results: ${response.data.error}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error getting assessment results: ${error.message}`, 'red');
    return null;
  }
}

async function testCreateAssessment(caseId) {
  log(`\n🧪 TEST 7: Create New Assessment for Case ${caseId}`, 'blue');
  log('─'.repeat(70), 'cyan');

  try {
    log('   Sending POST request...', 'yellow');

    const response = await makeRequest(`/api/cases/${caseId}/assessments`, 'POST', {
      run_name: `API Test Run - ${new Date().toISOString()}`,
      calculation_method: 'CML 2001'
    });

    if (response.status === 201) {
      log(`✅ Assessment created successfully!`, 'green');

      const assessment = response.data.assessment;
      log(`   Run ID: ${assessment.run_id}`, 'cyan');
      log(`   Run Name: ${assessment.run_name}`, 'cyan');
      log(`   Status: ${assessment.status}`, 'cyan');

      if (response.data.summary) {
        log(`\n   Summary:`, 'cyan');
        log(`      Total Components: ${response.data.summary.total_components}`, 'cyan');
        log(`      Components with Flows: ${response.data.summary.components_with_flows}`, 'cyan');
        log(`      Flows Processed: ${response.data.summary.total_flows_processed}`, 'cyan');
        log(`      Impact Categories: ${response.data.summary.impact_categories_calculated}`, 'cyan');
      }

      if (response.data.total_impacts) {
        log(`\n   Total Impacts:`, 'cyan');
        response.data.total_impacts.forEach(impact => {
          log(`      ${impact.category_name}: ${impact.impact_value} ${impact.unit}`, 'cyan');
        });
      }

      return assessment;
    } else {
      log(`❌ Failed to create assessment: ${response.data.error}`, 'red');
      if (response.data.details) {
        log(`   Details: ${response.data.details}`, 'red');
      }
      return null;
    }
  } catch (error) {
    log(`❌ Error creating assessment: ${error.message}`, 'red');
    return null;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  log('\n' + '='.repeat(70), 'blue');
  log('LCA PROJECT V3 - ASSESSMENT API TESTS', 'blue');
  log('='.repeat(70) + '\n', 'blue');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Server Connection
  totalTests++;
  if (await testServerConnection()) {
    passedTests++;
  } else {
    log('\n❌ Cannot proceed without server connection', 'red');
    return;
  }

  await sleep(500);

  // Test 2: Login
  totalTests++;
  if (await testLogin()) {
    passedTests++;
  } else {
    log('\n❌ Cannot proceed without authentication', 'red');
    return;
  }

  await sleep(500);

  // Test 3: Get Projects
  totalTests++;
  const projects = await testGetProjects();
  if (projects.length > 0) {
    passedTests++;
  } else {
    log('\n⚠️  No projects found - some tests will be skipped', 'yellow');
    log('   Run ./LOAD_TEST_DATA.sh to populate database', 'yellow');
  }

  if (projects.length > 0) {
    const testProject = projects[0];

    await sleep(500);

    // Test 4: Get Cases
    totalTests++;
    const cases = await testGetCases(testProject.project_id);
    if (cases.length > 0) {
      passedTests++;
    }

    if (cases.length > 0) {
      const testCase = cases[0];

      await sleep(500);

      // Test 5: Get Assessments
      totalTests++;
      const assessments = await testGetAssessments(testCase.case_id);
      if (assessments !== null) {
        passedTests++;
      }

      if (assessments.length > 0) {
        await sleep(500);

        // Test 6: Get Assessment Results
        totalTests++;
        const results = await testGetAssessmentResults(assessments[0].run_id);
        if (results) {
          passedTests++;
        }
      }

      await sleep(500);

      // Test 7: Create New Assessment
      totalTests++;
      log('\n⚠️  About to create a new assessment (this will modify the database)', 'yellow');
      log('   Press Ctrl+C to cancel, or wait 3 seconds to proceed...', 'yellow');

      await sleep(3000);

      const newAssessment = await testCreateAssessment(testCase.case_id);
      if (newAssessment) {
        passedTests++;
      }
    }
  }

  // Summary
  log('\n' + '='.repeat(70), 'blue');
  log('TEST SUMMARY', 'blue');
  log('='.repeat(70), 'blue');
  log(`\nTotal Tests: ${totalTests}`, 'cyan');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${totalTests - passedTests}`, 'red');

  if (passedTests === totalTests) {
    log('\n✅ ALL TESTS PASSED!', 'green');
  } else {
    log(`\n⚠️  ${totalTests - passedTests} test(s) failed`, 'yellow');
  }

  log('\n' + '='.repeat(70) + '\n', 'blue');
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
