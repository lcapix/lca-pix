# LCA Project v3 - Quick Start Guide

## ✅ CURRENT STATUS: WORKING

Last updated: October 23, 2025

### Your Application is Running!

- **Frontend**: http://localhost:3002 ✅
- **Project Page**: http://localhost:3002/project/1/ ✅
- **Database Tunnel**: Port 3307 ✅
- **Dev Server**: Port 3002 ✅

---

## How to Start/Stop

### Start Everything

```bash
# Option 1: Use the persistent tunnel script (Recommended)
./persistent-tunnel.sh &    # Start in background
npm run dev                 # Start dev server

# Option 2: Use the automated script
./start-dev.sh

# Option 3: Use the diagnostic script (checks everything first)
./diagnose-and-fix.sh
```

### Stop Everything

```bash
./stop-dev.sh
```

---

## What Was Fixed

### The Problem
- `http://localhost:3002/project/1` was not working
- Database connection was failing with `ECONNREFUSED 127.0.0.1:3307`
- SSH tunnel to AWS RDS was not running

### The Root Cause
- The AWS Session Manager tunnel was starting but **immediately exiting** after first connection attempt
- The tunnel needs to be **persistent** to stay alive
- The `START_LOCAL_DEVELOPMENT.sh` script starts a non-persistent tunnel

### The Solution
1. ✅ **Started persistent tunnel** using `./persistent-tunnel.sh`
2. ✅ **Verified database connection** (found 1 project, 2 cases, 3 assessments)
3. ✅ **Confirmed webpage loads** (HTTP 200)

---

## Current Running Processes

Check what's running:

```bash
# Check database tunnel
lsof -i :3307

# Check dev server
lsof -i :3002

# Check all LCA processes
ps aux | grep -E "(session-m|next-server)" | grep -v grep
```

---

## Database Access

### Via Application
- **Project 1**: http://localhost:3002/project/1/
  - Case 1: Baseline Production - 2025
  - Case 2: Renewable Energy Scenario

### Via TablePlus
- **Host**: 127.0.0.1
- **Port**: 3307
- **User**: lcaadmin
- **Password**: EP76017fLefZ8?d!ezTHsN[kA()X
- **Database**: lca_v3

### Via Command Line
```bash
# Test connection
node << 'EOF'
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });
  const [rows] = await conn.execute('SELECT COUNT(*) as count FROM project');
  console.log(`Projects: ${rows[0].count}`);
  await conn.end();
})();
EOF
```

---

## Troubleshooting

### If page doesn't load

1. **Check tunnel is running**:
   ```bash
   lsof -i :3307
   # Should show: session-m <PID> ... TCP localhost:opsession-prxy (LISTEN)
   ```

2. **Check dev server is running**:
   ```bash
   lsof -i :3002
   # Should show: next-server <PID> ... TCP *:3002 (LISTEN)
   ```

3. **Test database connection**:
   ```bash
   cd "/Users/kavishpandit/Desktop/lca/lca project v3"
   node << 'EOF'
   const mysql = require('mysql2/promise');
   (async () => {
     try {
       const conn = await mysql.createConnection({
         host: '127.0.0.1', port: 3307,
         user: 'lcaadmin',
         password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
         database: 'lca_v3'
       });
       console.log('✅ Connected');
       await conn.end();
     } catch (e) {
       console.error('❌', e.message);
     }
   })();
   EOF
   ```

4. **Restart everything**:
   ```bash
   ./stop-dev.sh
   sleep 2
   ./persistent-tunnel.sh &
   sleep 5
   npm run dev
   ```

### If tunnel keeps disconnecting

The `persistent-tunnel.sh` script automatically reconnects if the tunnel drops. Check the log:

```bash
tail -f /tmp/lca-tunnel-persistent.log
```

### If you see "Loading project..." forever

This means the API is failing. Check:

```bash
# Test API endpoint
curl http://localhost:3002/api/projects/1

# Check dev server logs
tail -f /tmp/lca-dev.log
```

---

## Log Files

- **Tunnel**: `/tmp/lca-tunnel-persistent.log`
- **Dev Server**: `/tmp/lca-dev.log`
- **Tunnel (from start-dev.sh)**: `/tmp/lca-tunnel.log`

View logs in real-time:
```bash
# Dev server
tail -f /tmp/lca-dev.log

# Tunnel
tail -f /tmp/lca-tunnel-persistent.log
```

---

## Next Steps

Now that everything is working:

1. ✅ Access your application at http://localhost:3002/project/1/
2. ✅ Assessment data should display (3 assessments available)
3. ✅ You can run new assessments
4. ✅ Database is fully accessible

### Remaining Tasks

- **Assessment Display Issue**: There's a separate issue where assessment status might not show correctly. This is because the `assessment_runs` table is missing the `status` column. See `FIX_ASSESSMENT_DISPLAY.md` for details.

- **Run Assessment Button Position**: Fixed! The duplicate bottom button has been removed.

---

## Important Notes

- **Tunnel must stay running** - If it closes, restart with `./persistent-tunnel.sh &`
- **AWS credentials required** - The tunnel uses AWS SSM with the `lca-pix` profile
- **Port 3307** - Local port that forwards to RDS (don't change this)
- **Port 3002** - Next.js dev server (configured in package.json)

---

## Created Scripts

### `/diagnose-and-fix.sh`
Comprehensive diagnostic script that:
- Checks AWS Session Manager plugin
- Tests database tunnel
- Verifies database connection
- Checks dev server status
- Tests project page accessibility
- Automatically attempts to fix issues

Usage:
```bash
./diagnose-and-fix.sh
```

### `/persistent-tunnel.sh`
Auto-reconnecting SSH tunnel script. This is the **recommended way** to keep the tunnel alive.

Usage:
```bash
./persistent-tunnel.sh &
```

---

**Status**: ✅ All systems operational!
