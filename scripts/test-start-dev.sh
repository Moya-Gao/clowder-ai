#!/bin/bash
# Minimal regression test for setup_storage() fallback logic.
# Verifies: when redis-cli/redis-server unavailable → REDIS_URL is unset.
#
# BACKLOG #18: 缅因猫 review 指出 Redis 启动失败分支无自动化测试

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source start-dev.sh functions without executing main
# shellcheck source=./start-dev.sh
source "$SCRIPT_DIR/start-dev.sh" --source-only

# Override: make redis-cli and redis-server always fail
redis-cli() { return 1; }
redis-server() { return 1; }
command() {
    if [[ "$2" == "redis-server" ]]; then
        return 1
    fi
    builtin command "$@"
}

# Test 1: Redis unavailable with USE_REDIS=true → should unset REDIS_URL
unset REDIS_URL
USE_REDIS=true
REDIS_PORT=6399
setup_storage 2>/dev/null

if [ -n "$REDIS_URL" ]; then
    echo "FAIL: REDIS_URL should be unset when Redis unavailable, got: $REDIS_URL"
    exit 1
fi
echo "PASS: Redis unavailable → memory fallback (REDIS_URL unset)"

# Test 2: USE_REDIS=false → should also unset REDIS_URL
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

echo ""
echo "All shell tests passed."
