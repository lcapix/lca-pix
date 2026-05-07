# LCA Project v3 - Database Integration Guide

## 📊 Database Schema Overview

Your LCA v3 database has **13 tables** organized in a hierarchical structure to support complete Life Cycle Assessment workflows.

### Database Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    USER & AUTHENTICATION                     │
│  account → permissions → project_members                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT STRUCTURE                       │
│  project → case_table → component (5-level hierarchy)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    LCA DATA & CALCULATIONS                   │
│  substances → flows → impact_categories                      │
│  driver_impact_factors → assessment_runs → assessment_results│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      AUDIT & COMPLIANCE                      │
│  audit_log                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Flow & Database Mapping

### **Flow 1: User Sign Up & Authentication**

**User Action:** Sign up → Login → Access Dashboard

**Database Flow:**
```
1. POST /api/auth/signup
   → INSERT INTO account (username, email, password_hash, account_type)
   → Return account.id + JWT token

2. POST /api/auth/login
   → SELECT * FROM account WHERE email = ? AND is_active = TRUE
   → Verify password_hash (bcrypt)
   → Return JWT token with account.id

3. GET /api/auth/me
   → SELECT id, username, email, account_type FROM account WHERE id = ?
   → Return user profile
```

**Tables Involved:**
- `account` - User credentials and profile

---

### **Flow 2: Create New Project**

**User Action:** Dashboard → New Project → Enter details → Create

**Database Flow:**
```
1. POST /api/projects
   → INSERT INTO project (project_name, description, owner_id)
   → Get project_id
   → INSERT INTO project_members (project_id, account_id, permission_id=1) [owner permission]
   → INSERT INTO audit_log (table_name='project', action='CREATE', changed_by=user_id)
   → Return project_id

2. GET /api/projects
   → SELECT p.*, a.username as owner_name
     FROM project p
     JOIN account a ON p.owner_id = a.id
     WHERE p.owner_id = ?
     OR p.project_id IN (
       SELECT project_id FROM project_members WHERE account_id = ?
     )
   → Return projects list
```

**Tables Involved:**
- `project` - Project metadata
- `project_members` - Access control
- `permissions` - Role definitions
- `audit_log` - Change tracking

---

### **Flow 3: Create Base Case**

**User Action:** Select Project → Create Base Case → Enter scenario details

**Database Flow:**
```
1. POST /api/projects/:projectId/cases
   → Check: Only 1 base case allowed per project
   → SELECT COUNT(*) FROM case_table
     WHERE project_id = ? AND case_type = 'base'
   → If count = 0, allow base case creation
   → INSERT INTO case_table (project_id, case_name, case_description, case_type='base')
   → INSERT INTO audit_log
   → Return case_id

2. GET /api/projects/:projectId/cases
   → SELECT * FROM case_table WHERE project_id = ? ORDER BY case_type, created_at
   → Return cases (base first, then comparatives)
```

**Tables Involved:**
- `case_table` - Scenario definitions
- `audit_log` - Change tracking

---

### **Flow 4: Build Process Hierarchy (5 Levels)**

**User Action:** Select Case → Add Components → Build tree structure

**Hierarchy Levels:**
```
Level 1: Product (root)           - component_type='product', parent_id=NULL
  └─ Level 2: Machine/Line        - component_type='machine', parent_id=product_id
     └─ Level 3: Subprocess       - component_type='subprocess', parent_id=machine_id
        └─ Level 4: Operation     - component_type='operation', parent_id=subprocess_id
           └─ Level 5: Elemental  - component_type='elemental', parent_id=operation_id
```

**Database Flow:**
```
1. POST /api/cases/:caseId/components
   Request: {
     component_name: "Metal Bucket Product",
     component_type: "product",
     parent_id: null,  // NULL for root (Product)
     case_id: caseId
   }
   → INSERT INTO component (case_id, component_name, component_type, parent_id)
   → Return component_id

2. POST /api/cases/:caseId/components (child)
   Request: {
     component_name: "Manufacturing Line",
     component_type: "machine",
     parent_id: 1,  // Product component_id
     case_id: caseId
   }
   → Validate: parent_id exists and is correct type
   → Validate: hierarchy rules (machine must be child of product)
   → INSERT INTO component
   → Return component_id

3. GET /api/cases/:caseId/hierarchy
   → SELECT * FROM v_component_hierarchy WHERE case_id = ?
   → Build tree structure recursively
   → Return hierarchical JSON
```

