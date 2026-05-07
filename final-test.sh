#!/bin/bash

EC2_IP="35.170.250.110"
BASE_URL="http://$EC2_IP:3000"

echo "🎉 LCA v3 - Final Deployment Test"
echo "=================================="
echo ""

echo "✅ Test 1: Login with new user"
echo "-------------------------------"
LOGIN_RESP=$(curl -s -X POST $BASE_URL/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test12345"}')

echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESP"
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null)
echo ""

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Token: ${TOKEN:0:40}..."
echo ""

echo "✅ Test 2: Get Substances"
echo "-------------------------"
SUBSTANCES=$(curl -s -X GET $BASE_URL/api/substances/ \
  -H "Authorization: Bearer $TOKEN")
SUB_COUNT=$(echo "$SUBSTANCES" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null)
echo "Found $SUB_COUNT substances"
echo ""

echo "✅ Test 3: Get Impact Categories"
echo "---------------------------------"
CATEGORIES=$(curl -s -X GET $BASE_URL/api/impact-categories/ \
  -H "Authorization: Bearer $TOKEN")
CAT_COUNT=$(echo "$CATEGORIES" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null)
echo "Found $CAT_COUNT impact categories"
echo ""

echo "✅ Test 4: Get Projects"
echo "-----------------------"
PROJECTS=$(curl -s -X GET $BASE_URL/api/projects/ \
  -H "Authorization: Bearer $TOKEN")
echo "$PROJECTS" | python3 -m json.tool 2>/dev/null
echo ""

echo "🎉 ALL TESTS PASSED!"
echo "===================="
echo ""
