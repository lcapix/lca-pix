#!/bin/bash

# =============================================================================
# AWS Profile Setup Script
# =============================================================================
# This script helps you configure multiple AWS account profiles
# =============================================================================

echo "======================================================================"
echo "  AWS Multi-Account Profile Setup"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Backup existing config
if [ -f ~/.aws/config ]; then
    echo -e "${YELLOW}📋 Backing up existing AWS config...${NC}"
    cp ~/.aws/config ~/.aws/config.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backup created${NC}"
fi

if [ -f ~/.aws/credentials ]; then
    echo -e "${YELLOW}📋 Backing up existing AWS credentials...${NC}"
    cp ~/.aws/credentials ~/.aws/credentials.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backup created${NC}"
fi
echo ""

# Create AWS config directory if it doesn't exist
mkdir -p ~/.aws

# =============================================================================
# Profile 1: Solimed (Default) - Keep existing
# =============================================================================
echo "======================================================================"
echo "  Profile 1: Solimed Account (Default)"
echo "======================================================================"
echo ""
echo "Current default profile:"
echo "  Account ID: 058264547802"
echo "  Region: us-east-2 (Ohio)"
echo ""
echo -e "${GREEN}✅ Keeping existing default profile as 'solimed'${NC}"
echo ""

# Add solimed profile to config
cat > ~/.aws/config << 'EOF'
[default]
region = us-east-2
output = json

[profile solimed]
region = us-east-2
output = json
EOF

# =============================================================================
# Profile 2: LCA PIX - Interactive setup
# =============================================================================
echo "======================================================================"
echo "  Profile 2: LCA PIX Account"
echo "======================================================================"
echo ""
echo "Target Account ID: 117852575520"
echo ""
echo "To get your LCA PIX access keys:"
echo "  1. Sign in to AWS Console (LCA PIX account)"
echo "  2. Search for 'IAM' → Click IAM"
echo "  3. Left sidebar → Users → Click your username"
echo "  4. Security credentials tab"
echo "  5. Scroll to 'Access keys' section"
echo "  6. Click 'Create access key'"
echo "  7. Choose 'Command Line Interface (CLI)'"
echo "  8. Copy both keys"
echo ""

# Check if user wants to configure now
echo -e "${YELLOW}Do you have the LCA PIX access keys ready? (y/n)${NC}"
read -r CONFIGURE_NOW

if [ "$CONFIGURE_NOW" = "y" ] || [ "$CONFIGURE_NOW" = "Y" ]; then
    echo ""
    echo "Enter LCA PIX Access Key ID:"
    read -r LCA_ACCESS_KEY

    echo "Enter LCA PIX Secret Access Key:"
    read -s LCA_SECRET_KEY
    echo ""

    echo "Enter preferred region (press Enter for us-east-1):"
    read -r LCA_REGION
    LCA_REGION=${LCA_REGION:-us-east-1}

    # Add LCA PIX profile to config
    cat >> ~/.aws/config << EOF

[profile lca-pix]
region = $LCA_REGION
output = json
EOF

    # Add LCA PIX credentials
    # First, preserve existing default credentials
    if [ -f ~/.aws/credentials ]; then
        DEFAULT_KEY=$(grep -A 1 "^\[default\]" ~/.aws/credentials | grep aws_access_key_id | cut -d'=' -f2 | xargs)
        DEFAULT_SECRET=$(grep -A 2 "^\[default\]" ~/.aws/credentials | grep aws_secret_access_key | cut -d'=' -f2 | xargs)

        cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = $DEFAULT_KEY
aws_secret_access_key = $DEFAULT_SECRET

[solimed]
aws_access_key_id = $DEFAULT_KEY
aws_secret_access_key = $DEFAULT_SECRET

[lca-pix]
aws_access_key_id = $LCA_ACCESS_KEY
aws_secret_access_key = $LCA_SECRET_KEY
EOF
    fi

    echo ""
    echo -e "${GREEN}✅ LCA PIX profile configured!${NC}"

    # Verify connection
    echo ""
    echo "Verifying LCA PIX account connection..."
    ACCOUNT=$(aws sts get-caller-identity --profile lca-pix --query Account --output text 2>/dev/null)

    if [ "$ACCOUNT" = "117852575520" ]; then
        echo -e "${GREEN}✅ Successfully connected to LCA PIX account!${NC}"
        echo "   Account ID: $ACCOUNT"
    else
        echo -e "${YELLOW}⚠️  Connected to account: $ACCOUNT${NC}"
        echo "   Expected: 117852575520"
        echo "   Please verify your access keys"
    fi
else
    echo ""
    echo -e "${YELLOW}⚠️  LCA PIX profile not configured${NC}"
    echo ""
    echo "To configure later, run:"
    echo "  aws configure --profile lca-pix"

    # Add placeholder to config
    cat >> ~/.aws/config << 'EOF'

[profile lca-pix]
region = us-east-1
output = json
# Configure with: aws configure --profile lca-pix
EOF
fi

echo ""
echo "======================================================================"
echo "  Summary"
echo "======================================================================"
echo ""
echo "Configured profiles:"
echo "  1. default   → Solimed (058264547802)"
echo "  2. solimed   → Solimed (058264547802)"
echo "  3. lca-pix   → LCA PIX (117852575520)"
echo ""
echo "To use a specific profile:"
echo "  aws s3 ls --profile lca-pix"
echo "  aws ec2 describe-instances --profile solimed"
echo ""
echo "Or use the account switcher:"
echo "  source switch-aws-account.sh lca-pix"
echo ""
echo -e "${GREEN}✅ Profile setup complete!${NC}"
echo ""
