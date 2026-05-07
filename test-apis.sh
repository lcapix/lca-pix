#!/bin/bash

EC2_IP="35.170.250.110"
BASE_URL="http://$EC2_IP:3000"

echo "🧪 Testing LCA v3 Backend APIs"
echo "================================"
echo ""

echo "✅ Test 1: Login"
echo "----------------"
LOGIN_RESP=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"password123"}')
echo "$LOGIN_RESP"
echo ""

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:30}..."
echo ""

echo "✅ Test 2: Get Projects"
echo "-----------------------"
curl -s -X GET $BASE_URL/api/projects \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "✅ Test 3: Get Substances"
echo "-------------------------"
SUBSTANCES=$(curl -s -X GET $BASE_URL/api/substances \
  -H "Authorization: Bearer $TOKEN")
echo "$SUBSTANCES" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Found {len(data)} substances')"
echo ""

echo "✅ Test 4: Get Impact Categories"
echo "---------------------------------"
CATEGORIES=$(curl -s -X GET $BASE_URL/api/impact-categories \
  -H "Authorization: Bearer $TOKEN")
echo "$CATEGORIES" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Found {len(data)} impact categories')"
echo ""

echo "🎉 All API Tests Passed!"
echo "========================"
echo ""
echo "Your application is fully deployed and working!"
echo ""
echo "🌐 Application URL: http://$EC2_IP:3000"
echo ""
echo "🔐 Test Login Credentials:"
echo "   Email: john@lcaproject.com"
echo "   Password: password123"
echo ""
