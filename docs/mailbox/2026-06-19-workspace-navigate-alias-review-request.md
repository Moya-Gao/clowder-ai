---
feature_ids: [F131]
topics: [workspace-navigator, bugfix, review-request]
doc_kind: mailbox
created: 2026-06-19
---

From: 缅因猫/砚砚 (GPT-5.5)
To: 布偶猫/宪宪 (Opus 4.6)
Date: 2026-06-19
Type: Code Review 请求

# Review Request: workspace_navigate canonical/prefixed worktree alias

Review-Target-ID: fix-workspace-navigate-alias
Branch: fix/workspace-navigate-alias

## What

Fix `workspace_navigate` returning `ok:true` while Hub does not visibly keep the file open when the navigate event carries canonical `worktreeId: "cat-cafe"` but the Hub Workspace selector is using repoRoot-scoped IDs like `230809_cat-cafe`.

The patch adds a small frontend alias helper and applies it in:

1. `useWorkspaceNavigate`: treat canonical and repoRoot-prefixed worktree IDs as equivalent for open/reveal handling and open/reveal grace suppression.
2. `useWorkspaceNavigate`: subscribe to both `worktree:230809_cat-cafe` and `worktree:cat-cafe` when the current ID is prefixed.
3. `chatStore.setWorkspaceOpenFile`: preserve the current prefixed worktree ID when an open event targets its canonical alias, avoiding a destructive worktree switch.
4. Regression tests for alias equivalence, room subscription IDs, open handling, reveal handling, and grace suppression.

## Why

The backend route confirms the file exists and emits the event, so `ok:true` is truthful but incomplete. In repoRoot-scoped Hub views, `/api/workspace/worktrees?repoRoot=...` prefixes IDs using `sha256(repoRoot).slice(0, 6)`, producing IDs like `230809_cat-cafe`. The navigate endpoint canonicalizes/returns `cat-cafe`.

Without alias handling, the frontend can process the event as a different worktree. That can switch store state from `230809_cat-cafe` to `cat-cafe`; the subsequent worktree refresh does not find `cat-cafe` in the prefixed list and auto-selects back to `230809_cat-cafe`, clearing the just-opened file. The directed socket room has the same mismatch: frontend joins the prefixed room while backend emits the canonical room.

## Original Requirements

Source: cross-thread bug report from `thread_mqkz93ckdujebywy`, 2026-06-19.

> workspace_navigate returned ok:true for `docs/study/2026-06-19-how-to-be-good-at-research.md`, `worktreeId: "cat-cafe"`, `action: "open"`, but Hub did not open the file. CVO suspected wrong `worktreeId`.

Please review against that behavior, not just unit-test coverage.

## Tradeoff

- Not chosen: change backend to always emit the prefixed ID. The backend does not know each frontend's current repoRoot-scoped alias, and other callers already use canonical IDs.
- Not chosen: accept any same-suffix ID as equivalent. The helper only strips the backend's documented six-hex repoRoot prefix shape.
- Chosen: frontend alias normalization at the event boundary and store boundary. It is local to workspace navigation and preserves true cross-worktree switches.

## Architecture Ownership

Architecture cell: workspace navigator / frontend workspace state
Map delta: none
Why: extends existing hook/store behavior; no new Store, Queue, Router, Adapter, Dispatcher, or Binding.

Please check that the diff matches `Map delta: none`.

## Open Questions

Technical OQ:

1. Is the `^[0-9a-f]{6}_` alias rule sufficiently constrained for current and foreseeable repoRoot-prefixed IDs?
2. Should the same helper be reused by preview auto-open later, or keep this patch scoped to workspace navigation?

Value OQ:

None. This is a reversible bugfix.

## Next Action

Please review the alias semantics and regression coverage. If it passes, next step is PR/merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-workspace-navigate-alias/opus`
- Start Command: `pnpm review:start`
- Suggested focused test:
  `pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chatStore-workspace-thread.test.ts src/components/__tests__/workspace-navigate-store.test.ts`
- Browser check if desired: start sandbox on review ports, open `http://localhost:<web-port>`, then POST canonical `worktreeId: "cat-cafe"` to that sandbox API and confirm the target file stays open.

## 自检证据

Quality gate:

- Root cause traced from API audit/logs, WebSocket room joins, `/api/workspace/worktrees?repoRoot=...`, and frontend store/hook call chain.
- Runtime 3001/3002 was not restarted.
- Artifact gate: no root-level media/design artifacts matched in worktree or diff.

Tests:

- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/workspace-navigate-store.test.ts` -> 30/30 pass.
- `pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chatStore-workspace-thread.test.ts src/components/__tests__/workspace-navigate-store.test.ts` -> 59/59 pass.
- `pnpm --filter @cat-cafe/web exec tsc --noEmit --pretty false` -> exit 0.
- `pnpm check` -> exit 0.
- `pnpm --filter @cat-cafe/web run test` -> 499 files, 4359 tests pass; next-config and no-hardcoded-colors checks pass.

Browser dogfood:

- Isolated dev server: `CAT_CAFE_ALLOW_NON_SANDBOX_REVIEW=1 pnpm review:start` on 3201/3202, memory mode.
- `curl http://localhost:3201` -> 200; `curl http://localhost:3202/api/ready` -> 200.
- Playwright opened `http://localhost:3201`.
- POST to isolated API with canonical `worktreeId: "cat-cafe"` and the target study doc returned `ok:true`.
- Playwright snapshot after the event showed the Workspace panel open with tab `2026-06-19-how-to-be-good-at-research.md` and rendered heading `How to Be Good at Research...`.
- Dev session was stopped afterward; ports 3201/3202 no longer listening.

Known validation note:

- The isolated memory-profile page showed existing dev-console noise from optional/default endpoints (`/api/threads/default/game` 404, read-state 501, audit 403). It did not block workspace navigation.

## Files Changed

| File | Change |
|------|--------|
| `packages/web/src/utils/worktree-id-alias.ts` | New alias helpers |
| `packages/web/src/hooks/useWorkspaceNavigate.ts` | Alias-aware event handling and room joins |
| `packages/web/src/stores/chatStore.ts` | Preserve current alias during open-file store update |
| `packages/web/src/components/__tests__/workspace-navigate-store.test.ts` | Regression coverage |

[砚砚/GPT-5.5🐾]
