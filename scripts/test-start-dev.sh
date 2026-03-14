#!/bin/bash
# Regression tests for start-dev.sh
#
# Tests:
#   1-4: setup_storage / sanitize_lockfiles (BACKLOG #18)
#   5+:  F115 Phase A — Profile 化

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source start-dev.sh functions without executing main
# shellcheck source=./start-dev.sh
source "$SCRIPT_DIR/start-dev.sh" --source-only

# ── setup_storage / sanitize tests (run in subshells to isolate exit 1) ──

# Override: make redis-cli and redis-server always fail
redis-cli() { return 1; }
redis-server() { return 1; }
command() {
    if [[ "$2" == "redis-server" ]]; then
        return 1
    fi
    builtin command "$@"
}

# Test 1: Redis unavailable with USE_REDIS=true → exit 1 (hard fail)
set +e
(
    unset REDIS_URL
    USE_REDIS=true
    REDIS_PORT=6399
    setup_storage 2>/dev/null
)
rc=$?
set -e
[ "$rc" -ne 0 ] || { echo "FAIL: setup_storage should exit 1 when Redis unavailable"; exit 1; }
echo "PASS: Redis unavailable → exit 1 (hard fail)"

# Test 2: USE_REDIS=false → should unset REDIS_URL
export REDIS_URL="redis://should-be-cleared"
USE_REDIS=false
setup_storage 2>/dev/null

if [ -n "$REDIS_URL" ]; then
    echo "FAIL: REDIS_URL should be unset in memory mode, got: $REDIS_URL"
    exit 1
fi
echo "PASS: --memory mode → REDIS_URL unset"

# Test 3: sanitize_lockfiles should remove provided lockfile path
tmp_lock="$(mktemp)"
echo '{"name":"tmp-lock"}' > "$tmp_lock"

if [ ! -f "$tmp_lock" ]; then
    echo "FAIL: temp lockfile was not created for sanitize test"
    exit 1
fi

sanitize_lockfiles "$tmp_lock" 2>/dev/null
if [ -f "$tmp_lock" ]; then
    echo "FAIL: sanitize_lockfiles should remove lockfile: $tmp_lock"
    exit 1
fi
echo "PASS: sanitize_lockfiles removes provided lockfile path"

# Test 4: sanitize_lockfiles should be no-op for missing file
sanitize_lockfiles "$tmp_lock" 2>/dev/null
echo "PASS: sanitize_lockfiles is safe when file does not exist"

# ── F115 Phase A: Profile 化 ──

# Test 5: apply_profile_defaults sets correct values for "dev"
apply_profile_defaults "dev"
[ "$_PROF_ANTHROPIC_PROXY_ENABLED" = "1" ] || { echo "FAIL: dev profile proxy should be 1"; exit 1; }
[ "$_PROF_ASR_ENABLED" = "1" ] || { echo "FAIL: dev profile ASR should be 1"; exit 1; }
[ "$_PROF_TTS_ENABLED" = "1" ] || { echo "FAIL: dev profile TTS should be 1"; exit 1; }
[ "$_PROF_LLM_POSTPROCESS_ENABLED" = "1" ] || { echo "FAIL: dev profile LLM should be 1"; exit 1; }
[ "$_PROF_MESSAGE_TTL_SECONDS" = "0" ] || { echo "FAIL: dev profile TTL should be 0"; exit 1; }
[ "$_PROF_REDIS_PROFILE" = "dev" ] || { echo "FAIL: dev profile redis should be dev"; exit 1; }
echo "PASS: apply_profile_defaults dev"

# Test 6: apply_profile_defaults sets correct values for "opensource"
apply_profile_defaults "opensource"
[ "$_PROF_ANTHROPIC_PROXY_ENABLED" = "0" ] || { echo "FAIL: opensource profile proxy should be 0"; exit 1; }
[ "$_PROF_ASR_ENABLED" = "0" ] || { echo "FAIL: opensource profile ASR should be 0"; exit 1; }
[ "$_PROF_TTS_ENABLED" = "0" ] || { echo "FAIL: opensource profile TTS should be 0"; exit 1; }
[ "$_PROF_LLM_POSTPROCESS_ENABLED" = "0" ] || { echo "FAIL: opensource profile LLM should be 0"; exit 1; }
[ "$_PROF_MESSAGE_TTL_SECONDS" = "86400" ] || { echo "FAIL: opensource TTL should be 86400"; exit 1; }
[ "$_PROF_REDIS_PROFILE" = "opensource" ] || { echo "FAIL: opensource redis profile should be opensource"; exit 1; }
echo "PASS: apply_profile_defaults opensource"

# Test 7: resolve_config — env override wins over profile default
PROFILE="opensource"
apply_profile_defaults "$PROFILE"
ANTHROPIC_PROXY_ENABLED=1  # explicit env override
resolve_config "ANTHROPIC_PROXY_ENABLED"
[ "$ANTHROPIC_PROXY_ENABLED" = "1" ] || { echo "FAIL: env override should win, got: $ANTHROPIC_PROXY_ENABLED"; exit 1; }
[ "$_SRC_ANTHROPIC_PROXY_ENABLED" = ".env override" ] || { echo "FAIL: source should be .env override, got: $_SRC_ANTHROPIC_PROXY_ENABLED"; exit 1; }
unset ANTHROPIC_PROXY_ENABLED
echo "PASS: resolve_config env override wins"

