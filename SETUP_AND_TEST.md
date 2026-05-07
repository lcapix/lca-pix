# LCA Project v3 - Setup and Testing Guide

## 🚀 Complete Setup Instructions

### Step 1: Install Dependencies

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"

# Install database and authentication packages
npm install mysql2 bcrypt jsonwebtoken
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

### Step 2: Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# The .env.local file already has the correct credentials
# Just verify these values are set:
```

Your `.env.local` should contain:
```env
DATABASE_HOST=lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=EP76017fLefZ8?d!ezTHsN[kA()X
JWT_SECRET=your-random-secret-key-change-this
NODE_ENV=development
```

### Step 3: Test Database Connection

Create a test file:

```bash
cat > test-db-connection.js << 'EOF'
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: 'lcaadmin',
      password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
      database: 'lca_v3'
    });

    console.log('✅ Database connection successful!');

    // Test query
    const [rows] = await connection.execute('SHOW TABLES');
    console.log('📊 Tables in database:');
    rows.forEach(row => {
      console.log('   -', Object.values(row)[0]);
    });

    await connection.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
EOF

node test-db-connection.js
```

**Expected Output:**
```
✅ Database connection successful!
📊 Tables in database:
   - account
   - assessment_results
   - assessment_runs
   - audit_log
   - case_table
   - component
   - driver_impact_factors
   - flows
   - impact_categories
   - permissions
   - project
   - project_members
   - substances
```

### Step 4: Start Development Server

```bash
npm run dev
```

Server should start at `http://localhost:3000`

---

## 🧪 Complete Testing Flow

### Test 1: User Registration

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
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

**Save the token for next requests!**

### Test 2: User Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
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

### Test 3: Get Current User

```bash
# Replace YOUR_TOKEN with the token from login
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "account_type": "user",
    "is_active": true,
    "created_at": "2025-01-17T12:00:00.000Z"
  }
}
```

---

## 🔍 Verify Data in Database

### Check User was Created

```bash
node -e "
const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  const [users] = await conn.execute('SELECT id, username, email, account_type, is_active, created_at FROM account');
  console.log('Users in database:');
  console.table(users);

  await conn.end();
}

check();
"
```

**Expected Output:**
```
Users in database:
┌─────────┬────┬───────────┬──────────────────┬──────────────┬───────────┬─────────────────────────┐
│ (index) │ id │ username  │ email            │ account_type │ is_active │ created_at              │
├─────────┼────┼───────────┼──────────────────┼──────────────┼───────────┼─────────────────────────┤
│    0    │ 1  │ 'john_doe'│'john@example.com'│   'user'     │     1     │ 2025-01-17T12:00:00.000Z│
└─────────┴────┴───────────┴──────────────────┴──────────────┴───────────┴─────────────────────────┘
```

---

## 📝 Next API Routes to Create

After authentication works, create these routes:

### **Projects API**
- `POST /api/projects` - Create new project
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### **Cases API**
- `POST /api/projects/:projectId/cases` - Create case
- `GET /api/projects/:projectId/cases` - List cases
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### **Components API**
- `POST /api/cases/:caseId/components` - Create component
- `GET /api/cases/:caseId/hierarchy` - Get full hierarchy
- `PUT /api/components/:id` - Update component (add driver data)
- `DELETE /api/components/:id` - Delete component

### **Flows API**
- `POST /api/components/:componentId/flows` - Add flow
- `GET /api/components/:componentId/flows` - Get flows
- `DELETE /api/flows/:id` - Delete flow

### **Assessment API**
- `POST /api/cases/:caseId/assessments/run` - Run LCA calculation
- `GET /api/assessments/:runId/results` - Get results
- `GET /api/cases/:caseId/assessments` - List all runs

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'mysql2'"
```bash
npm install mysql2
```

### Issue: "Cannot find module 'bcrypt'"
```bash
npm install bcrypt
npm install @types/bcrypt --save-dev
```

### Issue: "Database connection failed"
Check:
1. RDS is deployed (schema should be in database)
2. RDS is in "available" status
3. Security group allows connections from EC2 or your IP
4. .env.local has correct credentials

### Issue: "Invalid token"
- Token expires after 7 days
- Get a new token by logging in again
- Make sure JWT_SECRET in .env.local matches server

### Issue: "ECONNREFUSED" or Connection timeout
- Database is in private VPC
- Can only connect from EC2 instance
- Deploy application to EC2 for production access

---

## 📊 Database Schema Summary

Your database has these tables ready:

### **User & Auth**
- `account` - User accounts (id, username, email, password_hash, account_type)
- `permissions` - Role definitions (owner, admin, editor, viewer)
- `project_members` - Team collaboration (project_id, account_id, permission_id)

### **Project Structure**
- `project` - Projects (project_id, project_name, description, owner_id)
- `case_table` - Scenarios (case_id, project_id, case_name, case_type)
- `component` - 5-level hierarchy (component_id, parent_id, component_type)

### **LCA Data**
- `substances` - Materials/energy/emissions catalog
- `flows` - Input/output substances per component
- `impact_categories` - Environmental impact types
- `driver_impact_factors` - Calculation conversion factors

### **Results & Audit**
- `assessment_runs` - Calculation execution history
- `assessment_results` - Calculated impact values
- `audit_log` - Complete change tracking

---

## ✅ Success Checklist

- [ ] Dependencies installed (mysql2, bcrypt, jsonwebtoken)
- [ ] .env.local configured with database credentials
- [ ] Test connection script runs successfully
- [ ] Development server starts without errors
- [ ] `/api/auth/signup` creates new users
- [ ] `/api/auth/login` returns valid JWT token
- [ ] `/api/auth/me` returns user info with token
- [ ] User data visible in database
- [ ] Ready to build remaining API routes

---

## 🚀 Next Steps

1. **Deploy Database Schema** (if not done yet)
   - Use one of the methods in `HOW_TO_COMPLETE_SETUP.md`

2. **Test Authentication Flow**
   - Run all curl commands above
   - Verify users are created in database

3. **Create Project Management Routes**
   - Reference `DATABASE_INTEGRATION_GUIDE.md` for examples

4. **Build Frontend Components**
   - Connect to API routes
   - Test complete user flows

5. **Deploy to EC2**
   - Install Node.js on EC2
   - Clone repo and configure environment
   - Run with PM2 for production

---

**You're ready to start testing! 🎉**

Run `npm run dev` and test the authentication API routes.
