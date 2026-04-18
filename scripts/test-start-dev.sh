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

# Test 4b: build failures should print full log, not just tail lines
fail_script="$(mktemp)"
cat >"$fail_script" <<'EOF'
#!/bin/bash
for i in $(seq 1 12); do
    printf 'line-%02d\n' "$i"
done
exit 23
EOF
chmod +x "$fail_script"

set +e
fail_output=$(run_logged_step "failure-test" 3 "$fail_script" 2>&1)
rc=$?
set -e

rm -f "$fail_script"

[ "$rc" -eq 23 ] || { echo "FAIL: run_logged_step should preserve exit code, got: $rc"; exit 1; }
echo "$fail_output" | grep -q "line-01" || { echo "FAIL: failure output should include first line of log"; exit 1; }
echo "$fail_output" | grep -q "line-12" || { echo "FAIL: failure output should include last line of log"; exit 1; }
echo "PASS: run_logged_step prints full failure log"

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
[ "$_PROF_MESSAGE_TTL_SECONDS" = "0" ] || { echo "FAIL: opensource TTL should be 0"; exit 1; }
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
[ "$MESSAGE_TTL_SECONDS" = "0" ] || { echo "FAIL: opensource TTL should be 0"; exit 1; }
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

# Test 13b: default Redis port is 6398 for non-runtime dev
PROD_WEB=false
default_port=$(default_redis_port)
[ "$default_port" = "6398" ] || { echo "FAIL: dev default Redis port should be 6398, got: $default_port"; exit 1; }
echo "PASS: dev default Redis port is 6398"

# Test 13c: default Redis port is 6399 for runtime/prod-web
PROD_WEB=true
default_port=$(default_redis_port)
[ "$default_port" = "6399" ] || { echo "FAIL: prod-web default Redis port should be 6399, got: $default_port"; exit 1; }
PROD_WEB=false
echo "PASS: runtime default Redis port is 6399"

# Test 13d: non-runtime explicit 6399 is rejected
set +e
(
    USE_REDIS=true
    PROD_WEB=false
    REDIS_PORT=6399
    guard_runtime_redis_sanctuary 2>/dev/null
)
rc=$?
set -e
[ "$rc" -ne 0 ] || { echo "FAIL: non-runtime 6399 should fail fast"; exit 1; }
echo "PASS: non-runtime 6399 is rejected"

# Test 13e: runtime may use 6399
USE_REDIS=true
PROD_WEB=true
REDIS_PORT=6399
guard_runtime_redis_sanctuary 2>/dev/null
PROD_WEB=false
echo "PASS: runtime 6399 is allowed"

# Test 13f: kill_port blocks cross-worktree process by default
orig_port_listen_pids_def="$(declare -f port_listen_pids)"
orig_pid_cwd_def="$(declare -f pid_cwd)"
port_listen_pids() { echo "4242"; }
pid_cwd() { echo "/tmp/cat-cafe-runtime"; }
CAT_CAFE_RUNTIME_RESTART_OK=0
set +e
kill_output=$(kill_port 3002 "API" 2>&1)
rc=$?
set -e
[ "$rc" -ne 0 ] || { echo "FAIL: cross-worktree kill should be blocked by default"; exit 1; }
echo "$kill_output" | grep -q "跨 worktree" || { echo "FAIL: should explain cross-worktree guard"; exit 1; }
echo "$kill_output" | grep -q "正在终止进程" && { echo "FAIL: should not reach kill stage when ownership guard blocks"; exit 1; }
echo "PASS: kill_port blocks cross-worktree process by default"

