---
feature_ids: [F115]
doc_kind: plan
created: 2026-03-14
---

# F115 Phase A: start-dev.sh Profile 化 Implementation Plan

**Feature:** F115 — `docs/features/F115-runtime-startup-optimization.md`
**Goal:** 将 start-dev.sh 改为 `--profile=dev|opensource` 模式，不同 profile 决定默认值，启动摘要标注每个值来源。
**Acceptance Criteria:**
- AC-A1: `start-dev.sh --profile=opensource` 使用开源仓默认值（proxy OFF 等）
- AC-A2: `start-dev.sh --profile=dev` 使用家里默认值（proxy ON 等）
- AC-A3: 启动摘要标注每个配置值来源
- AC-A4: `.env` override 正确覆盖 profile 默认值
**Architecture:** 在参数解析阶段新增 `--profile=dev|opensource`，profile 设置 `_PROFILE_*` 内部变量。后续各环节用 `${VAR:-$_PROFILE_VAR}` 取值，已有 `.env` / env var 值优先。启动摘要用 `config_source()` 函数标注每个值来源。
**Tech Stack:** Bash (POSIX-compatible), node:test (for test runner)
**前端验证:** No

---

## Terminal Schema

Profile 系统的最终形态：

```bash
# 1. Profile defaults map (pure data, no side effects)
apply_profile_defaults() {
    local profile="$1"
    case "$profile" in
        dev)
            _PROF_ANTHROPIC_PROXY_ENABLED=1
            _PROF_ASR_ENABLED=1
            _PROF_TTS_ENABLED=1
            _PROF_LLM_POSTPROCESS_ENABLED=1
            _PROF_MESSAGE_TTL_SECONDS=0
            _PROF_THREAD_TTL_SECONDS=0
            _PROF_TASK_TTL_SECONDS=0
            _PROF_SUMMARY_TTL_SECONDS=0
            _PROF_REDIS_PROFILE=dev
            ;;
        opensource)
            _PROF_ANTHROPIC_PROXY_ENABLED=0
            _PROF_ASR_ENABLED=0
            _PROF_TTS_ENABLED=0
            _PROF_LLM_POSTPROCESS_ENABLED=0
            _PROF_MESSAGE_TTL_SECONDS=86400
            _PROF_THREAD_TTL_SECONDS=86400
            _PROF_TASK_TTL_SECONDS=86400
            _PROF_SUMMARY_TTL_SECONDS=86400
            _PROF_REDIS_PROFILE=opensource
            ;;
    esac
}

# 2. Resolve: env override > profile default
resolve_config() {
    local var_name="$1"
    local prof_var="_PROF_${var_name}"
    local env_val="${!var_name}"
    local prof_val="${!prof_var}"
    if [ -n "$env_val" ]; then
        _CONFIG_SOURCE[$var_name]=".env override"
        echo "$env_val"
    else
        _CONFIG_SOURCE[$var_name]="profile default ($PROFILE)"
        echo "$prof_val"
    fi
}

# 3. Startup summary annotates source
print_config_summary() {
    for key in "${!_CONFIG_SOURCE[@]}"; do
        echo "  $key = ${!key}  ← ${_CONFIG_SOURCE[$key]}"
    done
}
```

## NOT Building

- 不改 `.env` 文件格式
- 不引入 YAML/JSON 配置文件
- 不改动任何服务启动逻辑（仅改默认值来源和摘要输出）
- `--profile` 不影响 `--quick`、`--memory`、`--prod-web` 行为

---

## Task 1: Profile 参数解析 + apply_profile_defaults 函数

**Files:**
- Modify: `scripts/start-dev.sh:40-50` (arg parsing)
- Modify: `scripts/start-dev.sh:88-105` (insert profile defaults before env defaults)
- Test: `scripts/test-start-dev.sh`

### Step 1: Write failing test — profile defaults

在 `test-start-dev.sh` 末尾新增测试：

