# TablePlus SSH Tunnel Setup - Visual Guide

## 📍 Step-by-Step UI Navigation

### Step 1: Open Your Connection Settings

In TablePlus, click on your **"LCA v3 Production"** connection to edit it.

You should see the MySQL Connection form with these sections:
- Name field (top)
- Host/IP field
- Port field
- User field
- Password field
- Database field
- **"Over SSH" button** (bottom left area)

---

### Step 2: Find and Enable "Over SSH"

**Location:** Bottom left of the connection form, you'll see a button that says:

```
[ Over SSH ]
```

**Click on "Over SSH"** - it will expand to show SSH configuration fields.

---

### Step 3: Fill in SSH Section (New fields that appear)

After clicking "Over SSH", you'll see these NEW fields appear:

#### SSH Connection Fields:

1. **SSH Host:**
   - Enter: `35.170.250.110`
   - This is your EC2 instance IP

2. **SSH Port:**
   - Enter: `22`
   - Standard SSH port

3. **SSH User:**
   - Enter: `ubuntu`
   - Default Ubuntu user for AWS EC2

4. **SSH Password:**
   - Leave BLANK (we'll use key instead)

5. **SSH Key:**
   - Click the **file browser icon** (📁)
   - Navigate to your EC2 key file (`.pem` file)
   - If you don't have it, I'll help you find/create it

---

### Step 4: Fill in MySQL Section (Keep as before)

The original MySQL fields should still show:

1. **Host/IP:**
   - `lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com`
   - ⚠️ Keep the RDS hostname (NOT 127.0.0.1)

2. **Port:**
   - `3306`
   - ⚠️ Keep as 3306 (NOT 3307)

3. **User:**
   - `lcaadmin`

4. **Password:**
   - `EP76017fLefZ8?d!ezTHsN[kA()X`

5. **Database:**
   - `lca_v3`

---

### Step 5: Test & Connect

1. Click **"Test"** button (bottom of form)
   - Should show "Connection successful" or similar

2. Click **"Connect"** button
   - TablePlus will establish SSH tunnel → then connect to MySQL

---

## 🔑 Finding Your EC2 SSH Key

### Option A: You Already Have It

Look for a `.pem` file you downloaded when creating the EC2 instance. Common locations:
- `~/Downloads/`
- `~/.ssh/`
- Desktop

Common names:
- `lca-key.pem`
- `ec2-key.pem`
- `aws-key.pem`
- Something you named when creating the instance

### Option B: You Don't Have It

If you can't find it, we have options:

**Option 1: Create New Key Pair (5 minutes)**
I can help you create a new key pair and attach it to your EC2.

**Option 2: Use EC2 Instance Connect Endpoint (Advanced)**
Use AWS Systems Manager instead of direct SSH.

---

## 🖼️ What the TablePlus Form Should Look Like:

```
┌─────────────────────────────────────────────┐
│  MySQL Connection                           │
├─────────────────────────────────────────────┤
│  Name: [LCA v3 Production              ]   │
│  Host/IP: [lca-dev-db-small.cmp8ms...  ]   │
│  Port: [3306]                               │
│  User: [lcaadmin                       ]   │
│  Password: [••••••••••••••••           ]   │
│  Database: [lca_v3                     ]   │
│                                             │
│  ┌─ Over SSH (ENABLED) ─────────────────┐ │
│  │ SSH Host: [35.170.250.110          ] │ │
│  │ SSH Port: [22]                       │ │
│  │ SSH User: [ubuntu                  ] │ │
│  │ SSH Key:  [📁 Browse...            ] │ │
│  └─────────────────────────────────────┘ │
│                                             │
│         [Test]  [Save]  [Connect]          │
└─────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### Can't Find "Over SSH" Button?

- Make sure you're in **Edit mode** (not viewing the list)
- Look at the **bottom left** area of the connection form
- It might be labeled differently: "SSH Tunnel" or "Use SSH"
- Try scrolling down if the form is long

### SSH Key Not Working?

Check if the key has correct permissions:
```bash
chmod 400 ~/path/to/your-key.pem
```

### Connection Still Timing Out?

1. Verify EC2 is running:
   ```bash
   aws ec2 describe-instances --instance-ids i-055b91c4baf230251 --profile lca-pix --query 'Reservations[0].Instances[0].State.Name'
   ```

2. Test SSH to EC2 first:
   ```bash
   ssh -i ~/path/to/your-key.pem ubuntu@35.170.250.110
   ```

---

## 📸 Next Step

Take a screenshot of your TablePlus connection form and show me:
1. Where you see (or don't see) the "Over SSH" option
2. What fields you see

I'll help you find the right settings!