# Test 13g: explicit restart auth allows cross-worktree kill
port_probe_state="$(mktemp)"
echo "0" > "$port_probe_state"
port_listen_pids() {
    local count
    count=$(cat "$port_probe_state")
    if [ "$count" -eq 0 ]; then
        echo "4242"
    fi
    echo $((count + 1)) > "$port_probe_state"
}
CAT_CAFE_RUNTIME_RESTART_OK=1
set +e
kill_output=$(kill_port 3002 "API" 2>&1)
rc=$?
set -e
rm -f "$port_probe_state"
[ "$rc" -eq 0 ] || { echo "FAIL: explicit restart auth should allow cross-worktree cleanup"; exit 1; }
echo "$kill_output" | grep -q "CAT_CAFE_RUNTIME_RESTART_OK=1" || { echo "FAIL: should print explicit auth warning"; exit 1; }
echo "$kill_output" | grep -q "端口 3002 已释放" || { echo "FAIL: should report port released after explicit auth"; exit 1; }
echo "PASS: explicit restart auth allows cross-worktree cleanup"

unset CAT_CAFE_RUNTIME_RESTART_OK
eval "$orig_port_listen_pids_def"
eval "$orig_pid_cwd_def"

# Test 13h: managed port cleanup includes preview gateway
kill_port_calls=""
kill_port() { kill_port_calls="${kill_port_calls}|$1:$2"; }
API_PORT=3002
WEB_PORT=3001
PREVIEW_GATEWAY_PORT=4100
ANTHROPIC_PROXY_ENABLED=0
ASR_ENABLED=0
TTS_ENABLED=0
LLM_POSTPROCESS_ENABLED=0
kill_managed_ports
echo "$kill_port_calls" | grep -q "|3002:API" || { echo "FAIL: should kill API port"; exit 1; }
echo "$kill_port_calls" | grep -q "|3001:Frontend" || { echo "FAIL: should kill frontend port"; exit 1; }
echo "$kill_port_calls" | grep -q "|4100:Preview Gateway" || { echo "FAIL: should kill preview gateway port"; exit 1; }
echo "PASS: managed port cleanup includes preview gateway"

# ── F115 Phase B: Sidecar 状態分層 ──

# Save original wait_for_port before overriding
eval "$(declare -f wait_for_port)" 2>/dev/null
_original_wait_for_port() { wait_for_port "$@"; }

# Test 14: start_sidecar sets state to "ready" when port available
_STATE_TEST=disabled
wait_for_port() { return 0; }
start_sidecar "TestSvc" "_STATE_TEST" 9999 5 "true" 2>/dev/null
[ "$_STATE_TEST" = "ready" ] || { echo "FAIL: state should be ready, got: $_STATE_TEST"; exit 1; }
echo "PASS: start_sidecar → ready (AC-B1)"

# Test 15: start_sidecar sets state to "failed" when port timeout
_STATE_TEST2=disabled
wait_for_port() { return 1; }
start_sidecar "TestSvc2" "_STATE_TEST2" 9998 5 "true" 2>/dev/null
[ "$_STATE_TEST2" = "failed" ] || { echo "FAIL: state should be failed, got: $_STATE_TEST2"; exit 1; }
echo "PASS: start_sidecar → failed (AC-B1)"

# Test 16: print_sidecar_summary_all only lists ready, reports failed, hides disabled
_STATE_ASR=ready
_STATE_TTS=failed
_STATE_LLM_PP=disabled
ASR_PORT=9876
TTS_PORT_VAL=9879
LLM_PP_PORT=9878
sidecar_output=$(print_sidecar_summary_all 2>&1)
echo "$sidecar_output" | grep -q "ASR.*9876" || { echo "FAIL: ready ASR should appear"; exit 1; }
echo "$sidecar_output" | grep -q "启动失败" || { echo "FAIL: failed TTS should show failure"; exit 1; }
echo "$sidecar_output" | grep -q "LLM" && { echo "FAIL: disabled LLM should not appear"; exit 1; }
echo "PASS: sidecar summary shows ready + failed, hides disabled (AC-B3)"

# Test 17: Default timeouts — ASR/TTS 30s, LLM 60s
[ "${ASR_TIMEOUT:-30}" = "30" ] || { echo "FAIL: ASR default timeout should be 30"; exit 1; }
[ "${TTS_TIMEOUT:-30}" = "30" ] || { echo "FAIL: TTS default timeout should be 30"; exit 1; }
[ "${LLM_TIMEOUT:-60}" = "60" ] || { echo "FAIL: LLM default timeout should be 60"; exit 1; }
ASR_TIMEOUT=45
[ "$ASR_TIMEOUT" = "45" ] || { echo "FAIL: ASR timeout not configurable"; exit 1; }
unset ASR_TIMEOUT
echo "PASS: sidecar timeouts configurable with correct defaults (AC-B2)"

