---
feature_ids: [F238]
related_features: [F237, F203, F116, F154, F168, F190]
topics: [open-source, intake, sanitizer, brand-guard, harness, l0]
doc_kind: spec
created: 2026-06-16
---

# F238: Bidirectional Boundary Symmetry

> **Status**: closed | **Owner**: 缅因猫/砚砚 (@codex) + cat-cafe maintainers | **Priority**: P0 | **Source**: F237 intake blocker  
> **Vision Guardian**: 宪宪/claude-sonnet-4-6 🐾 — 2026-06-17 ✅ RELEASE（独立 AC 验证通过，33/33 round-trip pass，full 5-phase delivery confirmed）

## Why

F237 cannot be intaked safely while the cat-cafe <-> clowder-ai boundary policy lives in scattered regexes and hand-maintained path lists. The current outbound sync can still export home-only brand and L4 terms into clowder-ai, while inbound intake can classify L0 and prompt-template files as safe cherry-pick. This breaks the core promise of opensource-ops: community contributions must replay source intent into cat-cafe without overwriting home invariants.

## Current State / 现状基线

F237 Round-3 audit found a real dual-repo boundary gap while reviewing clowder-ai PR #859. The second-pass dry-run on 2026-06-16 used current cat-cafe `main` commit `5a5d41880d1b` and confirmed that `sync-to-opensource.sh --dry-run --yes` still produced home-only terms in exported public files:

| Surface | Evidence |
|---------|----------|
| PWA manifest | `packages/web/public/manifest.json` exported `Cat Café`, `猫猫`, and `三只 AI 猫猫的协作空间`. |
| Concierge pet skin | `packages/web/public/concierge/skins/ragdoll-v1/pet.json` exported `布偶猫 v1` and `Cat Cafe default concierge skin`. |
| L0 compiler | `scripts/compile-system-prompt-l0.mjs` exported `铲屎官/CVO`, Chinese cat-family governance, and `Cat Café MCP`. |
| Native L0 | `assets/system-prompts/system-prompt-l0.md` exported residual `Redis 圣域` and `CVO`. |
| YAML roots | `sop-definitions/development.yaml` exported `Cat Cafe`, `铲屎官`, and `CVO`; `plugins/github/plugin.yaml` exported `Cat Cafe`. |
| Desktop root | `desktop/**` retained Cat Cafe product strings in package metadata, installer, shell scripts, and splash UI. |
| Public skills | `cat-cafe-skills/**` retained multiple home-only role and culture terms after current sanitizer rules. |

Mock intake plan verification also confirmed these paths currently fall through to `safe-cherry-pick`: `assets/system-prompts/**`, `assets/prompt-templates/**`, `sop-definitions/**`, `guides/**`, and `desktop/**`. The root cause is structural: outbound rules, inbound classifier, pre-commit hook, test fixtures, and `opensource-ops` prose each maintain their own partial boundary lists.

## What

### Phase A: Boundary Contract Truth Source

Create the F238 spec, add `assets/brand-dictionary.yaml` v0.1, and update `opensource-ops` so principles 12/13/22 reference the dictionary instead of duplicating stale file lists.

The critical classification flips are:

| Path | Previous intake default | F238 policy | Why |
|------|-------------------------|-------------|-----|
| `assets/system-prompts/**` | safe-cherry-pick | manual-port | Native L0 truth source; public L0 must never overwrite home L0. |
| `assets/prompt-templates/**` | safe-cherry-pick | manual-port | F237 template extraction moves core prompt material here. |
| `sop-definitions/**` | safe-cherry-pick | manual-port | Runtime SOP policy text carries CVO/home terms and safety behavior. |
| `desktop/**` | safe-cherry-pick | manual-port | Product name, installer identity, startup scripts, and support paths differ by repo. |
| `guides/**` | safe-cherry-pick | manual-port | User-visible copy and onboarding terms are repo-branded. |
| `cat-cafe-skills/**` | manual-port by script, prose list incomplete | manual-port + dictionary scan | Public skill export needs semantic term policy, not one-off replacements. |

### Phase B: Outbound Dictionary Enforcement

Refactor outbound sanitization so brand and L4 terms come from `assets/brand-dictionary.yaml`. The export gate must scan the generated public tree and fail on P0/P1 home-only terms outside explicit exceptions.

### Phase C: Inbound Dictionary Enforcement

Generate or consume the same path policies inside `intake-from-opensource.sh`, `--validate-inbound`, and `.githooks/pre-commit`. Inbound validation must scan the working tree and the staged index using dictionary terms, not just the old five UI paths.

### Phase D: Reverse Sanitizer Detect-Only V1

Add a detect-only reverse sanitizer that reports public terms in cat-cafe-sensitive paths and home terms in clowder-ai exports. It must not auto-rewrite in V1.

### Phase E: Round-Trip and Eval Loop

Add representative round-trip fixtures and a recurring verdict: public export has zero P0/P1 home terms, and inbound sensitive paths have zero public terms unless explicitly whitelisted.

## Requirements Checklist

