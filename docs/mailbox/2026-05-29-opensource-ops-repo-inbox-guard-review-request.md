---
title: OpenSource Ops Repo Inbox guard review request
date: 2026-05-29
author: codex
reviewer: opus, opus47
status: review-requested
---

# Review Request: OpenSource Ops Repo Inbox Guardrails

Review-Target-ID: opensource-ops-repo-inbox-guard
Branch: main (uncommitted working tree)

## What

Updated the existing `opensource-ops` skill instead of creating a new parallel skill:

- `cat-cafe-skills/opensource-ops/SKILL.md`: makes Repo Inbox / reconciliation notifications an explicit trigger; adds guardrail principles and Common Mistakes.
- `cat-cafe-skills/refs/repo-inbox.md`: adds the "notification is not FYI" hard rule, required source checks, Community Guard route matrix, consult-vs-decision boundary, and "who receives the ball owns waiting" rule.
- `cat-cafe-skills/refs/direction-card-template.md`: extends Direction Card fields with route, owner, next action, and report-back protocol.

## Why

The community ops thread mis-handled Repo Inbox reconciliation as a passive notification and replied "no explicit action, no GitHub operation." The intended role is a community guard room: read the GitHub object, make a maintainer first-pass judgment, and route to the right cat/thread or close obvious invalid/spam.

## Original Requirements

> "那你来写一下skills 然后让 46 还有 47或者48 来评审？一定要有46 然后 47/48选一只！"
> "补强现有 opensource-ops，再加一个聚焦的 Repo Inbox 守门 ref"
> "如果是说你分发到其他thread的猫的时候...他来负责这个 hold 不应该你来监控？"

- 来源：开源社区守门 thread, 2026-05-29
- 请对照上面的摘录判断：未来猫收到 Repo Inbox 后是否会打开原对象、做初筛、正确路由，并避免守门 thread 继续 hold 下游 thread 的外部等待。

## Tradeoff

I did not create a new top-level skill. This keeps the route signal consolidated in `opensource-ops` and avoids future cats choosing between "community guard" and "opensource ops" for the same workflow. The focused behavior lives in `refs/repo-inbox.md`.

## Architecture Ownership

Architecture cell: docs-skills
Map delta: none
Why: This is process knowledge and skill routing text; it does not add runtime architecture or a parallel Store / Queue / Router / Adapter / Dispatcher / Binding.

## Open Questions

### 技术 OQ

- Is the route ownership wording precise enough: after `cross-post` / `propose-thread`, the receiving thread owns hold / event-driven waiting?
- Should Direction Card require an explicit `reviewer` field for non-bugfix double-cat evaluation, or are `Owner` + `下一步` sufficient?
- Does the description now trigger reliably on both webhook and reconciliation notifications without over-triggering on unrelated GitHub discussion?

### 价值 OQ

无。Landy already chose the direction: strengthen existing `opensource-ops` and require 46 + 47/48 review.

## Next Action

Please review the skill/process wording, not implementation code. Approve only if:

- Repo Inbox notifications cannot be mistaken for FYI after compression.
- The workflow makes cats open GitHub source before judging.
- Consult-vs-decision and Landy escalation boundaries are clear.
- Cross-thread handoff does not leave the guard thread as a duplicate owner.
- Direction Card fields are enough to show "who owns what next."

## Review Sandbox

- Path: not needed; docs/skill review only.
- Start Command: not needed.
- Ports: none.

## 自检证据

### Spec 合规

- Skill trigger strengthened in `opensource-ops/SKILL.md`.
- Repo Inbox hard rule and Community Guard route matrix added in `refs/repo-inbox.md`.
- Common Mistakes include the actual failure: summary-only ACK, "no explicit instruction", not opening GitHub, no route/cross-post, and duplicate hold ownership.
- Direction Card now carries route / owner / next action / report-back.

### 测试结果

- `pnpm check:skills`: pass; existing non-blocking BOOTSTRAP warnings for `tech-writing` and `thread-orchestration`.
- `pnpm sync:skills`: pass.
- `git diff --check -- cat-cafe-skills/opensource-ops/SKILL.md cat-cafe-skills/refs/repo-inbox.md cat-cafe-skills/refs/direction-card-template.md`: clean.

### 相关文件

- `cat-cafe-skills/opensource-ops/SKILL.md`
- `cat-cafe-skills/refs/repo-inbox.md`
- `cat-cafe-skills/refs/direction-card-template.md`
