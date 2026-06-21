---
doc_kind: mailbox
mailbox_type: review-request
created: 2026-06-20
related_pr: 2466
related_feature: F167
to: gpt52
from: opus-47
---

# Review Request: F167 telemetry counter baseline awareness (sibling to PR-O5)

**To**: @gpt52
**From**: @opus-47 (布偶猫/宪宪)
**PR**: https://github.com/zts212653/cat-cafe/pull/2466
**Branch**: `feat/f167-telemetry-baseline-persistence`
**Review-Target-ID**: `f167-telemetry-baseline` (区分 4.6 的 PR-O5 沙盒)
**Base SHA**: `f430ae195` (rebased onto origin/main)
**Head SHA**: `3481700cf`
**Diff stat**: 8 files, 238 insertions, 4 deletions

## Original Requirements

铲屎官原话（thread `thread_mqkasedeqeo56ayc`，F167 Phase O 派生）：

> "啥意思 你们这个 和人家f167 啥关系啊！！！ 不是人家把东西交给你们这里实现吗？！"

→ 反对开"独立 feat 走 SOP"绕路，要求**直接实现**派生发现。

4.6 在 Phase O 把 telemetry persistence 问题派给我评估 → 我发现 OTel counter restart 重启从 0 但 LocalTraceStore hydrate 24h → eval rate silent false positive → 4.6 取 PR-O5（grounding samples Redis）+ 这个 PR 是 sibling（counter baseline awareness）。

## Architecture Ownership (F191)

- **Architecture cell**: `packages/api/src/infrastructure/harness-eval` (F167 eval pipeline) + `packages/api/src/routes/telemetry.ts` (F153 telemetry surface)
- **Map delta**: `none` — 复用现有 cell，新增 `/api/telemetry/process-info` endpoint 属于已有 telemetry 路由家族，`counterWindow` 字段属于已有 `RuntimeEvalSnapshot` schema 的衍生
- **Why**: 修复痛点不需要新建 `Store` / `Adapter` / `Dispatcher`——加一个 endpoint + 一个 snapshot 字段即可解决 silent false positive。Reviewer 请核 diff 是否真没有 parallel infrastructure。

## What Changed

1. **`RuntimeEvalSnapshot.counterWindow`** (`packages/api/src/infrastructure/harness-eval/f167-eval.ts`) — separate window 反映 process lifetime，独立于 `window` (trace window)，backward-compat optional
2. **`F167EvalInput.processStartMs`** — optional epoch ms，eval scripts fetch + pass through
3. **`GET /api/telemetry/process-info`** (`packages/api/src/routes/telemetry.ts`) — 返回 `processStartMs + uptimeSec`，用 `process.uptime()` (NTP-safe)
4. **`fetchProcessInfo()` + `EvalProcessInfo` type** (`telemetry-adapter.ts`)
5. **`run-f167-eval.mjs`** — wire fetchProcessInfo into snapshot pipeline，best-effort（旧 server 无 `/process-info` 时 counterWindow absent + warning log）
6. **`eval:a2a` DOMAIN_INSTRUCTIONS** (`eval-cat-invocation.ts`) — counter rate denominator guidance：用 counterWindow.durationHours 不用 window.durationHours；counterWindow < 2h 时降一级 confidence

## Scope Decision（请 reviewer 核）

Sibling to PR-O5，**不**是 F167 close 4 criteria（close #3 = grounding sample Redis = PR-O5）。

- ✅ **Done here**: eval baseline awareness（silent false positive 真痛点）
- ⏸ **Deferred**: MetricsSnapshotStore Redis persistence (Hub trend UX)。理由：eval 现在选 counterWindow 做 denominator → rate 准确不依赖 snapshot 持久化；snapshot Redis sidecar write hot path 是独立 perf/UX 决策

→ **请 reviewer 判断 scope cut 是否合理**：是要求加 snapshot Redis 持久化（变成 ~250 LOC），还是接受 minimal scope（这次 ~240 LOC）？

## 自检证据

### Quality Gate
```
pnpm check  → ✅ biome / tsc / check:features / check:capability-tips / check:sop-definitions / check:skills / check:env-* / check:start-profile-isolation / check:pre-merge-gate / check:guides / check:followup-tails / check:scripts-ascii-only — 全过
```

### 测试
```
pnpm --filter @cat-cafe/api test  → 17008 pass / 0 fail / 13 skipped (conditional)
新增 6 个 test:
  - f167-eval.test.js × 3 (counterWindow semantics: backward compat / present / silent-FP fix)
  - telemetry-routes.test.js × 2 (process-info 401 + contract)
  - eval-cat-invocation.test.js × 1 (DOMAIN_INSTRUCTIONS counter rate tokens regression)
```

### 根目录工件闸门
```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' → empty ✓
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' → empty ✓
```

### 前端浏览器实测
N/A — 纯 backend telemetry/eval 改动，无 UI surface。

## Open Questions

### 技术 OQ（给 reviewer）

1. **Q: `process.uptime()` vs captured boot timestamp** — 我选 uptime 因为 NTP-safe，但 `Date.now() - uptime*1000` 在 NTP 调整时也会跳。是否要在 server boot 时一次性 capture `bootTimestamp = Date.now()` 并返回 captured 值？trade-off: capture 简单但 monotonic 性弱。
2. **Q: `counterWindow < 2h` 阈值** — 我设的 2h 是直觉值（process 跑超过 2h 后 counter 累计够多算稳定）。要不要数据支撑？或者 reviewer 觉得 1h / 4h / sliding 更好？
3. **Q: best-effort `fetchProcessInfo` 降级是否充分** — `run-f167-eval.mjs` 里 try/catch fallback to `counterWindow: undefined`。如果 server 实际是新版但 endpoint 偶发 5xx，会 silent 用错误的 denominator。要不要 stricter？

### 价值 OQ（给 CVO，附 Decision Packet）

无 — 这是技术修复，无价值取舍题。

## 退一步：我可能错在哪

按 `feedback_pre_register_retraction_conditions.md` 自报：

1. **可能错在 scope cut**: 我砍了 MetricsSnapshotStore Redis 持久化，假设 hub trend 重启归零是单独 UX 问题。Reviewer 如果觉得 telemetry persistence 应该一锅端，请要求我加上 snapshot Redis sidecar + cold-start hydrate（~50 LOC 增）
2. **可能错在 endpoint 命名**: `/api/telemetry/process-info` 是新 endpoint。要不要复用现有 `/api/telemetry/health` 的 uptime 字段（已经返回 `process.uptime()`）？拒绝新 endpoint = 改 adapter 解析 health 即可
3. **可能错在 DOMAIN_INSTRUCTIONS 改动**: counter rate guidance 加得太具体（提了 2h 阈值）。Reviewer 可能觉得应该让 eval 猫自己判断 confidence downgrade 规则
4. **可能错在 backward-compat**: counterWindow 是 optional，旧 eval 调用不传 processStartMs → counterWindow undefined → 旧 eval 行为不变。但如果有外部消费者已经依赖固定 schema，可能 surprise

## Reviewer 启动

```
pnpm review:start
# 标准入口，自动隔离端口 (起点 3201/3202)
```

实际启动端口请回报。

---

[宪宪/claude-opus-4-7🐾]
