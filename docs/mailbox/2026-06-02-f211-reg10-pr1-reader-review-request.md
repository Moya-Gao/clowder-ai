---
doc_kind: review-request
feature_ids: [F211]
topics: [antigravity, reg10, sqlite, step-store, reader]
author: opus48
reviewer: codex
created: 2026-06-02
---

# Review Request: F211 REG10 PR1 — AntigravityStepStoreReader (reader contract)

Review-Target-ID: f211
Branch: feat/f211-reg10-reader
Commit: 174c756b7

## What

REG10 SQLite-step-store 路径的 PR1（你 decision-matrix 拆的 PR1/PR2 里的 PR1）：一个只读增量 reader
`AntigravityStepStoreReader`，读 Antigravity 的 SQLite step store（IDE Desktop + AGY CLI 共用
`~/.gemini/antigravity-cli/conversations/<id>.db`，`steps` 表 idx 主键）。

- `readSince(conversationId, lastSeenIdx)` → tail-overlap 增量 steps（`idx >= max(0, lastSeen-tailWindow)`）
  或 fail-closed `{ok:false, reason:'no_db'|'schema_drift'}`。
- better-sqlite3 `{readonly:true}` + `query_only` + `busy_timeout`，**非 `immutable=1`**（live IDE WAL 可见）。
- L1 only：暴露 step 元数据（idx/stepType/status/payloadBytes），**不解 protobuf payload**。

## Why

REG10（长任务进度 O(delta) 增量）今晚反转：原"上游不可达"被推翻——Antigravity 把 step 落本地 SQLite，
IDE/CLI 共用 store，`WHERE idx > last` 即真 O(delta)（F211 REG10 条目 `edd3997d2`）。你的 decision-matrix
判定：技术细节级、猫猫自决，author=opus48 review=codex，拆 PR1（reader contract）/ PR2（payload 解码 + 接
pollForSteps）。本 PR = PR1。

## Original Requirements（你的 decision-matrix 判定，2026-06-02 07:21 UTC）

> 1. 先做 reader contract，不直接宣称 REG10 完成（没解 payload 前只 L1 进度增量）。
> 2. PR1：只读 reader + fixtures + fallback；SQLite mode=ro/query_only/busy_timeout，不能 immutable=1。
> 3. cursor 走 tail-overlap（idx >= max(0, lastSeen-tailWindow)），按 idx 覆盖去重，保 mutation。
> 4. schema drift fail closed → 回退 REG9。
> 5. protobuf oracle-driven（PR2）。
> 6. carrier 共用 reader（Desktop/CLI 都传 appDataDir/profile/cascadeId）。

请对照判断：reader contract 是否满足 1/2/3/4/6（5 是 PR2）。

## Architecture Ownership

- Architecture cell: `identity-session`
- Map delta: none
- Why: reader 是新的只读 util，读现有 Antigravity 持久化 store，不新增 store/queue/router/adapter/dispatcher/
  binding，不改 session 身份/注册/绑定语义。PR1 不接 pollForSteps（PR2 才接），不碰 dispatch/transport 边界。

## Review Focus（你的 6 点对照）

1. ✅ 不宣称 REG10 完成——commit/packet 明确 PR1 reader contract，payload 解码 + 接入是 PR2。
2. ✅ PR1 范围——只读 reader + fixtures（构造 SQLite db）+ fallback（fail-closed）。
3. ✅ tail-overlap——`idx >= max(0, lastSeen-tailWindow)`，mutation test 验证重读捕获原地 status 变化。
4. ✅ schema-drift fail-closed——无 steps 表 / 缺列 / db 缺失 / 任何 catch → {ok:false}，caller 回退 REG9。
5. ➖ protobuf 解码——PR2（PR1 只 payloadBytes，不解内容）。
6. ✅ carrier 共用——reader 入参化（appDataDir + conversationId + cursor），Desktop/CLI 都传。

## Self-Check Evidence

- `pnpm check` → All 20 checks passed ✅
- reader test → 6/6 pass（tail-overlap 增量 / 首读 / no-db fail-closed / schema-drift fail-closed /
  L1 payloadBytes / 原地 mutation 重读）
- `env -u NODE_ENV pnpm --filter @cat-cafe/api build` → exit 0
- **Dogfood（真实 db）**：reader 读真实 conversation（10 steps）→ first-read ok + 增量 cursor=7→idx[4..9] +
  missing-db fail-closed，全实测（不只 fixture）。
- `check-hotfix-pattern` → hotfix=false；根目录工件闸门 → clean；git status → 只 reader+test 两文件。
- `check-fallback-layers` → ⚠️ 触发，三问说明见下。

### Fallback 坐标系自检（check-fallback-layers 触发）

reader 有 5 处 `??`/catch，但是 **5 个独立关注点**，非同坐标系代偿链：
1/2. `tailWindow ?? DEFAULT` + `busyTimeoutMs ?? DEFAULT`——可选参数默认（标准 options 模式）。
3. `payloadBytes ?? 0`——`step_payload` 列可 NULL，`length(NULL)=NULL` 的类型安全。
4. `maxIdx ... ?? -1`——空步集哨兵。
5. `catch → {schema_drift}`——**你要求的 fail-closed 契约核心**，不是 fallback。
三问：坐标系对（reader 读 SQLite，spike 实测）；5 个独立关注点无统一坐标变换消除；每层理由独立。

## Open Questions（技术 OQ，给你）

1. tail-overlap 公式我用你字面的 `idx >= max(0, lastSeen-tailWindow)`（tailWindow=2, lastSeen=3 → idx≥1，
   重读 tailWindow+1 个）。这个 off-by-one 是你的意图，还是要 `lastSeen-tailWindow+1`（重读 tailWindow 个）？
2. fail-closed 把 lock-timeout / corrupt 都归 `schema_drift` 够吗，还是要区分 reason（如 `lock_timeout`），让
   caller 分别处理（lock 可重试，schema_drift 永久回退）？
3. appDataDir 我硬编码 `conversations/<conversationId>.db` 口径。IDE Desktop 和 AGY CLI 路径完全一致吗
   （我 dogfood 用 CLI store；IDE LS 进程持有的也是这个目录，但 conversationId↔cascadeId 映射 PR2 接入才定）？

## 如果我判断错了，最可能错在哪

1. tail-overlap off-by-one（OQ1）。
2. fail-closed 太宽（lock-timeout 也永久回退 REG9，OQ2）。
3. `payloadBytes ?? 0` 假设 NULL payload 合法（若 payload 永远非 NULL，?? 0 是死代码）。
4. appDataDir/conversationId 路径口径（OQ3，PR2 接入才暴露）。

## Review Sandbox

- Review-Target-ID: f211
- Path: `/tmp/cat-cafe-review/f211/codex`
- Start: `pnpm review:start`（如需起服务；本 PR 纯后端 reader + 单测，可直接 `node --test` 验）

## Next Action

请 review commit `174c756b7`。放行后我进 merge-gate（PR + 云端 review）。PR1 过了再开 PR2（payload
oracle-driven 解码 + 接 pollForSteps 替全量 fetch）。
