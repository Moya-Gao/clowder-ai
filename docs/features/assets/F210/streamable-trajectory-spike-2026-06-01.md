---
feature_ids: [F210]
related_features: [F211]
topics: [antigravity, agy, cli, streamable, trajectory, spike]
doc_kind: spike
created: 2026-06-01
author: 宪宪/Opus-4.8
status: spike-done-pending-owner-discussion
---

# F210 Spike: AGY CLI Streamable Trajectory（旁路读 trajectory 做实时进度 + 根治 resume 重放）

> 日期 2026-06-01 | 作者 宪宪/Opus-4.8 | 状态：spike 完成，方案待与 owner 砚砚讨论后定 Phase 归属
> 全程真跑 agy 实测，无脑补。证据标 [实测]。

## 0. 背景 / 动机

**触发现象**：runtime 暹罗猫（`gemini25`，走 `antigravity-cli` adapter = `agy --print`）连续多轮翻译请求，回复**累加重放历史**：
- 回复 A = [Bitter Lesson]
- 回复 B = [Bitter Lesson, Reward is Enough]
- 回复 C = [Bitter Lesson, Reward is Enough, Era of Experience]

三条请求间隔 62 分钟 / 23 小时（非连发），且每篇都真翻译了（docs/study/ 三文件 + 三 git commit 为证）——所以**重复段是历史文本重放，不是重新执行**。

**根因（已定位）**：`agy --print --conversation <id>` resume 时把整个会话历史的所有 assistant 回复输出到 stdout；`classifyAntigravityCliPlainText` 的 resumed 分支（`antigravity-cli-event-parser.ts:64-66`）原样返回整个 stdout（仅标 `textMode:'replace'`，未切历史轮次）。

**CVO 升维**：真痛点不止重放——`agy --print` **阻塞执行、过程黑盒**。10 分钟任务用户干等到结束才一次性出结果，中间 tool call / 进度 / 报错全看不见。剪裁只治重放，治不了"过程不可见"。**需要真 streamable**。

## 1. 命门（spike 要回答的问题）

> agy 发起的 cascade，能否被 Cat Cafe 旁路读，做出 **step 级实时增量**（streamable）？

## 2. 探查过程（三次路径修正，全部真跑实测）

### 2.1 ❌ 不是连 IDE 的常驻 LS
- IDE 的 `language_server` 常驻（pid 83579，listen `127.0.0.1:57303/57304`，`--csrf_token` + `--enable_sidecars`）。
- [实测] agy 跑任务时自己的 log：
  - `server.go:1292] Starting language server process with pid 46748`（**agy 自起 LS，pid 与 IDE 不同**）
  - `server.go:211] ... appDataDir=/Users/lysander/.gemini/antigravity-cli`（**独立 appDataDir**，非 IDE 的 `~/Library/Application Support/Antigravity`）
  - `server.go:2174] Language server shutting down`（**任务结束即关**，整个 LS 生命周期约 13 秒）
- **结论**：agy 每次 spawn 自己的临时 LS 子进程，跑完即关。没有可连的常驻端点 → "旁路连常驻 LS"不成立。

### 2.2 ⚠️ 临时 LS 可连，但复杂
- [实测] LS 二进制 strings 出 Connect-RPC 路由：
  - `/exa.language_server_pb.LanguageServerService/GetCascadeTrajectory`
  - `/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories`
  - `/exa.language_server_pb.LanguageServerService/ConvertTrajectoryToMarkdown`
  - `CancelCascadeSteps` / `CancelCascadeInvocation` / `ForceStopCascadeTree` 等
- [实测] 鉴权：header `x-codeium-csrf-token`；env `ANTIGRAVITY_LS_ADDRESS` / `ANTIGRAVITY_CSRF_TOKEN`；LS 写发现 struct `{pid, httpsPort, httpPort, lspPort, lsVersion, csrfToken}`（`setCredentials(csrfToken, serverAddress)`）。
- **缺点**：临时 LS 端口动态、生命周期随任务生灭、要处理 csrf + Connect-RPC + proto-over-HTTP。可行但重，且要赶在 LS 活着时连上。

### 2.3 ✅ 最优：本地 SQLite trajectory store
- [实测] agy log：`manager.go:92] Creating trajectory store manager with proto store and SQLite store`
- [实测] 每个 cascade 一个独立 DB：`~/.gemini/antigravity-cli/conversations/<cascade-uuid>.db`
- [实测] `steps` 表 schema（trajectory 的逐步记录）：
  ```sql
  CREATE TABLE `steps` (
    `idx` integer, `step_type` integer NOT NULL DEFAULT 0,
    `status` integer NOT NULL DEFAULT 0, `has_subtrajectory` numeric,
    `metadata` blob, `error_details` blob, `permissions` blob,
    `task_details` blob, `render_info` blob, `step_payload` blob,
    `step_format` integer, PRIMARY KEY (`idx`));
  ```
  （同库还有 `trajectory_meta(trajectory_id, cascade_id, ...)`、`executor_metadata`、`gen_metadata` 等）
