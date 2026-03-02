---
feature_ids: [F028]
topics: [push-notification, hub, ux, bugfix]
doc_kind: plan
created: 2026-03-02
updated: 2026-03-02
---

# Push Test Notification Click Feedback Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 修复 Hub「通知」页里“发送测试通知”点击后无反馈的问题，让铲屎官能明确知道请求是否成功或失败。

**Architecture:** 在 `usePushNotify` 内把 `sendTest` 从“吞响应”改为“解析响应并回传结果”；在 `PushSettingsPanel` 消费该结果并通过 toast 明确展示成功/失败。这样既保留后端推送能力，也避免当前页面可见时 SW 静默导致的“看起来没反应”。

**Tech Stack:** Next.js + React hooks + Zustand toast store + Vitest

---

### Task 1: 建立失败测试（Red）

**Files:**
- Create: `packages/web/src/components/__tests__/push-settings-panel.test.ts`
- Reference: `packages/web/src/components/PushSettingsPanel.tsx`, `packages/web/src/stores/toastStore.ts`

**Step 1: Write the failing test**
- 验证点击“发送测试通知”后：
  - 成功路径会出现 success toast
  - 失败路径会出现 error toast
- 当前实现不会加 toast，测试应失败。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter @cat-cafe/web test -- push-settings-panel.test.ts`
- Expected: FAIL（找不到预期 toast）

### Task 2: 最小实现（Green）

**Files:**
- Modify: `packages/web/src/hooks/usePushNotify.ts`
- Modify: `packages/web/src/components/PushSettingsPanel.tsx`

**Step 1: Implement minimal behavior**
- `sendTest` 返回结构化结果（`ok`/`message`）。
- 处理非 2xx 响应和 JSON 解析失败，提供可显示的错误消息。
- `PushSettingsPanel` 点击后根据结果写入 toast（success/error），并在请求进行中禁用按钮。

**Step 2: Run focused test to verify pass**
- Run: `pnpm --filter @cat-cafe/web test -- push-settings-panel.test.ts`
- Expected: PASS

### Task 3: 回归检查 + 交付材料

**Files:**
- Optional modify: `docs/bug-report/2026-03-02-push-test-notification-no-feedback/bug-report.md`
- Optional create: `docs/mailbox/2026-03-02-push-test-notification-review-request.md`

**Step 1: Run related tests**
- Run: `pnpm --filter @cat-cafe/web test -- useAuthorization-notify.test.ts`
- Expected: PASS（验证通知相关逻辑无回归）

**Step 2: Quality gate minimal evidence**
- Run: `pnpm --filter @cat-cafe/web test -- push-settings-panel.test.ts useAuthorization-notify.test.ts`
- Expected: PASS

**Step 3: Prepare review request for gpt52**
- 汇总：问题复现、根因、修复点、测试证据。
