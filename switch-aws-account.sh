#!/bin/bash

# =============================================================================
# AWS Account Switcher
# =============================================================================
# This script switches between AWS accounts using profiles
# Usage: source switch-aws-account.sh [profile-name]
#        source switch-aws-account.sh lca-pix
#        source switch-aws-account.sh solimed
# =============================================================================

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to show available profiles
show_profiles() {
    echo ""
    echo "Available AWS Profiles:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ -f ~/.aws/config ]; then
        grep "^\[profile " ~/.aws/config | sed 's/\[profile /  • /' | sed 's/\]//'

        # Also show default profile
        if grep -q "^\[default\]" ~/.aws/config; then
            echo "  • default"
        fi
    else
        echo "  No profiles configured"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Function to verify connection
verify_connection() {
    local PROFILE=$1
    local PROFILE_FLAG=""

    if [ "$PROFILE" != "default" ]; then
        PROFILE_FLAG="--profile $PROFILE"
    fi

    ACCOUNT=$(aws sts get-caller-identity $PROFILE_FLAG --query Account --output text 2>/dev/null)
    REGION=$(aws configure get region $PROFILE_FLAG 2>/dev/null)
    USER=$(aws sts get-caller-identity $PROFILE_FLAG --query Arn --output text 2>/dev/null | awk -F'/' '{print $NF}')

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Connected to AWS${NC}"
        echo "   Account: $ACCOUNT"

        # Show friendly name
        if [ "$ACCOUNT" = "058264547802" ]; then
            echo "   Name: Solimed / Kavish Personal"
        elif [ "$ACCOUNT" = "117852575520" ]; then
            echo "   Name: LCA PIX"
        fi

        echo "   Region: $REGION"
        echo "   User: $USER"
        return 0
    else
        echo -e "${RED}❌ Cannot connect to AWS${NC}"
        echo "   Profile may not be configured correctly"
        return 1
    fi
}

# Main script
if [ -z "$1" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  No profile specified${NC}"
    show_profiles
    echo "Usage:"
    echo "  source switch-aws-account.sh [profile-name]"
    echo ""
    echo "Examples:"
    echo "  source switch-aws-account.sh lca-pix"
    echo "  source switch-aws-account.sh solimed"
    echo "  source switch-aws-account.sh default"
    echo ""
    return 1 2>/dev/null || exit 1
fi

PROFILE=$1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Switching to AWS Profile: $PROFILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if profile exists
if [ "$PROFILE" != "default" ]; then
    if ! grep -q "^\[profile $PROFILE\]" ~/.aws/config 2>/dev/null; then
        echo -e "${RED}❌ Profile '$PROFILE' not found${NC}"
        show_profiles
        echo "To create this profile:"
        echo "  aws configure --profile $PROFILE"
        echo ""
        return 1 2>/dev/null || exit 1
    fi
fi

# Set environment variable
export AWS_PROFILE=$PROFILE
export AWS_DEFAULT_PROFILE=$PROFILE

echo ""
echo -e "${BLUE}Setting AWS_PROFILE=$PROFILE${NC}"
echo ""

# Verify connection
if verify_connection $PROFILE; then
    echo ""
    echo -e "${GREEN}✅ Successfully switched to profile: $PROFILE${NC}"
    echo ""
    echo "You can now run AWS commands without --profile flag:"
    echo "  aws s3 ls"
    echo "  aws ec2 describe-instances"
    echo "  ./check-aws-setup.sh"
    echo ""
    echo "To switch to another profile:"
    echo "  source switch-aws-account.sh [profile-name]"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Failed to connect to AWS with profile: $PROFILE${NC}"
    echo ""
    return 1 2>/dev/null || exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
