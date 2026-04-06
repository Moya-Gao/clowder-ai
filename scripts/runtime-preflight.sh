#!/usr/bin/env bash
# Runtime Preflight Gate — 验证当前 runtime 状态的可执行脚本
# 用法：bash scripts/runtime-preflight.sh [目标commit]
# 输出固定 7 行字段，没跑完不允许做 runtime 状态断言。
#
# 来源：§16a shared-rules + debugging skill Runtime Preflight Gate
# 铲屎官 P0 教训 (2026-04-05)：禁止无证据猜"没更新/没编译/没重启"

set -euo pipefail

RUNTIME_DIR="${RUNTIME_DIR:-../cat-cafe-runtime}"
TARGET_COMMIT="${1:-}"
PORT="${RUNTIME_PORT:-3002}"  # 3002=API (default), 3001=frontend

# 1. Find PID LISTENING on the specific port (not any client connection)
PID=$(lsof -nP -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -1 || true)
if [[ -z "$PID" ]]; then
  echo "PORT=${PORT}"
  echo "PID=NOT_FOUND"
  echo "START_TIME=N/A"
  echo "HEAD=N/A"
  echo "TARGET_COMMIT=${TARGET_COMMIT:-not_specified}"
  echo "PROCESS_AFTER_TARGET=UNKNOWN"
  echo "LOG_EVIDENCE=no process on port ${PORT}"
  exit 1
fi

# 2. Get process start time
START_TIME=$(ps -p "$PID" -o lstart= 2>/dev/null | xargs || echo "UNKNOWN")

# 3. Get runtime HEAD (worktree .git is a file not a dir — use rev-parse)
if git -C "$RUNTIME_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
  HEAD=$(git -C "$RUNTIME_DIR" log --oneline -1 2>/dev/null || echo "UNKNOWN")
else
  HEAD="RUNTIME_DIR_NOT_FOUND"
fi

# 4. Check if target commit is in history
PROCESS_AFTER_TARGET="not_specified"
if [[ -n "$TARGET_COMMIT" && "$HEAD" != "RUNTIME_DIR_NOT_FOUND" ]]; then
  if git -C "$RUNTIME_DIR" merge-base --is-ancestor "$TARGET_COMMIT" HEAD 2>/dev/null; then
    # Compare commit time vs process start time
    COMMIT_EPOCH=$(git -C "$RUNTIME_DIR" log -1 --format=%ct "$TARGET_COMMIT" 2>/dev/null || echo "0")
    # Parse start time to epoch (macOS compatible)
    START_EPOCH=$(date -j -f "%a %b %d %T %Y" "$START_TIME" +%s 2>/dev/null || echo "0")
    if [[ "$START_EPOCH" -gt "$COMMIT_EPOCH" ]]; then
      PROCESS_AFTER_TARGET="yes"
    else
      PROCESS_AFTER_TARGET="no_STALE_PROCESS"
    fi
  else
    PROCESS_AFTER_TARGET="no_COMMIT_NOT_IN_HISTORY"
  fi
fi

# 5. Grab latest log evidence for this PID
LOG_DIR="${RUNTIME_DIR}/packages/api/data/logs/api"
LOG_EVIDENCE="no_log_dir"
if [[ -d "$LOG_DIR" ]]; then
  LATEST_LOG=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1 || true)
  if [[ -n "$LATEST_LOG" ]]; then
    LOG_EVIDENCE=$(grep -c "\"pid\":${PID}" "$LATEST_LOG" 2>/dev/null || echo "0")
    LOG_EVIDENCE="${LOG_EVIDENCE} lines from pid=${PID} in $(basename "$LATEST_LOG")"
  fi
fi

# Output
echo "PORT=${PORT}"
echo "PID=${PID}"
echo "START_TIME=${START_TIME}"
echo "HEAD=${HEAD}"
echo "TARGET_COMMIT=${TARGET_COMMIT:-not_specified}"
echo "PROCESS_AFTER_TARGET=${PROCESS_AFTER_TARGET}"
echo "LOG_EVIDENCE=${LOG_EVIDENCE}"

# Fail-closed: exit 1 if any critical field is invalid
# This ensures "7 lines present" ≠ "7 lines valid"
FAIL=0
[[ "$HEAD" == "RUNTIME_DIR_NOT_FOUND" || "$HEAD" == "UNKNOWN" ]] && echo "⚠ HEAD invalid — cannot make runtime state claims" && FAIL=1
[[ "$START_TIME" == "UNKNOWN" ]] && echo "⚠ START_TIME unknown" && FAIL=1
[[ "$PROCESS_AFTER_TARGET" == "no_STALE_PROCESS" ]] && echo "⚠ Process started BEFORE target commit — may be running old code" && FAIL=1
[[ "$PROCESS_AFTER_TARGET" == "no_COMMIT_NOT_IN_HISTORY" ]] && echo "⚠ Target commit not in runtime history" && FAIL=1
[[ "$LOG_EVIDENCE" == "0 lines"* ]] && echo "⚠ No log lines for this PID — process may not be the API" && FAIL=1
exit $FAIL
