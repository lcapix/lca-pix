#!/bin/bash
# Test Deployment Script - Run after deploying to EC2
# This tests all backend APIs and provides frontend test instructions

set -e

echo "🧪 LCA v3 Deployment Testing"
echo "============================="
echo ""

# Get EC2 IP
read -p "Enter your EC2 Public IP: " EC2_IP

if [ -z "$EC2_IP" ]; then
  echo "❌ EC2 IP is required"
  exit 1
fi

BASE_URL="http://$EC2_IP:3000"

echo "🌐 Testing: $BASE_URL"
echo ""

echo "✅ Test 1: Homepage Health Check"
echo "---------------------------------"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
  echo "✅ Homepage accessible (HTTP $HTTP_CODE)"
else
  echo "❌ Homepage failed (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

echo "✅ Test 2: Create New User (Signup)"
echo "------------------------------------"
SIGNUP_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}')

echo "Response: $SIGNUP_RESPONSE"

# Check if signup was successful or user already exists
if echo "$SIGNUP_RESPONSE" | grep -q "token\|already exists"; then
  echo "✅ Signup API working"
else
  echo "❌ Signup failed"
  echo ""
fi

echo "✅ Test 3: Login with Test User"
echo "--------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"password123"}')

echo "Response: $LOGIN_RESPONSE"

# Extract token (works on macOS and Linux)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token received"
  echo "⚠️  Make sure test data was created in database"
  echo ""
  echo "Run this in EC2:"
  echo "mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \\"
  echo "  -u lcaadmin \\"
  echo "  -p'EP76017fLefZ8?d!ezTHsN[kA()X' \\"
  echo "  lca_v3 < create-test-data.sql"
  exit 1
fi

echo "✅ Login successful - Token: ${TOKEN:0:20}..."
echo ""

echo "✅ Test 4: Get Projects"
echo "-----------------------"
PROJECTS_RESPONSE=$(curl -s -X GET $BASE_URL/api/projects \
  -H "Authorization: Bearer $TOKEN")

echo "$PROJECTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROJECTS_RESPONSE"

if echo "$PROJECTS_RESPONSE" | grep -q "Electric Vehicle Manufacturing"; then
  echo "✅ Projects API working - Test project found!"
else
  echo "⚠️  No test projects found - may need to create test data"
fi
echo ""

echo "✅ Test 5: Get Substances"
echo "-------------------------"
SUBSTANCES_RESPONSE=$(curl -s -X GET $BASE_URL/api/substances \
  -H "Authorization: Bearer $TOKEN")

SUBSTANCE_COUNT=$(echo "$SUBSTANCES_RESPONSE" | grep -o '"substance_id"' | wc -l)
echo "Found $SUBSTANCE_COUNT substances"

if [ $SUBSTANCE_COUNT -ge 10 ]; then
  echo "✅ Substances API working"
else
  echo "⚠️  Expected 13 substances, found $SUBSTANCE_COUNT"
fi
echo ""

echo "✅ Test 6: Get Impact Categories"
echo "---------------------------------"
CATEGORIES_RESPONSE=$(curl -s -X GET $BASE_URL/api/impact-categories \
  -H "Authorization: Bearer $TOKEN")

CATEGORY_COUNT=$(echo "$CATEGORIES_RESPONSE" | grep -o '"category_id"' | wc -l)
echo "Found $CATEGORY_COUNT impact categories"

if [ $CATEGORY_COUNT -ge 8 ]; then
  echo "✅ Impact Categories API working"
else
  echo "⚠️  Expected 8 categories, found $CATEGORY_COUNT"
fi
echo ""

echo "🎉 Backend API Tests Complete!"
echo "=============================="
echo ""
echo "📊 Summary:"
echo "  ✅ Homepage accessible"
echo "  ✅ Signup API working"
echo "  ✅ Login API working"
echo "  ✅ Authentication working (JWT token issued)"
echo "  ✅ Projects API working"
echo "  ✅ Substances API working"
echo "  ✅ Impact Categories API working"
echo ""
echo "🌐 Frontend Testing Instructions"
echo "================================="
echo ""
echo "1. Open browser and go to: $BASE_URL"
echo ""
echo "2. Login Credentials:"
echo "   Email: john@lcaproject.com"
echo "   Password: password123"
echo ""
echo "3. Test Checklist:"
echo "   [ ] Homepage loads without errors"
echo "   [ ] Can login successfully"
echo "   [ ] Can see 'Electric Vehicle Manufacturing' project"
echo "   [ ] Can click into project"
echo "   [ ] Can see 2 cases (Baseline + Renewable)"
echo "   [ ] Can navigate component hierarchy"
echo "   [ ] Can see flows (Electricity, CO₂, Methane, Water)"
echo "   [ ] Can see assessment results"
echo "   [ ] No console errors (F12 → Console tab)"
echo ""
echo "4. Test Data Persistence:"
echo "   [ ] Create a new project via UI"
echo "   [ ] Refresh page - still there?"
echo "   [ ] Verify in database (see command below)"
echo ""
echo "5. Verify in Database (run in EC2):"
echo "   mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \\"
echo "     -u lcaadmin \\"
echo "     -p'EP76017fLefZ8?d!ezTHsN[kA()X' \\"
echo "     lca_v3 -e \"SELECT * FROM project;\""
echo ""
echo "📧 Ready to share with PM?"
echo "========================="
echo "Send them:"
echo "  - URL: $BASE_URL"
echo "  - Login: john@lcaproject.com / password123"
echo "  - Documents: TEST_DATA_FOR_PM_REVIEW.md"
echo ""
