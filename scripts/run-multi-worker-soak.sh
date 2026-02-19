#!/usr/bin/env bash
set -u

ITERATIONS="${1:-10}"
SLEEP_SECONDS="${2:-5}"
PER_ITERATION_TIMEOUT_SECONDS="${3:-180}"

if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]] || [ "$ITERATIONS" -lt 1 ]; then
  echo "Usage: $0 [iterations>=1] [sleep_seconds>=0]"
  exit 1
fi

if ! [[ "$SLEEP_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 [iterations>=1] [sleep_seconds>=0] [per_iteration_timeout_seconds>=1]"
  exit 1
fi

if ! [[ "$PER_ITERATION_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$PER_ITERATION_TIMEOUT_SECONDS" -lt 1 ]; then
  echo "Usage: $0 [iterations>=1] [sleep_seconds>=0] [per_iteration_timeout_seconds>=1]"
  exit 1
fi

PASS=0
FAIL=0
START_TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/tmp/pricepilot-multi-worker-soak-${START_TS}.log"

echo "[Soak] Starting multi-worker readiness soak"
echo "[Soak] Iterations: ${ITERATIONS}"
echo "[Soak] Sleep between iterations: ${SLEEP_SECONDS}s"
echo "[Soak] Per-iteration timeout: ${PER_ITERATION_TIMEOUT_SECONDS}s"
echo "[Soak] Log file: ${LOG_FILE}"
echo ""

for i in $(seq 1 "$ITERATIONS"); do
  echo "[Soak][${i}/${ITERATIONS}] Running verify:multi-worker ..." | tee -a "$LOG_FILE"

  (
    yarn verify:multi-worker >>"$LOG_FILE" 2>&1
  ) &
  CMD_PID=$!
  START_EPOCH="$(date +%s)"
  TIMED_OUT=0

  while kill -0 "$CMD_PID" 2>/dev/null; do
    NOW_EPOCH="$(date +%s)"
    ELAPSED=$((NOW_EPOCH - START_EPOCH))
    if [ "$ELAPSED" -ge "$PER_ITERATION_TIMEOUT_SECONDS" ]; then
      TIMED_OUT=1
      echo "[Soak][${i}/${ITERATIONS}] TIMEOUT after ${PER_ITERATION_TIMEOUT_SECONDS}s; killing PID ${CMD_PID}" | tee -a "$LOG_FILE"
      kill "$CMD_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$CMD_PID" 2>/dev/null || true
      break
    fi
    sleep 1
  done

  if [ "$TIMED_OUT" -eq 0 ]; then
    wait "$CMD_PID"
    CMD_EXIT=$?
  else
    CMD_EXIT=124
  fi

  if [ "$CMD_EXIT" -eq 0 ]; then
    PASS=$((PASS + 1))
    echo "[Soak][${i}/${ITERATIONS}] PASS" | tee -a "$LOG_FILE"
  else
    FAIL=$((FAIL + 1))
    echo "[Soak][${i}/${ITERATIONS}] FAIL (exit=${CMD_EXIT})" | tee -a "$LOG_FILE"
  fi

  if [ "$i" -lt "$ITERATIONS" ] && [ "$SLEEP_SECONDS" -gt 0 ]; then
    sleep "$SLEEP_SECONDS"
  fi

done

echo ""
echo "[Soak] Summary"
echo "[Soak] Passed: ${PASS}"
echo "[Soak] Failed: ${FAIL}"
echo "[Soak] Log: ${LOG_FILE}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
