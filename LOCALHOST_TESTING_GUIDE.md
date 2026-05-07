# LCA Project v3 - Localhost Testing Guide

**Date:** January 19, 2025
**Application URL:** http://localhost:3002
**Status:** ✅ Ready for Testing

---

## 🎯 Quick Start - Test Now!

### **Step 1: Open Application**
Open your browser and go to:
```
http://localhost:3002
```

### **Step 2: Test Google OAuth Login**

1. Click **"Continue with Google"** button
2. You'll be redirected to Google OAuth consent screen
3. Select account: **lcapix50@gmail.com**
4. Grant permissions (if asked)
5. You'll be redirected back to `/home`

**✅ Expected:** You should be logged in and see the home page

---

## 🧪 Complete Testing Checklist

### **Authentication Tests**

#### **Test 1: Google OAuth Login**
- [ ] Navigate to http://localhost:3002/auth/login
- [ ] Click "Continue with Google"
- [ ] Complete OAuth flow
- [ ] Redirected to `/home`
- [ ] User created in database automatically

#### **Test 2: Email/Password Login**
- [ ] Navigate to http://localhost:3002/auth/login
- [ ] Enter email: `ec2user@example.com`
- [ ] Enter password: `password123`
- [ ] Click "Sign in"
- [ ] Should redirect to `/home`

#### **Test 3: Email/Password Signup**
- [ ] Navigate to http://localhost:3002/auth/signup
- [ ] Enter email: `test@lcaproject.com`
- [ ] Enter password: `Test123!@#`
- [ ] Click "Create account"
- [ ] Should redirect to `/home`

#### **Test 4: Google OAuth Signup**
- [ ] Navigate to http://localhost:3002/auth/signup
- [ ] Click "Continue with Google"
- [ ] Complete OAuth flow
- [ ] Should create new user and redirect to `/home`

---

### **Application Flow Tests**

#### **Test 5: Home Page**
- [ ] Navigate to http://localhost:3002/home
- [ ] Should see dashboard
- [ ] Can see "Create New Project" button

#### **Test 6: Create Project**
- [ ] Click "Create New Project"
- [ ] Enter project name: "Test Project"
- [ ] Enter description: "Testing LCA Project v3"
- [ ] Click "Create"
- [ ] Should redirect to project page

#### **Test 7: Create Base Case**
- [ ] From project page, click "Create Base Case"
- [ ] Enter case name: "Baseline Scenario"
- [ ] Enter description
- [ ] Click "Create"
- [ ] Should redirect to case page

#### **Test 8: Navigation**
- [ ] Test navigation between pages
- [ ] Check if all links work
- [ ] Test back button functionality

---

## ⚠️ Known Limitations (Localhost Only)

**What WORKS on localhost:**
- ✅ Google OAuth login/signup
- ✅ Email/password login/signup
- ✅ All application features
- ✅ Database connection
- ✅ API endpoints

**What DOESN'T work:**
- ❌ **Cannot share with others** (only accessible from your laptop)
- ❌ **Cannot test from phone/tablet**
- ❌ **PM Khushi cannot access** (needs domain for EC2)

---

## 🔧 Database Migration (REQUIRED)

**Before testing, you MUST apply the database migration:**

### **Method 1: TablePlus (Recommended)**

1. **Start Database Tunnel:**
   ```bash
   # Open a new terminal
   cd "/Users/kavishpandit/Desktop/lca/lca project v3"
   ./persistent-tunnel.sh
   ```
   Keep this terminal open!

2. **Connect TablePlus:**
   - Open TablePlus
   - Connect to existing connection: `localhost:3307`
   - Username: `lcaadmin`
   - Password: `EP76017fLefZ8?d!ezTHsN[kA()X`
   - Database: `lca_v3`

3. **Run Migration:**
   - In TablePlus, click **File → Open**
   - Select: `migrate-schema-updates.sql`
   - Click **Run** (▶️ button)
   - Wait for completion

4. **Verify Migration:**
   Scroll to bottom of results, you should see:
   ```
   | status | count |
   |--------|-------|
   | Email validation constraint added | 1 |
   | case_table.description added | 1 |
   | component.notes added | 1 |
   | assessment_runs.notes added | 1 |
   ```

   All counts should be `1` = ✅ Success!

---

## 📊 Test Credentials

### **Existing Users (Email/Password)**

