# LCA Project v3 - Database Integration Complete! 🎉

## ✅ What's Been Completed

I've successfully analyzed your database schema and created a complete integration between your Next.js application and the AWS RDS MySQL database.

---

## 📁 Files Created

### **Database Connection Layer**
1. **`lib/db.ts`** - MySQL connection pool
2. **`lib/db-helpers.ts`** - Database utility functions (query, insert, execute, transaction)
3. **`lib/auth.ts`** - Authentication utilities (JWT, password hashing, permissions)

### **API Routes**
4. **`app/api/auth/signup/route.ts`** - User registration
5. **`app/api/auth/login/route.ts`** - User authentication
6. **`app/api/auth/me/route.ts`** - Get current user

### **Configuration**
7. **`.env.local.example`** - Environment variables template
8. **`DATABASE_INTEGRATION_GUIDE.md`** - Complete integration documentation
9. **`SETUP_AND_TEST.md`** - Step-by-step setup and testing guide

---

## 📊 Database Schema Understanding

Your LCA v3 database has **13 interconnected tables**:

### **Authentication & Users** (3 tables)
- `account` - User credentials and profiles
- `permissions` - Role definitions (owner, admin, editor, viewer)
- `project_members` - Team collaboration and access control

### **Project Structure** (3 tables)
- `project` - Top-level LCA studies
- `case_table` - Scenarios (1 base + N comparative cases)
- `component` - **5-level hierarchy** (Product → Machine → Subprocess → Operation → Elemental)

### **LCA Data & Calculations** (4 tables)
- `substances` - Materials, energy, emissions catalog
- `flows` - Input/output substances per component
- `impact_categories` - Environmental impact types (Global warming, etc.)
- `driver_impact_factors` - Conversion factors for calculations

### **Results & Compliance** (3 tables)
- `assessment_runs` - Calculation execution history
- `assessment_results` - Impact values per component × category
- `audit_log` - Complete change tracking for compliance

---

## 🔄 User Flow Mapping

I've mapped out all 10 major user workflows:

1. **User Sign Up** → `account` table
2. **User Login** → JWT token generation
3. **Create Project** → `project` + `project_members` tables
4. **Create Base Case** → `case_table` with validation
5. **Build Process Hierarchy** → `component` with 5-level tree
6. **Add Driver Data** → `component` fields (driver_category, driver_amount, etc.)
7. **Add Input/Output Flows** → `flows` + `substances` linkage
8. **Run LCA Assessment** → Calculate impacts → `assessment_runs` + `assessment_results`
9. **View Historical Assessments** → Query and compare runs
10. **Team Collaboration** → `project_members` + `permissions`

**Complete flow documentation in `DATABASE_INTEGRATION_GUIDE.md`**

---

## 🚀 How to Get Started

### **Step 1: Install Dependencies**
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
npm install mysql2 bcrypt jsonwebtoken
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

### **Step 2: Configure Environment**
```bash
cp .env.local.example .env.local
# File already has correct RDS credentials
```

### **Step 3: Deploy Database Schema**
**⚠️ IMPORTANT: Schema must be deployed first!**

Choose one of these methods from `HOW_TO_COMPLETE_SETUP.md`:
- **Option 1:** Find SSH key → Run `./deploy-from-ec2.sh` (5 min)
- **Option 2:** Use TablePlus/MySQL Workbench → Import SQL manually (15 min)
- **Option 3:** Configure SSM on EC2 → Deploy remotely (30 min)

### **Step 4: Test Database Connection**
```bash
# Create test file
cat > test-db-connection.js << 'EOF'
const mysql = require('mysql2/promise');
async function test() {
  const conn = await mysql.createConnection({
    host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });
  console.log('✅ Connected!');
  const [rows] = await conn.execute('SHOW TABLES');
  console.log('Tables:', rows);
  await conn.end();
}
test();
EOF

node test-db-connection.js
```

**Expected:** Should show 13 tables

### **Step 5: Start Development Server**
```bash
npm run dev
```

Server starts at `http://localhost:3000`

### **Step 6: Test Authentication API**
```bash
# Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# Get user info (use token from login)
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Detailed testing guide in `SETUP_AND_TEST.md`**

---

## 📖 Documentation Structure

### **1. DATABASE_INTEGRATION_GUIDE.md** (Most Important)
- Complete database schema explanation
- All 10 user flows mapped to database operations
- SQL examples for each operation
- API route implementation examples
- Database connection setup
- Authentication system design

### **2. SETUP_AND_TEST.md**
- Step-by-step installation instructions
- Environment configuration
- Test scripts for connection
- Complete testing flow with curl commands
- Troubleshooting guide
- Success checklist

### **3. HOW_TO_COMPLETE_SETUP.md**
- Options for deploying database schema
- RDS access methods (SSH, SSM, manual)
- Database credentials
- After-deployment steps

### **4. COST_OPTIMIZATION_COMPLETE.md**
- Budget breakdown
- Cost savings achieved ($91.50/month)
- Infrastructure summary

---

## 🗂️ Database Schema Files

- **`lca_v3_drawsql_schema.sql`** - Complete schema with 13 tables
- Ready to deploy to RDS
- Includes foreign keys, indexes, constraints, and views
- Sample data commented out (will be seeded separately)

---

## 🔐 Authentication System

### **How It Works**
1. User signs up → Password hashed with bcrypt → Stored in `account` table
2. User logs in → Password verified → JWT token generated
3. Protected routes → Token verified → User ID extracted
4. Permission checks → Query `project_members` + `permissions` tables

### **JWT Token Payload**
```json
{
  "id": 1,
  "email": "user@example.com",
  "account_type": "user",
  "iat": 1705521600,
  "exp": 1706126400
}
```

### **Permission Levels**
- **owner**: Full control, can delete project
- **admin**: Manage project and team
- **editor**: Edit project data
- **viewer**: Read-only access

---

## 🏗️ Component Hierarchy Structure

Your app uses a **5-level self-referencing tree**:

```
Level 1: Product (root)
  └─ Level 2: Machine/Line
     └─ Level 3: Subprocess
        └─ Level 4: Operation
           └─ Level 5: Elemental Task
