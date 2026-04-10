#!/bin/bash
# VigiByte Security Verification Script
# One-click check of all security measures

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  🔐 VigiByte Security Verification 🔐     ║"
echo "╚════════════════════════════════════════════╝"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to print result
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $2${NC}"
    ((FAILED++))
  fi
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  ((WARNINGS++))
}

# ============================================
# 1. Check Node.js & npm
# ============================================
echo -e "${BLUE}1️⃣  Node.js & npm${NC}"
echo "─────────────────────────────────────────────"

if command_exists node; then
  NODE_VERSION=$(node -v)
  echo -e "${GREEN}✅ Node.js installed ($NODE_VERSION)${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Node.js NOT installed${NC}"
  ((FAILED++))
fi

if command_exists npm; then
  NPM_VERSION=$(npm -v)
  echo -e "${GREEN}✅ npm installed ($NPM_VERSION)${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ npm NOT installed${NC}"
  ((FAILED++))
fi

# ============================================
# 2. Check Dependencies
# ============================================
echo ""
echo -e "${BLUE}2️⃣  Security Dependencies${NC}"
echo "─────────────────────────────────────────────"

if grep -q "jsonwebtoken" package.json; then
  echo -e "${GREEN}✅ JWT library installed${NC}"
  ((PASSED++))
else
  print_warning "JWT library not in package.json"
fi

if grep -q "bcryptjs" package.json; then
  echo -e "${GREEN}✅ bcryptjs installed${NC}"
  ((PASSED++))
else
  print_warning "bcryptjs not in package.json"
fi

# ============================================
# 3. Check Environment Configuration
# ============================================
echo ""
echo -e "${BLUE}3️⃣  Environment Configuration${NC}"
echo "─────────────────────────────────────────────"

if [ -f .env ]; then
  echo -e "${GREEN}✅ .env file exists${NC}"
  ((PASSED++))

  if grep -q "JWT_SECRET" .env; then
    echo -e "${GREEN}✅ JWT_SECRET configured${NC}"
    ((PASSED++))
  else
    print_warning "JWT_SECRET not set in .env"
  fi

  if grep -q "ENCRYPTION_KEY" .env; then
    echo -e "${GREEN}✅ ENCRYPTION_KEY configured${NC}"
    ((PASSED++))
  else
    print_warning "ENCRYPTION_KEY not set in .env"
  fi

  if grep -q "VITE_SUPABASE_URL" .env; then
    echo -e "${GREEN}✅ Supabase URL configured${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ Supabase URL not configured${NC}"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ .env file not found${NC}"
  ((FAILED++))
fi

# ============================================
# 4. Check Security Files
# ============================================
echo ""
echo -e "${BLUE}4️⃣  Security Files${NC}"
echo "─────────────────────────────────────────────"

FILES=(
  "src/services/security.js:Security Service"
  "src/components/AuthPanel.jsx:Auth Component"
  "src/config/security.config.js:Security Config"
  "SECURITY.md:Security Documentation"
  "SECURITY_VERIFICATION.md:Verification Guide"
  "Dockerfile:Docker Configuration"
  "docker-compose.yml:Docker Compose"
)

for file_pair in "${FILES[@]}"; do
  IFS=':' read -r file name <<< "$file_pair"
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $name exists${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $name missing${NC}"
    ((FAILED++))
  fi
done

# ============================================
# 5. Vulnerability Scan
# ============================================
echo ""
echo -e "${BLUE}5️⃣  Vulnerability Scan${NC}"
echo "─────────────────────────────────────────────"

if command_exists npm; then
  echo "Running npm audit..."
  AUDIT_OUTPUT=$(npm audit 2>&1 || true)
  
  if echo "$AUDIT_OUTPUT" | grep -q "0 vulnerabilities"; then
    echo -e "${GREEN}✅ No npm vulnerabilities found${NC}"
    ((PASSED++))
  else
    VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -oP '\d+(?= vulnerabilities)' | head -1 || echo "0")
    if [ "$VULN_COUNT" -eq 0 ]; then
      echo -e "${GREEN}✅ No vulnerabilities${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️  $VULN_COUNT vulnerabilities found (run: npm audit fix)${NC}"
      ((WARNINGS++))
    fi
  fi
fi

