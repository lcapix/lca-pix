# AWS Multi-Account Setup Guide

## 📋 Overview

You have **two AWS accounts** configured:

1. **Solimed Account** (058264547802) - Your personal/Solimed healthcare account
2. **LCA PIX Account** (117852575520) - LCA Project account

This guide shows you how to easily switch between them.

---

## 🚀 Quick Start

### Step 1: Add LCA PIX Credentials

Run this script and follow the prompts:

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./add-lca-pix-credentials.sh
```

**You'll need:**
- LCA PIX Access Key ID
- LCA PIX Secret Access Key

**Where to get them:**
1. Sign in to AWS Console for **LCA PIX** account (117852575520)
2. Top right → Click your name → "Security credentials"
3. OR: Search `IAM` → Users → Your username → Security credentials
4. Click "Create access key"
5. Choose "Command Line Interface (CLI)"
6. Copy both keys immediately!

---

### Step 2: Switch Between Accounts

Use the switcher script:

```bash
# Switch to LCA PIX account
source switch-aws-account.sh lca-pix

# Switch to Solimed account
source switch-aws-account.sh solimed

# Switch to default account
source switch-aws-account.sh default
```

**Important:** Use `source` (not `./`) so the environment variables persist in your current shell!

---

## 📖 How It Works

### Your AWS Profiles

After setup, you'll have these profiles configured:

| Profile Name | Account ID | Account Name | Region |
|--------------|------------|--------------|--------|
| `default` | 058264547802 | Solimed | us-east-2 |
| `solimed` | 058264547802 | Solimed | us-east-2 |
| `lca-pix` | 117852575520 | LCA PIX | us-east-1 |

### Configuration Files

Your AWS credentials are stored in:
- **Config**: `~/.aws/config` (regions, output format)
- **Credentials**: `~/.aws/credentials` (access keys - KEEP SECRET!)

---

## 🔧 Usage Examples

### Method 1: Using `--profile` Flag (Quick Commands)

```bash
# List S3 buckets in LCA PIX account
aws s3 ls --profile lca-pix

# List EC2 instances in Solimed account
aws ec2 describe-instances --profile solimed

# Check current LCA PIX account
aws sts get-caller-identity --profile lca-pix
```

### Method 2: Switch Account (Persistent)

```bash
# Switch to LCA PIX for multiple commands
source switch-aws-account.sh lca-pix

# Now all commands use LCA PIX (no --profile needed!)
aws s3 ls
aws ec2 describe-instances
aws rds describe-db-instances

# Switch back to Solimed
source switch-aws-account.sh solimed
```

### Method 3: Check Current Account

```bash
# See which account you're using
echo $AWS_PROFILE

# Or verify with AWS
aws sts get-caller-identity
```

---

## 📊 Running Configuration Checks

### Check LCA PIX Account

```bash
# Switch to LCA PIX
source switch-aws-account.sh lca-pix

# Run the configuration checker
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./check-aws-setup.sh
```

OR run directly with profile:

```bash
# Check LCA PIX without switching
./quick-check-lca-account.sh lca-pix

# Check Solimed without switching
./quick-check-lca-account.sh solimed
```

---

## 🎯 Common Workflows

### Workflow 1: Check Both Accounts

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"

# Check Solimed account
echo "=== Solimed Account ==="
./quick-check-lca-account.sh solimed

echo ""
echo "=== LCA PIX Account ==="
./quick-check-lca-account.sh lca-pix
```

### Workflow 2: Deploy to LCA PIX

```bash
# Switch to LCA PIX
source switch-aws-account.sh lca-pix

# Verify correct account
aws sts get-caller-identity

# Deploy application
aws s3 cp myapp.zip s3://lca-dev-assets/
aws ec2 describe-instances
# ... other deployment commands
```

### Workflow 3: Work on Solimed, Then LCA

```bash
# Start with Solimed
source switch-aws-account.sh solimed
aws rds describe-db-instances

# Switch to LCA PIX
source switch-aws-account.sh lca-pix
aws s3 ls

# Switch back to Solimed
source switch-aws-account.sh solimed
```

---

## 🛠️ Troubleshooting

### Issue 1: "Profile not found"

**Problem:**
```bash
The config profile (lca-pix) could not be found
```

**Solution:**
```bash
# Run the credential setup
./add-lca-pix-credentials.sh

# Or manually configure
aws configure --profile lca-pix
```

---

### Issue 2: Connected to wrong account

**Problem:**
```bash
aws sts get-caller-identity
# Shows account 058264547802 but you want 117852575520
```

**Solution:**
```bash
# Check current profile
echo $AWS_PROFILE

# Switch to correct profile
source switch-aws-account.sh lca-pix

# Verify
aws sts get-caller-identity --query Account --output text
# Should show: 117852575520
```

