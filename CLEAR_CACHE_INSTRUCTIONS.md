# Clear Browser Cache to See Database Projects

## Problem
The application is showing **4 cached projects** from localStorage instead of the **1 real project** from the MySQL database.

## Database Status ✅
- Database has **1 project**: "Electric Vehicle Manufacturing" (owner_id: 1, john_doe)
- API endpoint `/api/projects` works correctly
- Login works with database authentication

## Frontend Issue ⚠️
- Browser localStorage still has old cached projects under key `"lcapix-projects"`
- These cached projects override the database fetch

---

## Solution: Clear localStorage

### **Method 1: DevTools (Fastest)**
1. Open http://localhost:3002 in browser
2. Press **F12** to open DevTools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Expand **Local Storage** in left sidebar
5. Click on `http://localhost:3002`
6. Find the key: **`lcapix-projects`**
7. Right-click → **Delete**
8. Refresh page (Cmd+R / Ctrl+R)

### **Method 2: Sign Out and Back In**
1. Click your profile icon (top right corner)
2. Click **"Sign out"**
   - This now automatically clears localStorage (updated in code)
3. Login again: `john@lcaproject.com` / `password123`
4. Should see only 1 project: "Electric Vehicle Manufacturing"

### **Method 3: Clear All Site Data**
**Chrome:**
- DevTools → Application tab
- Click "Clear site data" button
- Refresh page

**Firefox:**
- DevTools → Storage tab
- Right-click → "Delete All"
- Refresh page

---

## Verification Steps

After clearing cache, verify:

1. **Home page shows 1 project only**
   - Project name: "Electric Vehicle Manufacturing"
   - Description: "Life cycle assessment of EV battery production facility"
   - Owner: john_doe (john@lcaproject.com)

2. **Console shows API fetch**
   - Open DevTools → Console
   - Look for: `GET /api/projects 200`
   - Should show successful database fetch

3. **Click into project**
   - Should see 2 cases:
     - "Baseline Production - 2025" (base)
     - "Renewable Energy Scenario" (comparative)
   - All data from MySQL database

---

## Why This Happened

**Before Fix:**
- Zustand store used `persist` middleware
- Stored projects in localStorage key `"lcapix-projects"`
- Home page never called API to fetch from database
- Result: Showed old cached demo data

**After Fix (Current):**
- Home page now calls `/api/projects` on mount
- Fetches real data from MySQL database
- Logout clears localStorage automatically
- **BUT**: Old cached data still in browser until manually cleared

---

## For Future Testing

To prevent this issue when testing:
1. Use **Incognito/Private window** (fresh localStorage)
2. Clear cache after major changes
3. Use logout feature (now clears cache automatically)

---

**Last Updated**: After database integration fix
**Status**: Waiting for user to clear browser localStorage
