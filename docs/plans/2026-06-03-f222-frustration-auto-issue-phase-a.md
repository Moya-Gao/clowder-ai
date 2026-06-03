# F222 Frustration Auto-Issue Phase A — Implementation Plan

**Feature:** F222 — `docs/features/F222-frustration-auto-issue.md`
**Goal:** 当用户遇到 CLI 报错或连续取消时，自动采集上下文并生成 issue 卡片，用户一键确认或跳过
**Acceptance Criteria:**
- AC-A1: 摩擦信号检测（至少支持 CLI 报错 + 连续 cancel 两种触发）
- AC-A2: Auto-issue 卡片生成（rich block card，含上下文采集 + 用户可编辑描述）
- AC-A3: 用户确认后 issue 持久化（可被 eval:task-outcome 消费）
- AC-A4: 用户跳过 → 不产生 issue，但 cancel/error 事件仍被记录
**Architecture cell:** harness-eval
**Map delta:** none
**Map delta why:** 复用 F128 propose-thread callback + card action 模式，复用 F192 signal pipeline，不改 ownership 边界
**Architecture:** FrustrationDetector 服务在 route-serial 后调周期检测摩擦信号（CLI 报错 / permission cancel burst），触发时创建 draft issue + 发 rich card 给用户确认。FrustrationIssueStore（Redis-backed）持久化 issue。Frontend 渲染 card meta.kind='frustration_auto_issue' 的专属卡片。
**Tech Stack:** TypeScript, Redis (sorted sets + hashes), Zod, Fastify routes, React card component
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测 card 渲染 + 按钮交互

---

## What We're NOT Building (Phase A scope 边界)

- ❌ 文本情绪分析（"不对""错了"关键词检测）→ Phase B
- ❌ A2A 超时检测 → Phase B
- ❌ 用户反复 retry 同一操作检测 → Phase B
- ❌ Issue 看板/列表页面 → Phase B
- ❌ 自动分配/分拣 → 不在 F222 scope

## Terminal Schema

```typescript
// packages/shared/src/types/frustration-issue.ts
export type FrustrationSignalType = 'cli_error' | 'cancel_burst';

export type FrustrationIssueStatus = 'draft' | 'confirmed' | 'skipped';

export interface FrustrationIssue {
  issueId: string;
  status: FrustrationIssueStatus;
  threadId: string;
  userId: string;
  catId: string;
  invocationId?: string;

  // Signal
  signalType: FrustrationSignalType;
  signalDetail: {
    // cli_error: { reasonCode, publicSummary, publicHint }
    // cancel_burst: { cancelCount, windowMs }
    [key: string]: unknown;
  };

  // Auto-collected context
  context: {
    recentMessages: Array<{ role: string; content: string; timestamp: number }>;
    errorLogs?: string;
    toolCallHistory?: Array<{ tool: string; approved: boolean; timestamp: number }>;
  };

  // User-provided
  userDescription?: string;

  // Lifecycle
  cardMessageId?: string;
  createdAt: number;
  confirmedAt?: number;
  skippedAt?: number;
}
```

---

## Task 1: Shared Types + ID Generator

**Files:**
- Create: `packages/shared/src/types/frustration-issue.ts`
- Modify: `packages/shared/src/types/index.ts` (add export)
- Modify: `packages/shared/src/types/ids.ts` (add generateFrustrationIssueId)
- Test: `packages/shared/test/types/frustration-issue.test.ts`

**Step 1.1:** Write test for ID generator + type validation

**Step 1.2:** Implement types + ID generator (nanoid prefix `fi_`)

**Step 1.3:** Export from index.ts

**Step 1.4:** `pnpm --filter @cat-cafe/shared build` + verify

**Step 1.5:** Commit `feat(F222): add FrustrationIssue shared types [宪宪/Opus-4.6🐾]`

---

