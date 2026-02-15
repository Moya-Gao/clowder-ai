# Bug Report: F24 Session Chain 对 Claude Code 独立 Session 半盲

## 元信息

| 项目 | 内容 |
|------|------|
| **报告人** | 铲屎官 (runtime 观察) + 布偶猫 (事后分析) |
| **发现时间** | 2026-02-15 ~04:50 UTC |
| **严重程度** | P0 — 导致失忆 + 未授权操作 |
| **影响范围** | 所有通过 Claude Code SDK 独立运行的猫 (当前仅 opus) |
| **状态** | 分析完成，方案待实施 |
| **参考文档** | [`docs/research/AI-Coding-Tools-research.md`](../../research/AI-Coding-Tools-research.md) — CLI Hooks 能力调研 |

## 1. 事件时间线

```
T0  布偶猫 session 开始，处理 F24 per-cat toggle 任务
    - 写 bug report、实现 toggle、跑测试、提交 commit

T1  缅因猫 R1 review → 发现 P1 (context_health 未被 guard)
    - 布偶猫修复 → 缅因猫 R2 通过

T2  铲屎官要求提 PR + 云端 review
    - 布偶猫创建 PR #3，触发 @codex review

T3  云端 Codex 发现 P1 (getCachedConfig 配置不可读时 throw)
    - 缅因猫本地确认属实 → 布偶猫修复 → push 到 PR

T4  缅因猫 R4 通过 (0 P1/P2)

T5  ⚠️ 前端显示 context 占用 82%
    - 铲屎官在这个时间点要求布偶猫继续干活
    - F24 session chain 没有任何反应（没有 seal 提醒）

T6  ⚠️ Context 达到 SDK 压缩阈值
    - Claude Code SDK 自动触发 context compaction
    - F24 完全不知道这件事发生了
    - 压缩后 context 降到 ~39%
    - 布偶猫丢失了关键上下文细节

T7  🔴 布偶猫从压缩摘要恢复
    - 摘要中包含歧义信息："铲屎官说可以合入"
    - 布偶猫误以为这是关于 PR #3 的（实际是关于更早的 PR #1）
    - 自行执行 `gh pr merge 3 --squash`
    - 违反了"合入权归铲屎官"和"Cloud review 修复后需二次确认"的流程

T8  铲屎官发现问题，纠正布偶猫
```

### 1.1 复现步骤

**前置条件**：
- Cat Cafe API 运行中 (localhost:3001)
- F24 session chain 已启用 (opus: `features.sessionChain = true`)
- 布偶猫通过 Claude Code SDK 独立运行（非 API invoke）

**复现步骤**：

1. 在 Claude Code 中开始一个需要多轮对话的任务（如多文件重构）
2. 持续对话直到 context 占用超过 80%（可通过前端 StatusBar 观察）
3. 继续对话，触发 Claude Code SDK 自动 context compaction
4. 观察 F24 是否有任何 seal / 警告 / 状态保存行为

**期望行为**：
- T5~T6 之间：F24 应在 SDK 压缩前触发 seal，保存 session transcript + digest
- T6 压缩后：F24 应注入关键上下文（当前任务、待确认 PR、review 状态等）+ 防呆提醒
- T7 恢复后：猫应知道自己刚经历压缩，高危操作前应主动验证

**实际行为**：
- F24 完全不知道 SDK 压缩发生了（无 seal、无警告、无状态保存）
- 猫从有损摘要恢复，丢失细节，做出错误判断
- 高危操作 (`gh pr merge`) 未被拦截

### 1.2 验证通过标准

修复完成后，以下三项必须全部通过：

| # | 验证项 | 通过标准 | 验证方法 |
|---|--------|----------|----------|
| V1 | PreCompact hook 触发 | 手动 `/compact` 时 hook 执行、调用 seal API、写状态文件 | `claude --debug` 查看 hook 输出 + 检查状态文件 |
| V2 | SessionStart(compact) hook 注入 | compact 后 session 恢复时注入防呆提醒 + 工作状态 | 检查 compact 后 Claude 的 context 中是否有注入内容 |
| V3 | PreToolUse guard 拦截 | compact 后执行 `gh pr merge` 等高危命令被 deny | `claude --debug` 查看 permissionDecision = deny |

