---
feature_ids: [F251]
related_features: [F059, F116, F168, F238]
topics: [open-source, outbound-sync, provenance, community, harness]
doc_kind: spec
created: 2026-06-25
tips_exempt: 内部 sync 管道硬门禁，对用户透明无可见动作面
---

# F251: Public Target Delta Preservation Gate

> **Status**: in-progress | **Owner**: 缅因猫(砚砚) + 布偶猫(宪宪) | **Priority**: P1

## Why

> 铲屎官原话（2026-06-25 14:29 UTC）："我们家经常 intake 回来 pr 然后全量同步出去之后改坏别人的功能 不下十次了。这个其实很难知道是因为 intake 回家出现的问题把人家丢了还是后续哪里演进的时候出现的问题。"

clowder-ai 不是 cat-cafe 的 git fork，也不是简单镜像；它是有 1.8k stars、社区 PR、独立用户的公开发布仓。当前 `sync-to-opensource.sh` 用 `rsync -a --delete`（line 521）做 outbound sync，工具层是无脑覆盖——一旦 clowder-ai 在上次同步后产生 delta（社区 PR、maintainer quickfix、bot），rsync 会静默抹回去。SOP 层的 Community Diff Guard（`refs/opensource-ops-outbound-sync.md` Step 1.5）是 V1 手动 + 依赖 ledger 真实性 + 视野只覆盖 social-PR-centric 类，盲区一大堆。

教科书证据：clowder-ai#723（mindfn / 吴浪审计）→ 2026-05-19 zts212653 说 "All 17 visual normalization items shipped via sync PR #726" → 2026-05-20 mindfn 复查发现 "#726 同步后核心视觉问题全部仍在"——sync 把家里 17 项修复又抹回去了。

## What

### Scope Boundary

Phase A 只挡 **C1/C2 类 public target delta preservation**：clowder-ai 在上次 sync 后已经有目标侧 delta，而本次 export 会把它删掉、回退或冲突。它不挡 **C3 家里演进回归**：cat-cafe 自己把共享行为改坏后同步出去、且 clowder-ai 目标侧没有独立 delta 的情况。C3 需要 Phase B Community Contract Registry、dogfood、社区反馈和 hotfix 兜底。Task 1 的 synthetic fixtures 只证明 classifier 边界；在 AC-A5 历史事故 replay fixture BLOCK 住真实 #720/#726 类事故前，V1 不能宣称 anti-placebo 成立。