- [实测] SELECT（带 tool call 的任务，cascade `8c0d2c16-...`）：

  | idx | step_type | status | payload bytes |
  |-----|-----------|--------|---------------|
  | 0 | 14 | 3 | 561 |
  | 1 | 98 | 3 | 231 |
  | 2 | 15 | 3 | 1995 |
  | 3 | 9 | 3 | 2063 |
  | … | (8/9/14/15/23/98 共 6 类 step_type) | | |
  | 9 | 15 | 3 | 2756 |

  10 个 step（idx 0-9），完全对上 log 的 `Drip stopped: lastStepIdx=9`。
- **结论**：trajectory 逐 step append（idx 递增）写进**本地 SQLite**。任务进行中临时 LS 持续写，**poll 这个本地文件就是天然 O(delta)**——不连 LS、无端口/csrf/RPC，最轻最稳。

## 3. Streamable 方案

| 步骤 | 做法 | 现成度 |
|------|------|--------|
| 1. 拿 cascade UUID | agy `--log-file` 早早吐 `Created conversation <uuid>` | ✅ `extractAntigravityCliConversationId` 已实现 |
| 2. 定位 DB | `<appDataDir>/conversations/<uuid>.db`（profile 隔离时按对应 appDataDir） | ✅ 路径已坐实 |
| 3. 流式 poll | 任务进行中 `SELECT * FROM steps WHERE idx > :cursor ORDER BY idx`，新 step 即 emit | 新写，但与 GeminiAgentService 已有「读 gemini-cli session jsonl」（`findGeminiSessionFile` + `readJsonlTail`）**同构** |
| 4. 收尾 | agy 退出 → 最后一次 poll | — |

### L1（明文，立即可用）
`idx` / `step_type` / `status` 是明文 integer → 进度条 + 第 N/M 步 + 步类型 + 完成态。**不需要解码就能做粗粒度 streamable**。

### L2（内容，需解码）
`step_payload` / `render_info` / `task_details` 是 proto blob → tool call 名/参数/结果 + 文本内容。
- 解码路径 A：逆向 step proto schema（LS 二进制有 `exa.*_pb` + `CORTEX_STEP_TYPE_*` / `CORTEX_STEP_SOURCE_*` 枚举）
- 解码路径 B（后备）：连 agy 临时 LS 调 `ConvertTrajectoryToMarkdown` RPC

## 4. 价值

- ✅ **真 streamable**：step 级、tool-call 级，10 分钟任务实时见进度
- ✅ **架构对齐**：GeminiAgentService 已在读 gemini-cli 的 session jsonl；这是加一个读 SQLite 的同构分支（CLI 猫读 jsonl transcript ≈ agy 读 SQLite trajectory，机制一致）
- ✅ **根治 resume 重放**：改吃 steps 增量（按 idx 游标）后，`agy --print` 全量 stdout 重放那条路整个废弃，不需剪裁

## 5. 待解点 / 开放问题（给 owner 砚砚讨论）

1. **数据源选型**：SQLite 直读 vs 临时 LS RPC vs log tail。我推荐 SQLite 直读（最轻/本地/无鉴权）。请从坐标系 + 鲁棒性评（agy 跨版本 schema 稳定性？）
2. **proto 解码**：逆向 step proto schema vs `ConvertTrajectoryToMarkdown` RPC——哪个更稳、更省事
3. **step_type 枚举语义**：8/9/14/15/23/98 各是什么（文本/工具调用/思考/计划/…）需从 LS proto 逆向；映射错会误标 UI
4. **profile appDataDir**：runtime 暹罗猫用 isolated AGY profile（不同 HOME → 不同 appDataDir），DB 路径要按 profile 算，不能写死默认 `~/.gemini/antigravity-cli`
5. **并发读**：任务进行中临时 LS 在写 SQLite，poll 端要 WAL / 只读快照 / busy_timeout，避免锁与读到半行
6. **落地分层**：L1（进度流）先单独落，还是 L1+L2 一起
7. **与重放修复的关系**：走 trajectory 增量后是否**一并替换** `antigravity-cli` adapter 的输出来源（stdout → trajectory steps），把重放修复合进同一改动
8. **Phase 归属**：挂 F210 新 Phase（如 Phase H: Streamable Trajectory）还是并入 Phase G 的 local-API probe 线——owner 决定

## 6. 关联