## 2. 根因分析

### 直接原因：压缩摘要导致失忆

Claude Code SDK 在 context window 快满时自动执行 context compaction。压缩是**有损的**：它把完整对话压缩成摘要，丢失了细节。布偶猫从摘要中读到了歧义信息，做出了错误判断。

### 根本原因：F24 对 Claude Code 独立 session 完全半盲

F24 session chain 的 context health 监控**只在 Cat Cafe API invoke 层工作**：

```
Cat Cafe API invoke 猫 → 猫返回 token 使用 → F24 计算 fillRatio → 判断是否 seal
```

但 opus 作为 Claude Code 独立运行时：

```
铲屎官直接跟 Claude Code 对话 → context 在 SDK 内部增长 →
SDK 自己压缩 → F24 完全不知道
```

**F24 看到的 82% 是上次被 Cat Cafe API invoke 时的快照**。之后布偶猫继续跟铲屎官对话，context 持续增长，但 F24 无从感知。

### 设计缺陷：没有"压缩前交接"机制

理想流程应该是：
```
Context 接近阈值 → F24 seal 当前 session → 写 transcript + digest →
启动新 session → bootstrap 注入关键上下文 → 无损交接
```

实际发生的：
```
Context 接近阈值 → SDK 强制压缩 → 有损摘要 → 失忆 → 错误操作
```

## 3. 影响评估

### 本次事件影响
- PR #3 被未授权合入（代码本身正确，流程违规）
- Cloud P1 修复未经云端二次 review
- 残余风险（配置不可读时 gemini 被临时开启）未修

### 系统性影响
- **所有通过 Claude Code SDK 独立运行的猫都有此风险**
- 压缩 = 失忆，失忆后猫的行为不可预测
- F24 投入的 session chain / seal / transcript 机制对最大用户（opus 独立 session）无效

## 4. 修复方案：Claude Code Hooks 集成

### 核心发现

Claude Code 官方 hooks 体系提供了**两个关键 hook event**：

| Hook | 触发时机 | 能力 |
|------|----------|------|
| **`PreCompact`** | Context 压缩**之前** | 可注入信息，但**不能阻止压缩** |
| **`SessionStart`** | Session 开始或 compact **之后** | matcher `compact` 可区分压缩后恢复，可注入 context |

### 方案 A：PreCompact Hook — 压缩前保存关键状态

在 context 压缩前，通过 hook 脚本：
1. 调用 Cat Cafe API 创建 seal record（写 transcript / digest）
2. 保存当前工作状态到文件（当前任务、待确认的 PR、review 状态等）
3. 输出警告信息提醒（通过 `systemMessage` 返回）

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "manual|auto",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/f24-pre-compact.sh",
            "statusMessage": "F24: 保存 session 状态..."
          }
        ]
      }
    ]
  }
}
```

**PreCompact hook 脚本**思路：
```bash
#!/bin/bash
# f24-pre-compact.sh
# 在 context 压缩前执行

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
TRIGGER=$(echo "$INPUT" | jq -r '.trigger')

# 1. 通知 Cat Cafe API 执行 F24 seal（带超时 + 返回码检查）
SEAL_HTTP_CODE=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost:3001/api/sessions/seal" \
  -H "Content-Type: application/json" \
  -d "{\"catId\": \"opus\", \"reason\": \"claude-code-compact-$TRIGGER\"}")
SEAL_OK=$?

if [ "$SEAL_OK" -ne 0 ] || [ "$SEAL_HTTP_CODE" -lt 200 ] || [ "$SEAL_HTTP_CODE" -ge 300 ]; then
  SEAL_WARNING="⚠️ F24 seal 失败 (HTTP $SEAL_HTTP_CODE)，session 历史可能未保存。"
else
  SEAL_WARNING=""
fi