---

### Issue 3: "Access Denied"

**Problem:**
```bash
An error occurred (AccessDenied) when calling the ListBuckets operation
```

**Solution:**
1. Verify you're using the correct profile:
   ```bash
   aws sts get-caller-identity --profile lca-pix
   ```

2. Check if access keys are correct:
   ```bash
   # Re-run credential setup
   ./add-lca-pix-credentials.sh
   ```

3. Verify IAM permissions in AWS Console

---

### Issue 4: Environment variable not persisting

**Problem:**
```bash
./switch-aws-account.sh lca-pix  # Wrong! Without 'source'
# Account doesn't switch
```

**Solution:**
```bash
source switch-aws-account.sh lca-pix  # Correct! With 'source'
```

**Why?**
- `./script.sh` runs in a subshell (changes are lost)
- `source script.sh` runs in current shell (changes persist)

---

## 📝 Advanced: Shell Aliases

Add these to your `~/.zshrc` or `~/.bashrc` for quick switching:

```bash
# Add these lines to ~/.zshrc (Mac) or ~/.bashrc (Linux)

# Quick alias to switch accounts
alias aws-lca="source ~/Desktop/lca/'lca project v3'/switch-aws-account.sh lca-pix"
alias aws-solimed="source ~/Desktop/lca/'lca project v3'/switch-aws-account.sh solimed"

# Show current AWS account
alias aws-whoami="aws sts get-caller-identity --query Account --output text"

# Quick account check
alias aws-check="aws sts get-caller-identity && echo 'Profile:' \$AWS_PROFILE"
```

**After adding, reload your shell:**
```bash
source ~/.zshrc  # Mac
source ~/.bashrc # Linux
```

**Then use:**
```bash
aws-lca       # Switch to LCA PIX
aws-solimed   # Switch to Solimed
aws-whoami    # Show current account ID
aws-check     # Show full account info
```

---

## 🔐 Security Best Practices

### 1. Protect Your Credentials

```bash
# Check permissions (should be 600)
ls -la ~/.aws/credentials

# If not, fix it:
chmod 600 ~/.aws/credentials
chmod 600 ~/.aws/config
```

### 2. Never Commit Credentials

```bash
# Add to .gitignore
echo "~/.aws/credentials" >> .gitignore
echo "~/.aws/config" >> .gitignore
```

### 3. Rotate Access Keys Regularly

**Every 90 days:**
1. Create new access keys in AWS Console
2. Run `./add-lca-pix-credentials.sh` with new keys
3. Test that new keys work
4. Delete old keys in AWS Console

### 4. Use MFA (Multi-Factor Authentication)

Enable MFA for your AWS accounts:
1. AWS Console → IAM → Users → Your user
2. Security credentials → Assign MFA device
3. Use authenticator app (Google Authenticator, Authy)

---

## 📚 Reference

### Useful Commands

```bash
# List all profiles
grep "^\[" ~/.aws/config

# Show current profile
echo $AWS_PROFILE

# Verify connection
aws sts get-caller-identity

# List all S3 buckets (current account)
aws s3 ls

# List all EC2 instances (current account)
aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,State.Name,Tags[?Key==`Name`].Value|[0]]' --output table
```

### Files Created

| File | Purpose |
|------|---------|
| `setup-aws-profiles.sh` | Initial setup script |
| `add-lca-pix-credentials.sh` | Add/update LCA PIX credentials |
| `switch-aws-account.sh` | Switch between accounts |
| `quick-check-lca-account.sh` | Quick configuration check |
| `check-aws-setup.sh` | Detailed configuration check |
| `MULTI_ACCOUNT_SETUP.md` | This guide |

---

## ✅ Setup Checklist

- [ ] Run `./add-lca-pix-credentials.sh`
- [ ] Enter LCA PIX access keys
- [ ] Test switch: `source switch-aws-account.sh lca-pix`
- [ ] Verify connection: `aws sts get-caller-identity`
- [ ] Check configuration: `./quick-check-lca-account.sh lca-pix`
- [ ] Test Solimed: `source switch-aws-account.sh solimed`
- [ ] Verify Solimed: `aws sts get-caller-identity`
- [ ] Bookmark this guide!

---

## 🎉 You're All Set!

You can now:
- ✅ Switch between accounts in seconds
- ✅ Run AWS commands on either account
- ✅ Check configurations for both accounts
- ✅ Deploy applications to LCA PIX
- ✅ Manage Solimed resources separately

**Need help?** Refer to the troubleshooting section or run:
```bash
./switch-aws-account.sh
# Shows available profiles and usage
```

---

**Last Updated:** 2025-10-12
**Accounts:** Solimed (058264547802), LCA PIX (117852575520)