**C4 sibling — sync exclude rule misses runtime asset**（2026-06-25 宪宪发现并修复）：另一类 outbound sync 漏水不属于 Phase A scope 但症状相邻——`sync-to-opensource.sh` 用 `--exclude='docs/'` 一刀切再用一组 include 通道（decisions allowlist / features 结构化导出 / SOP / BACKLOG 等）放行。如果 `packages/api/src` 在运行时 readFileSync 一个 docs/* 文件，但**没有任何通道覆盖**，target 永远撞 404；三方树（base/theirs/ours）都没有这个文件，Phase A gate 检测不到 delta（无可保护的差异）。事故来源：`clowder-ai#1025` —— `docs/services-offline-install.html` 被 cat-cafe `packages/api/src/routes/services.ts:98` readFile + `InstallPreviewModal.tsx:486` 链接，但 sync 通道一直没覆盖它。修复 = reverse-check guard `scripts/check-sync-docs-runtime-assets.mjs`（扫 runtime references → 对照 sync coverage → 报告孤儿，进 `pnpm check`）+ 新 manifest key `docs_runtime_assets_allowlist` + sync 脚本对应 copy loop（mirror `docs_decisions_allowlist` 模式）。这是 F251 sibling sub-task（同主题 outbound sync harness 治理），不占 Phase 编号、不抢 Phase A/B 注意力。

### Phase A: Public Target Delta Preservation Gate (V1)

在 public byte-space 做三方树对比：`base` = 上次成功 sync 落到 clowder-ai 的 commit（来自 `sync/*` tag 或 first-parent 解析），`theirs` = clowder-ai 当前 HEAD，`ours` = cat-cafe 本次 export 后的 public tree。逐 path 判定，target-only delta 在 ours 里消失/回退 = BLOCK；双边冲突 = BLOCK；binary/delete/rename = BLOCK；override 需写 reason 入 provenance，单次 sync override > 3 触发 CVO approval alarm。

实施细节、Acceptance Test Matrix、Implementation Tasks、Schema 见 `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`。

### Phase B: Community Contract Registry v0

3-way gate 看不见 "家里改家里回归"（clowder-ai 那边没动）。补一层 Community Contract Registry，每个社区高价值 issue/PR 进入一个 contract：用户可见行为、对应测试/截图/手工验收。outbound 前 replay contract。**Registry 不是银弹**——只治"有意识守护的高价值行为"，治不了"没意识到要守护的盲区行为"；盲区靠 dogfood + 社区反馈 + hotfix 兜底。

### Phase C: V1.5+ 演进（不强制 V1 完成）

V1.5 path ownership（sync-managed / target-owned / mixed） → V2 hunk-level conflict → V3 半自动 resolve queue。non-blocking。

## Acceptance Criteria

### Phase A（Public Delta Gate V1）

- [x] AC-A1: Full sync fails before touching the real `clowder-ai` target when any sync-managed path has an unpreserved target delta. — wired in Task 4a (PR #2591 squash `c8b99a708`); production gate runs after Step 5b validation, before Step 5c `sync_filtered_into_target`, fail-closes with `exit 1`.
- [x] AC-A2: Gate runs in public byte-space after export/sanitization, before `sync_filtered_into_target`. — Task 4a uses pristine `$FILTERED_DIR` (post-export, pre-rsync) so target byte-space matches what would land on clowder-ai.
- [x] AC-A3: Gate emits machine-readable JSON + human-readable Markdown reports with per-path classification. — Task 3 report writer + Task 4a writes both artifacts to `$SOURCE_DIR/docs/ops/` (dry-run uses `mktemp -d` to avoid pollution).
- [ ] AC-A4: Override requires explicit reason, written to provenance; > 3 overrides per sync triggers CVO approval alarm. — DEFERRED to Task 4c. Current path: `--skip-delta-gate` flag + CVO sign-off documented in sync PR body.
- [x] AC-A5: 至少一个高置信历史事故（clowder-ai#723 audit of #720 sync 覆盖 F190 17 项视觉）reconstructed 成 dry-run fixture，V1 gate 必须 BLOCK 才算通过（anti-placebo）。 — Task 4b (PR #2601 squash `d865b4472`) frozen 3-way byte-state fixture from real `89cc0f220` squash commit at `scripts/_fixtures/f251-replay-clowder-ai-720/`. Replay test asserts `result.status === 1` + `blockCount >= 20` + 3 P1 paths (AppShell/ChatContainer/HubListModal) match `mode=/block$/`. Wired into `pnpm check` via `check:sync-public-delta-gate` (KD-10). **Anti-placebo gate sealed.**
- [ ] AC-A6: V1 部署 1 个月后跑 retroactive dry-run eval；C1a/C1b 历史事故必须 BLOCK，漏挡则重开 gate design。 — pending V1 deployment + 30 days; `docs/ops/community-sync-incident-ledger.json` 7 C1a/C1b candidates ready for replay.

### Phase B（Community Contract Registry v0）

- [ ] AC-B1: `docs/ops/community-contracts.json` schema 定型 + V0 contracts ≥3 条（来自 A 量化高优先级事故）。
- [ ] AC-B2: `scripts/check-community-contracts.mjs` 实施，sync 前 warning（非 hard block）。
- [ ] AC-B3: 文档明确 "Registry 非银弹" 边界，列出靠 dogfood/hotfix 兜底的责任分界。

## Tips Contribution（F244）

- [ ] Tips 暂无（F251 是 sync 管道内部 harness，对最终用户透明）；tips_exempt 见下方。
- tips_exempt: 内部 sync 管道硬门禁，对用户透明无可见动作面。

## Dependencies

- **Related**: F059（Cat Café 开源计划 umbrella，done）、F116（开源运营 skill）、F168（社区运营看板）、F238（双向边界对称 / brand-dictionary）

## Risk

| 风险 | 缓解 |
|------|------|
| Override 变成绕过 gate 的逃生门 | override count > 3 触发 CVO approval alarm（INV-3）+ override 全部写入 provenance 可审计 |
| Baseline 解析失败导致 fail-open | INV: missing baseline → fail-closed（不允许 fall back 到无 base 模式） |
| Task 1 unit fixtures 被误读成历史 replay fixture | Scope Boundary 明确区分 synthetic classifier fixtures 与 AC-A5 历史事故 replay；AC-A5 未通过前不宣称真实事故可挡 |
| Task 2 baseline resolver 选错 base，导致 classifier 正确但 gate 语义错 | KD-2/INV-1 钉死 baseline 来源；Task 2 必须验证 `sync/*` tag / landed sync commit 优先，不用 `target_head_sha` |
| 历史回归 fixture 不能 catch 真实事故 = 安慰剂 gate | AC-A5 强制至少一个历史 dry-run replay 通过；云端砚砚 Pro failure-mode audit 双保险 |
| Contract Registry 被当银弹用 | spec 明示边界（治"有意识守护行为"，不治盲区行为） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Generated/provenance allowlist 来源（path glob vs 显式列表 vs sync 脚本现有 restore 集合） | ⬜ 实施阶段自决 |
| OQ-2 | V1 → V1.5 path ownership 是否在 V1 内一并交付，还是拆 Phase | ⬜ A 量化数据回来后判 |
| OQ-3 | Manual Community Contract 何时升级为 hard release blocker | ⬜ CVO（已写 plan Open Questions） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | V1 不替换 `rsync --delete`，只在 sync 前加 preservation gate | 减小爆炸面；rsync 已有验证路径不破坏 | 2026-06-25 |
| KD-2 | base 用 `sync/*` tag / landed sync commit，不用 `.sync-provenance.json.target_head_sha` | target_head_sha 是 pre-sync parent，下次 gate 用它会把上次 sync 本身误判成 target delta | 2026-06-25 |
| KD-3 | Override count > 3 触发 CVO approval alarm | 防 override 变绕过逃生门（同样命运 SOP V1 手动 Guard） | 2026-06-25（宪宪边界补充） |
| KD-4 | gateCoverage 多选标签，C1 拆 C1a/C1b | 一个事故可同时 covered_by_v1 + needs_contract_registry；maintainer self-quickfix 严重程度不同于社区被改坏等家修 | 2026-06-25（宪宪边界补充） |
| KD-5 | AC-A5 Historical Regression Replay 必须通过才算 V1 验收 | 不能在 dry-run 标出真实事故 = 安慰剂 gate | 2026-06-25（云端砚砚 Pro review）✓ satisfied by Task 4b (2026-06-27) |
| KD-6 | AC-A6 one-month anti-placebo eval | V1 不能只在 forward fixtures 里绿；retroactive C1a/C1b 漏挡必须回头改 gate | 2026-06-25（云端砚砚 Pro review） |
| KD-7 | Report contract uses `version: 1` plus `reportKind`, repo constants, `syncModule`, nested resolver `baseline`, and `exportedHead` | Task 4 needs one report schema truth source; nested baseline preserves Task 2 resolver diagnostics, and exportedHead records the actual candidate public byte-space tree | 2026-06-26（Task 3 review） |
| KD-8 | Task 4b uses frozen 3-way byte-state fixture committed to `scripts/_fixtures/`, NOT live clowder-ai fetch | CI must be hermetic + deterministic; live fetch would couple test pass to clowder-ai branch state; frozen fixture documented with provenance + extraction script for re-generation | 2026-06-26（Task 4b spec） |
| KD-9 | Task 4b targets `clowder-ai#723` evidence (squash commit `89cc0f220`), not `#720` directly | `#720` is the bad sync PR; `#723` is mindfn's audit that *documents* the regression. The byte evidence lives in `#723.evidence.affectedPaths` + extracted from `89cc0f220^1` (theirs = clowder-ai main pre-sync) vs `89cc0f220` itself (ours = post-bad-sync state — the squash commit IS the synced bytes; no `^2` exists because squash is single-parent) | 2026-06-26（Task 4b spec, corrected by Task 4b R0 cross-review 砚砚 P1） |
| KD-10 | AC-A5 replay test is wired into `pnpm check` via `check:sync-public-delta-gate` script that runs all 4 delta-gate test files (classifier + cli + wire + replay) | Without persistent harness wiring, AC-A5 silently rots after merge — replay test only protects until next commit. Plan Step 3 "wired as required test" demands this | 2026-06-26（Task 4b R0 cross-review 砚砚 P1） |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-25 | 立项；CVO 拍 F251 anchor；plan 初稿、云端 Pro review、A 量化首批启动 |
| 2026-06-25 | Task 0 incident ledger v0 landed on main (`d71669cd9`); `docs/ops/community-sync-incident-ledger.json` now seeds AC-A5 replay candidates, but the replay fixture is not validated until Task 4 wires the gate |
| 2026-06-25 | Task 1 pure classifier merged via PR #2554 (squash `606cd63d`); classifier + fixtures landed, Phase A sync wiring still pending |
| 2026-06-25 | Task 2 baseline resolver merged via PR #2566 (squash `3eb52c60`); baseline selection now resolves explicit / reachable mirrored `sync/*` refs / landed sync provenance, Phase A sync wiring still pending |
| 2026-06-25 | Task 3 report writer merged via PR #2584 (squash `8b94fa31`); JSON/Markdown report builder + append-only artifact safeguards landed, but AC-A3 still waits for Task 4 sync wiring to emit reports in real runs |
| 2026-06-25 | C4 sibling sub-task merged via PR #2571 (squash `5ebc9f09d`); reverse-check guard `scripts/check-sync-docs-runtime-assets.mjs` + `docs_runtime_assets_allowlist` manifest key + sync-to-opensource.sh dir-prefix copy. Fixes clowder-ai#1025 root cause (sync `--exclude='docs/'` dropped `docs/services-offline-install.html`). Review chain: local 砚砚 R0/R1/R5 + cloud R0/R2/R3 (sealed by LL-072 at R5 — single-round 50% stale replay). |
| 2026-06-26 | **Task 4a sync wire merged via PR #2591 (squash `c8b99a708`); AC-A1/A2/A3 NOW LIVE in production sync.** Production gate runs from `sync-to-opensource.sh` after Step 5b validation, before Step 5c real rsync, fail-closes with `exit 1`. `--skip-delta-gate` flag is the only opt-out (independent of `--skip-validate`). Review chain: 砚砚 R0/R2/R7 local cross-review + opus48 final-SHA ship-readiness audit + cloud R0–R7 (R3 9 P1/P2 plan-layer re-design, R4–R5 file-size + sourceHead + trailing-slash + binary detection, R6 test fixture split, R7 砚砚 P1 `.sync-provenance.json` generated-or-provenance allowlist). **AC-A4/A5/A6 remain DEFERRED** (4c override-with-reason, 4b historical replay, 1-month retroactive eval). |
| 2026-06-26 | Task 4b kicked off (anti-placebo gate). Spec at `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md` Task 4b section — frozen 3-way byte-state fixture from `clowder-ai#723.evidence` (sync merge `89cc0f220`, 6 path globs, `2 P1 + 10 P2 + 5 P3`). Approach: extract once → commit fixture → replay test asserts BLOCK. AC-A5 stays UNCHECKED until replay test pass on main. |
| 2026-06-27 | **Task 4b sync replay merged via PR #2601 (squash `d865b4472`); AC-A5 NOW LIVE — anti-placebo gate sealed.** Real `clowder-ai#723` 3-way byte-state (476 KB frozen fixture, 23 affected paths) replay test PASSES via Task 4a CLI offline (`--no-fetch`). 20/23 paths BLOCK (18 target-added-would-delete + 1 both-changed-conflict + 1 delete-or-rename) + 3 P1 paths (AppShell/ChatContainer/HubListModal) all match `mode=/block$/`. Persistent guard wired into `pnpm check` via `check:sync-public-delta-gate` (KD-10); script stripped from public export via internalScripts (sync script + env-ports test mirror, R2 P1). Review chain: 砚砚 R0 (P1.1 pnpm check wire + P1.2 squash semantics) / R2 (P1 public strip) / R3 APPROVE + cloud R0–R3 (R1 P2 fixture byte SHA validation + R2 P2 clear-before-extract; R3 clean) + opus48 final-SHA audit. **Phase A AC-A1/A2/A3/A5 LIVE; AC-A4 (Task 4c override-with-reason) + AC-A6 (30-day retroactive eval) still DEFERRED.** |

## Review Gate

- Phase A: 砚砚 (gpt-5.5) 写实施 + 宪宪 (Opus 4.7) cross review + 云端砚砚 Pro failure-mode audit
- Phase B: Contract Registry schema 需独立 design review（不与 Phase A 同行）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Plan** | `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md` | 实施细节 + Acceptance Test Matrix + Schema |
| **Feature** | `docs/features/F059-open-source-plan.md` | 开源主题 umbrella（done） |
| **Skill** | `cat-cafe-skills/refs/opensource-ops-outbound-sync.md` | 当前 SOP V1 手动 Guard（待升级为工具硬门禁，AC-A 落地后改） |
| **Memory** | `feedback_feat_anchor_needs_cvo_explicit_signoff.md` | 锚点 P0 反射触发本 spec 立项 |
| **Incident** | clowder-ai#723 / #720 / sync PR #726 | 教科书证据：sync 把家里 17 项视觉修复抹回去 |
