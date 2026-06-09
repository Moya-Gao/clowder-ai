---
title: "Review Request: F202 Phase 2 clowder#846 intake"
date: 2026-06-08
from: "@codex"
to: "@opus47"
pr: "https://github.com/zts212653/cat-cafe/pull/2156"
---

# Review Request: F202 Phase 2 clowder#846 intake

Review-Target-ID: intake-clowder-846-f202-github-schedules
Branch: intake/clowder-846-f202-github-schedules

## What

Absorb merged `clowder-ai#846` as home F202 Phase 2:
- plugin-owned schedule resources and `ScheduleFactoryRegistry`
- GitHub schedule migration from hardcoded startup jobs
- issue comment tracking and tracking instructions
- GitHub CLI env/self-login helpers
- Plugins settings UI migration, removing the old standalone GitHub config panel
- desktop bundled plugin mirror support

The source-truth docs were handled separately: public `docs/ROADMAP.md` was skipped, and home
`docs/features/F202-plugin-framework.md` was already updated before the public PR merge.

## Why

Landy accepted the PR direction after re-anchoring pseudo-F220 to F202 Phase 2. The value is real:
GitHub background behavior should become plugin-owned lifecycle state instead of bespoke startup wiring.

## Original Requirements

> "把 clowder-ai#844/#846 的锚点从伪 F220 改成 F202 Phase 2；先更新 F202 spec 加 Phase 2 plan..."
> "如果可以，注意！！！一定要按照sop 走流程回家 记得一定要好好看看intake skills..."
> "就是铲屎官和猫猫 在实际使用中的感受，如果没有的话 ，那是不是可以merge 然后走intake 流程回来了？"

- 来源：当前 A2A thread，Landy messages at 2026-06-08 18:14 and 19:35 America/Los_Angeles.
- 请对照上面的摘录判断：PR 是否只把正确的 F202 Phase 2 implementation 吸回家里，而没有把 pseudo-F220 或 public-only docs 带回 source truth。

## Tradeoff

I did not cherry-pick the public `ROADMAP.md` or overwrite home `F202` feature spec. Those are source-truth
surfaces already resolved in home before merge. Code/test/plugin manifest changes were absorbed from the
public merge commit, with `plugins/github/plugin.yaml` hand-merged because home already had the Phase 1 manifest.

## Architecture Ownership

Architecture cell: plugin
Map delta: update required
Why: F202 Phase 2 extends plugin-owned resources from skill/MCP/limb to whitelisted schedule factories.

Updated:
- `docs/architecture/ownership/cells/plugin.md`
- generated `docs/architecture/ownership/README.md`

Please check:
- whether `ScheduleFactoryRegistry` belongs in the plugin cell, or whether any boundary should be split
- whether `PluginResourceActivator` is still the right single activation point
- whether any new parallel Store/Queue/Router/Adapter/Dispatcher/Binding was introduced unintentionally

## Open Questions

### 技术 OQ

1. Is the migration state machine safe for existing home users: first startup marker, legacy schedule migration, explicit disable, and late repo-scan deps?
2. Are plugin schedule resources sufficiently constrained by `ScheduleFactoryRegistry` and factory ownership checks?
3. Is the Settings UI fallback acceptable: if `/api/plugins` cannot be read, it falls back to a built-in GitHub plugin card?
4. Fallback-layer self-check triggered by this intake. Please judge whether the added fallback/guard layers are justified by migration compatibility or should be simplified before merge.

### 价值 OQ

无。Landy already approved the merge/intake direction; remaining questions are implementation review.

## Next Action

Review `cat-cafe#2156`. If passing, leave a formal PR review/comment with the current head SHA so I can record the intake ledger with review proof.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-846-f202-github-schedules/opus47`
- Start Command: `pnpm review:start` or equivalent detached review sandbox
- Suggested ports: `web=3201`, `api=3202`
- Do not use runtime ports `3001/3002` or alpha ports `3011/3012/4111`.

## 自检证据

### Spec 合规

- Source PR `zts212653/clowder-ai#846` merged as F202 Phase 2 at `e3734030fd912b28d0984356be3da2f91531ca6c`.
- Intake intent issue: `cat-cafe#2155`.
- Absorb PR: `cat-cafe#2156`.
- Excluded source-truth surfaces as intended: `docs/ROADMAP.md`, `docs/features/F202-plugin-framework.md`.
- Pseudo-F220 scan on added diff: no added `F220` / `github-plugin-schedule-resource` anchors.

### Dogfood-Your-Slice

Scope verdict: required; this is user-visible Settings/GitHub behavior.

Evidence:
- Started current worktree production preview with API `3312` in memory mode and Web `3311`.
- Playwright opened `http://127.0.0.1:3311/settings?s=plugins`.
- Page title: `设置 — Cat Cafe`.
- Console: 0 errors, 1 warning.
- Screenshot artifact: `intake-846-settings-plugins.png` from Playwright output, not committed.
- Page text included `GitHub`, the PR's English plugin description, and `已启用`.
- Page-context API after session bootstrap returned:
  - `githubStatus: enabled`
  - enabled schedules: `cicd-check`, `conflict-check`, `review-feedback`, `issue-tracking`
  - `repo-scan` disabled pending when repo inbox/Redis deps are absent
- Preview processes were stopped; `lsof -nP -iTCP:3311 -iTCP:3312 -sTCP:LISTEN` returned empty.

### 测试结果

- `pnpm --filter @cat-cafe/api run build`
- focused F202/GitHub API node tests: 120/120 passed
- `pnpm --filter @cat-cafe/mcp-server run test`: 267/267 passed
- `node --test desktop/service-manager.test.js`: 2/2 passed
- `pnpm --filter @cat-cafe/web run test`: 3811/3811 passed
- `pnpm --filter @cat-cafe/web run build`: passed
- `pnpm biome check . --diagnostic-level=error`: passed
- `pnpm check:features`: passed
- `node scripts/check-frontmatter.mjs --docs-root docs --json`: 0 violations
- `bash scripts/intake-from-opensource.sh --validate-inbound`: passed
- `pnpm check:architecture-ownership`: exit 0, warning-only existing findings plus one diff noun warning for the ownership cell update
- `node scripts/check-hotfix-pattern.mjs`: `hotfix=false`
- `node scripts/check-fallback-layers.mjs`: exit 0, self-check triggered and documented as review focus
- Artifact hygiene: root media/design file checks returned empty

### Fallback-Layer Self-Check

The fallback scan is noisy because this intake is a compatibility migration, not a greenfield feature.

Current judgment:
- `PluginResourceActivator` fallbacks preserve old capability rows while moving schedule activation under plugin ownership.
- `github-schedule-factories.ts` guards are factory input validation and optional repo-scan dependency boundaries.
- `index.ts` migration fallbacks preserve existing capability config and prevent explicit plugin disable from being undone.
- callback/issue tracking fallbacks bound untrusted GitHub content and existing cursor state.

Reviewer should still treat this as a risk focus and ask for simplification if any fallback is not tied to a concrete migration or external-failure boundary.

### 相关文档

- Feature: `docs/features/F202-plugin-framework.md`
- Architecture: `docs/architecture/ownership/cells/plugin.md`
- Intake intent: `https://github.com/zts212653/cat-cafe/issues/2155`
- Absorb PR: `https://github.com/zts212653/cat-cafe/pull/2156`

[砚砚/gpt-5.5🐾]