# 2. 保存当前工作状态快照（按 session_id 隔离）
STATE_FILE="/tmp/cat-cafe-opus-compact-state-${SESSION_ID}.json"
jq -n \
  --arg sid "$SESSION_ID" \
  --arg trigger "$TRIGGER" \
  --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{sessionId: $sid, trigger: $trigger, compactedAt: $time}' \
  > "$STATE_FILE"

# 3. 写 recent-compact 标记文件（供 PreToolUse Guard 判断"刚 compact 过"）
#    按 session_id 隔离，避免并行实例/跨项目串扰
MARKER_FILE="/tmp/cat-cafe-opus-recent-compact-${SESSION_ID}.marker"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER_FILE"

# 4. 返回系统消息提醒（含 seal 成败状态）
SEAL_MSG="${SEAL_WARNING:+$SEAL_WARNING\n}"
jq -n --arg msg "${SEAL_MSG}⚠️ Context 即将被压缩。F24 已保存 session 状态到 $STATE_FILE。压缩后请注意验证关键上下文是否完整。" \
  '{systemMessage: $msg}'
```

### 方案 B：SessionStart (compact) Hook — 压缩后恢复关键上下文

在压缩后 session 恢复时，注入保存的状态：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/f24-post-compact-bootstrap.sh",
            "statusMessage": "F24: 恢复 session 上下文..."
          }
        ]
      }
    ]
  }
}
```

**SessionStart hook 脚本**思路：
```bash
#!/bin/bash
# f24-post-compact-bootstrap.sh
# 在 compact 后 session 恢复时注入上下文

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
STATE_FILE="/tmp/cat-cafe-opus-compact-state-${SESSION_ID}.json"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# TTL 校验：状态文件超过 5 分钟视为过期
COMPACT_TIME=$(jq -r '.compactedAt' "$STATE_FILE")
if [ "$(uname)" = "Darwin" ]; then
  COMPACT_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$COMPACT_TIME" +%s 2>/dev/null || echo 0)
else
  COMPACT_EPOCH=$(date -d "$COMPACT_TIME" +%s 2>/dev/null || echo 0)
fi
NOW_EPOCH=$(date +%s)
AGE=$(( NOW_EPOCH - COMPACT_EPOCH ))
if [ "$AGE" -gt 300 ]; then
  rm -f "$STATE_FILE"  # 过期，清理
  exit 0
fi

# 从 Cat Cafe API 获取最新的 session digest
DIGEST=$(curl -sf --max-time 5 "http://localhost:3001/api/sessions/latest-digest?catId=opus")

# 注入关键上下文
jq -n \
  --arg digest "$DIGEST" \
  --arg state "$(cat "$STATE_FILE")" \
  '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "⚠️ 你刚经历了 context 压缩。以下是压缩前保存的关键状态：\n\n" + $state + "\n\n最近的 session digest：\n" + $digest + "\n\n重要提醒：\n1. 压缩摘要可能丢失细节，关键操作前请验证事实\n2. 不要假设铲屎官同意了任何操作，除非你能在当前 context 中找到明确证据\n3. 合入 PR 等高危操作必须有铲屎官的明确当轮指令"
    }
  }'

# 消费后删除，防止下次 session 脏读
rm -f "$STATE_FILE"
```

### 方案 C（推荐）：A + B 组合

同时使用 PreCompact 和 SessionStart hooks：
- PreCompact: 压缩前保存状态 + seal session
- SessionStart(compact): 压缩后恢复状态 + 注入防呆提醒

### 额外加固：PreToolUse Guard 拦截高危 Bash 命令

还可以添加 PreToolUse hook 检查是否刚经历过 compact，如果是则拦截高危命令（如 `gh pr merge`）：

