# TablePlus Connection Guide for LCA v3 Database

## 🔌 Connection Details

Use these credentials to connect to your RDS database from TablePlus:

| Field | Value |
|-------|-------|
| **Connection Type** | MySQL |
| **Host** | `lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com` |
| **Port** | `3306` |
| **User** | `lcaadmin` |
| **Password** | `EP76017fLefZ8?d!ezTHsN[kA()X` |
| **Database** | `lca_v3` |

---

## 📋 Step-by-Step Setup

### 1. Open TablePlus

Launch TablePlus on your Mac.

### 2. Create New Connection

- Click **"Create a new connection"** or press `⌘N`
- Select **MySQL** as the database type

### 3. Enter Connection Details

Fill in the connection form with:

```
Name: LCA v3 Production (AWS RDS)
Host: lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
Port: 3306
User: lcaadmin
Password: EP76017fLefZ8?d!ezTHsN[kA()X
Database: lca_v3
```

### 4. Test Connection

Click **"Test"** button to verify connection works.

### 5. Connect

Click **"Connect"** button to open the database.

---

## 🗄️ Database Schema

Once connected, you'll see these tables:

### Core Tables
1. **account** - User accounts
2. **project** - LCA projects
3. **base_case** - Base case definitions
4. **component** - Component hierarchy (5 levels)
5. **flows** - Environmental flows (inputs/outputs)
6. **assessment_runs** - LCA calculation runs
7. **assessment_results** - Calculated impact results

### Reference Data
8. **permission** - User permission levels
9. **project_members** - Project team members
10. **substances** - Substance catalog
11. **impact_category** - Impact categories (GWP, ODP, etc.)
12. **driver_impact_factors** - Characterization factors
13. **component_flows** - Flow relationships (junction table)

---

## 🔒 Security

✅ **Your IP is whitelisted:** `76.36.238.7/32`
✅ **SSL/TLS:** Connection is encrypted
✅ **VPC:** Database is in private VPC
✅ **Firewall:** Only your IP + EC2 can access

---

## 📊 Quick Queries to Try

### View all users
```sql
SELECT id, username, email, account_type, created_at
FROM account;
```

### View all projects
```sql
SELECT p.project_id, p.project_name, a.username as owner
FROM project p
JOIN account a ON p.owner_id = a.id;
```

### View component hierarchy
```sql
SELECT
  component_id,
  component_name,
  node_type,
  parent_id,
  level
FROM component
ORDER BY level, parent_id, component_id;
```

### View test data
```sql
-- Count records in each table
SELECT 'Users' as table_name, COUNT(*) as count FROM account
UNION ALL
SELECT 'Projects', COUNT(*) FROM project
UNION ALL
SELECT 'Cases', COUNT(*) FROM base_case
UNION ALL
SELECT 'Components', COUNT(*) FROM component
UNION ALL
SELECT 'Flows', COUNT(*) FROM flows
UNION ALL
SELECT 'Assessments', COUNT(*) FROM assessment_runs
UNION ALL
SELECT 'Results', COUNT(*) FROM assessment_results;
```

---

## 🛠️ Troubleshooting

### Connection Timeout

If you get a timeout error:

1. **Check your IP changed:**
   ```bash
   curl https://checkip.amazonaws.com
   ```

2. **Update security group if IP changed:**
   ```bash
   aws ec2 authorize-security-group-ingress \
     --group-id sg-01baf6b650f9c860a \
     --protocol tcp \
     --port 3306 \
     --cidr YOUR_NEW_IP/32 \
     --profile lca-pix
   ```

### Connection Refused

Make sure RDS instance is running:
```bash
aws rds describe-db-instances \
  --db-instance-identifier lca-dev-db-small \
  --profile lca-pix \
  --query 'DBInstances[0].DBInstanceStatus'
```

### Authentication Failed

Double-check password has no typos:
- Password: `EP76017fLefZ8?d!ezTHsN[kA()X`
- Note the special characters: `?`, `!`, `[`, `]`, `(`, `)`

---

## 💡 Pro Tips

1. **Save Connection:** Save this connection in TablePlus for easy access
2. **Color Code:** Give it a color (e.g., orange for production)
3. **Read-Only Mode:** Enable read-only mode if you want to prevent accidental changes
4. **Export Data:** Use TablePlus export feature for backups
5. **Query History:** TablePlus saves your query history automatically

---

## 📞 Need Help?

If connection fails:
1. Verify your public IP: `curl https://checkip.amazonaws.com`
2. Check RDS is running in AWS Console
3. Verify security group rules in AWS Console → EC2 → Security Groups → sg-01baf6b650f9c860a

---

**Your database is ready to connect! Open TablePlus and try it now.** 🚀
