# Review Request: F253 Phase B — Fresh-Context Pre-Review + Reviewer Delta Metric

Review-Target-ID: f253-phase-b
Branch: worktree-f253-phase-b-fresh-context
PR: #2612

## What

F253 QC Loop Phase B: 5 doc files changed (1 new skill + 4 modifications). No runtime code.

1. **New `fresh-context-review/SKILL.md`** — author-triggered pre-review scan flow
2. **manifest.yaml** — register skill (sop_step 2.5, optional)
3. **SOP.md** — add optional Step ②½
4. **review-request-template.md** — add Fresh-Context Findings section
5. **receive-review/SKILL.md** — add Reviewer Delta Annotation (FC tags)

## Why

Enable cognitive load reduction for formal reviewers + establish measurement for cross-model review value. Phase B of F253 QC Loop (Phase A already merged: PR #2608, #2610).

## Original Requirements（必填）
> "靠 QC 把废品拦住" + "偷方法，不偷口号" + "QC 触发可以自动，授权不能自动"
- 来源：`docs/features/F253-qc-loop.md` — spec 讨论收敛（宪宪 + 砚砚 + 铲屎官）
- **请对照 spec Phase B section 判断交付物是否解决了认知负荷减负 + delta metric 需求**

## Tradeoff

考虑过只在 SOP.md 加一段（不建新 skill）——但 fresh-context 流程有独立的触发决策表、finding 格式、身份约束，内容量足够独立成 skill。SOP.md 只放指针。

## Architecture Ownership（必填）
Architecture cell: harness-eval (extend)
Map delta: none
Why: 纯 SOP/skill 文档扩展，不新增运行时 infra

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（无新 Store/Queue/Router 等）
- fresh-context-review 是否真的只是文档，不引入运行时依赖

## Open Questions

### 技术 OQ（给 reviewer）
1. fresh-context 触发决策表的阈值（≥3 files, ≥50 行）是否合理？太低会增加摩擦，太高会失去价值
2. FC:covered / FC:new / FC:N/A 三个 tag 是否足够？是否需要更细粒度？

### 价值 OQ（给 CVO，如有）
无——这是已确认的 spec Phase B，方向已定。

## Fresh-Context Findings（如有）
未触发（doc-only PR, trivial scope）。

## Next Action
请 review 5 个文件的文档内容，重点关注：
- "finding generator, not approval authority" 约束是否在所有相关位置一致
- Delta metric annotation 格式是否实用（会不会增加 reviewer 摩擦）
- SOP/manifest 链路是否正确（quality-gate → fresh-context → request-review）

## Review Sandbox（必填）
N/A — doc-only PR，无需运行环境。Reviewer 直接读 diff。

## 自检证据

### AC 合规
- AC-B1 ✅: `fresh-context-review/SKILL.md` 存在，"finding generator" 出现 4 次，"author 触发" ownership 出现 6 次
- AC-B2 ✅: `FC:covered / FC:new / FC:N/A` 在 receive-review 出现 7 次，review-request-template 含 FC 节

### 验证
- YAML validation: `manifest.yaml` parsed successfully (node yaml + python yaml)
- No runtime code: `git diff --stat` shows only `.md` and `.yaml` files

### 相关文档
- Plan: `docs/plans/2026-06-27-f253-phase-b-fresh-context-pre-review.md`
- Feature: F253 — `docs/features/F253-qc-loop.md`
