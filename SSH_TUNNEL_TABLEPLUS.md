# Connect to RDS via SSH Tunnel (EC2 Jump Host)

Since your RDS is in a private subnet, you need to use your EC2 instance as a jump host.

## 🔑 Step 1: Setup SSH Key for EC2

Your EC2 instance ID: `i-055b91c4baf230251`

First, we need to enable SSH access to your EC2. Run this command:

```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-055b91c4baf230251 \
  --instance-os-user ubuntu \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --availability-zone us-east-1c \
  --profile lca-pix
```

## 🌉 Step 2: Create SSH Tunnel

Open a new terminal and run:

```bash
ssh -i ~/.ssh/id_rsa -N -L 3307:lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com:3306 ubuntu@35.170.250.110
```

This creates a tunnel:
- Local port `3307` on your Mac
- → through EC2 at `35.170.250.110`
- → to RDS at port `3306`

**Keep this terminal open!**

## 📱 Step 3: Configure TablePlus

Now in TablePlus, use these settings:

| Field | Value |
|-------|-------|
| **Name** | `LCA v3 Production (via tunnel)` |
| **Host** | `127.0.0.1` ⚠️ (localhost, not RDS hostname) |
| **Port** | `3307` ⚠️ (local tunnel port, not 3306) |
| **User** | `lcaadmin` |
| **Password** | `EP76017fLefZ8?d!ezTHsN[kA()X` |
| **Database** | `lca_v3` |

## ✅ Connect!

Click "Test" then "Connect" in TablePlus. It will connect through the SSH tunnel to your RDS database!

---

## 🛑 Important Notes:

1. **Keep SSH tunnel terminal open** - If you close it, TablePlus will disconnect
2. **EC2 must be running** - The tunnel goes through your EC2 instance
3. **Use port 3307** on localhost, NOT 3306
4. **Use 127.0.0.1** as host, NOT the RDS hostname

---

## 🔄 Alternative: TablePlus Built-in SSH

TablePlus has built-in SSH tunneling. Instead of manual tunnel:

1. In TablePlus connection form, enable **"Over SSH"** toggle
2. Fill SSH details:
   - **SSH Host:** `35.170.250.110`
   - **SSH Port:** `22`
   - **SSH User:** `ubuntu`
   - **SSH Key:** Browse to your `~/.ssh/id_rsa` or EC2 key
3. Fill database details as normal:
   - **Host:** `lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com`
   - **Port:** `3306`
   - **User:** `lcaadmin`
   - **Password:** `EP76017fLefZ8?d!ezTHsN[kA()X`
   - **Database:** `lca_v3`

This is easier - TablePlus handles the tunnel for you!

---

## 🔐 If You Don't Have SSH Key

You may need to download your EC2 key pair. If you don't have it, we can:
1. Create a new key pair
2. Or use AWS Session Manager (more complex)

Let me know which approach you prefer!