## Task 2: FrustrationIssueStore (Port + Redis + InMemory + Factory)

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/ports/FrustrationIssueStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/frustration-issue-keys.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisFrustrationIssueStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/memory/InMemoryFrustrationIssueStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/factories/FrustrationIssueStoreFactory.ts`
- Test: `packages/api/test/stores/frustration-issue-store.test.ts`

**Step 2.1:** Write failing tests for store operations:
- create(input) → FrustrationIssue with status='draft'
- getById(issueId) → FrustrationIssue | null
- confirm(issueId, userDescription?) → updates status='confirmed', confirmedAt
- skip(issueId) → updates status='skipped', skippedAt
- listByThread(threadId) → sorted by createdAt desc
- listConfirmed(userId) → only status='confirmed', for eval consumption

**Step 2.2:** Implement port interface (IFrustrationIssueStore)

**Step 2.3:** Implement Redis keys namespace

**Step 2.4:** Implement InMemoryFrustrationIssueStore (tests pass)

**Step 2.5:** Implement RedisFrustrationIssueStore (Lua CAS for status transitions)

**Step 2.6:** Implement factory

**Step 2.7:** Commit `feat(F222): FrustrationIssueStore with Redis + InMemory impl [宪宪/Opus-4.6🐾]`

---

## Task 3: FrustrationDetector Service

**Files:**
- Create: `packages/api/src/domains/cats/services/frustration/FrustrationDetector.ts`
- Create: `packages/api/src/domains/cats/services/frustration/frustration-card-builder.ts`
- Test: `packages/api/test/services/frustration-detector.test.ts`

**Step 3.1:** Write failing tests for detection logic:
- `shouldTrigger({ cliDiagnostics })` → true when reasonCode in trigger set
- `shouldTrigger({ cancelCount: 3, windowMs: 60000 })` → true (≥3 cancels in 60s)
- `shouldTrigger({ cancelCount: 1 })` → false (below threshold)
- `shouldTrigger({ cliDiagnostics: { reasonCode: 'server_overloaded' } })` → false (transient, not user-actionable)
- Dedup: same thread + same signal type within 5min → don't re-trigger

**Step 3.2:** Write failing tests for context collector:
- `collectContext(threadId, invocationId, deps)` → { recentMessages, errorLogs, toolCallHistory }
- Collects last 5 messages from thread
- Includes CLI error excerpt if available
- Includes last 3 tool events with approve/cancel status

**Step 3.3:** Write failing tests for card builder:
- `buildFrustrationIssueCard(issue)` → RichCardBlock with meta.kind='frustration_auto_issue'
- Card has correct tone='warning', title, bodyMarkdown, fields, actions
- Actions: confirm + skip with correct payload

**Step 3.4:** Implement FrustrationDetector:
- `shouldTrigger(signals)`: evaluates CLI error + cancel burst thresholds
- `collectContext(threadId, invocationId, deps)`: gathers recent messages + errors + tool events
- Dedup via in-memory TTL map (threadId+signalType → lastTriggeredAt)

**Step 3.5:** Implement frustration-card-builder:
- `buildFrustrationIssueCard(issue)`: creates RichCardBlock
- `buildFrustrationIssueInteractive(issue)`: creates RichInteractiveBlock for confirm/skip with OptionAction callbacks

**Step 3.6:** Commit `feat(F222): FrustrationDetector service + card builder [宪宪/Opus-4.6🐾]`

---

## Task 4: API Routes (Confirm / Skip / List)

**Files:**
- Create: `packages/api/src/routes/frustration-issue-routes.ts`
- Modify: `packages/api/src/index.ts` (wire store + routes)
- Test: `packages/api/test/routes/frustration-issue-routes.test.ts`

**Step 4.1:** Write failing tests for routes:
- POST `/api/frustration-issues/:id/confirm` — 200 + issue.status='confirmed'
- POST `/api/frustration-issues/:id/confirm` with body.description — userDescription set
- POST `/api/frustration-issues/:id/skip` — 200 + issue.status='skipped'
- POST confirm on already-confirmed → 409
- POST confirm on nonexistent → 404
- GET `/api/frustration-issues/pending` — returns draft issues for user

**Step 4.2:** Implement routes (Zod validation, user auth)

**Step 4.3:** Wire FrustrationIssueStore into DI (index.ts createFrustrationIssueStore)

**Step 4.4:** Register routes in app

**Step 4.5:** Commit `feat(F222): frustration-issue API routes [宪宪/Opus-4.6🐾]`

---

## Task 5: Integration into route-serial.ts

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (~line 2270, after error persistence)
- Test: `packages/api/test/services/frustration-integration.test.ts`

**Step 5.1:** Write failing integration test:
- route-serial with CLI error → FrustrationDetector fires → card message emitted → issue in store
- route-serial with no error → FrustrationDetector does not fire
- route-serial with transient error (server_overloaded) → does not fire

**Step 5.2:** Add FrustrationDetector + FrustrationIssueStore to route-serial deps

**Step 5.3:** After collectedErrorText persistence block (~line 2273), add:
```typescript
// F222: Frustration auto-issue — detect CLI error signal
if (collectedCliDiagnostics?.reasonCode && frustrationDetector) {
  await frustrationDetector.evaluate({
    signalType: 'cli_error',
    signalDetail: { ...collectedCliDiagnostics },
    threadId, catId, userId,
    invocationId: ownInvocationId,
  });
}
```

**Step 5.4:** Add cancel burst detection hook:
- Query PendingRequestStore for recent denied requests in this thread
- If ≥3 denials in last 60s → trigger cancel_burst signal

**Step 5.5:** FrustrationDetector.evaluate():
1. shouldTrigger check
2. collectContext
3. frustrationIssueStore.create(draft)
4. Build card + interactive blocks
5. messageStore.append (system message with rich blocks)
6. socketManager.broadcastToRoom (real-time delivery)
7. Update issue.cardMessageId

**Step 5.6:** Commit `feat(F222): integrate FrustrationDetector into route-serial [宪宪/Opus-4.6🐾]`

---

## Task 6: Frontend Card Renderer

**Files:**
- Create: `packages/hub/src/components/chat/rich/FrustrationIssueCard.tsx`
- Modify: `packages/hub/src/components/chat/rich/RichBlockRenderer.tsx` (add meta.kind routing)
- Test: visual verification via browser-preview

**Step 6.1:** Add meta.kind='frustration_auto_issue' dispatch in RichBlockRenderer

**Step 6.2:** Implement FrustrationIssueCard:
- Renders issue context (error summary, recent messages, tool history)
- "确认提交" button with optional description textarea
- "跳过" button
- Calls `/api/frustration-issues/:id/confirm` or `/api/frustration-issues/:id/skip`
- After action: card updates to show confirmed/skipped status
- WebSocket subscription for real-time state sync

**Step 6.3:** Commit `feat(F222): FrustrationIssueCard frontend component [宪宪/Opus-4.6🐾]`

---

## Task 7: End-to-End Verification

**Step 7.1:** `pnpm check` + `pnpm lint` pass

**Step 7.2:** All new tests pass: `pnpm --filter @cat-cafe/api test -- --grep "F222"`

**Step 7.3:** `pnpm gate` passes

**Step 7.4:** Commit any remaining fixes

---

## Open Questions (Technical — 自决)

| OQ | 决策 | 理由 |
|----|------|------|
| Cancel burst threshold | 3 cancels in 60s | 低于 3 太敏感（正常 cancel 频率），高于 3 遗漏真实摩擦 |
| CLI error trigger codes | auth_failed, quota_exceeded, network_error, context_window_exceeded, tool_call_parse_failed, spawn_failed | 排除 server_overloaded（瞬态）和 invalid_thinking_signature/missing_rollout（内部） |
| Dedup window | 同 thread + 同 signal type 5 分钟内不重复触发 | 防止连续报错刷屏 |
| Recent messages count | 最近 5 条 | 够提供上下文但不过长 |
| Issue TTL | 永久（TTL=0），遵守铁律 #5 | 用户可见数据默认持久化 |
