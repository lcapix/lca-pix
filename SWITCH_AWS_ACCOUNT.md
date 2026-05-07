# How to Switch AWS CLI to LCA PIX Account

You're currently connected to AWS Account: **058264547802** (Kavish Personal/Solimed)
You need to switch to: **LCA PIX Account: 117852575520**

---

## Option 1: Use AWS CLI Profiles (Recommended)

### Step 1: Configure New Profile for LCA PIX Account

Run this command in your terminal:

```bash
aws configure --profile lca-pix
```

You'll be prompted to enter:
1. **AWS Access Key ID**: [Get from LCA PIX IAM Console]
2. **AWS Secret Access Key**: [Get from LCA PIX IAM Console]
3. **Default region**: `us-east-1` (or your preferred region)
4. **Default output format**: `json`

---

### Step 2: Get Access Keys from LCA PIX Account

To get the access keys:

1. **Sign in to AWS Console** for LCA PIX account (117852575520)
2. **Search**: `IAM` → Click **IAM**
3. **Left sidebar** → Click **Users**
4. **Click** on your username
5. **Click**: "Security credentials" tab
6. **Scroll to**: "Access keys"
7. **Click**: "Create access key"
8. **Choose**: "Command Line Interface (CLI)"
9. **Check**: "I understand..." box
10. **Click**: "Create access key"
11. **IMPORTANT**: Copy both:
    - Access key ID
    - Secret access key
    - (You can't retrieve the secret key later!)

---

### Step 3: Use the LCA PIX Profile

Once configured, run commands with the profile:

```bash
# Check which account you're using
aws sts get-caller-identity --profile lca-pix

# Run the configuration checker
./check-aws-setup.sh --profile lca-pix

# List S3 buckets
aws s3 ls --profile lca-pix

# List EC2 instances
aws ec2 describe-instances --profile lca-pix
```

---

## Option 2: Temporarily Set Environment Variables

If you just want to check quickly without setting up a profile:

```bash
export AWS_ACCESS_KEY_ID="YOUR_LCA_PIX_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_LCA_PIX_SECRET_KEY"
export AWS_DEFAULT_REGION="us-east-1"

# Now run commands
aws sts get-caller-identity
./check-aws-setup.sh
```

**To switch back to your original account:**
```bash
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_DEFAULT_REGION
```

---

## Option 3: Use AWS SSO (If Organization Setup)

If the LCA PIX account is part of an AWS Organization with SSO:

```bash
# Configure SSO
aws configure sso --profile lca-pix

# Follow the prompts to authenticate via browser

# Use the profile
aws s3 ls --profile lca-pix
```

---

## Verify You're Connected to Correct Account

After switching, verify:

```bash
aws sts get-caller-identity --profile lca-pix
```

Should show:
```json
{
    "Account": "117852575520",
    ...
}
```

---

## Modified Check Script for Specific Profile

I'll create a version of the checker that accepts a profile parameter.