**Hierarchy Rules (Enforced in Application):**
- Product: Must have `parent_id = NULL`
- Machine: Parent must be Product
- Subprocess: Parent must be Machine
- Operation: Parent must be Subprocess
- Elemental: Parent must be Operation, CANNOT have children

**Tables Involved:**
- `component` - All process nodes
- `v_component_hierarchy` - View with parent names

---

### **Flow 5: Add Driver Data to Elemental Tasks**

**User Action:** Select Elemental Task → Add driver (Energy, Materials, etc.)

**Database Flow:**
```
1. PUT /api/components/:componentId
   Request: {
     driver_category: "Energy",
     driver_type: "Electricity (kWh)",
     driver_amount: 15.5,
     driver_unit: "kWh",
     mass: 100,
     mass_unit: "kg",
     capex: 0,
     opex: 125.50
   }
   → Validate: component_type = 'elemental'
   → UPDATE component SET driver_category=?, driver_type=?, ... WHERE component_id=?
   → INSERT INTO audit_log
   → Return updated component

2. GET /api/components/:componentId
   → SELECT * FROM component WHERE component_id = ?
   → Return component with driver data
```

**Tables Involved:**
- `component` - Driver fields (only for elemental type)
- `audit_log` - Change tracking

---

### **Flow 6: Add Input/Output Flows**

**User Action:** Select Elemental Task → Add Flows (inputs/outputs)

**Database Flow:**
```
1. POST /api/components/:componentId/flows
   Request: {
     substance_id: 1,  // Electricity
     direction: "input",
     amount: 15.5,
     unit: "kWh"
   }
   → Validate: component is elemental type
   → Validate: substance_id exists
   → INSERT INTO flows (component_id, substance_id, direction, amount, unit)
   → Return flow_id

2. GET /api/components/:componentId/flows
   → SELECT f.*, s.substance_name, s.category
     FROM flows f
     JOIN substances s ON f.substance_id = s.substance_id
     WHERE f.component_id = ?
     ORDER BY direction, substance_name
   → Return {inputs: [...], outputs: [...]}
```

**Example Flow Data:**
```json
{
  "inputs": [
    {
      "flow_id": 1,
      "substance_name": "Electricity",
      "amount": 15.5,
      "unit": "kWh"
    }
  ],
  "outputs": [
    {
      "flow_id": 2,
      "substance_name": "CO2",
      "amount": 7.2,
      "unit": "kg"
    }
  ]
}
```

**Tables Involved:**
- `flows` - Input/output substances
- `substances` - Material/energy/emission catalog

---

### **Flow 7: Run LCA Assessment (Calculate Impacts)**

**User Action:** Select Case → Run Assessment → View Results