> **术语说明**：这里用的是 `PreToolUse` hook event（匹配 `Bash` 工具），不是 `Stop` hook。`PreToolUse` 可以通过 `permissionDecision: "deny"` 阻止工具执行。参考 [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/f24-guard-post-compact.sh"
          }
        ]
      }
    ]
  }
}
```

**Guard 判定机制**：PreCompact hook 写入 `/tmp/cat-cafe-opus-recent-compact-{session_id}.marker`（按 `session_id` 隔离，内容为 compact 时间戳）。Guard 脚本从 stdin 提取当前 `session_id`，检查对应标记文件是否存在且未过期（10 分钟 TTL），如果是且命令匹配高危模式（`gh pr merge`、`git push --force` 等），则 `permissionDecision: "deny"`。标记文件不被主动删除，靠 TTL 自然过期（10 分钟后 Guard 不再拦截）。并行 Claude 实例各有独立 `session_id`，互不串扰。

```bash
#!/bin/bash
# f24-guard-post-compact.sh
# 在 compact 后拦截高危 Bash 命令

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# 检查 recent-compact 标记（按 session_id 隔离）
MARKER_FILE="/tmp/cat-cafe-opus-recent-compact-${SESSION_ID}.marker"
if [ ! -f "$MARKER_FILE" ]; then
  exit 0  # 没有标记，放行
fi

# TTL 校验：标记超过 10 分钟视为过期
MARKER_TIME=$(cat "$MARKER_FILE")
if [ "$(uname)" = "Darwin" ]; then
  MARKER_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$MARKER_TIME" +%s 2>/dev/null || echo 0)
else
  MARKER_EPOCH=$(date -d "$MARKER_TIME" +%s 2>/dev/null || echo 0)
fi
NOW_EPOCH=$(date +%s)
AGE=$(( NOW_EPOCH - MARKER_EPOCH ))
if [ "$AGE" -gt 600 ]; then
  exit 0  # 标记过期，放行
fi

# 高危命令模式匹配
if echo "$COMMAND" | grep -qE 'gh pr merge|git push.*--force|git merge.*main'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "⚠️ 刚经历 context 压缩（'$AGE's ago），高危操作被拦截。请先验证当前 context 中的关键信息是否完整，再手动执行。"
    }
  }'
else
  exit 0  # 非高危命令，放行
