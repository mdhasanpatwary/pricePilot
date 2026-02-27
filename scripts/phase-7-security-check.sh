#!/bin/bash
# CI/CD Production Safety Checks
# 
# Verifies that debug/development code is not accidentally included in production builds.
# Phase 7 Security Hardening

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔒 Running Phase 7 Security Hardening Checks..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0
PASSED=0

# Helper functions
success() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Checking INTERNAL_MODE configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$VERCEL" ] || [ "$NODE_ENV" = "production" ]; then
  if grep -q 'INTERNAL_MODE.*true' "${PROJECT_ROOT}/.env" 2>/dev/null || \
     grep -q 'INTERNAL_MODE.*true' "${PROJECT_ROOT}/.env.production" 2>/dev/null; then
    fail "INTERNAL_MODE=true found in production environment"
  else
    success "INTERNAL_MODE is disabled in production"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Checking for hardcoded debug routes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for dev-only imports without proper gates
DEBUG_IMPORTS=$(find "${PROJECT_ROOT}/app" "${PROJECT_ROOT}/lib" -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec grep -l "withInternalGate\|INTERNAL_MODE" {} \; 2>/dev/null | wc -l)

if [ "$DEBUG_IMPORTS" -gt 0 ]; then
  success "Found $DEBUG_IMPORTS files using internal gates (proper encapsulation)"
else
  warning "No internal-gated debug routes found (expected for development)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Checking for unguarded environment-specific code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for NODE_ENV checks that should be gated
if grep -r "NODE_ENV.*development" "${PROJECT_ROOT}/app" 2>/dev/null | \
   grep -v "next.config" | grep -v ".test." | grep -v ".spec." > /tmp/env_checks.txt 2>&1; then
  
  # Count valid patterns (those not in middleware/gate contexts)
  UNGUARDED=$(grep -v "isProduction\|isDevelopment\|ensureDevelopmentOnly" /tmp/env_checks.txt | wc -l)
  
  if [ "$UNGUARDED" -gt 0 ]; then
    warning "Found $UNGUARDED unguarded NODE_ENV checks (verify they're safe)"
  else
    success "All NODE_ENV checks are properly guarded"
  fi
else
  success "No unguarded NODE_ENV development checks found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Checking for debug console methods in production code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CONSOLE_LOGS=$(find "${PROJECT_ROOT}/app" "${PROJECT_ROOT}/lib" -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec grep -l "console\.debug\|console\.trace" {} \; 2>/dev/null | wc -l)

if [ "$CONSOLE_LOGS" -gt 0 ]; then
  warning "Found $CONSOLE_LOGS files with debug console methods (should use logger instead)"
else
  success "No debug console methods found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Checking for hardcoded secrets/credentials"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for common credential patterns
if find "${PROJECT_ROOT}/app" "${PROJECT_ROOT}/lib" -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec grep -l "api_key\|apiKey\|password\|secret\|token" {} \; 2>/dev/null | \
  xargs grep -l "= ['\"][a-zA-Z0-9_-]\{20,\}['\"]" 2>/dev/null > /tmp/creds.txt 2>&1; then
  
  CRED_COUNT=$(wc -l < /tmp/creds.txt)
  if [ "$CRED_COUNT" -gt 0 ]; then
    fail "Found potential hardcoded credentials in source"
    cat /tmp/creds.txt | head -5
  fi
else
  success "No obvious hardcoded credentials detected"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Checking SSRF protection is available"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "${PROJECT_ROOT}/lib/security/ssrf-protection.ts" ]; then
  success "SSRF protection module found"
else
  fail "SSRF protection module not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. Checking environment separation is available"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "${PROJECT_ROOT}/lib/security/environment-separation.ts" ]; then
  success "Environment separation module found"
else
  fail "Environment separation module not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Checks Passed: ${GREEN}$PASSED${NC}"
echo "Checks Failed: ${RED}$FAILED${NC}"

if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ All Phase 7 hardening checks passed!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}✗ Some hardening checks failed. Please review above.${NC}"
  exit 1
fi