- **重放 bug 根因**：`antigravity-cli-event-parser.ts:64-66`（resumed 分支原样返回整个 stdout）+ `GeminiAgentService.invokeAntigravityCLI`（`--conversation` resume，`internalAgyArgs.push('--conversation', requestedSessionId)`）
- **F211 先例（同思维不同数据源）**：孟加拉猫 IDE/Desktop 路径的 trajectory 增量——REG9 status-poll（57KB vs 4MB，70× 降）已 merged；REG10 push `StreamCascadeReactiveUpdates` 为 deferred 终态。F211 走「连 LS」，本 spike 走「读 SQLite」，机制同源
- **F211 实测的死路（避免重走）**：read RPC 的 delta 字段（`startStepIndex` 等 16 名 + cursor）被静默忽略——LS 侧真增量只能 push。本方案绕开此坑（SQLite 的 `idx` 游标天然支持 `WHERE idx > cursor`）

## 7. H2a 探索增量（2026-06-02，砚砚拍板 H2a/H2b 拆分后）

> 砚砚 H2 方向：H2a 做 SQLite content extractor（路径 A 直读，`ConvertTrajectoryToMarkdown` 只做 oracle），H2b 才替换 resumed turn final text。退出条件：proto 字段一天内啃不出稳定 text extractor → 停 spike，不硬上替换。本节为 H2a 第一轮真跑探索证据。

### 7.1 [实测] agy two-turn 真跑
- `agy --print "Translate to French: apple..."` → 输出 `pomme`（正确），conversation id `68022d68-...`（从 `--log-file` grep uuid）。
- `agy` 默认 profile 可直接跑（无需 isolated profile / 额外 auth）。
- macOS 无 `timeout` 命令（要 `gtimeout`）；用 agy 内置 `--print-timeout`。

### 7.2 ⚠️ [实测] 关键映射：DB 文件名 = **cascade-uuid ≠ conversation id**
- conversation id `68022d68-...` 对应的 `conversations/68022d68-....db` **不存在**（`no such table: steps`）。
- 实际 DB 文件名是 **cascade uuid**（如 `1cf6dc43-....db`），`trajectory_meta` 里 `(trajectory_id, cascade_id, ...)` = `(0a3d5bd5, 1cf6dc43, ...)`。
- **🔴 H1 隐患待核**：`resolveAgyTrajectoryDbPath` 用 `extractAntigravityCliConversationId`（conversation id）拼 `conversations/<id>.db`。single-turn 时可能 conversation id == cascade uuid（H1 spike「steps 1→10」当时能读到说明走通了），但**multi-turn resume 时 conversation id 与 cascade uuid 分叉**，H1 observer 可能定位不到 DB（fail-open 静默降级，不报错但拿不到 progress）。H2a 必须改用 cascade uuid 定位：从 log 拿 cascade id（log 有 `Creating trajectory store`）或扫 `conversations/` 最新 mtime DB + 用 `trajectory_meta.cascade_id` 反查。

### 7.3 [实测] steps schema + step_type 语义线索
- 短任务 trajectory（cascade `1cf6dc43`）4 steps：

  | idx | step_type | status | payload bytes | 语义（strings 推断）|
  |-----|-----------|--------|---------------|------|
  | 0 | 14 | 3 | 493 | （头部/任务）|
  | 1 | 98 | 3 | 231 | （元数据）|
  | 2 | 15 | 3 | 3661 | **assistant thinking（明文可提取）** |
  | 3 | 23 | 3 | 587 | footer（含 sessionID + cascade/conversation uuid）|

### 7.4 ✅ [实测] H2a 命门回答：assistant text 是**明文** proto string field
- `step_type 15` payload（3661B）`strings` 直接出明文：`/Gemini 3.5 Flash`（model）+ `**Considering the Prompt** Okay, I'm now focusing on the single-sentence...`（assistant reasoning/thinking 文本）+ 尾部二进制（疑似 embedding）。
- **结论**：assistant text 不加密、proto string field 明文存储 → **路径 A（SQLite 直读 + proto string 提取）可行，不必逆向完整 proto schema**。最坏情况可 `strings`-style 抽明文段，正解是按 proto wire format 取对应 field（field tag + length-delimited）。

### 7.5 下阶段（H2a 未完，下次继续）
1. **proto field 精确解码**：区分 thinking vs **final answer** vs tool call/result（本机无 `protoc`，需装 `protoc --decode_raw` 或 python `protobuf`/手写 wire-format parser）。砚砚 OQ「哪个字段最稳定承载 final assistant text」未答 → 必须 multi-turn fixture 比对。
2. **multi-turn resume fixture 待重采**：turn2（`--conversation 68022d68` resume "banana"）**`--print-timeout 4m` 超时**未出结果（resume bootstrap 卡住，与 spike 提的 ~257ms resume 体感不符，需复查是否首次 resume 冷启动慢 / 任务本身卡）。`[1]→[1,2]→[1,2,3]` 累加 fixture 还没采到。
3. **H2a extractor + H1 background 红测**：proto field 定位稳定后开 red 测。
- **状态**：H2a 命门（可行性）已确认 ✅；proto field 精确语义 + multi-turn fixture 是剩余硬骨头，符合砚砚「先证可行，啃不动停 spike」的边界。

---
[宪宪/Opus-4.8🐾]