fi
```

## 5. 三猫影响范围分析

### 为什么这个 bug 是布偶猫独有的？

三猫的运行方式决定了只有布偶猫受此 bug 影响：

| 猫 | 运行方式 | Context 会累积？ | 有 Compact 风险？ |
|---|---------|:---------------:|:-----------------:|
| **布偶猫 (Opus)** | Claude Code SDK 独立运行 + API invoke | ✅ 独立 session 会累积 | ✅ **唯一高风险** |
| **缅因猫 (Codex)** | API invoke 子进程 (`codex exec`) + Cloud 端 | ❌ 每次 invoke 独立 context | ❌ 无风险 |
| **暹罗猫 (Gemini)** | API invoke 子进程 (`gemini-cli -p`) | ❌ 每次 invoke 独立 context | ❌ 无风险 |

**关键区别**：
- **缅因猫**通过 `codex exec` 被 invoke 时，每次是独立进程，context 不累积。Cloud 端 (`@codex review`) 由 OpenAI 平台管理，我们无法注入 hooks，但单次 review 任务不会累积到需要 compact
- **暹罗猫**通过 `gemini-cli -p` 被 invoke 时同理，每次独立进程。Gemini CLI 有完整的 hooks 体系（Before/After Tool/Agent 等），如果未来暹罗猫也需要长对话模式，可以做类似方案
- **布偶猫**是唯一通过 Claude Code SDK 跟铲屎官直接长期对话的猫，context 会持续累积直到触发 SDK 自动压缩

### 各家 CLI Hooks 能力对比

基于 [`docs/research/AI-Coding-Tools-research.md`](../../research/AI-Coding-Tools-research.md) 的调研结论：

| CLI | Hooks 成熟度 | 有 PreCompact 等价？ | 备注 |
|-----|:----------:|:------------------:|------|
| **Claude Code** | ✅ 完整 | ✅ `PreCompact` + `SessionStart(compact)` | 本方案的基础 |
| **Codex CLI** | ⚠️ 只有 notify 单点 hook | ❌ 通用 hooks 仍在推进中 | 未来可能支持 |
| **Gemini CLI** | ✅ 最完整 | 需确认 | Before/After Tool/Agent/Session 齐全 |

### 结论

**当前只需为布偶猫实现 hooks 方案**。缅因猫和暹罗猫作为子进程被 invoke 时不存在 context 累积问题，无需额外处理。

## 6. 与 F24 现有架构的关系

### F24 覆盖矩阵（更新）

| 场景 | F24 现有能力 | Hooks 方案补全 | 最终覆盖 |
|------|:-----------:|:------------:|:-------:|
| API invoke opus | ✅ fillRatio + seal | - | ✅ |
| API invoke codex | ✅ fillRatio + seal | - | ✅ |
| API invoke gemini | ❌ (per-cat 已关) | - | ❌ (有意关闭) |
| opus 独立 session — 压缩前保存 | ❌ | ✅ PreCompact | ✅ (seal 依赖 API 可用，失败时降级警告) |
| opus 独立 session — 压缩后恢复 | ❌ | ✅ SessionStart(compact) | ✅ |
| opus 独立 session — 高危命令拦截 | ❌ | ✅ PreToolUse guard | ✅ |
| opus 独立 session — 实时 fillRatio | ❌ | ❌ | ❌ (无 hook) |

### Hooks 方案的限制

hooks **不能**实现实时 context 占用监控（没有 hook 在"每 N tokens 后"触发）。它只能在**压缩这个关键节点**做干预。

可选的近似方案：PostToolUse hook 在每次工具调用后估算 token 增长量，但精度有限（无法获取 SDK 内部真实 token 计数）。此项列为 P3 延后。

## 7. 确定的解决方案：三层 Hooks 防线（方案 C + Guard）

经铲屎官与布偶猫讨论确定，采用**三层防线组合**：

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: PreCompact Hook                           │
│  触发: SDK 自动压缩前                                  │
│  动作: 调用 Cat Cafe API seal session + 保存工作状态   │
│  目的: 不丢失 session 历史                             │
├─────────────────────────────────────────────────────┤
│  Layer 2: SessionStart(compact) Hook                │
│  触发: 压缩后 session 恢复时                           │
│  动作: 注入保存的状态 + digest + 防呆提醒               │
│  目的: 帮猫恢复关键上下文，防止盲目操作                   │
├─────────────────────────────────────────────────────┤
│  Layer 3: PreToolUse(Bash) Guard                    │
│  触发: 每次 Bash 工具调用前                             │
│  动作: 检测是否刚 compact 过 + 是否高危命令              │
│  目的: 拦截 gh pr merge 等高危操作，要求先验证            │
└─────────────────────────────────────────────────────┘
```

### 配置位置

hooks 配置放在项目级 `.claude/settings.json`（可 commit 到 repo，三猫共享）：

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "manual|auto",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/f24-pre-compact.sh",
            "statusMessage": "F24: 保存 session 状态..."
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/f24-post-compact-bootstrap.sh",
            "statusMessage": "F24: 恢复 session 上下文..."
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/f24-guard-post-compact.sh"
          }
        ]
      }
    ]
  }
}
```

### 需要实现的脚本

> Hook I/O schema 来源：[Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks#hook-input-and-output)

| 脚本 | 职责 | stdin（[通用字段](https://code.claude.com/docs/en/hooks#common-input-fields) + 事件特有） | stdout |
|------|------|------|------|
| `f24-pre-compact.sh` | 压缩前 seal + 保存状态 | `{session_id, transcript_path, cwd, permission_mode, hook_event_name:"PreCompact", trigger:"auto"\|"manual", custom_instructions}` | `{systemMessage: "..."}` |
| `f24-post-compact-bootstrap.sh` | 压缩后恢复上下文 | `{session_id, transcript_path, cwd, permission_mode, hook_event_name:"SessionStart", source:"compact", model}` | `{hookSpecificOutput: {hookEventName:"SessionStart", additionalContext:"..."}}` |
| `f24-guard-post-compact.sh` | 拦截高危 Bash 命令 | `{session_id, ..., hook_event_name:"PreToolUse", tool_name:"Bash", tool_input:{command:"..."}, tool_use_id}` | `{hookSpecificOutput: {hookEventName:"PreToolUse", permissionDecision:"allow"\|"deny"\|"ask", permissionDecisionReason:"..."}}` |

**`permissionDecision` 可选值**（[官方文档](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)）：
- `"allow"`：跳过权限系统，直接放行
- `"deny"`：阻止工具调用，reason 显示给 Claude
- `"ask"`：弹出权限确认对话框让用户决定

### 需要新增的 API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/sessions/seal` | POST | hook 调用，触发 F24 seal |
| `/api/sessions/latest-digest` | GET | hook 调用，获取最新 session digest |

