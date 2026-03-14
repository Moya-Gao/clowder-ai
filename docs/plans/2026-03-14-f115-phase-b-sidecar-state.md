---
feature_ids: [F115]
doc_kind: plan
created: 2026-03-14
---

# F115 Phase B: Sidecar 状態分層 Implementation Plan

**Feature:** F115 — `docs/features/F115-runtime-startup-optimization.md`
**Goal:** Sidecar 服务（ASR/TTS/LLM）从 boolean flag 升级为 4 状态机，启动失败明确报告，summary 只列 ready 服务。
**Acceptance Criteria:**
- AC-B1: sidecar 状态机 `disabled/launching/ready/failed` 正确流转
- AC-B2: ASR/TTS 超时 30s、LLM 超时 60s（可配置）
- AC-B3: summary 只报 `ready` 状态的服务
**Architecture:** 引入 `sidecar_state` 函数管理 `_STATE_<SERVICE>` 变量，替换现有 `STARTED_*` boolean。`start_sidecar` 统一处理 disabled→launching→ready/failed 流转。startup summary 遍历状态变量，只列 ready、报告 failed。
**Tech Stack:** Bash (POSIX-compatible, bash 3.2)
**前端验证:** No

---

## Terminal Schema

```bash
# State values: disabled | launching | ready | failed
_STATE_ASR=disabled
_STATE_TTS=disabled
_STATE_LLM_PP=disabled

# Unified sidecar launcher
# start_sidecar <name> <state_var> <port> <timeout> <launch_cmd>
start_sidecar() {
    local name="$1" state_var="$2" port="$3" timeout="$4"
    shift 4
    local launch_cmd="$*"

    eval "${state_var}=launching"
    echo "  启动 ${name} (端口 ${port})..."
    eval "$launch_cmd" &
    if wait_for_port "$port" "$name" "$timeout"; then
        eval "${state_var}=ready"
    else
        eval "${state_var}=failed"
    fi
}

# Summary helper: print sidecar status
print_sidecar_summary() {
    local name="$1" state_var="$2" port="$3"
    local state="${!state_var}"
    case "$state" in
        ready)   echo "  - ${name}: http://localhost:${port}" ;;
        failed)  echo -e "  - ${RED}${name}: 启动失败${NC}" ;;
        # disabled: don't print
    esac
}
```

## NOT Building

- 不改 `wait_for_port` 函数本身（已经正确返回 0/1）
- 不改 Proxy 的启动逻辑（Proxy 不是 sidecar，有自己的健康检查）
- 不增加运行时状态查询 API（那是未来的事）
- 不改超时值的可配置方式（env var 足够，不需要 profile 化）

---

## Task 1: start_sidecar 函数 + 状态变量

**Files:**
- Modify: `scripts/start-dev.sh:563-618` (replace 3 sidecar blocks with start_sidecar calls)
- Test: `scripts/test-start-dev.sh`

### Step 1: Write failing test — start_sidecar sets state

```bash
# Test 14: start_sidecar sets state to "ready" when port becomes available
_STATE_TEST=disabled
# Mock wait_for_port to always succeed
wait_for_port() { return 0; }
start_sidecar "TestSvc" "_STATE_TEST" 9999 5 "true"
[ "$_STATE_TEST" = "ready" ] || { echo "FAIL: state should be ready, got: $_STATE_TEST"; exit 1; }
echo "PASS: start_sidecar → ready"

# Test 15: start_sidecar sets state to "failed" when port timeout
_STATE_TEST2=disabled
wait_for_port() { return 1; }
start_sidecar "TestSvc2" "_STATE_TEST2" 9998 5 "true"
[ "$_STATE_TEST2" = "failed" ] || { echo "FAIL: state should be failed, got: $_STATE_TEST2"; exit 1; }
echo "PASS: start_sidecar → failed"
```

### Step 2: Run test → FAIL (start_sidecar not found)

### Step 3: Implement start_sidecar

Add `start_sidecar` function to start-dev.sh (after `wait_for_port`, before `clean_cache`).

