---
doc_kind: review-request
created: 2026-05-04
author: codex
reviewer: opus-47
source_pr: pending
---

# Review Request: catch up empty stream CLI bubbles

Review-Target-ID: fix-empty-stream-cli-catchup
Branch: fix/cli-output-empty-catchup

## What
Fix the remaining Opus 4.6 "CLI Output expanded but stdout missing until F5/thread switch" path.

The change adds one narrow finalization guard in `useAgentMessages.ts`: when a final stream message has a live bubble with empty `content` but has CLI/tool or thinking shell data, request the existing Phase C stream catch-up for that thread. The catch-up then hydrates the persisted server content into the dark CLI Output path.

## Why
Runtime was already past PR #1550 and hard-refresh was confirmed, but the latest Opus 4.6 message still rendered an expanded CLI Output with only `1 tool (collapsed)` and no stdout.

The backend persisted the final stream content correctly; the live frontend store had a finalized stream bubble with a tool shell and empty content. Existing #1550 catch-up wiring covered reducer recovery actions and no-bubble finalization, but not this active-empty-bubble finalization state.

## Original Requirements
> "好像还是之前那样的 @codex 你来定位看看？我强制刷新过了，然后也更新到最新了 发现现在的最新版本布偶猫还是需要f5才能看到cli的气泡"

- 来源：当前 thread，2026-05-04 铲屎官对最新 runtime 的复现报告
- 请对照上面的摘录判断：是否解决 "latest + hard refresh 后仍需 F5 才看到 CLI stdout" 的恢复缺口

## Tradeoff
This deliberately does not change the #1547 visual contract:

- stream content stays in dark CLI Output
- 4.6 stream-final-speech still defaults expanded
- callback speech remains the light main bubble

It also does not attempt the larger reducer semantic fix for accepting late chunks into a finalized tool bubble. This PR uses existing catch-up infrastructure as the smallest recovery path for the observed persisted-content/live-empty mismatch.

## Open Questions
Please focus on these edges:

- Is the guard narrow enough (`assistant` + `origin='stream'` + empty content + toolEvents/thinking shell + final done)?
- Should the same active-empty finalization recovery also be wired for any background-stream done path, or is the current active invocation path the right minimal scope?
- Does the test set prove both the RED path and the non-final no-overtrigger guard?
- Confirm this does not regress the #1547 dark CLI Output visual placement.

## Next Action
Review PR #1552 once opened. If clean, give R1 LGTM so I can trigger cloud review per SOP-serial.

## Review Sandbox
- Path: `/tmp/cat-cafe-review/fix-empty-stream-cli-catchup/opus-47`
- Start Command: `pnpm review:start`
- Ports: not started by author; this is a live-state recovery wiring fix. If reviewer chooses to run the app, use `pnpm review:start` assigned ports, not 3001/3002/3011/3012/4111.

## 自检证据

### Runtime Diagnosis
- Runtime preflight: process started after target merge `d7822fe36`, source and bundle are current.
- Thread: `thread_mopdgqxok6c93xk9`
- Message: `0001777904990289-000003-efcec235`
- API: `origin='stream'`, `content_len=551`, `toolEvents=1`, invocationId `4a92c646-29df-41d8-a155-e0316cf13ae8`
- Screenshot: CLI Output body expanded but stdout section absent until F5/thread switch.

### Tests
RED first:

- New test `requests catch-up when done(isFinal) only has an empty CLI/tool bubble` failed with 0 catch-up calls before the fix.

GREEN:

- `NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts` -> 10/10
- Focused stream/background/active/default-expand suite -> 97/97
- Full web suite -> 377 files / 2812 tests
- `pnpm check` -> passed
- `pnpm gate` -> passed on code commit `dbf32402`

### Artifact / Hygiene
- Biome on touched files: passed with existing warnings only in large pre-existing hook file.
- Root media/design artifact guard: clean.
- `git diff --check`: passed.

### 相关文档
- PR #1547: CLI Output default-expand visual contract.
- PR #1550: reducer recovery action catch-up wiring.

[砚砚/Codex-5.5🐾]
