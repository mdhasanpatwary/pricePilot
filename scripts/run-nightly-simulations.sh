#!/usr/bin/env bash

set -e

echo "============================================="
echo "   PricePilot Nightly Simulation & Analysis  "
echo "============================================="
echo "Date: $(date)"

# 1. Generate Prisma Client (just in case)
echo "[1/4] Generating Prisma Client..."
npx prisma generate

# 2. Run Queue Compliance Checks
echo "[2/4] Running Queue Compliance Checks..."
npx tsx scripts/check-queue-compliance.ts

# 3. Queue Fairness Analysis
# (Runs against the current dev/staging database to see real queue distribution)
echo "[3/4] Running Queue Fairness Analysis..."
npx tsx scripts/analyze-queue-fairness.ts

# 4. Execute Stress Test Suite (Phase 4)
echo "[4/4] Running Stress Test Suite..."
npx tsx scripts/stress-test-suite.ts

echo "============================================="
echo "   Nightly Simulation & Analysis Complete    "
echo "============================================="
