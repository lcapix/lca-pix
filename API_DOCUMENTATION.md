# LCA Project v3 - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All API routes (except signup and login) require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Auth Endpoints

#### POST /api/auth/signup
Create a new user account.

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "account_type": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /api/auth/login
Authenticate and get JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "account_type": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET /api/auth/me
Get current user information.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "account_type": "user"
  }
}
```

## Project Management

#### GET /api/projects
Get all projects for authenticated user (owned or member).

**Response:**
```json
{
  "success": true,
  "projects": [
    {
      "project_id": 1,
      "project_name": "My LCA Project",
      "description": "Product lifecycle assessment",
      "owner_id": 1,
      "owner_username": "john_doe",
      "is_template": false,
      "permission_name": "owner",
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

#### POST /api/projects
Create a new project.

**Request:**
```json
{
  "project_name": "New LCA Project",
  "description": "Optional description",
  "is_template": false
}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "project_id": 2,
    "project_name": "New LCA Project",
    "description": "Optional description",
    "owner_id": 1,
    "owner_username": "john_doe",
    "is_template": false,
    "created_at": "2025-01-15T11:00:00.000Z"
  }
}
```

#### GET /api/projects/[projectId]
Get project details with members.

**Response:**
```json
{
  "success": true,
  "project": {
    "project_id": 1,
    "project_name": "My LCA Project",
    "description": "Product lifecycle assessment",
    "owner_id": 1,
    "members": [
      {
        "member_id": 1,
        "user_id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "permission_name": "owner"
      }
    ]
  }
}
```

#### PUT /api/projects/[projectId]
Update project (requires admin permission).

**Request:**
```json
{
  "project_name": "Updated Project Name",
  "description": "Updated description"
}
```

#### DELETE /api/projects/[projectId]
Delete project (requires owner permission).

## Case Management

#### GET /api/projects/[projectId]/cases
Get all cases for a project.

**Response:**
```json
{
  "success": true,
  "cases": [
    {
      "case_id": 1,
      "project_id": 1,
      "case_name": "Base Case",
      "case_type": "base",
      "parent_case_id": null,
      "description": "Baseline scenario",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

#### POST /api/projects/[projectId]/cases
Create a new case (requires editor permission).

**Request:**
```json
{
  "case_name": "Alternative Scenario",
  "case_type": "comparative",
  "parent_case_id": 1,
  "description": "Comparing with renewable energy"
}
```

#### GET /api/cases/[caseId]
Get case details.

#### PUT /api/cases/[caseId]
Update case (requires editor permission).

#### DELETE /api/cases/[caseId]
Delete case (requires admin permission).

## Component Hierarchy

#### GET /api/cases/[caseId]/components
Get all components for a case (5-level hierarchy).

**Response:**
```json
{
  "success": true,
  "components": [
    {
      "component_id": 1,
      "case_id": 1,
      "parent_component_id": null,
      "component_name": "Product A",
      "component_type": "product",
      "hierarchy_level": 1,
      "quantity": 1.0,
      "unit": "unit",
      "description": null,
      "parent_component_name": null
    }
  ]
}
```

**Component Types:**
- `product` (Level 1)
- `machine_line` (Level 2)
- `subprocess` (Level 3)
- `operation` (Level 4)
- `elemental_task` (Level 5)

#### POST /api/cases/[caseId]/components
Create a new component (requires editor permission).

**Request:**
```json
{
  "component_name": "Assembly Machine",
  "component_type": "machine_line",
  "parent_component_id": 1,
  "hierarchy_level": 2,
  "quantity": 1.0,
  "unit": "unit",
  "description": "Main assembly line"
}
```

#### GET /api/components/[componentId]
Get component details.

#### PUT /api/components/[componentId]
Update component (requires editor permission).

#### DELETE /api/components/[componentId]
Delete component (requires admin permission).

## Flows (Inputs/Outputs)

#### GET /api/components/[componentId]/flows
Get all flows for a component.

**Response:**
```json
{
  "success": true,
  "flows": [
    {
      "flow_id": 1,
      "component_id": 5,
      "substance_id": 7,
      "substance_name": "Electricity",
      "substance_category": "resource",
      "flow_type": "input",
      "quantity": 100.5,
      "unit": "kWh",
      "is_driver": true,
      "driver_description": "Main energy consumption"
    }
  ]
}
```

#### POST /api/components/[componentId]/flows
Create a new flow (requires editor permission).

**Request:**
```json
{
  "substance_id": 1,
  "flow_type": "output",
  "quantity": 25.5,
  "unit": "kg",
  "is_driver": true,
  "driver_description": "CO2 emissions from combustion"
}
```

**Flow Types:**
- `input` - Resource consumption
- `output` - Emissions/waste

#### PUT /api/flows/[flowId]
Update flow (requires editor permission).

#### DELETE /api/flows/[flowId]
Delete flow (requires admin permission).

## Assessment & Calculations

#### GET /api/cases/[caseId]/assessments
Get all assessment runs for a case.

**Response:**
```json
{
  "success": true,
  "assessments": [
    {
      "run_id": 1,
      "case_id": 1,
      "run_name": "Initial Assessment",
      "run_date": "2025-01-15T12:00:00.000Z",
      "calculation_method": "CML 2001",
      "status": "completed",
      "error_log": null,
      "executed_by": 1,
      "executed_by_username": "john_doe"
    }
  ]
}
```

#### POST /api/cases/[caseId]/assessments
Run a new LCA assessment (requires editor permission).

**Request:**
```json
{
  "run_name": "Q1 2025 Assessment",
  "calculation_method": "CML 2001"
}
```

**Assessment Process:**
1. Creates assessment run record
2. Calculates impacts for all components with driver flows
3. Multiplies flow quantities by driver impact factors
4. Stores results per component per impact category
5. Updates status to 'completed' or 'failed'

#### GET /api/assessments/[runId]
Get assessment results.

**Response:**
```json
{
  "success": true,
  "assessment": {
    "run_id": 1,
    "case_id": 1,
    "run_name": "Initial Assessment",
    "status": "completed",
    "results": [
      {
        "result_id": 1,
        "component_id": 5,
        "component_name": "Welding Process",
        "component_type": "elemental_task",
        "hierarchy_level": 5,
        "category_id": 1,
        "category_name": "Global Warming",
        "abbreviation": "GWP",
        "impact_value": 125.5,
        "unit": "kg CO2 eq",
        "contribution_percentage": null
      }
    ]
  }
}
```

## Reference Data

#### GET /api/substances
Get all substances.

**Query Parameters:**
- `category` (optional): Filter by category (resource, emission_air, emission_water, emission_soil, waste)

**Response:**
```json
{
  "success": true,
  "substances": [
    {
      "substance_id": 1,
      "substance_name": "Carbon Dioxide",
      "cas_number": "124-38-9",
      "category": "emission_air",
      "unit": "kg",
      "description": "Primary greenhouse gas"
    }
  ]
}
```

#### GET /api/impact-categories
Get all impact categories.

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "category_id": 1,
      "category_name": "Global Warming",
      "abbreviation": "GWP",
      "unit": "kg CO2 eq",
      "description": "Climate change impact measured in CO2 equivalents"
    }
  ]
}
```

#### GET /api/driver-factors
Get driver impact factors.

**Query Parameters:**
- `substance_id` (optional): Filter by substance
- `category_id` (optional): Filter by impact category

**Response:**
```json
{
  "success": true,
  "factors": [
    {
      "factor_id": 1,
      "substance_id": 1,
      "substance_name": "Carbon Dioxide",
      "category_id": 1,
      "category_name": "Global Warming",
      "factor_value": 1.0,
      "unit": "kg CO2 eq / kg CO2",
      "geographic_scope": "Global",
      "data_quality_score": 5.0,
      "source_reference": "IPCC AR6 2021"
    }
  ]
}
```

## Permission Levels

- **owner**: Full control including deletion
- **admin**: Manage settings and members, cannot delete project
- **editor**: Edit project data, cannot manage members
- **viewer**: Read-only access

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized (missing or invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

## Complete User Flow Example

```bash
# 1. Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# 2. Login and get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

# 3. Create project
PROJECT_ID=$(curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name":"Test Project"}' \
  | jq -r '.project.project_id')

# 4. Create base case
CASE_ID=$(curl -X POST http://localhost:3000/api/projects/$PROJECT_ID/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_name":"Base Case","case_type":"base"}' \
  | jq -r '.case.case_id')

# 5. Create component hierarchy
COMP_ID=$(curl -X POST http://localhost:3000/api/cases/$CASE_ID/components \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"component_name":"Product","component_type":"product","hierarchy_level":1}' \
  | jq -r '.component.component_id')

# 6. Add flows
curl -X POST http://localhost:3000/api/components/$COMP_ID/flows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"substance_id":7,"flow_type":"input","quantity":100,"unit":"kWh","is_driver":true}'

# 7. Run assessment
curl -X POST http://localhost:3000/api/cases/$CASE_ID/assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"run_name":"Test Assessment"}'
```