**Database Flow:**
```
1. POST /api/cases/:caseId/assessments/run
   Request: {
     run_name: "Initial Assessment - 2025-01-17",
     geographic_region: "US"
   }

   STEP 1: Create assessment run
   → INSERT INTO assessment_runs (case_id, executed_by, run_name, run_at)
   → Get run_id

   STEP 2: Get all components with drivers
   → SELECT * FROM component
     WHERE case_id = ? AND component_type = 'elemental'
     AND driver_amount IS NOT NULL

   STEP 3: Calculate impacts for each component × impact category
   FOR EACH component:
     FOR EACH impact_category:
       → SELECT impact_factor FROM driver_impact_factors
         WHERE driver_name = component.driver_type
         AND category_id = impact_category.category_id
         AND geographic_region = 'US'
         AND (valid_from <= NOW() AND (valid_to IS NULL OR valid_to >= NOW()))

       → Calculate: impact_value = driver_amount × impact_factor

       → INSERT INTO assessment_results (
           run_id, component_id, category_id,
           impact_value, unit, contribution_percentage
         )

   STEP 4: Calculate case-level totals
   FOR EACH impact_category:
     → SUM(impact_value) WHERE run_id = ? AND category_id = ?
     → INSERT INTO assessment_results (
         run_id, component_id=NULL, category_id,
         impact_value=total, unit
       )

   STEP 5: Calculate financial totals
   → UPDATE assessment_runs SET
       total_opex = SUM(component.opex),
       total_capex = SUM(component.capex),
       total_cost = total_opex + total_capex
     WHERE run_id = ?

   → Return run_id

2. GET /api/assessments/:runId/results
   → SELECT ar.*, ic.category_name, ic.unit, c.component_name
     FROM assessment_results ar
     JOIN impact_categories ic ON ar.category_id = ic.category_id
     LEFT JOIN component c ON ar.component_id = c.component_id
     WHERE ar.run_id = ?
     ORDER BY ar.component_id, ic.category_name

   → Return structured results:
   {
     "totals": [...],  // component_id = NULL
     "component_results": [...]  // grouped by component
   }
```

**Calculation Example:**
```
Component: Electricity Consumption
Driver: 15.5 kWh

Impact Factor (US, Global Warming): 0.5 kg CO2-eq/kWh

Calculation: 15.5 kWh × 0.5 = 7.75 kg CO2-eq
```

**Tables Involved:**
- `assessment_runs` - Run metadata
- `assessment_results` - Calculated impacts
- `driver_impact_factors` - Conversion factors
- `impact_categories` - Impact types
- `component` - Driver data

---

### **Flow 8: View Historical Assessments**

**User Action:** Select Case → View Assessment History → Compare runs

**Database Flow:**
```
1. GET /api/cases/:caseId/assessments
   → SELECT ar.*, a.username as executed_by_name
     FROM assessment_runs ar
     JOIN account a ON ar.executed_by = a.id
     WHERE ar.case_id = ?
     ORDER BY ar.run_at DESC
   → Return assessment runs list

2. GET /api/assessments/compare
   Query: ?run1=1&run2=2
   → SELECT * FROM v_latest_assessment_results
     WHERE run_id IN (1, 2)
   → Compare totals side-by-side
   → Return comparison data
```

**Tables Involved:**
- `assessment_runs` - Run history
- `v_latest_assessment_results` - Pre-built view for totals

---

### **Flow 9: Team Collaboration**

**User Action:** Project Owner → Invite Team Member → Assign Permission

**Database Flow:**
```
1. POST /api/projects/:projectId/members
   Request: {
     email: "john@example.com",
     permission: "editor"  // or 'admin', 'viewer'
   }

   → SELECT id FROM account WHERE email = ?
   → If not found: Send invitation email
   → SELECT permission_id FROM permissions WHERE permission_name = 'editor'
   → INSERT INTO project_members (project_id, account_id, permission_id)
   → Return member info

2. GET /api/projects/:projectId/members
   → SELECT pm.*, a.username, a.email, p.permission_name
     FROM project_members pm
     JOIN account a ON pm.account_id = a.id
     JOIN permissions p ON pm.permission_id = p.permission_id
     WHERE pm.project_id = ?
   → Return team members list

3. DELETE /api/projects/:projectId/members/:memberId
   → Validate: User is owner
   → DELETE FROM project_members WHERE id = ?
   → Return success
```

**Permission Levels:**
- **owner**: Full control, can delete project, manage team
- **admin**: Can edit and manage team (cannot delete project)
- **editor**: Can edit project data
- **viewer**: Read-only access

**Tables Involved:**
- `project_members` - Team membership
- `permissions` - Role definitions
- `account` - User info

---

### **Flow 10: Audit Trail**

**User Action:** Admin → View Activity Log → Track changes

