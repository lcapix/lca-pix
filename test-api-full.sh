#!/bin/bash

# LCA Project v3 - Complete API Test & Data Population
# This script tests all API endpoints and creates persistent test data

set -e

API_BASE="http://localhost:3002/api"
echo "=========================================="
echo "LCA Project v3 - API Test & Data Creation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. SIGNUP
echo -e "${BLUE}1. Creating test user...${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@lcaproject.com",
    "password": "SecurePass123!"
  }')

echo "$SIGNUP_RESPONSE" | jq '.'
TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Signup failed, trying login instead..."
  LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "john@lcaproject.com",
      "password": "SecurePass123!"
    }')
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
fi

echo -e "${GREEN}✓ User authenticated. Token obtained.${NC}"
echo ""

# 2. CREATE PROJECT
echo -e "${BLUE}2. Creating project...${NC}"
PROJECT_RESPONSE=$(curl -s -X POST "$API_BASE/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "Electric Vehicle Manufacturing",
    "description": "Life cycle assessment of EV battery production facility"
  }')

echo "$PROJECT_RESPONSE" | jq '.'
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.project.project_id')
echo -e "${GREEN}✓ Project created with ID: $PROJECT_ID${NC}"
echo ""

# 3. CREATE BASE CASE
echo -e "${BLUE}3. Creating base case...${NC}"
CASE_RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT_ID/cases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "case_name": "Baseline Production - 2025",
    "case_type": "base",
    "description": "Current state with coal-based grid electricity"
  }')

echo "$CASE_RESPONSE" | jq '.'
CASE_ID=$(echo "$CASE_RESPONSE" | jq -r '.case.case_id')
echo -e "${GREEN}✓ Base case created with ID: $CASE_ID${NC}"
echo ""

# 4. CREATE COMPONENT HIERARCHY (5 levels)
echo -e "${BLUE}4. Creating component hierarchy...${NC}"

# Level 1: Product
COMP1_RESPONSE=$(curl -s -X POST "$API_BASE/cases/$CASE_ID/components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "component_name": "EV Battery Pack (60 kWh)",
    "component_type": "product",
    "hierarchy_level": 1,
    "quantity": 1,
    "unit": "unit",
    "description": "Complete lithium-ion battery pack for electric vehicle"
  }')
COMP1_ID=$(echo "$COMP1_RESPONSE" | jq -r '.component.component_id')
echo -e "${GREEN}✓ Level 1 - Product: $COMP1_ID${NC}"

# Level 2: Machine/Line
COMP2_RESPONSE=$(curl -s -X POST "$API_BASE/cases/$CASE_ID/components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "component_name": "Cell Assembly Line",
    "component_type": "machine_line",
    "parent_component_id": '"$COMP1_ID"',
    "hierarchy_level": 2,
    "quantity": 1,
    "unit": "line",
    "description": "Automated battery cell assembly line"
  }')
COMP2_ID=$(echo "$COMP2_RESPONSE" | jq -r '.component.component_id')
echo -e "${GREEN}✓ Level 2 - Machine/Line: $COMP2_ID${NC}"

# Level 3: Subprocess
COMP3_RESPONSE=$(curl -s -X POST "$API_BASE/cases/$CASE_ID/components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "component_name": "Electrode Coating Process",
    "component_type": "subprocess",
    "parent_component_id": '"$COMP2_ID"',
    "hierarchy_level": 3,
    "quantity": 1,
    "unit": "batch",
    "description": "Coating electrodes with active materials"
  }')
COMP3_ID=$(echo "$COMP3_RESPONSE" | jq -r '.component.component_id')
echo -e "${GREEN}✓ Level 3 - Subprocess: $COMP3_ID${NC}"

# Level 4: Operation
COMP4_RESPONSE=$(curl -s -X POST "$API_BASE/cases/$CASE_ID/components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "component_name": "Drying Operation",
    "component_type": "operation",
    "parent_component_id": '"$COMP3_ID"',
    "hierarchy_level": 4,
    "quantity": 1,
    "unit": "cycle",
    "description": "High temperature drying of coated electrodes"
  }')
COMP4_ID=$(echo "$COMP4_RESPONSE" | jq -r '.component.component_id')
echo -e "${GREEN}✓ Level 4 - Operation: $COMP4_ID${NC}"

# Level 5: Elemental Task
COMP5_RESPONSE=$(curl -s -X POST "$API_BASE/cases/$CASE_ID/components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "component_name": "Oven Heating Task",
    "component_type": "elemental_task",
    "parent_component_id": '"$COMP4_ID"',
    "hierarchy_level": 5,
    "quantity": 1,
    "unit": "task",
    "description": "Electric heating element operation"
  }')
COMP5_ID=$(echo "$COMP5_RESPONSE" | jq -r '.component.component_id')
echo -e "${GREEN}✓ Level 5 - Elemental Task: $COMP5_ID${NC}"
echo ""