```bash
# Test 5: apply_profile_defaults sets correct values for "dev"
apply_profile_defaults "dev"
[ "$_PROF_ANTHROPIC_PROXY_ENABLED" = "1" ] || { echo "FAIL: dev profile proxy should be 1"; exit 1; }
[ "$_PROF_ASR_ENABLED" = "1" ] || { echo "FAIL: dev profile ASR should be 1"; exit 1; }
[ "$_PROF_REDIS_PROFILE" = "dev" ] || { echo "FAIL: dev profile redis should be dev"; exit 1; }
echo "PASS: apply_profile_defaults dev"

# Test 6: apply_profile_defaults sets correct values for "opensource"
apply_profile_defaults "opensource"
[ "$_PROF_ANTHROPIC_PROXY_ENABLED" = "0" ] || { echo "FAIL: opensource profile proxy should be 0"; exit 1; }
[ "$_PROF_ASR_ENABLED" = "0" ] || { echo "FAIL: opensource profile ASR should be 0"; exit 1; }
[ "$_PROF_MESSAGE_TTL_SECONDS" = "86400" ] || { echo "FAIL: opensource TTL should be 86400"; exit 1; }
[ "$_PROF_REDIS_PROFILE" = "opensource" ] || { echo "FAIL: opensource redis profile should be opensource"; exit 1; }
echo "PASS: apply_profile_defaults opensource"
```

### Step 2: Run test to verify it fails

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f115-phase-a
bash scripts/test-start-dev.sh
```
Expected: FAIL — `apply_profile_defaults: command not found`

### Step 3: Implement apply_profile_defaults + arg parsing

In `start-dev.sh`:

1. Add `--profile=*` to arg parsing (line 44-50):
```bash
PROFILE=""
for arg in "$@"; do
    case $arg in
        --quick|-q) QUICK_MODE=true ;;
        --memory|--no-redis) USE_REDIS=false ;;
        --prod-web) PROD_WEB=true ;;
        --profile=*) PROFILE="${arg#*=}" ;;
    esac
done
```

2. Add `apply_profile_defaults` function after env loading (after line 86, before line 88):
```bash
apply_profile_defaults() {
    local profile="$1"
    case "$profile" in
        dev)
            _PROF_ANTHROPIC_PROXY_ENABLED=1
            _PROF_ASR_ENABLED=1
            _PROF_TTS_ENABLED=1
            _PROF_LLM_POSTPROCESS_ENABLED=1
            _PROF_MESSAGE_TTL_SECONDS=0
            _PROF_THREAD_TTL_SECONDS=0
            _PROF_TASK_TTL_SECONDS=0
            _PROF_SUMMARY_TTL_SECONDS=0
            _PROF_REDIS_PROFILE=dev
            ;;
        opensource)
            _PROF_ANTHROPIC_PROXY_ENABLED=0
            _PROF_ASR_ENABLED=0
            _PROF_TTS_ENABLED=0
            _PROF_LLM_POSTPROCESS_ENABLED=0
            _PROF_MESSAGE_TTL_SECONDS=86400
            _PROF_THREAD_TTL_SECONDS=86400
            _PROF_TASK_TTL_SECONDS=86400
            _PROF_SUMMARY_TTL_SECONDS=86400
            _PROF_REDIS_PROFILE=opensource
            ;;
        "")
            # No profile — all _PROF_ vars stay unset, existing behavior preserved
            ;;
        *)
            echo "ERROR: Unknown profile '$profile'. Valid: dev, opensource"
            exit 1
            ;;
    esac
}

apply_profile_defaults "$PROFILE"
```

### Step 4: Run test to verify it passes

```bash
bash scripts/test-start-dev.sh
```
Expected: PASS for Tests 5 and 6

### Step 5: Commit

```bash
git add scripts/start-dev.sh scripts/test-start-dev.sh
git commit -m "feat(F115): add --profile arg + apply_profile_defaults [布偶猫🐾]"
```

---

## Task 2: resolve_config — profile default 作为 fallback，.env 覆盖

**Files:**
- Modify: `scripts/start-dev.sh:88-105` (replace hardcoded defaults with resolve_config)
- Test: `scripts/test-start-dev.sh`

### Step 1: Write failing test — resolve_config priority

```bash
# Test 7: resolve_config — env override wins over profile default
apply_profile_defaults "opensource"
ANTHROPIC_PROXY_ENABLED=1  # explicit env override
resolved=$(resolve_config "ANTHROPIC_PROXY_ENABLED")
[ "$resolved" = "1" ] || { echo "FAIL: env override should win, got: $resolved"; exit 1; }
[ "${_CONFIG_SOURCE[ANTHROPIC_PROXY_ENABLED]}" = ".env override" ] || { echo "FAIL: source should be .env override"; exit 1; }
unset ANTHROPIC_PROXY_ENABLED
echo "PASS: resolve_config env override wins"

