---
doc_kind: review-request
created: 2026-05-22
source_pr: clowder-ai#742
target_pr: cat-cafe#1834
intent_issue: cat-cafe#1833
---

# Review Request: intake clowder-ai#742

Review-Target-ID: intake-clowder-742
Branch: `fix/intake-clowder-742`
PR: https://github.com/zts212653/cat-cafe/pull/1834
Current HEAD: `b10b2b605dc4be2df2ca2448840864403d8a47f1`

## Original Requirements

铲屎官原话：

> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家 记得一定要好好看看intake skills 大多数猫猫都会犯错 而且是 从以前到现在 每次 intake都会有各种错误 没有一次不是

## Scope

Intake `clowder-ai#742` / `clowder-ai#743` back into Cat Cafe:

- Codex Stop hook emits Codex-compatible JSON only when invoked with `--codex-json`.
- Codex hook renderer appends `--codex-json` to Stop hook command.
- `memory-navigation` skill gains YAML frontmatter.
- Skill manifest checker rejects manifest skills whose `SKILL.md` lacks YAML frontmatter.
- Home-only checker tests cover the new guard.

## Architecture Ownership

Architecture cell: agent hooks / skills manifest validation
Map delta: none
Why: extends existing hook rendering and skill manifest validation boundaries; no new store, queue, router, adapter, dispatcher, or binding.

## Intake Guard Focus

- Intent Issue: https://github.com/zts212653/cat-cafe/issues/1833
- Source PR: https://github.com/zts212653/clowder-ai/pull/742
- Source merge commit: `1413e6d577b225e07f696fc83924ee2a9aec2d30`
- Path Guard: final diff should be the 5 source files plus explicit exceptions:
  - `scripts/check-skills-manifest.test.mjs`
  - `docs/mailbox/2026-05-22-intake-clowder-742-review-request.md`
- Overlap Guard: verify home-only differences were preserved:
  - `cat-cafe-skills/memory-navigation/SKILL.md` keeps the internal plan link.
  - `packages/api/test/agent-hooks.test.js` keeps home localhost ports instead of public sanitized ports.
- Brand Guard: no brand-sensitive files changed; `--validate-inbound` passed.

## Validation Already Run

```bash
node --test --test-name-pattern 'fails when manifest skill SKILL.md is missing YAML frontmatter' scripts/check-skills-manifest.test.mjs
# RED before implementation: Missing expected exception

node --test scripts/check-skills-manifest.test.mjs
# 13/13 pass

pnpm --dir packages/api build && pnpm --dir packages/api exec node --test test/agent-hooks.test.js
# 17/17 pass

pnpm check:skills:manifest
# PASS check-skills-manifest: 40 skills validated; existing MCP advisory warnings only

bash scripts/intake-from-opensource.sh --validate-inbound
# No brand violations detected

bash -n .claude/hooks/user-level/session-stop-check.sh
# exit 0

pnpm check
# exit 0

pnpm lint
# exit 0; existing cafe/no-hardcoded-colors warnings in unrelated web files

pnpm -r --if-present run build
# exit 0; existing web lint warnings only
```

Manual hook proof:

```bash
printf '{"cwd":"<temp git repo>"}' | bash .claude/hooks/user-level/session-stop-check.sh --codex-json | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'
# parsed object contains systemMessage with 收工自检 and warning filename
```

## Reviewer Ask

Please leave a formal GitHub PR comment on `cat-cafe#1834` that:

- confirms review covers current HEAD `b10b2b605dc4be2df2ca2448840864403d8a47f1`;
- checks the file-level decisions in `cat-cafe#1833`;
- verifies source intent is present and home invariants are preserved;
- states which validation command(s) you reran.

[砚砚/GPT-5.5🐾]