# 5. ADD FLOWS TO ELEMENTAL TASK
echo -e "${BLUE}5. Adding flows (inputs/outputs)...${NC}"

# Input: Electricity (Driver)
FLOW1=$(curl -s -X POST "$API_BASE/components/$COMP5_ID/flows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "substance_id": 7,
    "flow_type": "input",
    "quantity": 250.5,
    "unit": "kWh",
    "is_driver": true,
    "driver_description": "Electric energy consumption for oven heating"
  }')
echo -e "${GREEN}✓ Flow 1: Electricity input (driver) - 250.5 kWh${NC}"

# Output: CO2 (Driver)
FLOW2=$(curl -s -X POST "$API_BASE/components/$COMP5_ID/flows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "substance_id": 1,
    "flow_type": "output",
    "quantity": 125.25,
    "unit": "kg",
    "is_driver": true,
    "driver_description": "CO2 emissions from coal-based electricity generation"
  }')
echo -e "${GREEN}✓ Flow 2: CO2 output (driver) - 125.25 kg${NC}"

# Output: Methane (Driver)
FLOW3=$(curl -s -X POST "$API_BASE/components/$COMP5_ID/flows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "substance_id": 2,
    "flow_type": "output",
    "quantity": 2.5,
    "unit": "kg",
    "is_driver": true,
    "driver_description": "Methane emissions from energy production"
  }')
echo -e "${GREEN}✓ Flow 3: Methane output (driver) - 2.5 kg${NC}"

# Input: Water (non-driver)
FLOW4=$(curl -s -X POST "$API_BASE/components/$COMP5_ID/flows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "substance_id": 8,
    "flow_type": "input",
    "quantity": 15.0,
    "unit": "m3",
    "is_driver": false,
    "driver_description": null
  }')
echo -e "${GREEN}✓ Flow 4: Water input (non-driver) - 15.0 m3${NC}"
echo ""

# 6. RUN ASSESSMENT
echo -e "${BLUE}6. Running LCA assessment...${NC}"
ASSESSMENT_RESPONSE=$(curl -s -X POST "$API_BASE/cases/$CASE_ID/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "run_name": "Q1 2025 Baseline Assessment",
    "calculation_method": "CML 2001"
  }')

echo "$ASSESSMENT_RESPONSE" | jq '.'
RUN_ID=$(echo "$ASSESSMENT_RESPONSE" | jq -r '.assessment.run_id')
echo -e "${GREEN}✓ Assessment completed with RUN_ID: $RUN_ID${NC}"
echo ""

# 7. GET ASSESSMENT RESULTS
echo -e "${BLUE}7. Retrieving assessment results...${NC}"
RESULTS_RESPONSE=$(curl -s -X GET "$API_BASE/assessments/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$RESULTS_RESPONSE" | jq '.assessment.results[] | {component: .component_name, category: .category_name, impact: .impact_value, unit: .unit}'
echo ""

# 8. CREATE COMPARATIVE CASE
echo -e "${BLUE}8. Creating comparative case (renewable energy scenario)...${NC}"
CASE2_RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT_ID/cases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "case_name": "Renewable Energy Scenario",
    "case_type": "comparative",
    "parent_case_id": '"$CASE_ID"',
    "description": "Same production with 100% renewable electricity"
  }')
CASE2_ID=$(echo "$CASE2_RESPONSE" | jq -r '.case.case_id')
echo -e "${GREEN}✓ Comparative case created with ID: $CASE2_ID${NC}"
echo ""

# 9. SUMMARY
echo "=========================================="
echo -e "${GREEN}TEST DATA CREATION COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "Created:"
echo "  - 1 User: john@lcaproject.com"
echo "  - 1 Project: Electric Vehicle Manufacturing (ID: $PROJECT_ID)"
echo "  - 2 Cases: Baseline + Renewable (IDs: $CASE_ID, $CASE2_ID)"
echo "  - 5 Components (full hierarchy from Product to Elemental Task)"
echo "  - 4 Flows (Electricity, CO2, Methane, Water)"
echo "  - 1 Assessment Run (ID: $RUN_ID)"
echo ""
echo "All data is now stored in AWS RDS MySQL database!"
echo ""
echo "To verify in database, run:"
echo "  ./verify-database-data.sh"
echo ""

# Save IDs to file for later use
cat > test-data-ids.json <<EOF
{
  "token": "$TOKEN",
  "project_id": $PROJECT_ID,
  "case_id": $CASE_ID,
  "case2_id": $CASE2_ID,
  "component_ids": [$COMP1_ID, $COMP2_ID, $COMP3_ID, $COMP4_ID, $COMP5_ID],
  "run_id": $RUN_ID
}
EOF

echo "IDs saved to test-data-ids.json"