**Database Flow:**
```
1. GET /api/projects/:projectId/audit
   → SELECT al.*, a.username
     FROM audit_log al
     JOIN account a ON al.changed_by = a.id
     WHERE al.table_name IN ('project', 'case_table', 'component')
     AND al.record_id IN (
       -- Get all related record IDs
       SELECT project_id FROM project WHERE project_id = ? UNION
       SELECT case_id FROM case_table WHERE project_id = ? UNION
       SELECT component_id FROM component WHERE case_id IN (
         SELECT case_id FROM case_table WHERE project_id = ?
       )
     )
     ORDER BY al.changed_at DESC
     LIMIT 100

   → Return activity log with old/new values

2. POST /api/audit/log
   (Triggered automatically by application on any CREATE/UPDATE/DELETE)
   → INSERT INTO audit_log (
       table_name, record_id, action, changed_by,
       old_values, new_values
     )
```

**Audit Log Example:**
```json
{
  "log_id": 123,
  "table_name": "component",
  "record_id": 5,
  "action": "UPDATE",
  "changed_by": 1,
  "changed_at": "2025-01-17T14:30:00Z",
  "old_values": {"driver_amount": 10.0},
  "new_values": {"driver_amount": 15.5}
}
```

**Tables Involved:**
- `audit_log` - Complete change history

---

## 🔗 Database Connection Configuration

### **1. Environment Variables (.env.local)**

```env
# Database Connection
DATABASE_HOST=lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=EP76017fLefZ8?d!ezTHsN[kA()X

# AWS Configuration
AWS_REGION=us-east-1
AWS_SECRET_NAME=rds!db-fabed009-0d32-4d03-aa8a-54bb8209c1b4

# S3 Buckets
S3_BUCKET_ASSETS=lca-dev-assests
S3_BUCKET_BACKUPS=lca-dev-backups

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://35.170.250.110:3000
```

### **2. Database Client Setup (lib/db.ts)**

```typescript
import mysql from 'mysql2/promise';

// Connection pool configuration
const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('✅ Database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

export default pool;
```

### **3. Database Helper Functions (lib/db-helpers.ts)**

```typescript
import pool from './db';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

// Generic query function
export async function query<T extends RowDataPacket>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows;
}

// Insert with auto-increment ID return
export async function insert(
  sql: string,
  params?: any[]
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result.insertId;
}

// Update/Delete with affected rows count
export async function execute(
  sql: string,
  params?: any[]
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result.affectedRows;
}

// Transaction support
export async function transaction<T>(
  callback: (connection: any) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

---

## 📝 API Route Examples

### **Authentication Routes**

#### `/api/auth/signup` - POST
```typescript
import { hash } from 'bcrypt';
import { insert } from '@/lib/db-helpers';

export async function POST(req: Request) {
  const { username, email, password } = await req.json();

  // Hash password
  const password_hash = await hash(password, 10);

  // Insert user
  const userId = await insert(
    `INSERT INTO account (username, email, password_hash, account_type)
     VALUES (?, ?, ?, 'user')`,
    [username, email, password_hash]
  );

  // Create JWT token
  const token = createJWT({ id: userId, email });

  return Response.json({ userId, token });
}
```

#### `/api/auth/login` - POST
```typescript
import { compare } from 'bcrypt';
import { query } from '@/lib/db-helpers';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  // Find user
  const users = await query<any>(
    `SELECT id, email, password_hash, account_type, is_active
     FROM account WHERE email = ?`,
    [email]
  );

  if (users.length === 0) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const user = users[0];

  // Verify password
  const valid = await compare(password, user.password_hash);
  if (!valid || !user.is_active) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Create JWT
  const token = createJWT({ id: user.id, email: user.email });

  return Response.json({ token, user: { id: user.id, email: user.email } });
}
```

### **Project Routes**

#### `/api/projects` - GET
```typescript
import { query } from '@/lib/db-helpers';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: Request) {
  const userId = await verifyAuth(req);

  // Get projects where user is owner or member
  const projects = await query<any>(
    `SELECT DISTINCT p.*, a.username as owner_name,
            (SELECT permission_name FROM permissions perm
             JOIN project_members pm ON perm.permission_id = pm.permission_id
             WHERE pm.project_id = p.project_id AND pm.account_id = ?) as user_permission
     FROM project p
     JOIN account a ON p.owner_id = a.id
     LEFT JOIN project_members pm ON p.project_id = pm.project_id
     WHERE p.owner_id = ? OR pm.account_id = ?
     ORDER BY p.updated_at DESC`,
    [userId, userId, userId]
  );

  return Response.json({ projects });
}
```

#### `/api/projects` - POST
```typescript
import { insert, transaction } from '@/lib/db-helpers';
import { verifyAuth } from '@/lib/auth';