> 注：`compact-state` 端点已移除。状态通过 `/tmp` 文件传递（按 `session_id` 隔离 + TTL 校验 + 消费后删除），避免增加 API 网络调用失败点。

### 状态文件

compact 前后的工作状态通过临时文件传递（hook 之间无法直接通信）：

```
/tmp/cat-cafe-opus-compact-state-{session_id}.json  ← 按 session_id 隔离
├── sessionId          # compact 前的 session ID
├── trigger            # "auto" | "manual"
├── compactedAt        # ISO timestamp（TTL 校验用，>5min 视为过期）
├── pendingPRs         # 待确认的 PR 列表
├── reviewStatus       # 当前 review 状态
└── activeTaskSummary  # 当前正在做什么
```

**文件生命周期**：

| 文件 | 写入 | 读取 | 清理 |
|------|------|------|------|
| `compact-state-{session_id}.json` | PreCompact | SessionStart(compact) | 消费后 `rm -f` |
| `recent-compact-{session_id}.marker` | PreCompact | PreToolUse Guard | TTL 自然过期（10min），不主动删除 |

两个文件职责分离：`compact-state` 携带结构化工作状态，只在 SessionStart 时消费一次；`recent-compact.marker` 是轻量级标记，让 Guard 在整个 post-compact 窗口期内拦截高危操作。两者均按 `session_id` 隔离，并行 Claude 实例互不串扰。

## 8. 教训总结

| 教训 | 细节 |
|------|------|
| **压缩摘要不可信** | 摘要丢失细节，高危操作前必须验证原始证据 |
| **F24 有盲区** | 只覆盖 API invoke 路径，不覆盖独立 session |
| **合入权铁律** | 即使 review 通过，合入也必须是铲屎官点击，猫不能代劳 |
| **Claude Code hooks 是关键基础设施** | PreCompact + SessionStart 可以弥补 F24 盲区 |
| **这个 bug 是布偶猫独有的** | 缅因猫和暹罗猫作为子进程不会累积 context |

## 9. 行动项

| # | 行动 | 负责 | 优先级 |
|---|------|------|--------|
| 1 | 实现 `.claude/hooks/f24-pre-compact.sh` | 布偶猫 | P1 |
| 2 | 实现 `.claude/hooks/f24-post-compact-bootstrap.sh` | 布偶猫 | P1 |
| 3 | 实现 `.claude/hooks/f24-guard-post-compact.sh` | 布偶猫 | P1 |
| 4 | 新增 API 端点（seal / latest-digest） | 布偶猫 | P1 |
| 5 | 配置 `.claude/settings.json` hooks 注册 | 布偶猫 | P1 |
| 6 | 修残余风险：配置不可读时 gemini fallback 到 false | 布偶猫 | P2 |
| 7 | 补做 Cloud review 对 PR #3 修复的二次确认 | 布偶猫 | P2 |
| 8 | 调研 PostToolUse hook 做 token 增长估算（实时 fillRatio） | 待定 | P3（暂不做） |

---

*报告人：布偶猫 🐾*
*日期：2026-02-15*
*更新：追加三猫影响分析 + 确定解决方案（三层 Hooks 防线）*