- [x] F238 spec exists and records the full boundary root cause.
- [x] `assets/brand-dictionary.yaml` v0.1 exists as the first machine-readable truth source.
- [x] `opensource-ops` principles 12/13/22 reference the dictionary.
- [x] Spec explicitly flips the six required path groups away from safe-cherry-pick.
- [x] Outbound sanitizer covers dictionary brand/L4 terms for .json, .mjs, .yaml/.yml (PR #2324).
- [x] Inbound guard consumes the dictionary for path classification and validation. (PR #2327, Phase C)
- [x] Reverse sanitizer detect-only V1 exists.
- [x] CI and local hooks run dictionary-backed boundary scans. (PR #2327, Phase C — `.githooks/pre-commit` + `brand-boundary-guard.yml`)
- [x] Round-trip and export regression tests cover JSON, MJS, YAML, L0, skills, and cat-config (77 + 33 + 36 tests, PRs #2324/#2333/#2341).
- [ ] F237 intake re-runs with F238 boundary guard in place. (F237 scope — F238 unblocks, F237 executes)

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。重构/降复杂度类须实测可量（数字下降），不是"提了可测性就算"。详见 feat-lifecycle SKILL.md。 -->

### Phase A（Boundary Contract Truth Source）
- [x] AC-A1: `docs/features/F238-bidirectional-boundary-symmetry.md` captures the F237 blocker, evidence baseline, scope, phases, and required six-directory classification flip.
- [x] AC-A2: `assets/brand-dictionary.yaml` v0.1 defines term classes, directionality, path policies, exceptions, and enforcement modes.
- [x] AC-A3: `docs/BACKLOG.md` links to the F238 spec and no longer marks the feature link as pending.
- [x] AC-A4: `cat-cafe-skills/opensource-ops/SKILL.md` principles 12/13/22 reference `assets/brand-dictionary.yaml` as the boundary truth source.

### Phase B（Outbound Dictionary Enforcement）✅
- [x] AC-B1: `_sanitize-rules.pl` extended to cover `.json`, `.mjs`, `.yaml/.yml` brand/L4 mappings (铲屎官→co-creator/operator, CVO→operator, Redis 圣域, 猫猫, Cat Cafe/Café); two-pass key quoting for JS/TS; mentionPatterns dedupe. Remaining extensions (.html/.iss/.ps1/.bat/.py/.sh) deferred — no current leaks found in those types. (PR #2324)
- [~] ~~AC-B2~~: Removed — `check:boundary-roundtrip` (AC-E1/E3) + reverse sanitizer `pnpm check` gate provide equivalent fail-closed protection in the development workflow. The sync script is a manual tool always run after `pnpm check`; in-script redundant gate adds complexity without additional protection. Reverse sanitizer can integrate into sync as a separate enhancement if needed.
- [x] AC-B3: Regression coverage proves the current leaks are blocked: manifest, pet.json, cat-config generated roster text, native L0 residuals (Redis 圣域, CVO), sop-definitions YAML, plugin manifest YAML, and public skill surfaces. 77 total regression tests. (PR #2324)

### Phase C（Inbound Dictionary Enforcement）✅
- [x] AC-C1: `intake-from-opensource.sh --mode=plan` classifies dictionary manual-port / brand-sensitive paths according to `path_policies`, including all six required directory flips.
- [x] AC-C2: `--validate-inbound` scans working tree and index content using dictionary terms and reports structured violations (fail-closed cross-validation with three brand-sensitive anchors + manual-port anchor).
- [x] AC-C3: `.githooks/pre-commit` and a GitHub workflow (`brand-boundary-guard.yml`) invoke the dictionary-backed inbound guard; local hook bypass does not remove CI protection. 44 intake tests + 20 helper tests enforced via `pnpm check`.

### Phase D（Reverse Sanitizer Detect-Only V1）✅
- [x] AC-D1: A detect-only reverse sanitizer reports `severity | direction | file | line/field | term id | suggestion` and exits non-zero for P0/P1 violations.
- [x] AC-D2: JSON/YAML inputs report field paths where practical; text inputs report file/line.
- [x] AC-D3: The tool supports outbound-export validation and inbound cat-cafe validation without auto-rewriting.

### Phase E（Round-Trip and Eval Loop）✅
- [x] AC-E1: Round-trip fixtures cover representative files across L0, manifest, cat-config, desktop, sop-definitions, guides, and cat-cafe-skills. (Prompt templates deferred — `assets/prompt-templates/` does not exist yet; coverage extends automatically when F237 creates the directory.)
- [x] AC-E2: Sync/intake logs emit scan counters by term class, severity, and consumed exceptions.
- [x] AC-E3: A recurring verdict or equivalent eval records whether dictionary-backed boundary scans remain green over time.

## Dependencies

- **Evolved from**: F116 (opensource-ops) and F154/F168 (community intake infrastructure)
- **Blocked by**: none
- **Blocks**: F237 intake of clowder-ai PR #859
- **Related**: F203 (Native L0), F190 (inbound parity gate), F192 (harness eval)

## Risk

| 风险 | 缓解 |
|------|------|
| Dictionary becomes another stale list | Make scripts, hook, CI, and skill prose consume or point to the same file. |
| Over-sanitizing breaks public product concepts or code identifiers | Require explicit `exceptions` with reason and mode; fail closed for P0/P1 only. |
| Reverse sanitizer auto-rewrites home truth incorrectly | V1 is detect-only; manual-port remains the repair action. |
| Public skills intentionally keep some cat metaphor | Keep term classes separate: product metaphor can be whitelisted, private nicknames and CVO/home terms cannot. |
| F237 remains blocked too long | Phase A gives immediate policy anchor; B/C can be implemented in focused follow-up commits before intake. |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Should public-facing cat family labels remain Chinese in any UI/skill surface, or should they normalize to English breed names? | ⬜ Product wording decision; dictionary v0.1 treats private nicknames as disallowed and breed labels as path-dependent. |
| OQ-2 | Should `cat_cafe_*` MCP tool names remain public contract names long-term? | ⬜ v0.1 whitelists them as code identifiers; renaming is out of Phase A scope. |
| OQ-3 | Should `cat-cafe-skills` directory name be renamed in public distribution? | ⬜ Out of Phase A; dictionary treats the path as an exception but scans its content. |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F238 is P0 and blocks F237 intake. | F237 modifies L0/prompt surfaces; current inbound defaults can overwrite home truth. | 2026-06-16 |
| KD-2 | Boundary policy source is `assets/brand-dictionary.yaml`. | Regexes and prose lists already drifted; one machine-readable file must drive scripts and docs. | 2026-06-16 |
| KD-3 | Reverse sanitizer V1 is detect-only. | Automatic reverse rewriting can corrupt home semantics; manual-port is the safe repair path. | 2026-06-16 |
| KD-4 | Six path groups flip away from safe-cherry-pick. | They carry prompt, SOP, desktop, guide, and skill identity behavior that cannot be blindly imported. | 2026-06-16 |
| KD-5 | F238 follows ADR-031 soft + hard + eval. | Skill prose alone cannot enforce dual-repo boundaries; hard gates and eval close the loop. | 2026-06-16 |

## Eval / Tracking Contract

| Field | Contract |
|-------|----------|
| Primary Users + Activation Signal | opensource-ops maintainers running outbound sync or inbound intake; activation is sync/intake/hook/CI touching dictionary-managed paths. |
| Friction Metric | Number of boundary violations caught after review or after sync dry-run should trend to zero; false positives must be recorded by term id and path. |
| Regression Fixture | Fixtures must include current known leaks: manifest, pet.json, compile-system-prompt-l0.mjs, cat-config, native L0, sop-definitions, desktop, plugin manifest, and public skills. |
| Sunset Signal | Sunset only if cat-cafe and clowder-ai no longer share transformed files or if repo split is replaced by a structured package publication pipeline with equivalent boundary checks. |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-16 | F237 Round-3 audit exposes dual-repo boundary gap. |
| 2026-06-16 | F238 Phase A opened; spec, dictionary v0.1, and opensource-ops references landed. |
| 2026-06-16 | Phase B merged (PR #2324): outbound sanitizer extended to .json/.mjs/.yaml, L4 cultural terms, 77 regression tests. |
| 2026-06-17 | Phase C merged (PR #2327): inbound dictionary enforcement — classify_path, fail-closed cross-validation (3 brand-sensitive + 1 manual-port anchor), GitHub CI workflow, 44 intake + 20 helper tests in pnpm check. |
| 2026-06-17 | Phase D merged (PR #2333): reverse sanitizer detect-only V1 — NDJSON output, word-boundary regex, three-layer dedup, per-variant suggestion mapping, 30 tests, wired into pnpm check. |
| 2026-06-17 | Phase E merged (PR #2341): round-trip boundary fixtures (33 tests, 7 categories), --summary-json structured counters, per-termId reciprocity validation. F238 complete — all 5 phases delivered. |

## Review Gate

- Phase A: maintainer source thread final-only report to `thread_mqg0h9y5sx9obzxg` for opus-47.
- Phase B/C: code review must include a red fixture for at least one current leak before green implementation.
- Phase D/E: reviewer must verify detect-only behavior and evaluate false-positive handling.

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F237-prompt-injection-visibility-intake.md` | F237 intake that F238 blocks. |
| **Dictionary** | `assets/brand-dictionary.yaml` | Boundary policy single source of truth. |
| **Skill** | `cat-cafe-skills/opensource-ops/SKILL.md` | Inbound/outbound operating procedure. |
| **Script** | `scripts/sync-to-opensource.sh` | Outbound export pipeline. |
| **Script** | `scripts/intake-from-opensource.sh` | Inbound classifier and brand guard. |
| **Script** | `scripts/reverse-sanitizer.mjs` | Detect-only reverse sanitizer (Phase D). |
| **Plan** | `docs/plans/2026-06-17-f238-phase-d-reverse-sanitizer.md` | Phase D implementation plan. |