# Test 8: resolve_config — profile default used when no env
apply_profile_defaults "dev"
unset ASR_ENABLED
resolved=$(resolve_config "ASR_ENABLED")
[ "$resolved" = "1" ] || { echo "FAIL: profile default should be 1, got: $resolved"; exit 1; }
[ "${_CONFIG_SOURCE[ASR_ENABLED]}" = "profile default (dev)" ] || { echo "FAIL: source should be profile default"; exit 1; }
echo "PASS: resolve_config profile default fallback"

# Test 9: resolve_config — no profile, no env → empty (backward compat)
PROFILE=""
apply_profile_defaults "$PROFILE"
unset TTS_ENABLED
resolved=$(resolve_config "TTS_ENABLED")
[ -z "$resolved" ] || { echo "FAIL: no profile + no env should be empty, got: $resolved"; exit 1; }
echo "PASS: resolve_config no profile no env → empty"
```

### Step 2: Run test to verify it fails

Expected: FAIL — `resolve_config: command not found`

### Step 3: Implement resolve_config + wire into defaults section

```bash
declare -A _CONFIG_SOURCE

resolve_config() {
    local var_name="$1"
    local prof_var="_PROF_${var_name}"
    local env_val="${!var_name}"
    local prof_val="${!prof_var}"
    if [ -n "$env_val" ]; then
        _CONFIG_SOURCE[$var_name]=".env override"
        echo "$env_val"
    elif [ -n "$prof_val" ]; then
        _CONFIG_SOURCE[$var_name]="profile default ($PROFILE)"
        echo "$prof_val"
    else
        _CONFIG_SOURCE[$var_name]="built-in default"
        echo ""
    fi
}
```

Replace hardcoded defaults section (lines 88-105) to use resolve_config:

```bash
# 默认端口 (not profile-dependent)
API_PORT=${API_SERVER_PORT:-3002}
WEB_PORT=${FRONTEND_PORT:-3001}
REDIS_PORT=${REDIS_PORT:-6399}

# Profile-aware config resolution
ANTHROPIC_PROXY_ENABLED=$(resolve_config "ANTHROPIC_PROXY_ENABLED")
ASR_ENABLED=$(resolve_config "ASR_ENABLED")
TTS_ENABLED=$(resolve_config "TTS_ENABLED")
LLM_POSTPROCESS_ENABLED=$(resolve_config "LLM_POSTPROCESS_ENABLED")
MESSAGE_TTL_SECONDS=$(resolve_config "MESSAGE_TTL_SECONDS")
THREAD_TTL_SECONDS=$(resolve_config "THREAD_TTL_SECONDS")
TASK_TTL_SECONDS=$(resolve_config "TASK_TTL_SECONDS")
SUMMARY_TTL_SECONDS=$(resolve_config "SUMMARY_TTL_SECONDS")
REDIS_PROFILE=$(resolve_config "REDIS_PROFILE")

# Apply fallbacks for non-profiled vars
: "${ANTHROPIC_PROXY_ENABLED:=0}"
: "${ASR_ENABLED:=0}"
: "${TTS_ENABLED:=0}"
: "${LLM_POSTPROCESS_ENABLED:=0}"
: "${MESSAGE_TTL_SECONDS:=0}"
: "${THREAD_TTL_SECONDS:=0}"
: "${TASK_TTL_SECONDS:=0}"
: "${SUMMARY_TTL_SECONDS:=0}"
: "${REDIS_PROFILE:=dev}"

REDIS_DATA_DIR=${REDIS_DATA_DIR:-"$HOME/.cat-cafe/redis-${REDIS_PROFILE}"}
REDIS_BACKUP_DIR=${REDIS_BACKUP_DIR:-"$HOME/.cat-cafe/redis-backups/${REDIS_PROFILE}"}
REDIS_DBFILE=${REDIS_DBFILE:-dump.rdb}
REDIS_PIDFILE="${REDIS_DATA_DIR}/redis-${REDIS_PORT}.pid"
REDIS_LOGFILE="${REDIS_DATA_DIR}/redis-${REDIS_PORT}.log"
STARTED_REDIS=false

