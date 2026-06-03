---
feature_ids: [F198]
related: [docs/features/F198-claude-code-subscription-carrier.md]
doc_kind: bug-report
created: 2026-05-19
status: bug2-fixed-bug3-deferred
---

# F198 Phase D Bug #2 + #3 — BgCarrier production hang + 无 session resume

## 1. 报告人

F203-47（跨 thread）→ F198-47（本 spec owner，同一 model 不同 invocation）。
铲屎官 2026-05-19 在 runtime 翻 `CAT_CAFE_CLAUDE_CARRIER=bg_daemon` canary 实测撞出。

## 2. 复现步骤

**Bug #2（UI 永远"正在回复"卡死）**
- 期望：@ 布偶猫发消息 → reply 完成 → UI status 收尾回 idle
- 实际：reply 内容出来了，但前端 status dot / AgentMessage 流**永远显示"正在回复"**

**Bug #3（cancel 后新消息不 resume）**
- 期望：cancel 当前 invocation → 再发新消息 → resume 同 conversation
- 实际：每条新消息**新建 session**，丢失 conversation 历史

## 3. 根因分析

### Bug #2 根因（已确凿证据）

`ClaudeBgCarrierService.invoke()` 的终止信号 = `state.json.state === 'done' || 'error'`。

**实证（本机 daemon `77df0627` timeline.jsonl）**：
```
02:40:00.998Z  state=working  "scanning for deeper context"   ← 最后一次 state 写入
02:40:01.078Z  [transcript]   system/stop_hook_summary        ← 80ms 后 turn 完成
02:40:01.079Z  [transcript]   system/turn_duration            ← turn 完成
               daemon 此后再不写 state → state.json 永久停在 working
```

**当 `claude --bg` daemon 调用 MCP 工具后，turn 完成时 `state.json.state` 永久卡在 `working`。**
transcript 正确记录 turn 完成（`stop_hook_summary` + `turn_duration` system 条目），但 daemon
不更新 `state.json`。carrier 用 `state==='done'` 当终止信号 → 永不触发 → 循环到 30min
timeout → invoke-single-cat 收不到 `done` → UI "正在回复"卡死。

对照实验：
- 简单 prompt（无工具调用）→ `state=done` 1-4s 到位，carrier 正常（probe `7c14ed7b` / `994e365a`）
- 真实布偶猫 invocation（opus + L0 + 调 `cat_cafe_search_evidence`）→ `state` 永久卡 `working`（`77df0627`）
- 布偶猫每次都注入 cat-cafe MCP 且几乎必用 `cat_cafe_*` → **"每次"卡死**对得上 F203-47 报告

**次要缺口**：`JobState` type 只声明 `queued|working|done|error|idle` 5 个状态。实际 daemon
还产生 `failed`（init 失败，证据 `b67f7411`）、`blocked`（等用户输入，证据 `25d080fe`）、
`stopped`（外部停止）。carrier 终止检查全部漏判 → 这三种结局也 hang 到 timeout。

### Bug #3 根因（已确凿证据）

`ClaudeBgCarrierService` 文件头注释 line 17-18 明写：
> "Image hints, accountEnv overrides, MCP injection, **session resume**, OTel spans, etc are
> intentionally deferred"

`startJob()` 构造 `args = ['--bg', prompt, '--model', X]` —— **完全不读 `options.sessionId`**，
每次 invoke 都 spawn 全新 daemon job。**Bug #3 不是回归，是 bg carrier 从来没实现 session resume。**

附加问题：carrier 在 `session_init` 报 `sessionId: shortId`（8-hex daemon id），而
`claude --resume` 需要的是 conversation session UUID（在 `state.linkScanPath` 的文件名
`<uuid>.jsonl`）。即使 carrier 想 resume，存的也是错的 id 类型。

`claude --help` 确认 bg 模式支持 resume：`-r, --resume [value]` / `--session-id <uuid>`。

## 4. 修复方案

### Bug #2 — 终止信号改用 transcript（权威信号）+ 补全 state 枚举 ✅ PR #1798
- carrier tail transcript 时扫 `{type:'system', subtype:'turn_duration'|'stop_hook_summary'}`
  → 检测到即视为 turn 完成（终止）
- `JobState` type 补 `failed|blocked|stopped`
- carrier 终止条件扩展：`done`/`error`/`failed`/`stopped`/`blocked` + transcript turn-complete
  - `error`/`failed` → emit error message
  - `blocked` → emit error message 含 `needs` 文本
  - `stopped` → terminal（emit done）
- 加 `timeoutMs` constructor 选项（test seam，默认 `30*60_000`，镜像已有的 `pollMs`）

### Bug #3 — 实现 session resume ⬜ deferred (separate PR)

> **2026-06-03 修正（opus-48 spike + opus-47 binary trace 联合 verified）**：原方案 (a)(b) 两条**错**，empirical 真相在 spike 数据里。

- ~~carrier 从 `state.linkScanPath` 文件名提取 conversation UUID~~ → **改**：直接读 `state.resumeSessionId` 字段（claude 2.1.161 daemon 已在 state.json 顶层提供，不需正则解析路径）
- `done` message 带回 resumable UUID（`metadata.resumeSessionId`） ✅ 保留
- invoke-single-cat 持久化该 UUID ✅ 保留
- carrier `startJob`：`options.sessionId` 是合法 UUID 时 → `--resume <uuid>` ✅ 保留
- ~~假设 conversation UUID 跨 resume 不变（extract once, reuse forever）~~ → **改**：`--bg --resume <uuid>` **每轮产生新 sessionId**（实证：spike turn1=d061424f-…、turn2=61a48e5b-…、turn3=a56e3aa4-… 三个不同 UUID 但 conversation 连续）。carrier 必须**每轮从最新 state.resumeSessionId 读**当下轮 `--resume` 目标，**不能固定第一轮 UUID**
- cancel 语义：invalidate-and-keep（cancel 清当前 invocation，最新 resumeSessionId 保留给下次 resume）✅ 保留
- **`--bg --resume` vs `claude attach` 区分**：attach 是 interactive 接管活 daemon（铲屎官 CLI 经验，sessionId 不变）；`--bg --resume` 是 fresh background invocation + conversation 接力（每轮新 sessionId）。这是两个不同操作，spec author（opus-47）原 §4.2 没区分

## 5. 验证方式

- 单元测试 TDD Red→Green：
  - Bug #2：seed `state.json` 永久 `working` + transcript 含 `turn_duration` → 断言 `invoke()`
    在 timeoutMs 内 yield `done`（buggy carrier 会 timeout throw = RED）
  - Bug #2：seed `state=failed`/`blocked`/`stopped` → 断言 carrier 正确终止
  - Bug #3：`options.sessionId` 为 UUID → 断言 spawn args 含 `--resume <uuid>`
  - Bug #3：`done` message 带 `metadata.resumeSessionId` = transcript UUID
- 铲屎官 alpha 验证剧本（人肉 gate）：发多轮 / cancel / resume / 连发 3 轮，UI 每轮正确收尾