# Test 8: resolve_config — profile default used when no env
PROFILE="dev"
apply_profile_defaults "$PROFILE"
unset ASR_ENABLED
resolve_config "ASR_ENABLED"
[ "$ASR_ENABLED" = "1" ] || { echo "FAIL: profile default should be 1, got: $ASR_ENABLED"; exit 1; }
[ "$_SRC_ASR_ENABLED" = "profile default (dev)" ] || { echo "FAIL: source should be profile default, got: $_SRC_ASR_ENABLED"; exit 1; }
echo "PASS: resolve_config profile default fallback"

# Test 9: resolve_config — no profile, no env → empty (backward compat)
PROFILE=""
apply_profile_defaults "$PROFILE"
unset TTS_ENABLED
resolve_config "TTS_ENABLED"
[ -z "$TTS_ENABLED" ] || { echo "FAIL: no profile + no env should be empty, got: $TTS_ENABLED"; exit 1; }
echo "PASS: resolve_config no profile no env → empty"

# Test 10: print_config_summary includes source annotations
PROFILE="dev"
apply_profile_defaults "$PROFILE"
unset ANTHROPIC_PROXY_ENABLED ASR_ENABLED
resolve_config "ANTHROPIC_PROXY_ENABLED"
ASR_ENABLED=0  # explicit override
resolve_config "ASR_ENABLED"

summary_output=$(print_config_summary 2>&1)
echo "$summary_output" | grep -q "ANTHROPIC_PROXY_ENABLED.*profile default" || { echo "FAIL: summary should show profile default for proxy"; exit 1; }
echo "$summary_output" | grep -q "ASR_ENABLED.*.env override" || { echo "FAIL: summary should show .env override for ASR"; exit 1; }
echo "PASS: print_config_summary shows source annotations"

# ── Integration tests ──

# Test 11: Full --profile=dev flow — all services enabled by default
PROFILE="dev"
apply_profile_defaults "$PROFILE"
unset ANTHROPIC_PROXY_ENABLED ASR_ENABLED TTS_ENABLED LLM_POSTPROCESS_ENABLED
unset MESSAGE_TTL_SECONDS THREAD_TTL_SECONDS TASK_TTL_SECONDS SUMMARY_TTL_SECONDS
resolve_config "ANTHROPIC_PROXY_ENABLED"
resolve_config "ASR_ENABLED"
resolve_config "TTS_ENABLED"
resolve_config "LLM_POSTPROCESS_ENABLED"
resolve_config "MESSAGE_TTL_SECONDS"
[ "$ANTHROPIC_PROXY_ENABLED" = "1" ] || { echo "FAIL: dev profile proxy"; exit 1; }
[ "$ASR_ENABLED" = "1" ] || { echo "FAIL: dev profile ASR"; exit 1; }
[ "$TTS_ENABLED" = "1" ] || { echo "FAIL: dev profile TTS"; exit 1; }
[ "$LLM_POSTPROCESS_ENABLED" = "1" ] || { echo "FAIL: dev profile LLM"; exit 1; }
[ "$MESSAGE_TTL_SECONDS" = "0" ] || { echo "FAIL: dev profile TTL"; exit 1; }
echo "PASS: --profile=dev full config (AC-A2)"

# Test 12: Full --profile=opensource flow
PROFILE="opensource"
apply_profile_defaults "$PROFILE"
unset ANTHROPIC_PROXY_ENABLED ASR_ENABLED TTS_ENABLED LLM_POSTPROCESS_ENABLED
unset MESSAGE_TTL_SECONDS
resolve_config "ANTHROPIC_PROXY_ENABLED"
resolve_config "ASR_ENABLED"
resolve_config "MESSAGE_TTL_SECONDS"
[ "$ANTHROPIC_PROXY_ENABLED" = "0" ] || { echo "FAIL: opensource proxy should be 0"; exit 1; }
[ "$ASR_ENABLED" = "0" ] || { echo "FAIL: opensource ASR should be 0"; exit 1; }
[ "$MESSAGE_TTL_SECONDS" = "86400" ] || { echo "FAIL: opensource TTL should be 86400"; exit 1; }
echo "PASS: --profile=opensource full config (AC-A1)"

# Test 13: .env override beats profile (AC-A4)
PROFILE="opensource"
apply_profile_defaults "$PROFILE"
ANTHROPIC_PROXY_ENABLED=1  # user explicitly enables proxy in opensource
resolve_config "ANTHROPIC_PROXY_ENABLED"
[ "$ANTHROPIC_PROXY_ENABLED" = "1" ] || { echo "FAIL: env override should win"; exit 1; }
[ "$_SRC_ANTHROPIC_PROXY_ENABLED" = ".env override" ] || { echo "FAIL: source should be .env override"; exit 1; }
unset ANTHROPIC_PROXY_ENABLED
echo "PASS: .env override beats profile default (AC-A4)"

echo ""
echo "All shell tests passed."
