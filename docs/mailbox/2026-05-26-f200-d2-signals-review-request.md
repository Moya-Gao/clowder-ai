---
kind: review_request
feature_ids: [F200]
topics: [memory, recall, signal-sources, output-verified, thread-aware]
date: 2026-05-26
author: opus
---

# Review Request: F200 AC-D2.1/D2.2/D2.3 — Thread-aware signal auto-detection

Review-Target-ID: f200-d2-signals
Branch: feat/f200-d2-signals

## What

Extends OutputVerifiedDetector with 4 new auto-detection signals from thread
context (messages + PR tracking tasks):

1. **AC-D2.1 CVO accept**: Scans thread messages from human users (catId=null)
   for acceptance keywords (可以合入/通过/merge/lgtm/approved/走起/etc)
2. **AC-D2.1 Reviewer approval**: Scans thread messages from cat reviewers
   (catId set) for approval keywords (approved/lgtm/放行/可以合入/通过/没问题)
3. **AC-D2.2 CI passed**: Checks pr_tracking task `automationState.ci.lastBucket`
   for 'pass'|'success'
4. **AC-D2.3 PR merged**: Checks pr_tracking task `status='done'`

New file `ThreadAwareSignalSources.ts` composes `SqliteSignalSources` (v1) with
Redis-backed `SignalMessageStore` + `SignalTaskStore`. Optional interface methods
(`isCvoAcceptedForThread?` etc) keep backward compatibility — old callers still work.

Wired into `recall-metrics.ts` verify-pending route and `index.ts` app bootstrap.

## Why

铲屎官 2026-05-25: "明确没完成为啥不做？ac的那些东西"

AC-D2.1/D2.2/D2.3 were spec'd but not implemented — no blockers, just
deprioritized during dogfood work. Now completing them.

## Original Requirements（必填）

> 铲屎官 2026-05-25: "你合入之后我重启了！猫猫你们f200 都干完了吗？有没有什么狗粮要自己吃的？还是可以愿景守护了？"
> 铲屎官 follow-up: "明确没完成为啥不做 🤔 ？ 是遇到困难了吗？ ac的那些东西"

- 来源：当前 thread 铲屎官消息（非 Discussion 文档 — 这是对已有 spec AC 的催办）
- Spec: `docs/features/F200-memory-recall-eval.md` lines 401-403
- **请对照 AC-D2.1/D2.2/D2.3 原文判断交付物是否完整覆盖**

## Tradeoff

- CVO/reviewer detection uses regex pattern matching on message content strings,
  not NLP. Sufficient for structured approval keywords; false positive risk is low
  because we filter by catId (human vs cat) and patterns are specific.
- CI detection reads `lastBucket` from existing pr_tracking task automationState,
  not raw GitHub check_run events. This piggybacks on F140's existing CI pipeline
  rather than adding a new GitHub webhook consumer.

## Architecture Ownership（必填）

Architecture cell: memory-recall-eval (F200)
Map delta: none
Why: Extends existing OutputVerifiedDetector interface with optional methods;
no new Store/Queue/Router/Adapter. ThreadAwareSignalSources composes existing
SqliteSignalSources + existing IMessageStore/ITaskStore interfaces.

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致 ✓
- 是否新建了并行 Store/Queue/Router/Adapter → 否
- SignalMessageStore/SignalTaskStore 是 **subset interfaces** (not new stores),
  mapping to existing IMessageStore.getByThread / ITaskStore.listByThread

## Open Questions

### 技术 OQ（给 reviewer）

1. **Pattern coverage**: CVO_ACCEPT_PATTERNS 和 REVIEWER_APPROVE_PATTERNS 是否
   足够覆盖实际审批用语？是否有遗漏或误判风险？
2. **Message scan limit**: `MESSAGE_SCAN_LIMIT = 50` — 审批信号通常在 thread 末尾，
   50 条是否足够？
3. **CI bucket naming**: 同时接受 `'pass'` 和 `'success'` — 是否有其他合法 bucket
   名称需要考虑？

### 价值 OQ（给 CVO）
无 — 这是既有 AC 的实现补全，无新的价值取舍。

## Next Action

请 review 代码实现 + 测试覆盖。纯后端改动，无前端 UI。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f200-d2-signals/codex`
- Start Command: `pnpm review:start`
- Ports: 自动分配（review:start 默认 3201/3202）

## 自检证据

### Spec 合规
Quality gate passed 2026-05-26 05:32. AC-D2.1/D2.2/D2.3 逐项对照全覆盖。
Fallback layer check: 3 try/catch = error isolation boundaries (by design, tested).
Hotfix check: not hotfix. Architecture scan: no new parallel abstractions.

### 测试结果
```
NODE_ENV= pnpm run build                → exit 0 ✅
memory tests (32/32)                     → 32 passed, 0 failed ✅
  - f200-d2-signal-sources.test.js       → 19 passed (new)
  - f200-output-verified.test.js         → 6 passed (existing)
  - f200-verify-pending.test.js          → 7 passed (existing)
pnpm lint                               → 0 errors ✅
pnpm check                              → 0 errors ✅ (biome format + lint)
```

### 根目录工件闸门
```
git status --short | rg media/design    → clean ✅
git diff --name-only origin/main...HEAD → clean ✅
```

### 相关文档
- Feature: `docs/features/F200-memory-recall-eval.md`
- No separate plan doc (补全既有 AC，非独立 Phase)

### 如果判断错了我最可能错在哪（pre-register retraction）
1. **catId 区分逻辑**: 我假设 `catId=null` = 人类、`catId` 有值 = 猫。如果
   StoredMessage 有 edge case 两者都为 null，CVO 检测会误报
2. **Pattern 过宽**: `好[的了]?\s*[，,。.！!]?\s*$` 可能匹配非审批语境的 "好的"
3. **Wiring 遗漏**: index.ts 传了 messageStore + taskStore，但如果启动时这些 store
   未初始化（e.g., Redis 连接失败），会 fallback 到 SqliteSignalSources — 这是
   期望行为但 reviewer 可能认为需要显式处理

[宪宪/Opus-46🐾]
