---
title: F222 Hold-Ball Cancel-And-Feedback Review Request
date: 2026-06-05
feature: F222
status: review
---

# Review Request: F222 Hold-Ball Cancel-And-Feedback

Review-Target-ID: f222-hold-feedback
Branch: fix/f222-hold-ball-feedback

## What

Extends F222 UX-3 from permission authorization cards to hold-ball connector cards.

- Hold-ball connector bubbles now render both `取消持球` and `取消并反馈`.
- `取消并反馈` calls the existing authenticated hold cancel route with `withFeedback=1`.
- The route cancels the hold first, then best-effort emits F222 `user_report` with `toolName: cat_cafe_hold_ball`.
- If the hold task is already stale and DELETE returns 404, the frontend falls back to `POST /api/callbacks/hold-ball/feedback` so the explicit feedback still creates a report.
- Added route and component regressions.

## Why

PR #2107 only covered `AuthorizationCard`, but the screenshot that triggered this bug is a hold-ball connector card. Users need the same active complaint path there: cancel stale hold and immediately generate a feedback issue, without waiting for cancel-burst detection.

## Original Requirements

> "这里的 持球好像没有布偶猫说的 UX-3「取消并反馈」功能啊"
- 来源：current thread, 2026-06-05 15:21 PT, screenshot of `持球通知` card showing only `取消持球`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

No new signal type. This reuses the existing `user_report` path from PR #2107, so it inherits no-threshold and dedup-exempt behavior. I did not bypass callback auth or fabricate hold registration for browser testing; the new feedback branch stays behind the existing user-authenticated DELETE route.

## Architecture Ownership

Architecture cell: harness-eval
Map delta: none
Why: F222 already owns frustration auto-issue and `user_report`; this only adds a new UI entrypoint into that existing signal pipeline.

Please check:
- diff matches `Map delta: none`
- no parallel Store / Queue / Router / Adapter / Dispatcher / Binding
- hold cancellation remains primary and feedback remains best-effort

## Open Questions

### 技术 OQ（给 reviewer）

- Is `withFeedback=1` on the existing DELETE route the right narrow contract?
- Should feedback fire before or after the cancellation confirmation message? Current order is cancel -> user_report -> confirmation message, with user_report best-effort.
- Any concern that `catId` derived from `createdBy: hold-ball:{catId}` should be normalized differently?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review PR for correctness and UX coverage of the screenshot path.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f222-hold-feedback/gpt52`
- Start Command: `pnpm review:start`
- Ports: reviewer-assigned by `pnpm review:start` (self-preview used web=3331, API not needed for static component preview)

## 自检证据

### Spec 合规

- Root cause: UX-3 was implemented only in permission authorization UI, not hold-ball connector UI.
- Fix: hold-ball connector cards now expose `取消并反馈`.
- Route semantics: authorized hold cancel still removes the task; `withFeedback=1` additionally calls F222 `user_report`.
- Reviewer P1 fixed: stale/expired hold tasks no longer collapse feedback into misleading `已取消` without reporting.
- Architecture check: warning-only existing project warnings; F222 doc declares `Architecture cell: harness-eval`, `Map delta: none`.
- Hotfix pattern: `hotfix=false`.
- Root artifact guard: clean.

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
# PASS

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/hold-ball-cancel-route.test.js
# 9 passed, 0 failed

pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/connector-bubble-theme.test.ts
# 15 passed, 0 failed

pnpm check
# 22/22 passed

pnpm lint
# 0 errors; existing warnings only
```

### Frontend Preview

Temporary uncommitted Next showcase route rendered the real `ConnectorBubble` with hold-ball source:

```bash
env -u NODE_ENV NEXT_PUBLIC_API_URL=http://localhost:3332 PORT=3331 pnpm --filter @cat-cafe/web dev
curl http://localhost:3331/showcase/f222-hold-feedback
# 200; server-rendered HTML contained `持球通知`, `取消持球`, and `取消并反馈`
```

The temporary route was removed before commit; final diff only contains product code, tests, and this review request.

### 相关文档

- Feature: `docs/features/F222-frustration-auto-issue.md`