```

**Rules Enforced:**
- Product must have `parent_id = NULL`
- Each level can only be child of specific parent type
- Elemental tasks cannot have children
- Elemental tasks contain driver data (energy, materials, costs)

**Database Table:** `component` with self-referencing `parent_id` foreign key

---

## 📊 LCA Calculation Flow

### **How Assessment Works**

1. **User triggers:** "Run Assessment" button
2. **Create run:** Insert into `assessment_runs` table
3. **Get components:** Query all elemental tasks with drivers
4. **For each component × impact category:**
   - Get `driver_impact_factor` (e.g., Electricity → Global warming = 0.5 kg CO2-eq/kWh)
   - Calculate: `impact_value = driver_amount × impact_factor`
   - Insert into `assessment_results`
5. **Calculate totals:** SUM impacts per category
6. **Calculate costs:** SUM all OPEX and CAPEX
7. **Return results:** Structured by component and category

### **Example Calculation**
```
Component: Electricity Consumption
Driver: 15.5 kWh
Impact Factor (US, Global warming): 0.5 kg CO2-eq/kWh

Calculation: 15.5 × 0.5 = 7.75 kg CO2-eq
```

---

## 🎯 Next API Routes to Build

After authentication works, create:

### **Projects**
- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

### **Cases**
- `POST /api/projects/:projectId/cases`
- `GET /api/projects/:projectId/cases`

### **Components (Hierarchy)**
- `POST /api/cases/:caseId/components`
- `GET /api/cases/:caseId/hierarchy`
- `PUT /api/components/:id`

### **Flows**
- `POST /api/components/:componentId/flows`
- `GET /api/components/:componentId/flows`

### **Assessments**
- `POST /api/cases/:caseId/assessments/run`
- `GET /api/assessments/:runId/results`

**Code examples for all routes in `DATABASE_INTEGRATION_GUIDE.md`**

---

## 📋 Current Status Summary

### ✅ Completed
- [x] Database schema analyzed (13 tables)
- [x] User flows mapped (10 major workflows)
- [x] Database connection layer (`lib/db.ts`)
- [x] Database helpers (`lib/db-helpers.ts`)
- [x] Authentication system (`lib/auth.ts`)
- [x] Auth API routes (signup, login, me)
- [x] Environment configuration
- [x] Complete documentation

### ⏳ Pending (Blocked by Schema Deployment)
- [ ] Deploy database schema to RDS
- [ ] Test database connection
- [ ] Test authentication APIs
- [ ] Create remaining API routes
- [ ] Build frontend integration
- [ ] End-to-end testing

### 🚫 Blockers
- **Database schema not deployed** (need EC2 SSH key or manual deployment)
- Once schema is deployed → Can test everything immediately

---

## 💡 Key Insights

### **Architecture Highlights**
1. **Clean separation:** Database layer → API routes → Frontend
2. **Type safety:** TypeScript interfaces for all database operations
3. **Security:** JWT tokens, bcrypt password hashing, permission checks
4. **Compliance:** Complete audit trail in `audit_log` table
5. **Performance:** Connection pooling, indexed queries, optimized views

### **Database Design Strengths**
1. **Self-referencing hierarchy:** Flexible 5-level component tree
2. **Cascade deletes:** Referential integrity maintained automatically
3. **Business rules:** Check constraints enforce data validity
4. **Temporal tracking:** `created_at` and `updated_at` on all tables
5. **Multi-tenancy:** Project-based access control with team collaboration

### **Calculation Engine**
1. **Driver-based:** Environmental loads calculated from drivers (energy, materials)
2. **Geographic factors:** Regional impact factors (US vs EU vs global)
3. **Temporal factors:** Impact factors valid from/to dates
4. **Historical tracking:** All assessment runs preserved for comparison

---

## 🎉 Summary

**I've created a complete database integration system for your LCA Project v3!**

### **What You Have:**
- ✅ Full understanding of 13-table database schema
- ✅ Complete user flow documentation (10 workflows)
- ✅ Database connection and helper utilities
- ✅ JWT authentication system
- ✅ API routes for user signup/login
- ✅ Code examples for all remaining routes
- ✅ Comprehensive setup and testing guides

### **What's Next:**
1. Deploy database schema (5-30 minutes depending on method)
2. Install npm packages (`npm install mysql2 bcrypt jsonwebtoken`)
3. Test authentication APIs with provided curl commands
4. Build remaining API routes using provided examples
5. Test complete user flows end-to-end

### **When You're Ready:**
- All code is written and documented
- Just need schema deployed to RDS
- Then can test everything immediately

---

## 📞 Quick Reference

### **Database Credentials**
```
Host: lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
Port: 3306
Database: lca_v3
Username: lcaadmin
Password: EP76017fLefZ8?d!ezTHsN[kA()X
```

### **Key Files**
- Integration Guide: `DATABASE_INTEGRATION_GUIDE.md`
- Setup Instructions: `SETUP_AND_TEST.md`
- Schema Deployment: `HOW_TO_COMPLETE_SETUP.md`
- Database Schema: `lca_v3_drawsql_schema.sql`

### **Next Action**
Deploy the database schema, then run:
```bash
npm install mysql2 bcrypt jsonwebtoken
npm run dev
```

Then test with curl commands from `SETUP_AND_TEST.md`

---

**Your database integration is ready! Just waiting for schema deployment. 🚀**
