---
title: "F222 Card Status Review Request"
date: "2026-06-04"
feature: "F222"
review_target_id: "f222"
branch: "fix/f222-card-status"
author: "codex"
---

# Review Request: F222 Auto-Issue Card Refresh Status

Review-Target-ID: f222
Branch: fix/f222-card-status
Commit: 59e39d787

## What

Fixes the F222 auto-issue card after F5/page refresh:

- Adds `GET /api/frustration-issues/:issueId/status`.
- Hydrates `FrustrationIssueCard` on mount from the persisted issue.
- Adds API route tests for confirmed status and wrong-user access.
- Adds a frontend regression test proving a confirmed issue does not redraw as draft.

## Why

The issue submission already persisted server-side, but the historical rich card remounted with local `status='draft'`, so the user saw "确认提交" again after refresh and could not tell whether the feedback had been submitted.

Read-only runtime Redis check confirmed the user's actual issue was already `status=confirmed`; this fix makes the UI reflect that truth source.

## Original Requirements（必填）

> 是不是有bug喵？我之前填写了 我的反馈然后提交了 f5之后又变成这样了
> 我咋知道我到底提交没提交啊？
> 这啥能力你们f222的嘛？

- 来源：当前 thread 用户消息（2026-06-03/04，F222 auto-issue screenshot）
- 请对照上面的摘录判断交付物是否解决了"提交成功但刷新后不确定"的问题。

## Tradeoff

I added a read-only status endpoint instead of mutating the stored rich block after confirm. The endpoint keeps the card view derived from the persisted issue lifecycle and avoids rewriting historical message content.

Status hydration is best-effort: if the endpoint is unavailable or JSON parsing fails, the card keeps the existing draft UI rather than crashing the message timeline.

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: This extends F222's existing frustration issue lifecycle route + rich-card renderer; it does not add a new store/router/adapter boundary.

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致
- status endpoint 是否和 confirm/skip 的 auth semantics 一致
- frontend best-effort hydrate 是否应该 keep-draft on failure, or surface a smaller loading/error state

## Open Questions

### 技术 OQ（给 reviewer）

1. `GET /status` returns `403` for a known issue owned by another user, matching existing `confirm`/`skip`; please check whether this is acceptable or should be `404` to reduce ID probing.
2. `FrustrationIssueCard.tsx` still has a cumulative fallback-layer warning from pre-existing component complexity. This patch now adds only one net fallback layer; please decide whether this small fix should also refactor the older confirm/skip error parsing.
3. Browser smoke exposed unrelated dev-environment console noise (`callback-auth` 401 and HMR websocket warning); target F222 network calls were 200.

### 价值 OQ（给 CVO，如有）

无。

## Next Action

@opus 请 review。重点看 status endpoint auth, frontend hydration behavior, and whether this fully answers the user's F5 uncertainty.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f222/opus`
- Start Command: `pnpm review:start`
- Ports: default `web=3201`, `api=3202` (auto-advance if occupied; forbidden ports 3001/3002/3011/3012/4111 are not used)

Author smoke used:

- Web: `http://127.0.0.1:3101`
- API: `http://127.0.0.1:3102`
- Redis: `redis://localhost:6398`
- Screenshot: `/tmp/f222-card-status-smoke-clear.png`

## 自检证据

### Spec 合规

- User's actual submitted issue was checked read-only: persisted issue status was `confirmed`.
- UI regression is fixed: refresh-time card now hydrates `confirmed` and shows "已提交" instead of "确认提交".
- No Redis 6399 writes were performed. Runtime 6399 was only read to answer whether the user's submission succeeded.
- Root artifact guard: clean in target worktree and main worktree.

### 测试结果

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/routes/frustration-issue-routes.test.js
# 12 passed, 0 failed

pnpm --filter @cat-cafe/api build && node --test \
  packages/api/test/routes/frustration-issue-routes.test.js \
  packages/api/test/stores/frustration-issue-store.test.js \
  packages/api/test/services/frustration-detector.test.js
# 52 passed, 0 failed

cd packages/web && node scripts/run-with-node-env-test.mjs pnpm exec vitest run \
  src/components/rich/__tests__/FrustrationIssueCard.test.tsx \
  src/components/rich/__tests__/RichBlocks-provenance.test.tsx
# 5 passed, 0 failed

pnpm check
# 20 checks passed

pnpm -r --if-present run build
# passed

pnpm test
# passed after full build; initial run failed only because packages/mcp-server/dist was missing before build
```

### Browser / Visual

```bash
node --input-type=module <Playwright smoke>
# hasSubmitted: true
# hasConfirmButton: false
# status endpoint: 200 /api/frustration-issues/fi_mpz5aeug0c008ol3/status
```

The in-app Browser tool could not reach local dev server (`ERR_CONNECTION_CLOSED`) even after `curl` returned 200, so I used local Playwright for the browser check.

### Quality Scripts

```bash
node scripts/check-hotfix-pattern.mjs
# hotfix: false

node scripts/check-fallback-layers.mjs
# net +1 fallback layer in FrustrationIssueCard; cumulative warning remains because the file already has many fallback/status guards

pnpm check:architecture-ownership
# exits 0; warning-only diff noun points at the existing F222 route/store dependency
```

### Related Documents

- Feature: `docs/features/F222-frustration-auto-issue.md`
- Previous Phase A implementation: PR #2075
