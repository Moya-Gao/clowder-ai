# Review Request: F253 PR-A2 — Evidence Manifest + Validation Checker

Review-Target-ID: f253-evidence-manifest
Branch: feat/f253-evidence-manifest

## What

Extends merge-gate SKILL.md with two new sections:
1. **Evidence Manifest** — Review Provenance Matrix superset (10 fields, assembled from PR metadata at check time, stateless)
2. **Evidence Validation Checker (Step 6.9)** — 5-point hard gate (E1-E5) between Step 6.8 and Step 7.5a

Also: Quick Reference table + Common Mistakes table updated.

## Why

F253 AC-A3 + AC-A4. The existing merge-gate flow has Review Provenance Matrix but no formal "assemble and verify evidence before merge" step. This adds:
- A structured manifest schema that subsumes the Matrix
- A 5-point validation checklist that blocks merge on evidence gaps

## Original Requirements
> "靠 QC 把废品拦住。就算你们质量比他们好也会有问题的！！"
> "偷方法，不偷口号。"
— 铲屎官 2026-06-25 Kun Chen 调研讨论

- 来源：`docs/features/F253-qc-loop.md` Why 节
- **请对照上面的摘录判断：evidence manifest + validation checker 是否让"拦废品"链路更完整**

## Tradeoff

- Evidence is assembled at check time (stateless reconstruction), NOT stored as a file. Tradeoff: no persistent audit trail (Phase C telemetry will address this), but zero stale-file risk.
- Validation is a manual checklist (cats check and report), NOT an automated script. Tradeoff: relies on cat discipline, but avoids premature automation on a process that's still evolving.

## Architecture Ownership
Architecture cell: merge-gate (extend)
Map delta: none
Why: Adding documentation sections to existing SKILL.md, no new cell/boundary/extension point.

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter

## Open Questions

### 技术 OQ（给 reviewer）
1. E2/E3 的 continuity approval 覆盖范围：当前定义 "localPeerReviewSha 或 cloudReviewSha 覆盖当前 head（含 continuity approval）"——是否清晰？会不会导致猫误以为 pure rebase 不需要任何确认？
2. Evidence Manifest 与 Review Provenance Matrix 的"子集"关系描述是否容易误解为"两份独立的东西要维护"？

### 价值 OQ
无。

## Next Action

请 review SKILL.md diff（69 行 insertions）。重点：
- Evidence Manifest schema 是否完整且不冗余
- E1-E5 五项检查是否覆盖已知 merge 事故
- Step 6.9 插入位置是否正确（6.8 和 7.5a 之间）
- 是否与已有 Review Continuity Guard 逻辑矛盾或重复

## Review Sandbox
N/A — 纯 SKILL.md 文字改动，无 runtime 代码。Reviewer 直接 `git diff origin/main...HEAD` 看 diff 即可。

## 自检证据

### Spec 合规
- AC-A3 (evidence manifest): 10 字段全部定义，含来源 + 说明 ✅
- AC-A4 (validation checker): 5 项 E1-E5 全部定义，含验证方式 + 失败动作 ✅
- Plan 对照：`docs/plans/2026-06-27-f253-phase-a-local-qc-pipeline.md` Task 2 全部步骤完成

### 测试结果
N/A — SKILL.md 是 SOP 文档，不含可执行代码。`pnpm check` 中 biome 报的错误是 main 上预存的格式问题（`content-sanitizer.ts`、`story-annotations.ts`），与本 diff 无关。

### 相关文档
- Plan: `docs/plans/2026-06-27-f253-phase-a-local-qc-pipeline.md` (Task 2)
- Feature: `docs/features/F253-qc-loop.md`
- PR-A1 (predecessor): PR #2608 (merged) — `pnpm gate --auto-fix`

---
Cloud review: **exempt** per CVO directive (SKILL.md-only, 云端看不懂家里 SOP 语境)
