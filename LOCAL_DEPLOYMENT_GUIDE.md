# Local Deployment Guide - LCA Project v3

**Document Version**: 1.0
**Date**: January 2025
**Purpose**: Complete guide to run LCA Project v3 on your local machine

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (5 Minutes)](#2-quick-start-5-minutes)
3. [Detailed Setup Instructions](#3-detailed-setup-instructions)
4. [Database Setup](#4-database-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Running the Application](#6-running-the-application)
7. [Accessing the Application](#7-accessing-the-application)
8. [Testing the Installation](#8-testing-the-installation)
9. [Troubleshooting](#9-troubleshooting)
10. [Production Deployment](#10-production-deployment)

---

## 1. Prerequisites

Before you begin, ensure you have the following installed on your machine:

### Required Software

| Software | Minimum Version | Download Link | Purpose |
|----------|----------------|---------------|---------|
| **Node.js** | 18.17.0 or higher | [nodejs.org](https://nodejs.org/) | JavaScript runtime |
| **npm** | 9.6.7 or higher | Included with Node.js | Package manager |
| **MySQL** | 8.0 or higher | [mysql.com](https://dev.mysql.com/downloads/mysql/) | Database server |
| **Git** | 2.0 or higher | [git-scm.com](https://git-scm.com/) | Version control |

### Optional but Recommended

| Software | Purpose | Download Link |
|----------|---------|---------------|
| **MySQL Workbench** | GUI for database management | [mysql.com/workbench](https://www.mysql.com/products/workbench/) |
| **TablePlus** | Alternative database GUI | [tableplus.com](https://tableplus.com/) |
| **VS Code** | Code editor | [code.visualstudio.com](https://code.visualstudio.com/) |

### System Requirements

- **Operating System**: macOS, Windows, or Linux
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 500MB for project + 1GB for database
- **Internet**: Required for initial setup (downloading dependencies)

---

## 2. Quick Start (5 Minutes)

For experienced developers who want to get started immediately:

```bash
# 1. Clone the repository (if not already downloaded)
cd /Users/kavishpandit/Desktop/lca/lca\ project\ v3

# 2. Install dependencies
npm install

# 3. Set up MySQL database
mysql -u root -p
CREATE DATABASE lca_v3;
CREATE USER 'lca_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON lca_v3.* TO 'lca_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 4. Import database schema
mysql -u lca_user -p lca_v3 < lca_v3_drawsql_schema.sql

# 5. Create environment file
cp .env.local.example .env.local

# Edit .env.local with your database credentials
# DATABASE_HOST=localhost
# DATABASE_PORT=3306
# DATABASE_NAME=lca_v3
# DATABASE_USER=lca_user
# DATABASE_PASSWORD=your_secure_password

# 6. Run the application
npm run dev

# 7. Open browser to http://localhost:3002
```

If you encounter any issues, continue to the detailed instructions below.

---

## 3. Detailed Setup Instructions

### Step 1: Verify Prerequisites

#### Check Node.js Installation

```bash
node --version
# Should output: v18.17.0 or higher
```

If not installed or version is too old:
- **macOS**: `brew install node` (if you have Homebrew)
- **Windows**: Download installer from [nodejs.org](https://nodejs.org/)
- **Linux**: `sudo apt install nodejs npm` (Ubuntu/Debian)

#### Check MySQL Installation

```bash
mysql --version
# Should output: mysql  Ver 8.0.x or higher
```

If not installed:

**macOS**:
```bash
# Using Homebrew
brew install mysql
brew services start mysql
```

**Windows**:
1. Download MySQL Installer from [mysql.com](https://dev.mysql.com/downloads/installer/)
2. Run installer and select "Developer Default"
3. Set root password when prompted
4. Start MySQL service

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation
```

### Step 2: Navigate to Project Directory

```bash
cd /Users/kavishpandit/Desktop/lca/lca\ project\ v3
```

Or if you're cloning fresh:

```bash
cd /Users/kavishpandit/Desktop/lca
git clone <your-repo-url>
cd lca\ project\ v3
```

### Step 3: Install Project Dependencies

```bash
npm install
```

**What this does**:
- Downloads all required Node.js packages (~30 dependencies)
- Creates `node_modules` folder
- May take 2-5 minutes depending on internet speed

**Expected output**:
```
added 500+ packages in 3m
```

**Common issues**:
- If you see permission errors on macOS/Linux, try: `sudo npm install`
- If you see Python errors, install Python 3: `brew install python3` (macOS)

---

## 4. Database Setup

### Option A: Local MySQL Setup (Recommended for Development)

#### Step 1: Start MySQL Server

**macOS**:
```bash
# If installed via Homebrew
brew services start mysql

# Verify it's running
brew services list | grep mysql
# Should show: mysql started
```

**Windows**:
1. Open Services (Win + R, type `services.msc`)
2. Find "MySQL80" service
3. Right-click → Start

**Linux**:
```bash
sudo systemctl start mysql
sudo systemctl status mysql
```

#### Step 2: Create Database and User

Open MySQL command line:

```bash
mysql -u root -p
# Enter your MySQL root password when prompted
```

Inside MySQL prompt, run these commands:

```sql
-- 1. Create the database
CREATE DATABASE lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Create a dedicated user (more secure than using root)
CREATE USER 'lca_user'@'localhost' IDENTIFIED BY 'LCA_secure_pass_2025!';

-- 3. Grant permissions to the user
GRANT ALL PRIVILEGES ON lca_v3.* TO 'lca_user'@'localhost';

-- 4. Apply the changes
FLUSH PRIVILEGES;

-- 5. Verify database was created
SHOW DATABASES;
-- You should see lca_v3 in the list

-- 6. Exit MySQL
EXIT;
```

**Security Note**: Change `LCA_secure_pass_2025!` to a strong password of your choice.

#### Step 3: Import Database Schema

```bash
# Import the main schema
mysql -u lca_user -p lca_v3 < lca_v3_drawsql_schema.sql
# Enter password: LCA_secure_pass_2025! (or your chosen password)

# Verify tables were created
mysql -u lca_user -p lca_v3 -e "SHOW TABLES;"
```

**Expected output**:
```
+-------------------------+
| Tables_in_lca_v3        |
+-------------------------+
| account                 |
| assessment_results      |
| assessment_runs         |
| audit_log               |
| case_table              |
| component               |
| driver_impact_factors   |
| flows                   |
| impact_categories       |
| permissions             |
| project                 |
| project_members         |
| substances              |
+-------------------------+
13 rows in set
```

#### Step 4: Load Sample Data (Optional but Recommended)

```bash
# Load test data for development
mysql -u lca_user -p lca_v3 < create-test-data.sql
```

This creates:
- Sample user accounts (username: `demo`, password: `demo123`)
- Sample project with components
- Sample substances and impact categories
- Test flows and assessment data

### Option B: Use Existing AWS RDS Database

If you want to connect to the existing AWS database instead:

**Pros**:
- ✅ No local MySQL installation needed
- ✅ Pre-populated with data
- ✅ Same data as production

**Cons**:
- ❌ Requires internet connection
- ❌ Slower than local database
- ❌ May incur AWS costs

**Connection details** (from `.env.local.example`):
```
DATABASE_HOST=lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=EP76017fLefZ8?d!ezTHsN[kA()X
```

---

## 5. Environment Configuration

### Step 1: Create Environment File

```bash
# Copy the example file
cp .env.local.example .env.local
```

### Step 2: Edit Environment Variables

Open `.env.local` in your text editor:

```bash
# macOS/Linux
nano .env.local

# Or use VS Code
code .env.local
```

### Step 3: Configure for Local Database

**For Local MySQL Setup**, replace the content with:

```env
# ============================================================================
# LOCAL DEVELOPMENT CONFIGURATION
# ============================================================================

# Database Configuration (Local MySQL)
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lca_user
DATABASE_PASSWORD=LCA_secure_pass_2025!

# JWT Authentication
JWT_SECRET=my-super-secret-jwt-key-change-this-in-production-abc123xyz789
JWT_EXPIRES_IN=7d

# Application Configuration
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3002

# AWS Configuration (Optional - only if using S3/RDS)
# AWS_REGION=us-east-1
# S3_BUCKET_ASSETS=lca-dev-assests
# S3_BUCKET_BACKUPS=lca-dev-backups
```

**Important**:
- Change `DATABASE_PASSWORD` to match what you set in Step 4.2
- Change `JWT_SECRET` to a random string (at least 32 characters)
- Never commit `.env.local` to Git (it's already in `.gitignore`)

### Step 4: Generate Secure JWT Secret (Optional but Recommended)

```bash
# Generate a random 64-character string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` in `.env.local`.

### Configuration Options Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_HOST` | MySQL server location | `localhost` or `127.0.0.1` |
| `DATABASE_PORT` | MySQL port | `3306` (default) |
| `DATABASE_NAME` | Database name | `lca_v3` |
| `DATABASE_USER` | Database username | `lca_user` |
| `DATABASE_PASSWORD` | Database password | Your secure password |
| `JWT_SECRET` | Secret for JWT tokens | Random string (64+ chars) |
| `JWT_EXPIRES_IN` | Token expiry time | `7d` (7 days) |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `NEXT_PUBLIC_API_URL` | Frontend API URL | `http://localhost:3002` |

---

## 6. Running the Application

### Development Mode (Hot Reload)

This is the recommended mode for development - changes to code are automatically reloaded.

```bash
npm run dev
```

**Expected output**:
```
  ▲ Next.js 15.2.4
  - Local:        http://localhost:3002
  - Network:      http://192.168.1.100:3002

 ✓ Ready in 2.3s
```

**What this does**:
- Starts Next.js development server on port 3002
- Enables hot module replacement (auto-refresh on code changes)
- Shows detailed error messages
- Slower than production but better for debugging

### Production Mode (Optimized Build)

For testing production performance locally:

```bash
# Step 1: Build the application
npm run build

# Step 2: Start production server
npm run start
```

**Build output**:
```
  ▲ Next.js 15.2.4

  Creating an optimized production build ...
  ✓ Compiled successfully
  ✓ Linting and checking validity of types
  ✓ Collecting page data
  ✓ Generating static pages (12/12)
  ✓ Finalizing page optimization

  Route (app)                              Size     First Load JS
  ┌ ○ /                                   142 B          87.1 kB
  ├ ○ /auth/login                         312 B          88.2 kB
  ├ ○ /auth/signup                        298 B          88.1 kB
  └ ○ /home                               456 B          89.3 kB

  ○  (Static)  prerendered as static content
```

**Production mode benefits**:
- ✅ Faster page loads
- ✅ Optimized JavaScript bundles
- ✅ Compressed assets
- ✅ Better performance testing

### Running on Different Port

If port 3002 is already in use:

```bash
# Temporarily change port
PORT=3003 npm run dev

# Or edit package.json
# Change "dev": "next dev -p 3002" to "dev": "next dev -p 3003"
```

### Running in Background

**macOS/Linux**:
```bash
# Run in background
nohup npm run dev > output.log 2>&1 &

# Check if running
ps aux | grep next

# Stop background process
pkill -f "next dev"
```

**Windows** (PowerShell):
```powershell
# Run in background
Start-Process npm -ArgumentList "run dev" -WindowStyle Hidden

# Stop all Node processes
Get-Process node | Stop-Process
```

---

## 7. Accessing the Application

### Open in Browser

Once the server is running, open your browser and navigate to:

```
http://localhost:3002
```

### Application Pages

| URL | Page | Purpose |
|-----|------|---------|
| `http://localhost:3002/` | Landing Page | Welcome screen |
| `http://localhost:3002/auth/login` | Login | User authentication |
| `http://localhost:3002/auth/signup` | Sign Up | New account registration |
| `http://localhost:3002/home` | Dashboard | User home page |
| `http://localhost:3002/project/new` | New Project | Create LCA project |

### Default Test Accounts

If you loaded the test data, you can use these accounts:

| Username | Password | Role | Email |
|----------|----------|------|-------|
| `demo` | `demo123` | User | demo@lcaproject.com |
| `admin` | `admin123` | Admin | admin@lcaproject.com |

**Security Note**: These are test accounts only. Delete them in production!

### Network Access (Access from Other Devices)

To access the app from other devices on your network:

1. Find your local IP address:

**macOS/Linux**:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for something like: inet 192.168.1.100
```

**Windows**:
```cmd
ipconfig
# Look for IPv4 Address under your active network adapter
```

2. Update `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://192.168.1.100:3002
```

3. Restart the server:
```bash
npm run dev
```

4. Access from other devices:
```
http://192.168.1.100:3002
```

**Note**: Your firewall may block incoming connections. Allow Node.js through the firewall if prompted.

---

## 8. Testing the Installation

### 8.1 Database Connection Test

```bash
# Test database connection
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME
    });
    console.log('✅ Database connection successful!');
    await connection.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}
test();
"
```

**Expected output**:
```
✅ Database connection successful!
```

### 8.2 Manual Testing Checklist

Once the application is running, test these features:

#### Authentication
- [ ] Visit `http://localhost:3002/auth/signup`
- [ ] Create a new account
- [ ] Verify email validation works
- [ ] Log out
- [ ] Log in with created account
- [ ] Verify redirect to home page

#### Project Management
- [ ] Click "New Project" button
- [ ] Enter project name and description
- [ ] Create project
- [ ] Verify project appears in list
- [ ] Click project to view details

#### Case Creation
- [ ] Inside project, click "New Case"
- [ ] Create a base case
- [ ] Verify case is created

#### Component Creation
- [ ] Inside case, click "Add Component"
- [ ] Fill in component details
- [ ] Add environmental flows
- [ ] Save component

#### Assessment Run
- [ ] Click "Run Assessment"
- [ ] View results
- [ ] Check impact categories are displayed
- [ ] Verify charts render correctly

### 8.3 Automated API Tests

Create a test file `test-api.js`:

```javascript
const https = require('http');

const BASE_URL = 'http://localhost:3002';

async function testAPI(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`✅ ${method} ${endpoint} - Status: ${res.statusCode}`);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.error(`❌ ${method} ${endpoint} - Error: ${error.message}`);
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Starting API tests...\n');

  await testAPI('/');
  await testAPI('/auth/login');
  await testAPI('/auth/signup');
  await testAPI('/home');

  console.log('\n✅ All API tests completed!');
}

runTests();
```

Run the tests:
```bash
node test-api.js
```

---

## 9. Troubleshooting

### Common Issues and Solutions

#### Issue 1: Port 3002 Already in Use

**Error**:
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solution**:
```bash
# Find process using port 3002
lsof -ti:3002

# Kill the process
kill -9 $(lsof -ti:3002)

# Or change port in package.json
# "dev": "next dev -p 3003"
```

#### Issue 2: Cannot Connect to Database

**Error**:
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions**:

1. **Check if MySQL is running**:
```bash
# macOS
brew services list | grep mysql

# Linux
sudo systemctl status mysql

# Windows
services.msc → Find MySQL80 service
```

2. **Start MySQL**:
```bash
# macOS
brew services start mysql

# Linux
sudo systemctl start mysql
```

3. **Verify credentials in `.env.local`**:
```bash
mysql -u lca_user -p
# If this fails, your credentials are wrong
```

#### Issue 3: MySQL Access Denied

**Error**:
```
Error: Access denied for user 'lca_user'@'localhost'
```

**Solution**:
```sql
-- Log in as root
mysql -u root -p

-- Reset user password
ALTER USER 'lca_user'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;

-- Update .env.local with new password
```

#### Issue 4: Missing node_modules

**Error**:
```
Error: Cannot find module 'next'
```

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue 5: Next.js Build Errors

**Error**:
```
Error: Module not found: Can't resolve '@/components/...'
```

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run dev
```

#### Issue 6: Database Schema Issues

**Error**:
```
Error: Table 'lca_v3.account' doesn't exist
```

**Solution**:
```bash
# Re-import schema
mysql -u lca_user -p lca_v3 < lca_v3_drawsql_schema.sql

# Verify tables exist
mysql -u lca_user -p lca_v3 -e "SHOW TABLES;"
```

#### Issue 7: JWT Authentication Fails

**Error**:
```
Error: jwt malformed
```

**Solution**:
```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update JWT_SECRET in .env.local
# Clear browser cookies and try again
```

#### Issue 8: CSS Not Loading

**Error**:
- Page loads but looks unstyled
- Missing Tailwind CSS classes

**Solution**:
```bash
# Restart dev server
npm run dev

# If that doesn't work, rebuild
rm -rf .next
npm run dev
```

### Debug Mode

Enable verbose logging:

```bash
# Set debug environment variable
DEBUG=* npm run dev

# Or enable Next.js debug mode
NODE_OPTIONS='--inspect' npm run dev
```

Then open Chrome DevTools:
1. Open Chrome
2. Navigate to `chrome://inspect`
3. Click "Open dedicated DevTools for Node"

### Getting Help

If you're still stuck:

1. **Check the logs**:
   - Development server logs in terminal
   - Browser console (F12 → Console tab)
   - MySQL logs: `tail -f /usr/local/var/mysql/*.err` (macOS)

2. **Common log locations**:
   - Next.js: Terminal where you ran `npm run dev`
   - MySQL (macOS): `/usr/local/var/mysql/`
   - MySQL (Linux): `/var/log/mysql/`
   - MySQL (Windows): `C:\ProgramData\MySQL\MySQL Server 8.0\Data\`

3. **Database connection test**:
```bash
mysql -u lca_user -p -h localhost lca_v3 -e "SELECT 1;"
```

---

## 10. Production Deployment

### Building for Production

```bash
# 1. Create production environment file
cp .env.local.example .env.production

# 2. Edit .env.production with production values
# - Use strong passwords
# - Use production database
# - Set NODE_ENV=production

# 3. Build the application
npm run build

# 4. Test production build locally
npm run start
```

### Production Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong JWT secret (64+ characters)
- [ ] Use production database (not test data)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS/SSL
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Set up monitoring/logging
- [ ] Remove test accounts
- [ ] Update CORS settings
- [ ] Set up rate limiting
- [ ] Configure reverse proxy (nginx/Apache)

### Deployment Options

#### Option 1: AWS Deployment (Recommended)

See separate guide: `AWS_DEPLOYMENT_STATUS.md`

#### Option 2: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3002
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t lca-project .
docker run -p 3002:3002 --env-file .env.production lca-project
```

#### Option 3: VPS Deployment (DigitalOcean, Linode, etc.)

1. Set up VPS with Ubuntu 22.04
2. Install Node.js and MySQL
3. Clone repository
4. Follow local setup steps
5. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start npm --name "lca-project" -- start
pm2 save
pm2 startup
```

---

## Quick Reference Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database
```bash
# Connect to database
mysql -u lca_user -p lca_v3

# Import schema
mysql -u lca_user -p lca_v3 < lca_v3_drawsql_schema.sql

# Backup database
mysqldump -u lca_user -p lca_v3 > backup.sql

# Restore database
mysql -u lca_user -p lca_v3 < backup.sql
```

### Troubleshooting
```bash
# Clear cache and restart
rm -rf .next node_modules package-lock.json
npm install
npm run dev

# Check port usage
lsof -ti:3002

# Kill process on port
kill -9 $(lsof -ti:3002)

# MySQL status
brew services list | grep mysql  # macOS
sudo systemctl status mysql      # Linux
```

---

## Next Steps

Now that you have the application running locally:

1. **Explore the codebase**:
   - `app/` - Next.js app router pages
   - `components/` - React components
   - `lib/` - Core business logic (LCA engine)
   - `types/` - TypeScript type definitions

2. **Review documentation**:
   - [LCA_ALGORITHM_ANALYSIS.md](LCA_ALGORITHM_ANALYSIS.md) - Algorithm details
   - [ABC_COSTING_IMPLEMENTATION_GUIDE.md](ABC_COSTING_IMPLEMENTATION_GUIDE.md) - ABC features
   - [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference

3. **Start developing**:
   - Create a test project
   - Add components and flows
   - Run assessments
   - Explore the UI

4. **Customize**:
   - Modify UI components
   - Add new impact categories
   - Implement custom calculations
   - Extend the API

---

## Support

For issues or questions:

1. Check the [Troubleshooting](#9-troubleshooting) section
2. Review error logs in terminal/browser console
3. Search existing GitHub issues
4. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version, MySQL version)
   - Relevant logs

---

**Document End**

*Last Updated: January 2025*