export MESSAGE_TTL_SECONDS THREAD_TTL_SECONDS TASK_TTL_SECONDS SUMMARY_TTL_SECONDS
```

### Step 4: Run test to verify it passes

```bash
bash scripts/test-start-dev.sh
```

### Step 5: Commit

```bash
git add scripts/start-dev.sh scripts/test-start-dev.sh
git commit -m "feat(F115): resolve_config with profile fallback + .env override [布偶猫🐾]"
```

---

## Task 3: 启动摘要标注配置来源 (AC-A3)

**Files:**
- Modify: `scripts/start-dev.sh:555-570` (startup summary section)
- Test: `scripts/test-start-dev.sh`

### Step 1: Write failing test — print_config_summary output

```bash
# Test 10: print_config_summary includes source annotations
PROFILE="dev"
apply_profile_defaults "$PROFILE"
declare -A _CONFIG_SOURCE=()
unset ANTHROPIC_PROXY_ENABLED
ANTHROPIC_PROXY_ENABLED=$(resolve_config "ANTHROPIC_PROXY_ENABLED")
ASR_ENABLED=0  # explicit override
ASR_ENABLED_resolved=$(resolve_config "ASR_ENABLED")

summary_output=$(print_config_summary 2>&1)
echo "$summary_output" | grep -q "ANTHROPIC_PROXY_ENABLED.*profile default" || { echo "FAIL: summary should show profile default for proxy"; exit 1; }
echo "$summary_output" | grep -q "ASR_ENABLED.*.env override" || { echo "FAIL: summary should show .env override for ASR"; exit 1; }
echo "PASS: print_config_summary shows source annotations"
```

### Step 2: Run test to verify it fails

Expected: FAIL — `print_config_summary: command not found`

### Step 3: Implement print_config_summary

```bash
print_config_summary() {
    echo "  配置来源："
    local key
    for key in ANTHROPIC_PROXY_ENABLED ASR_ENABLED TTS_ENABLED LLM_POSTPROCESS_ENABLED \
               MESSAGE_TTL_SECONDS THREAD_TTL_SECONDS TASK_TTL_SECONDS SUMMARY_TTL_SECONDS \
               REDIS_PROFILE; do
        local val="${!key}"
        local source="${_CONFIG_SOURCE[$key]:-built-in default}"
        printf "    %-30s = %-10s ← %s\n" "$key" "$val" "$source"
    done
}
```

Insert `print_config_summary` call in the startup summary block (after line 557, before 服务地址):

```bash
echo ""
echo "========================"
echo -e "${GREEN}🎉 Cat Café 已启动！${NC}"
[ -n "$PROFILE" ] && echo -e "  Profile: ${CYAN}${PROFILE}${NC}"
echo ""
print_config_summary
echo ""
echo "服务地址："
```

### Step 4: Run test to verify it passes

### Step 5: Commit

```bash
git add scripts/start-dev.sh scripts/test-start-dev.sh
git commit -m "feat(F115): startup summary annotates config value source [布偶猫🐾]"
```

---

## Task 4: 更新脚本 header 注释 + Usage

**Files:**
- Modify: `scripts/start-dev.sh:1-22` (header comments)

### Step 1: Update header

```bash
# Cat Cafe 启动脚本
# 用法:
#   pnpm start                        — 开发模式 (next dev + Redis 持久化)
#   pnpm start --profile=dev          — 家里开发默认值 (proxy ON, sidecar ON)
#   pnpm start --profile=opensource   — 开源仓默认值 (proxy OFF, sidecar OFF)
#   pnpm start --quick                — 跳过 rebuild
#   pnpm start --memory               — 使用内存存储 (重启丢数据)
#   pnpm start --prod-web             — 前端 production build (PWA + Tailscale 友好)
#
# Profile 说明:
#   dev        — proxy ON, ASR/TTS/LLM ON, TTL=永久, redis-dev
#   opensource — proxy OFF, ASR/TTS/LLM OFF, TTL=86400s, redis-opensource
#   (无)       — 保持原有行为（各项 ENABLED 默认 0）
#
# .env 中的显式值覆盖 profile 默认值。启动摘要标注每个值的来源。
```

### Step 2: Commit

```bash
git add scripts/start-dev.sh
git commit -m "docs(F115): update start-dev.sh header with profile usage [布偶猫🐾]"
```

---

## Task 5: 端到端集成测试

**Files:**
- Test: `scripts/test-start-dev.sh`

### Step 1: Write integration tests

```bash
# Test 11: Full --profile=dev flow — all services enabled by default
PROFILE="dev"
apply_profile_defaults "$PROFILE"
declare -A _CONFIG_SOURCE=()
# Clear env to simulate fresh start
unset ANTHROPIC_PROXY_ENABLED ASR_ENABLED TTS_ENABLED LLM_POSTPROCESS_ENABLED
unset MESSAGE_TTL_SECONDS THREAD_TTL_SECONDS TASK_TTL_SECONDS SUMMARY_TTL_SECONDS
ANTHROPIC_PROXY_ENABLED=$(resolve_config "ANTHROPIC_PROXY_ENABLED")
ASR_ENABLED=$(resolve_config "ASR_ENABLED")
TTS_ENABLED=$(resolve_config "TTS_ENABLED")
LLM_POSTPROCESS_ENABLED=$(resolve_config "LLM_POSTPROCESS_ENABLED")
MESSAGE_TTL_SECONDS=$(resolve_config "MESSAGE_TTL_SECONDS")
[ "$ANTHROPIC_PROXY_ENABLED" = "1" ] || { echo "FAIL: dev profile proxy"; exit 1; }
[ "$ASR_ENABLED" = "1" ] || { echo "FAIL: dev profile ASR"; exit 1; }
[ "$TTS_ENABLED" = "1" ] || { echo "FAIL: dev profile TTS"; exit 1; }
[ "$LLM_POSTPROCESS_ENABLED" = "1" ] || { echo "FAIL: dev profile LLM"; exit 1; }
[ "$MESSAGE_TTL_SECONDS" = "0" ] || { echo "FAIL: dev profile TTL"; exit 1; }
echo "PASS: --profile=dev full config"