| Email | Password | Account Type | Created |
|-------|----------|--------------|---------|
| ec2user@example.com | password123 | user | Pre-existing |
| test@example.com | password123 | user | Pre-existing |

### **Google OAuth**
- Account: lcapix50@gmail.com
- Will auto-create user on first login

---

## 🐛 Troubleshooting

### **Issue: "Continue with Google" doesn't work**

**Symptoms:** Button does nothing or shows error

**Check:**
1. Dev server running on port 3002?
   ```bash
   lsof -i :3002
   ```
   Should show Node.js process

2. Environment variables loaded?
   ```bash
   cat .env.local | grep GOOGLE
   ```
   Should show Client ID and Secret

3. Browser console errors?
   - Open browser DevTools (F12)
   - Check Console tab for errors

**Fix:**
```bash
# Restart dev server
lsof -ti:3002 | xargs kill -9
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
PORT=3002 npm run dev
```

---

### **Issue: Database connection failed**

**Symptoms:** API errors, can't create users

**Check:**
1. Tunnel running?
   ```bash
   lsof -i :3307
   ```
   Should show ssh process

2. RDS accessible?
   ```bash
   nc -zv 127.0.0.1 3307
   ```
   Should show "succeeded!"

**Fix:**
```bash
# Restart tunnel
./persistent-tunnel.sh
```

---

### **Issue: "Email validation constraint" error**

**Symptoms:** Can't create user with certain email

**Cause:** Migration not applied yet

**Fix:** Run migration via TablePlus (see section above)

---

### **Issue: Port 3002 already in use**

**Symptoms:** "EADDRINUSE: address already in use"

**Fix:**
```bash
lsof -ti:3002 | xargs kill -9
PORT=3002 npm run dev
```

---

## 📝 Testing Report Template

After testing, fill this out:

```
Testing Date: __________
Tester Name: __________

AUTHENTICATION:
[ ] Google OAuth Login - PASS / FAIL
[ ] Google OAuth Signup - PASS / FAIL
[ ] Email/Password Login - PASS / FAIL
[ ] Email/Password Signup - PASS / FAIL

APPLICATION:
[ ] Home Page Loads - PASS / FAIL
[ ] Create Project - PASS / FAIL
[ ] Create Case - PASS / FAIL
[ ] Navigation - PASS / FAIL

DATABASE:
[ ] Migration Applied - YES / NO
[ ] All Verifications = 1 - YES / NO
[ ] New Users Created - YES / NO

ISSUES FOUND:
1. __________
2. __________
3. __________

OVERALL STATUS: ✅ READY / ⚠️ NEEDS FIXES / ❌ BLOCKED
```

---

## 🚀 Next Steps After Testing

**Once localhost testing is complete:**

1. **Get Domain Name** (for EC2 deployment)
   - Option A: Free - DuckDNS (lcaproject.duckdns.org)
   - Option B: Paid - Namecheap ($8/year)

2. **Update Google OAuth** with EC2 domain
   - Add domain to Authorized origins
   - Add domain to Redirect URIs

3. **Deploy to EC2**
   - I'll automate this with proper domain
   - Update environment variables
   - Restart PM2

4. **Share with Team**
   - Send link to PM Khushi
   - Get professor to approve CALCULATIONS.md
   - Collect feedback

---

## 💡 Tips

**Development Workflow:**
1. Make code changes
2. Dev server auto-reloads (hot reload)
3. Test in browser at http://localhost:3002
4. Check browser console for errors
5. Check terminal for server logs

**Database Changes:**
1. Always test migrations on RDS first
2. Keep TablePlus connection open for debugging
3. Use verification queries to confirm changes

**OAuth Debugging:**
1. Check `.env.local` has correct Client ID/Secret
2. Verify redirect URI matches exactly
3. Clear browser cache if issues persist
4. Check Google Cloud Console for OAuth errors

---

## 📞 Need Help?

**Application Logs:**
```bash
# Check dev server output
tail -f /path/to/dev/server/logs
```

**Database Connection:**
```bash
# Test tunnel
./persistent-tunnel.sh
```

**Environment Variables:**
```bash
# Verify loaded
cat .env.local
```

---

**✅ Ready to Test!**

Open http://localhost:3002 now and start testing! 🚀

Report any issues or successes back to continue.

---

**End of Testing Guide**
