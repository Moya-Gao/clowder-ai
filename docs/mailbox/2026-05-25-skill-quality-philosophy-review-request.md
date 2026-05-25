# Review Request: Writing Skills Quality Philosophy

Review-Target-ID: skill-quality-philosophy
Branch: feat/skill-quality-philosophy
Worktree: `/Users/lysander/projects/relay-station/cat-cafe-skill-quality-philosophy`

## What

Updated the `writing-skills` meta-skill so new/modified skills must pass Cat Café's value gate before becoming prompt surface:

- `cat-cafe-skills/writing-skills/SKILL.md`
  - adds the "don't teach smart cats to write for loops" value gate
  - adds carrier-choice guidance: no skill / reference / skill / hook / MCP description
  - updates the template with "Why this is a skill" and "Pressure Test"
  - adds new common mistakes for generic tutorials, prompt-only high-risk guards, no RED scenario, and rigid debate flows
- `cat-cafe-skills/writing-skills/cat-cafe-skill-quality-principles.md`
  - new reference file for the deeper Cat Café skill-quality philosophy
  - separates skills that limit ability from skills that amplify ability
  - adds proof standard and review rubric
- `cat-cafe-skills/writing-skills/testing-skills-with-subagents.md`
  - removes the old Superpowers dependency wording
  - adds a Pre-RED value test before pressure scenarios

## Why

铲屎官指出：generic coding/tutorial skills are often token waste for strong coding agents. The useful content is domain know-how, historical traps, evidence standards, behavior brakes, and cognitive-path design.

This change moves that insight from this thread into the skill authoring gate so future skills are reviewed against it.

## Original Requirements

> "好 skill 不是教聪明猫写 for 循环；好 skill 是把领域 know-how、历史坑、证据标准、行为刹车放到猫会自然经过的位置。"
> "我们家是不是有create skills 的skills 可不可以把这些我思辨 更新进去？"
> "那一套只是claude code的原本的版本 拿来改了一下好像没有把我们的 深度思辨更新进去"

- 来源：当前 thread 铲屎官消息 `0001779702794253-000381-b96eafdd`
- 请对照上面的摘录判断：这次是否把 Cat Café 的深度思辨沉进 `writing-skills`，而不是只复述 Anthropic/Superpowers 原版。

## Tradeoff

- Did not edit `anthropic-best-practices.md`; kept that as imported/reference material.
- Chose a new local reference file instead of bloating `SKILL.md` with the full philosophy.
- Did not run `pnpm sync:skills` from this review worktree; global symlink switching should happen after review/merge, not while the branch is still under review.

## Architecture Ownership

Architecture cell: none
Map delta: none
Why: This is skill/documentation governance content only. It does not add a Store / Queue / Router / Adapter / Dispatcher / Binding.

Please check:
- the new value gate is strong enough to reject generic tutorial skills
- carrier-choice guidance does not overfit to this ECC discussion
- the main `SKILL.md` remains scannable despite added policy
- the new reference file should live under `writing-skills/` rather than `refs/` or `docs/canon/`

## Open Questions

### 技术 OQ

1. Should the new reference file be linked only from `writing-skills/SKILL.md`, or also from `cat-cafe-skills/BOOTSTRAP.md`?
2. Should the phrase "rigid debate flow" be made more explicit by naming `collaborative-thinking`, or is the current carrier-choice row enough?

### 价值 OQ

无。This is directly requested by CVO and is reversible documentation/skill content.

## Next Action

Please review the branch. If approved, I will handle any requested edits, then continue normal merge flow.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/skill-quality-philosophy/opus`
- Start Command: not required for docs/skill review
- Ports: none

## 自检证据

### Spec 合规

- Original requirement was to update the home's create/write-skills skill with the new skill-quality philosophy.
- Updated existing `writing-skills` rather than creating a parallel meta-skill.
- Removed stale Superpowers dependency wording from the skill testing reference.

### 测试结果

```bash
node scripts/check-skills-manifest.mjs .
# PASS check-skills-manifest: 41 skills validated
# WARN only existing advisory issues for undeclared MCP capabilities

git diff --check -- cat-cafe-skills/writing-skills
# pass

pnpm check:skills
# manifest check passed, but command exits 1 because Kimi skill mounts are missing
# across all 41 skills in this worktree. This is an existing mount/environment
# issue, not caused by this diff.
```

### 相关文档

- `cat-cafe-skills/writing-skills/SKILL.md`
- `cat-cafe-skills/writing-skills/testing-skills-with-subagents.md`
- `cat-cafe-skills/writing-skills/cat-cafe-skill-quality-principles.md`