# Test 12: Full --profile=opensource flow
PROFILE="opensource"
apply_profile_defaults "$PROFILE"
declare -A _CONFIG_SOURCE=()
unset ANTHROPIC_PROXY_ENABLED ASR_ENABLED TTS_ENABLED LLM_POSTPROCESS_ENABLED
unset MESSAGE_TTL_SECONDS
ANTHROPIC_PROXY_ENABLED=$(resolve_config "ANTHROPIC_PROXY_ENABLED")
ASR_ENABLED=$(resolve_config "ASR_ENABLED")
MESSAGE_TTL_SECONDS=$(resolve_config "MESSAGE_TTL_SECONDS")
[ "$ANTHROPIC_PROXY_ENABLED" = "0" ] || { echo "FAIL: opensource proxy should be 0"; exit 1; }
[ "$ASR_ENABLED" = "0" ] || { echo "FAIL: opensource ASR should be 0"; exit 1; }
[ "$MESSAGE_TTL_SECONDS" = "86400" ] || { echo "FAIL: opensource TTL should be 86400"; exit 1; }
echo "PASS: --profile=opensource full config"

# Test 13: .env override beats profile (AC-A4)
PROFILE="opensource"
apply_profile_defaults "$PROFILE"
declare -A _CONFIG_SOURCE=()
ANTHROPIC_PROXY_ENABLED=1  # user explicitly enables proxy in opensource
resolved=$(resolve_config "ANTHROPIC_PROXY_ENABLED")
[ "$resolved" = "1" ] || { echo "FAIL: env override should win"; exit 1; }
[ "${_CONFIG_SOURCE[ANTHROPIC_PROXY_ENABLED]}" = ".env override" ] || { echo "FAIL: source should be .env override"; exit 1; }
unset ANTHROPIC_PROXY_ENABLED
echo "PASS: .env override beats profile default (AC-A4)"
```

### Step 2: Run full test suite

```bash
bash scripts/test-start-dev.sh
```
Expected: All 13 tests PASS

### Step 3: Commit

```bash
git add scripts/test-start-dev.sh
git commit -m "test(F115): integration tests for profile + override priority [布偶猫🐾]"
```

---

## AC Coverage Map

| AC | Task(s) | Verified by |
|----|---------|-------------|
| AC-A1: `--profile=opensource` defaults | Task 1+2 | Test 6, 12 |
| AC-A2: `--profile=dev` defaults | Task 1+2 | Test 5, 11 |
| AC-A3: 启动摘要标注来源 | Task 3 | Test 10 |
| AC-A4: `.env` override 覆盖 profile | Task 2 | Test 7, 13 |
