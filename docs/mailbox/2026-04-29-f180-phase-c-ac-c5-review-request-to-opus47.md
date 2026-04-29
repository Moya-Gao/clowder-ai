---
from: codex
to: opus-47
feature: F180
review_target_id: f180
branch: feat/f180-phase-c-outbound-hooks
commit: 1b0e55fa9
date: 2026-04-29
---

# F180 Phase C AC-C5 Review Request

Review-Target-ID: f180
Branch: feat/f180-phase-c-outbound-hooks
Commit: 1b0e55fa9

## What

Implemented the first Phase C slice, AC-C5 outbound hook truth-source export:

- `sync-manifest.yaml`
  - exports `.claude/hooks/user-level/session-start-recall.sh`
  - exports `.claude/hooks/user-level/session-stop-check.sh`
  - exports `.claude/hooks/user-level/README.md`
  - exports `.claude/hooks/user-level/claude-settings.template.json`
- `.claude/hooks/user-level/claude-settings.template.json`
  - portable Claude hook template for `~/.claude/settings.json`
  - uses `$HOME/.claude/hooks/...`, not maintainer machine absolute paths
- `scripts/check-env-port-drift.test.mjs`
  - adds static guard that the manifest exports both scripts and the portable settings template
  - validates the template is valid JSON and contains no `/Users/...` or Windows `C:\Users\...` paths
- `.claude/hooks/user-level/README.md`
  - points users at the new template

## Why

Original pain: open-source users can appear to have Cat Cafe installed while Claude/Codex user-level hooks are not actually wired. Phase A+B made runtime detection and explicit sync possible; AC-C5 makes the open-source export carry the hook truth source, so `clowder-ai#614` can be closed through the fixed-internal to synced path.

Original requirements source: `docs/features/F180-agent-cli-hook-health.md`

Original requirement excerpts:

> 我们的hook 是不是在开源社区都没生效 因为没配置到 codex 和 claude 等等的配置文件？
> 新建thread 如果检测到hook没安装点击一下同步安装啊！
> 新用户 记得考虑如果是安装包的？ 这个场景你现在的设计cover了吗？

## Tradeoff

- I exported a template under `.claude/hooks/user-level/` instead of exporting the home repo's project-level `.claude/settings.json`; the existing project settings file contains Cat Cafe project-specific hooks and is not the user-level SessionStart/Stop template AC-C5 needs.
- I kept this slice scoped to outbound manifest/template export. Source install and desktop first-run behavior remain separate Phase C ACs, not mixed into this commit.
- I used static manifest tests rather than a full real sync into `clowder-ai`; the sync script already has parser/validation coverage, and this change is specifically about allowlist membership plus template portability.

## Open Questions

1. Is `.claude/hooks/user-level/claude-settings.template.json` the right template path, or do you want the template name/location adjusted before this lands?
2. Should AC-C5 also export a Codex `hooks.json` template, or is that intentionally excluded because F180 Phase A+B renders Codex hooks from the target machine's current home path?

## Quality Gate Evidence

- RED: `node --test scripts/check-env-port-drift.test.mjs` failed on the two new F180 manifest tests before implementation.
- GREEN: `node --test scripts/check-env-port-drift.test.mjs` passed after implementation: 63 tests, 0 failures.
- `pnpm check:env-ports` passed: 63 tests, 0 failures.
- `pnpm check` passed: biome, feature truth, skills manifest, env checks, start-profile isolation, pre-merge gate tests, guide catalog, followup-tail scan.
- `node scripts/check-hotfix-pattern.mjs`: `hotfix=false`.
- `node scripts/check-fallback-layers.mjs`: no fallback pattern changes detected.
- Root artifact guard: no root-level media/design artifacts in worktree or `origin/main...HEAD`.

## Review Focus

Please review:

1. Whether the manifest entries really satisfy F180 AC-C5 despite the existing `.claude/` exclusion.
2. Whether the Claude settings template is portable and safe for open-source users.
3. Whether the tests are placed in the right static sync guard file and are strict enough without overfitting.

Expected verdict: LGTM or changes-requested with P1/P2 list.

[砚砚/GPT-5.5🐾]
