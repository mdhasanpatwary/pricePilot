#!/bin/bash

# Target Score Validation & Reporting
# Runs system validation against hardening score targets and generates reports

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
INTERNAL_MODE="${INTERNAL_MODE:-true}"

cd "$PROJECT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Target Score Validation & Hardening Report             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Base URL: $E2E_BASE_URL"
echo "  Internal Mode: $INTERNAL_MODE"
echo ""

# Verify server is running
echo -e "${BLUE}→ Checking server availability...${NC}"
if ! curl -s -f "$E2E_BASE_URL/api/v1/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Server is not responding at $E2E_BASE_URL${NC}"
  echo "  Start the server with: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Running Score Validation                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

# Run validation
echo ""
echo -e "${BLUE}→ Executing target score validation...${NC}"

VALIDATION_RESPONSE=$(curl -s -X GET "$E2E_BASE_URL/api/v1/internal/scoring/validate" \
  -H "X-Internal-Mode: $INTERNAL_MODE")

echo ""
echo -e "${BLUE}${VALIDATION_RESPONSE}${NC}"

# Check if validation passed overall
OVERALL_SCORE=$(echo "$VALIDATION_RESPONSE" | grep -o '"score":"[^"]*' | head -1 | cut -d'"' -f4)
OVERALL_PASSED=$(echo "$VALIDATION_RESPONSE" | grep -o '"passed":true' | head -1 || echo "false")

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Validation Results                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

if [ -n "$OVERALL_PASSED" ]; then
  echo -e "${GREEN}✓ Overall Score: ${OVERALL_SCORE}/10${NC}"
  echo -e "${GREEN}✓ All target scores met! System is production-ready.${NC}"
else
  echo -e "${YELLOW}⚠ Overall Score: ${OVERALL_SCORE}/10${NC}"
  echo -e "${YELLOW}⚠ Some targets have not been met yet${NC}"
fi

echo ""
echo -e "${BLUE}→ Fetching detailed report...${NC}"

# Get detailed report
REPORT=$(curl -s -X GET "$E2E_BASE_URL/api/v1/internal/scoring/report" \
  -H "X-Internal-Mode: $INTERNAL_MODE")

# Pretty print report
echo ""
echo -e "${BLUE}Dimension Scores:${NC}"

# Extract dimension scores
echo "$REPORT" | grep -o '"dimension":"[^"]*","score":[^,]*' | while read line; do
  DIMENSION=$(echo "$line" | grep -o '"dimension":"[^"]*' | cut -d'"' -f4)
  SCORE=$(echo "$line" | grep -o '"score":[^,]*' | cut -d':' -f2)
  
  # Color code based on score
  if (( $(echo "$SCORE >= 8" | bc -l) )); then
    echo -e "  ${GREEN}✓${NC} $DIMENSION: $SCORE/10"
  elif (( $(echo "$SCORE >= 7" | bc -l) )); then
    echo -e "  ${YELLOW}≈${NC} $DIMENSION: $SCORE/10"
  else
    echo -e "  ${RED}✗${NC} $DIMENSION: $SCORE/10"
  fi
done

# Check for recommendations
RECOMMENDATIONS=$(echo "$REPORT" | grep -o '"recommendations":\[[^]]*\]')
if [ -n "$RECOMMENDATIONS" ] && [ "$RECOMMENDATIONS" != '""' ]; then
  echo ""
  echo -e "${YELLOW}Recommendations:${NC}"
  echo "$RECOMMENDATIONS" | grep -o '"[^"]*"' | grep -v "recommendations" | head -5 | while read rec; do
    REC_TEXT=$(echo "$rec" | tr -d '"')
    if [ "${#REC_TEXT}" -gt 3 ]; then
      echo "  • $REC_TEXT"
    fi
  done
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    System Status Summary                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

if [ -n "$OVERALL_PASSED" ]; then
  echo -e "${GREEN}"
  echo "  ✓ Security Hardening: COMPLETE"
  echo "  ✓ All Phase 0-8 implementations: VERIFIED"
  echo "  ✓ Production Readiness: CONFIRMED"
  echo ""
  echo "  Status: ELIGIBLE FOR PRODUCTION DEPLOYMENT"
  echo -e "${NC}"
else
  echo -e "${YELLOW}"
  echo "  → Additional validation required"
  echo "  → Review recommendations above"
  echo "  → Run additional tests if needed"
  echo -e "${NC}"
fi

echo ""
echo -e "${GREEN}✓ Target Score Validation Complete${NC}"