export async function POST(req: Request) {
  const userId = await verifyAuth(req);
  const { project_name, description } = await req.json();

  const projectId = await transaction(async (conn) => {
    // Create project
    const [result1] = await conn.execute(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, ?, ?)`,
      [project_name, description, userId]
    );
    const projectId = result1.insertId;

    // Add owner to project_members with owner permission
    await conn.execute(
      `INSERT INTO project_members (project_id, account_id, permission_id)
       VALUES (?, ?, (SELECT permission_id FROM permissions WHERE permission_name = 'owner'))`,
      [projectId, userId]
    );

    // Audit log
    await conn.execute(
      `INSERT INTO audit_log (table_name, record_id, action, changed_by, new_values)
       VALUES ('project', ?, 'CREATE', ?, ?)`,
      [projectId, userId, JSON.stringify({ project_name, description })]
    );

    return projectId;
  });

  return Response.json({ projectId });
}
```

### **Component Hierarchy Routes**

#### `/api/cases/:caseId/hierarchy` - GET
```typescript
import { query } from '@/lib/db-helpers';

export async function GET(req: Request, { params }: { params: { caseId: string } }) {
  const { caseId } = params;

  // Get all components for case
  const components = await query<any>(
    `SELECT * FROM v_component_hierarchy WHERE case_id = ? ORDER BY component_id`,
    [caseId]
  );

  // Build tree structure
  const buildTree = (parentId: number | null) => {
    return components
      .filter(c => c.parent_id === parentId)
      .map(c => ({
        ...c,
        children: buildTree(c.component_id)
      }));
  };

  const hierarchy = buildTree(null);

  return Response.json({ hierarchy });
}
```

---

## 🧪 Testing Strategy

### **1. Database Connection Test**
```bash
npm install mysql2
node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
  user: 'lcaadmin',
  password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
  database: 'lca_v3'
}).then(() => console.log('✅ Connected')).catch(err => console.error('❌', err));
"
```

### **2. API Testing Sequence**
```bash
# 1. Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 3. Create Project (use token from step 2)
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name":"Test Project","description":"Testing"}'

# 4. Create Base Case
curl -X POST http://localhost:3000/api/projects/1/cases \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_name":"Base Case","case_type":"base"}'

# 5. Add Product (root component)
curl -X POST http://localhost:3000/api/cases/1/components \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"component_name":"Product","component_type":"product","parent_id":null}'
```

---

## 📦 Required npm Packages

```bash
npm install mysql2
npm install bcrypt
npm install jsonwebtoken
npm install @types/bcrypt @types/jsonwebtoken --save-dev
```

---

## ✅ Checklist for Integration

- [ ] Install MySQL client library (mysql2)
- [ ] Create .env.local with database credentials
- [ ] Set up lib/db.ts connection pool
- [ ] Create lib/db-helpers.ts utility functions
- [ ] Implement authentication APIs (signup, login)
- [ ] Implement project CRUD APIs
- [ ] Implement case management APIs
- [ ] Implement component hierarchy APIs
- [ ] Implement assessment calculation logic
- [ ] Add audit logging to all mutations
- [ ] Test complete user flow end-to-end
- [ ] Verify data persists correctly in RDS
- [ ] Set up error handling and logging
- [ ] Add input validation
- [ ] Implement permission checks on all routes

---

**Next Steps:** Once database schema is deployed, I'll help you:
1. Set up the Next.js database connection
2. Create API routes for each table
3. Implement authentication
4. Build component hierarchy management
5. Create LCA calculation engine
6. Test complete workflows

**Ready to connect your application once the schema is deployed!**
