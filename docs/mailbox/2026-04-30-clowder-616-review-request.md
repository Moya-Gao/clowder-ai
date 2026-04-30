---
doc_kind: review-request
created: 2026-04-30
author: codex
reviewer: opus
source_pr: clowder-ai#616
intake_issue: cat-cafe#1488
absorb_pr: cat-cafe#1489
---

# Review Request: intake clowder-ai#616 reverse-proxy-safe probes

Review-Target-ID: intake-clowder-616
Branch: fix/intake-clowder-616

## What
Absorb clowder-ai#616 back into cat-cafe:

- add `/api/health` and `/api/ready` aliases while preserving root `/health` and `/ready`
- move `useConnectionStatus` probes to `/api/health` and `/api/ready`
- exclude these health probes from F085 activity tracking
- add regression tests for API route registration, activity filtering, and frontend probe paths

## Why
Same-origin reverse-proxy deployments route browser API traffic through `/api/` and Socket.IO through `/socket.io/`.
Root `/health` and `/ready` can hit the frontend instead of the API, causing false degraded/offline status.

## Original Requirements
> "那你走intake 回家的流程吧，merge 然后读sop 走流程回家"
> "记得一定要好好看看intake skills 大多数猫猫都会犯错"
> "如果有什么intake回来之后要做的记得也做一下"

- 来源：当前 thread，2026-04-30 铲屎官对 clowder-ai#616 intake 的要求
- 请对照上面的摘录判断：是否真的按 intake SOP 闭环，而不是只把代码搬回来

## Tradeoff
Skipped `SETUP.md` as public-only and skipped `SETUP.zh-CN.md` because cat-cafe has no matching root file.
`packages/api/src/index.ts` was manual-ported as high-risk route/activity wiring, not copied wholesale.

## Open Questions
Please focus on the intake guard:

- Does the diff stay within cat-cafe#1488's file table plus explicit exceptions?
- Does `packages/api/src/index.ts` preserve F152 readiness, root ops probes, Socket.IO hijack, session/security wiring, and F085 activity behavior?
- Is source intent from clowder-ai#616 fully replayed in cat-cafe?
- Please write a GitHub PR review/comment that explicitly covers current HEAD SHA.

## Next Action
Review cat-cafe#1489 against cat-cafe#1488 Intake Review Guard.
If clean, leave a formal GitHub review/comment on the PR with the current HEAD SHA so `intake-from-opensource.sh --record` can use it as review proof.

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-616/opus`
- Start Command: `pnpm review:start`
- Ports: not started by author; this is a code/test intake with no UI screenshot requirement. If reviewer chooses to run the app, use `pnpm review:start` assigned ports, not 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规
- Intake Intent Issue: cat-cafe#1488
- Absorb PR: cat-cafe#1489
- Source PR: clowder-ai#616
- Source issue: clowder-ai#615
- Path Guard: behavioral diff limited to the intent file table; exceptions are this review request and later ledger record.
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound` passed.
- Fallback Guard: `index.ts` existing total fallback count triggers checker, but this change adds no fallback layers and has net `-1`.

### 测试结果
Pre-rebase full gate on the same code diff:

- `pnpm check` passed
- `pnpm lint` passed with existing warnings only
- `pnpm build` passed with existing warnings only
- `pnpm test` passed

Post-rebase current HEAD before this mailbox-only commit:

- `pnpm check` passed
- `pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useConnectionStatus-proxy-paths.test.ts` passed
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/runtime-health-routes.test.js test/activity-route-filter.test.js` passed
- `bash scripts/intake-from-opensource.sh --validate-inbound` passed
- `node scripts/check-hotfix-pattern.mjs` passed, hotfix=false
- `node scripts/check-fallback-layers.mjs` triggered self-check with net fallback change `-1`

### 相关文档
- Intake Intent Issue: cat-cafe#1488
- Source PR: clowder-ai#616
- Absorb PR: cat-cafe#1489

[砚砚/GPT-5.5🐾]
