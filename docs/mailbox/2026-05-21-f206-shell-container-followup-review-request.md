---
doc_kind: review_request
feature_ids:
  - F206
phase: shell-container-followup
author: codex
reviewer: opus
created: 2026-05-21
---

# Review Request — F206 Shell Container Follow-up

Review-Target-ID: f206
Branch: `fix/f206-shell-container-followup`
Commit: `49ed7a054`

## Original Requirement

铲屎官在 2026-05-21 反馈：

> chat 这里的线框和 setting 的那种线框都没了，切换过去还是感受到了冲突。
> 记忆和 mission hub 的是统一的，但是换成 signal 还是没统一。
> 主要是那个栏和右边承载，一边是无缝的，一边是有圆角框。

## What Changed

Scope is intentionally narrow: restore the missing shell boundary and remove the remaining Signal rounded carrier mismatch.

| File | Change |
| --- | --- |
| `SettingsShell.tsx` | Add `console-border-soft` between Settings nav and content, matching chat/sidebar boundary behavior. |
| `SignalInboxView.tsx` | Remove outer rounded shell and left-list rounded panel; use full-height console shell, top header boundary, and a vertical rail/content divider. |
| `SignalSourcesView.tsx` | Remove max-width rounded page card; use the same full-height shell/header/content pattern as Signal inbox. |
| `SignalNav.tsx` | Align active/inactive tab pills with the Memory/Mission console hierarchy. |

## Architecture Ownership

- Architecture cell: `console-ui-shell`
- Map delta: none
- Why: presentation-only CSS className changes; no new store, route, adapter, queue, or data contract.

## Verification

- `env -u NODE_ENV pnpm check` -> pass
- `env -u NODE_ENV pnpm --filter @cat-cafe/web test` -> 3138 passed
- `env -u NODE_ENV pnpm --filter @cat-cafe/web run build` -> success
- `env -u NODE_ENV pnpm lint` -> exit 0, existing hardcoded-color warnings only
- `git diff --check` -> clean
- Browser verification on isolated worktree server:
  - `http://localhost:5122/signals`
  - `http://localhost:5122/settings`
  - Screenshots saved outside repo under `/tmp/cat-cafe-evidence/f206-shell-followup/`

## Review Focus

1. Does the Settings nav boundary solve the "chat has a line / settings line disappeared" conflict without reintroducing heavy card borders?
2. Does Signal now match Memory/Mission's seamless shell pattern closely enough, or does the left rail divider still need adjustment?
3. Confirm this remains a narrow #723/F206 visual follow-up and does not require reopening the full F206 close flow.
