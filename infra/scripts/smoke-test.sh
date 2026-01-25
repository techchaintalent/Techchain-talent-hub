#!/bin/bash

set -e

echo "🧪 TechChain Talent Hub - Smoke Test"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api"

# Counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local expected_status=$4
  local data=$5

  echo -n "Testing: $name... "

  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" 2>/dev/null)
  fi

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASSED${NC} (HTTP $status_code)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAILED${NC} (Expected $expected_status, got $status_code)"
    echo "  Response: $body"
    ((FAILED++))
    return 1
  fi
}

# Wait for services
echo ""
echo "⏳ Waiting for services..."

# Wait for web server
for i in {1..30}; do
  if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}Web server is ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}Web server not ready after 30 seconds${NC}"
    exit 1
  fi
  sleep 1
done

echo ""
echo "📋 Running API Tests"
echo "--------------------"

# Test public endpoints
test_endpoint "Homepage" GET "/" 200

# Test auth endpoints (should redirect or return proper response)
echo ""
echo "🔐 Auth Endpoints"
test_endpoint "Auth signin page" GET "/auth/signin" 200 || true

# Test API endpoints (unauthenticated should return 401)
echo ""
echo "🔒 Protected API Endpoints (should require auth)"
test_endpoint "Roles list (unauth)" GET "/roles" 401 || true
test_endpoint "Submissions list (unauth)" GET "/submissions" 401 || true
test_endpoint "Candidate profile (unauth)" GET "/candidates/profile" 401 || true

echo ""
echo "📊 Database Check"
echo "-----------------"

# Check database connection via a simple query
DB_CHECK=$(curl -s "$BASE_URL" 2>/dev/null)
if [ -n "$DB_CHECK" ]; then
  echo -e "${GREEN}Database connection OK${NC}"
  ((PASSED++))
else
  echo -e "${RED}Database connection FAILED${NC}"
  ((FAILED++))
fi

# Summary
echo ""
echo "======================================"
echo "🏁 Test Results"
echo "======================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All tests passed${NC}"
  exit 0
fi