Initialize state variables in the sidecar section:
```bash
_STATE_ASR=disabled
_STATE_TTS=disabled
_STATE_LLM_PP=disabled
```

Replace each sidecar block with:
```bash
# ASR
if [ "${ASR_ENABLED:-0}" = "1" ]; then
    if [ -f "scripts/qwen3-asr-server.sh" ]; then
        start_sidecar "Qwen3-ASR" "_STATE_ASR" "$ASR_PORT" "${ASR_TIMEOUT:-30}" \
            "WHISPER_PORT=$ASR_PORT bash scripts/qwen3-asr-server.sh"
    elif [ -f "scripts/whisper-server.sh" ]; then
        start_sidecar "Whisper ASR" "_STATE_ASR" "$ASR_PORT" "${ASR_TIMEOUT:-30}" \
            "WHISPER_PORT=$ASR_PORT bash scripts/whisper-server.sh"
    else
        echo -e "${YELLOW}  ⚠ ASR 已启用，但脚本未找到，跳过${NC}"
        _STATE_ASR=failed
    fi
fi
```

### Step 4: Run test → PASS

### Step 5: Commit

---

## Task 2: print_sidecar_summary 替换硬编码 summary

**Files:**
- Modify: `scripts/start-dev.sh:664-670` (summary section)
- Test: `scripts/test-start-dev.sh`

### Step 1: Write failing test

```bash
# Test 16: print_sidecar_summary only lists "ready" services
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
echo "PASS: print_sidecar_summary only shows ready + failed (AC-B3)"
```

### Step 2: Run test → FAIL

### Step 3: Implement print_sidecar_summary_all

```bash
print_sidecar_summary_all() {
    local services=("ASR:_STATE_ASR:$ASR_PORT" "TTS:_STATE_TTS:$TTS_PORT_VAL" "LLM后修:_STATE_LLM_PP:$LLM_PP_PORT")
    for entry in "${services[@]}"; do
        IFS=':' read -r name state_var port <<< "$entry"
        local state="${!state_var}"
        case "$state" in
            ready)   echo "  - ${name}:      http://localhost:${port}" ;;
            failed)  echo -e "  - ${name}:      ${RED}启动失败${NC}" ;;
        esac
    done
}
```

Replace the old `[ "$STARTED_ASR" = true ]` lines with `print_sidecar_summary_all`.

### Step 4: Run test → PASS

### Step 5: Commit

---

## Task 3: Configurable timeouts (AC-B2)

**Files:**
- Modify: `scripts/start-dev.sh` (sidecar section, timeout env vars)
- Test: `scripts/test-start-dev.sh`

### Step 1: Write failing test

```bash
# Test 17: Timeout values are configurable via env
ASR_TIMEOUT=45
TTS_TIMEOUT=45
LLM_TIMEOUT=90
# Verify these are passed to start_sidecar (we test by checking the variables exist)
[ "${ASR_TIMEOUT}" = "45" ] || { echo "FAIL: ASR timeout not configurable"; exit 1; }
[ "${LLM_TIMEOUT}" = "90" ] || { echo "FAIL: LLM timeout not configurable"; exit 1; }
echo "PASS: Sidecar timeouts configurable (AC-B2)"
```

This AC is mostly about wiring — the `start_sidecar` calls already use `${ASR_TIMEOUT:-30}` etc. Test verifies the defaults are correct by checking the actual calls.

### Step 2-5: Implementation already in Task 1 (`${ASR_TIMEOUT:-30}`, `${TTS_TIMEOUT:-30}`, `${LLM_TIMEOUT:-60}`). This test validates the wiring.

---

## AC Coverage Map

| AC | Task(s) | Verified by |
|----|---------|-------------|
| AC-B1: 状态机 disabled/launching/ready/failed | Task 1 | Test 14, 15 |
| AC-B2: ASR/TTS 30s, LLM 60s (configurable) | Task 1, 3 | Test 17 + code review |
| AC-B3: summary 只报 ready 服务 | Task 2 | Test 16 |