# ============================================
# 6. Check for Secrets
# ============================================
echo ""
echo -e "${BLUE}6️⃣  Secrets & Hardcoded Values${NC}"
echo "─────────────────────────────────────────────"

# Check for hardcoded sensitive data
if grep -r "password:" src/ 2>/dev/null | grep -v "placeholder\|example"; then
  print_warning "Possible hardcoded passwords found in src/"
else
  echo -e "${GREEN}✅ No hardcoded passwords detected${NC}"
  ((PASSED++))
fi

if grep -r "API_KEY" src/ 2>/dev/null | grep -v "process.env"; then
  print_warning "Possible hardcoded API keys found"
else
  echo -e "${GREEN}✅ No hardcoded API keys detected${NC}"
  ((PASSED++))
fi

# ============================================
# 7. Check HTTPS Setup
# ============================================
echo ""
echo -e "${BLUE}7️⃣  HTTPS/TLS Configuration${NC}"
echo "─────────────────────────────────────────────"

if command_exists certbot; then
  echo -e "${GREEN}✅ Certbot (Let's Encrypt) available${NC}"
  ((PASSED++))
else
  print_warning "Certbot not installed (for HTTPS certificates)"
fi

# ============================================
# 8. Docker Setup
# ============================================
echo ""
echo -e "${BLUE}8️⃣  Docker Setup${NC}"
echo "─────────────────────────────────────────────"

if command_exists docker; then
  echo -e "${GREEN}✅ Docker installed$(docker --version | cut -d' ' -f3)${NC}"
  ((PASSED++))
else
  print_warning "Docker not installed"
fi

if command_exists docker-compose; then
  echo -e "${GREEN}✅ Docker Compose installed${NC}"
  ((PASSED++))
else
  print_warning "Docker Compose not installed"
fi

# ============================================
# 9. Git Configuration
# ============================================
echo ""
echo -e "${BLUE}9️⃣  Version Control${NC}"
echo "─────────────────────────────────────────────"

if [ -f .gitignore ]; then
  echo -e "${GREEN}✅ .gitignore exists${NC}"
  ((PASSED++))
  
  if grep -q "\.env" .gitignore; then
    echo -e "${GREEN}✅ .env is gitignored (secrets safe)${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ .env NOT gitignored (SECURITY RISK!)${NC}"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ .gitignore missing${NC}"
  ((FAILED++))
fi

# ============================================
# 10. Test Files
# ============================================
echo ""
echo -e "${BLUE}🔟 Test Suite${NC}"
echo "─────────────────────────────────────────────"

if [ -f "src/utils/securityTests.js" ]; then
  echo -e "${GREEN}✅ Security tests available${NC}"
  ((PASSED++))
  echo -e "${BLUE}   Run: ${NC}node src/utils/securityTests.js"
else
  echo -e "${RED}❌ Security tests missing${NC}"
  ((FAILED++))
fi

# ============================================
# Summary Report
# ============================================
echo ""
echo "═════════════════════════════════════════════"
echo -e "${BLUE}📊 VERIFICATION REPORT${NC}"
echo "═════════════════════════════════════════════"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "${GREEN}✅ Passed:  $PASSED${NC}"
if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
fi
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Failed:  $FAILED${NC}"
fi

PERCENTAGE=$((PASSED * 100 / (PASSED + FAILED)))

echo ""
echo "Security Score: $PERCENTAGE/100"

if [ $PERCENTAGE -ge 90 ]; then
  echo -e "${GREEN}Grade: 🟢 EXCELLENT${NC}"
elif [ $PERCENTAGE -ge 70 ]; then
  echo -e "${YELLOW}Grade: 🟡 GOOD${NC}"
elif [ $PERCENTAGE -ge 50 ]; then
  echo -e "${YELLOW}Grade: 🟠 FAIR${NC}"
else
  echo -e "${RED}Grade: 🔴 WEAK${NC}"
fi

echo "═════════════════════════════════════════════"

echo ""
echo "📋 Next Steps:"
echo "  1. Read: SECURITY.md"
echo "  2. Read: SECURITY_VERIFICATION.md"
echo "  3. Configure .env with your credentials"
echo "  4. Run security tests: node src/utils/securityTests.js"
echo "  5. Fix any warnings above"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}⚠️  Please fix the failed checks before production!${NC}"
  exit 1
else
  echo -e "${GREEN}✅ System ready for security testing!${NC}"
  exit 0
fi