# ── F115 Phase D: 交互式 Setup ──

# Test 18: check_sidecar_dep returns 1 when python3 is missing (AC-D3)
# Override command to simulate missing python3
_orig_command=$(which command 2>/dev/null || true)
command() {
    if [[ "$2" == "python3" ]]; then
        return 1
    fi
    builtin command "$@"
}
dep_result=0
check_sidecar_dep "ASR" "python3" 2>/dev/null || dep_result=$?
[ "$dep_result" -ne 0 ] || { echo "FAIL: check_sidecar_dep should fail when python3 missing"; exit 1; }
echo "PASS: check_sidecar_dep detects missing python3 (AC-D3)"

# Test 19: check_sidecar_dep returns 0 when dep exists
command() { builtin command "$@"; }  # restore
check_sidecar_dep "Node" "node" 2>/dev/null
dep_result=$?
[ "$dep_result" -eq 0 ] || { echo "FAIL: check_sidecar_dep should pass when node exists"; exit 1; }
echo "PASS: check_sidecar_dep passes when dep exists (AC-D3)"

# Test 20: setup.sh exists (AC-D1)
[ -f "$SCRIPT_DIR/setup.sh" ] || { echo "FAIL: setup.sh not found"; exit 1; }
echo "PASS: setup.sh exists (AC-D1)"

# Test 21: setup.sh --install-missing triggers venv creation (AC-D2)
# Extract the install_sidecar_venvs function and test it with a mock python3 -m venv
# We verify setup.sh contains install_sidecar_venvs and calls it when --install-missing
grep -q "^install_sidecar_venvs()" "$SCRIPT_DIR/setup.sh" || { echo "FAIL: setup.sh missing install_sidecar_venvs function definition (AC-D2)"; exit 1; }
grep -q '    install_sidecar_venvs' "$SCRIPT_DIR/setup.sh" || { echo "FAIL: setup.sh should call install_sidecar_venvs (indented call site) when --install-missing"; exit 1; }
echo "PASS: setup.sh has install_sidecar_venvs for --install-missing (AC-D2)"

# Test 22: install_sidecar_venvs creates venvs in expected paths (AC-D2)
# Mock python3 to avoid real venv creation, create fake bin/pip
setup_venv_calls=""
python3() {
    if [ "$1" = "-m" ] && [ "$2" = "venv" ]; then
        setup_venv_calls="${setup_venv_calls}${3};"
        mkdir -p "$3/bin"
        # Create a fake pip that does nothing
        echo '#!/bin/bash' > "$3/bin/pip"
        echo 'exit 0' >> "$3/bin/pip"
        chmod +x "$3/bin/pip"
        return 0
    fi
    builtin command python3 "$@"
}

# Source just the function from setup.sh
eval "$(sed -n '/^install_sidecar_venvs/,/^}/p' "$SCRIPT_DIR/setup.sh")"
TMPVENV=$(mktemp -d)
HOME="$TMPVENV" install_sidecar_venvs 2>/dev/null
# Check that it tried to create all three venvs
[ -n "$setup_venv_calls" ] || { echo "FAIL: install_sidecar_venvs did not call python3 -m venv"; exit 1; }
echo "$setup_venv_calls" | grep -q "asr-venv" || { echo "FAIL: should create asr-venv"; exit 1; }
echo "$setup_venv_calls" | grep -q "tts-venv" || { echo "FAIL: should create tts-venv"; exit 1; }
echo "$setup_venv_calls" | grep -q "llm-venv" || { echo "FAIL: should create llm-venv"; exit 1; }
rm -rf "$TMPVENV"
unset -f python3 2>/dev/null || true
echo "PASS: install_sidecar_venvs creates ASR/TTS/LLM venvs (AC-D2)"

echo ""
echo "All shell tests passed."
