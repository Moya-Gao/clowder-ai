# F253 Phase B: Fresh-Context Pre-Review — Implementation Plan

**Feature:** F253 — `docs/features/F253-qc-loop.md`
**Goal:** Document the fresh-context pre-review flow as a skill, and add reviewer delta metric annotation to the review template — enabling author-triggered cognitive load reduction for formal reviewers, with measurable cross-model review value.
**Acceptance Criteria:**
- AC-B1: fresh-context pre-review 流程文档化（skill 或 SOP），明确标注"finding generator, not approval authority"，明确 ownership = author 触发（验证：读 skill 文档）
- AC-B2: reviewer delta metric 有收集机制——正式 reviewer 的 findings 中可标注"fresh-context 已覆盖 / 新发现"（验证：review 模板含标注字段）
**Architecture cell:** harness-eval (extend)
**Map delta:** none
**Map delta why:** Fresh-context is a new SOP step (documentation) within the existing review skill chain; no new runtime infra, no new cell needed.
**Architecture:** Extend the existing quality-gate → request-review → receive-review skill chain with an optional fresh-context step between quality-gate and request-review. New skill `fresh-context-review/SKILL.md` documents the flow. Reviewer delta metric is an annotation format added to `receive-review` and `review-request-template.md`. No runtime code — pure SOP/skill documentation.
**Tech Stack:** Markdown (skill docs), YAML (manifest)
**前端验证:** No — pure toolchain/SOP

---

## Architecture归一 Self-Check

铲屎官 push back: "你们最好想别特喵自己造一套轮子 思考架构归一能不能有！"

| 检查 | 结果 |
|------|------|
| 新增 runtime 命令？ | ❌ 无。纯文档/SOP |
| 新增存储/数据模型？ | ❌ 无。delta metric 是 review 模板内的 annotation，无独立存储 |
| 复制现有功能？ | ❌ 无。扩展现有 skill chain（quality-gate → **fresh-context** → request-review） |
| 新增 infra 依赖？ | ❌ 无 |

## Scope Boundary

**In scope:**
- `fresh-context-review/SKILL.md` — new skill documenting the flow
- `manifest.yaml` — register new skill in chain
- `SOP.md` — add optional step reference
- `refs/review-request-template.md` — add "Fresh-Context Findings" section
- `receive-review/SKILL.md` — add reviewer delta annotation format

**NOT in scope:**
- Automated fresh-context triggering (that's Phase C territory, if ever)
- Any runtime code / scripts / hooks
- Evidence manifest changes (Phase A, already merged)

## Implementation Tasks

### Task 1: Create `fresh-context-review` Skill

**Files:**
- Create: `cat-cafe-skills/fresh-context-review/SKILL.md`

**Step 1: Write the skill document**

Core content structure:
```markdown
---
name: fresh-context-review
description: >
  Author-triggered fresh-context scan of PR diff before formal review.
  Finding generator, NOT approval authority.
  Use when: quality-gate passed, about to request-review, and PR is non-trivial.
  Not for: formal review verdict, approval, or merge decision.
  Output: Finding list (posted as PR comment or review request attachment).
triggers:
  - "fresh context"
  - "pre-review scan"
  - "找新眼看看"
---

# Fresh-Context Pre-Review

> **SOP 位置**: 可选步骤，在 `quality-gate` (Step ②) 之后、`request-review` (Step ③a) 之前。
> **上一步**: `quality-gate` | **下一步**: `request-review`

## ⚠️ 身份约束（硬规则）

**This is a FINDING GENERATOR, not an approval authority.**

- ❌ 不产出 APPROVE / BLOCK / LGTM verdict
- ❌ 不替代 Layer 2/3 named cat review
- ❌ 不签署任何 merge-gate 可识别的放行信号
- ✅ 只产出 "我看到这些 findings"（带签名的 finding list）

## 触发决策表

| PR 类型 | 触发？ | 理由 |
|---------|--------|------|
| 多文件代码改动（≥3 files, ≥50 行） | ✅ 推荐 | 正式 reviewer 认知负荷高 |
| shared/ 或跨包改动 | ✅ 推荐 | 影响面广，早发现早修 |
| 纯文档 / ≤10 行 / typo | ❌ 跳过 | 认知负荷已经很低 |
| SKILL.md-only | ❌ 跳过 | 轻量改动 |
| 紧急 hotfix | ❌ 跳过 | 时间约束 |

**决策权在 author**：表格是建议，不是硬规则。Author 自判是否需要 fresh context。

## 流程

### Ownership: Author 触发

```
1. Author 完成开发，quality-gate ✅
2. Author 判断是否需要 fresh-context（查触发决策表）
3. 需要 → Author 触发 fresh-context session
4. 不需要 → 直接进 request-review
```

### 如何触发

**方式 A: @ 另一只猫（推荐）**
在当前 thread 或另开 thread，@ 一只没参与开发的猫：
- 优先跨 family（布偶猫写的 → @ 缅因猫扫）
- 同 family 不同个体也可（opus 写的 → @ sonnet 扫）

**方式 B: Author 自己的新 session**
如果没有其他猫可用，author 可以在一个全新的 session 中自己扫——
关键是 **fresh context**（新 session 没有开发过程的上下文污染）。

### Fresh-Context Agent 的工作

1. 读 PR diff（`git diff origin/main...HEAD`）
2. 读相关 spec / plan（路径由 author 提供）
3. 逐文件扫描，产出 finding list
4. **不做 verdict**——只列 findings

### Finding List 格式

```markdown
## Fresh-Context Findings

Agent: {cat signature}
SHA: {HEAD sha}
Scope: {N} files, {M} lines changed

| # | File | Line | Category | Finding | Severity |
|---|------|------|----------|---------|----------|
| 1 | src/foo.ts | 42 | correctness | 边界条件未处理 | P2 |
| 2 | src/bar.ts | 18 | naming | 变量名与 spec 不一致 | P3 |
| ... | | | | | |

Total: {X} findings ({Y} P1, {Z} P2, {W} P3)
```

**Category 枚举**: correctness / performance / naming / style / security / spec-mismatch / missing-test / doc

### Author 处理 Findings

- Author 逐条审视（fresh-context 可能有假阳性）
- 有效的 → 修复后 commit
- 无效的 → 在 review request 中标注为 "dismissed + 理由"
- **Author 对 findings 有最终决定权**（fresh-context 不是 reviewer）

## 和正式 Review 的关系

| 维度 | Fresh-Context | 正式 Review |
|------|--------------|-------------|
| **角色** | Finding generator | Approval authority |
| **产出** | Finding list | APPROVE / BLOCK verdict |
| **权力** | 零（建议性） | 完全（merge gate 可识别） |
| **触发** | Author 主动 | request-review 流程 |
| **Ownership** | Author | Reviewer |
| **对 merge-gate** | 不可见 | localPeerReviewSha / cloudReviewSha |

## Common Mistakes

| 错误 | 正确 |
|------|------|
| 把 fresh-context 当正式 review，跳过 request-review | fresh-context 只是预扫，正式 review 仍必须 |
| Fresh-context agent 给 APPROVE verdict | 只给 finding list，不给 verdict |
| Reviewer 因为 fresh-context "已看过" 就不仔细看 | Reviewer 独立判断，fresh-context 是参考不是替代 |
| 所有 PR 都跑 fresh-context | 按触发决策表判断，trivial 跳过 |

## 下一步

Fresh-context findings 处理完 → 直接进 **`request-review`**（SOP Step ③a）。
在 review request 中附上 fresh-context findings 摘要（见 review-request-template.md 的 "Fresh-Context Findings" section）。
```

**Step 2: Verify skill document meets AC-B1**

Read the created file and check:
- ✅ "finding generator, not approval authority" explicitly stated
- ✅ Ownership = author 触发 explicitly stated
- ✅ Flow documented (when/how/output)

**Step 3: Commit**

```bash
git add cat-cafe-skills/fresh-context-review/SKILL.md
git commit -m "docs(F253): add fresh-context-review skill — finding generator, not approval authority

Phase B AC-B1: document the fresh-context pre-review flow as a skill.
Author-triggered, optional step between quality-gate and request-review.

[宪宪/claude-opus-4-6 🐾]"
```

### Task 2: Register in manifest.yaml + Update SOP.md

**Files:**
- Modify: `cat-cafe-skills/manifest.yaml` — add `fresh-context-review` entry after `quality-gate`, before `request-review`
- Modify: `docs/SOP.md` — add optional step reference

**Step 1: Add skill entry to manifest.yaml**

After the `quality-gate` entry (line ~265, `next: ["request-review"]`), add:

```yaml
  # ── Fresh-Context Pre-Review（可选） ──
  fresh-context-review:
    category: "开发流程"
    description: >
      Author-triggered fresh-context scan of PR diff.
      Finding generator, NOT approval authority.
      Use when: quality-gate 通过且 PR 非 trivial，想降低正式 reviewer 认知负荷。
      Not for: 正式 review verdict、approval、merge decision。
      Output: Finding list（附在 review request 中）。
    triggers:
      - "fresh context"
      - "pre-review scan"
      - "找新眼看看"
    not_for:
      - "正式 review"
      - "approval"
      - "merge"
    output: "Finding list (attached to review request)"
    next: ["request-review"]
    sop_step: 2.5
    optional: true
```

Also update `quality-gate.next` from `["request-review"]` to `["fresh-context-review", "request-review"]`.

**Step 2: Update SOP.md flow table**

In the flow table (line ~86-94), add between ② and ③a:

```markdown
| ②½ | *（可选）*Fresh-context pre-review scan | `fresh-context-review` | Author 判断是否需要；非 trivial PR 推荐 |
```

And update the 5-step flow diagram to mention the optional step.

**Step 3: Commit**

```bash
git add cat-cafe-skills/manifest.yaml docs/SOP.md
git commit -m "docs(F253): register fresh-context-review in manifest + SOP optional step

Wire fresh-context-review into the skill chain between quality-gate and
request-review. Optional step (sop_step 2.5), author decides trigger.

[宪宪/claude-opus-4-6 🐾]"
```

### Task 3: Add Fresh-Context Section to Review Request Template

**Files:**
- Modify: `cat-cafe-skills/refs/review-request-template.md` — add "Fresh-Context Findings" section

**Step 1: Add section to template**

After the "Open Questions" section and before "Next Action", add:

```markdown
## Fresh-Context Findings（如有）
<!-- 仅当 author 触发了 fresh-context pre-review 时填写此节。跳过时删除此节。 -->

Agent: {cat signature}
SHA scanned: {sha}
Total findings: {N} ({P1 count} P1, {P2 count} P2, {P3 count} P3)

| # | Finding | Author 处置 | 状态 |
|---|---------|------------|------|
| FC-1 | {摘要} | fixed (commit {sha}) | ✅ |
| FC-2 | {摘要} | dismissed: {理由} | ❌ |

**Reviewer delta tracking**: 正式 reviewer 请在你的 findings 中标注 `FC:covered`（fresh-context 已发现）或 `FC:new`（新发现）。详见 receive-review skill "Reviewer Delta Annotation"。
```

**Step 2: Commit**

```bash
git add cat-cafe-skills/refs/review-request-template.md
git commit -m "docs(F253): add Fresh-Context Findings section to review request template

Part of AC-B2: reviewer delta metric collection. Template instructs
formal reviewer to annotate findings with FC:covered or FC:new.

[宪宪/claude-opus-4-6 🐾]"
```

### Task 4: Add Reviewer Delta Annotation to receive-review

**Files:**
- Modify: `cat-cafe-skills/receive-review/SKILL.md` — add delta annotation format

**Step 1: Add "Reviewer Delta Annotation" section**

After the "核心知识" section's "两类反馈" table, add:

```markdown
### Reviewer Delta Annotation（F253 AC-B2）

当 review request 附有 Fresh-Context Findings 时，reviewer 在自己的 findings 中标注 delta tag：

| Tag | 含义 | 用途 |
|-----|------|------|
| `FC:covered` | 该 finding 已被 fresh-context 发现 | 量化 fresh-context 覆盖率 |
| `FC:new` | 该 finding 是 fresh-context 未发现的**新发现** | 量化正式 reviewer 增值（reviewer delta metric） |
| `FC:N/A` | 该 finding 不适用 delta 标注（如愿景级/架构级） | 排除非代码 finding |

**Annotation 格式**：在 finding 行末加 `[FC:tag]`

```
P2-1: 边界条件未处理 — src/foo.ts:42 [FC:covered]
P1-1: Race condition in concurrent writes — src/bar.ts:18 [FC:new]
```

**注意**：
- 标注是 lightweight annotation，不增加 review 流程
- 没有 fresh-context findings 时（review request 无 FC 节），不标注
- Delta 数据自然累积在 review 记录中，Phase C eval:qc 聚合分析
```

**Step 2: Add to the 修复后确认 format**

In the existing confirmation format, add an optional delta summary line:

```markdown
Fresh-Context Delta: {N} FC:covered, {M} FC:new, {K} FC:N/A
```

**Step 3: Commit**

```bash
git add cat-cafe-skills/receive-review/SKILL.md
git commit -m "docs(F253): add reviewer delta annotation format to receive-review

AC-B2: formal reviewer can tag findings as FC:covered / FC:new / FC:N/A
to quantify cross-model review value (reviewer delta metric).

[宪宪/claude-opus-4-6 🐾]"
```

### Task 5: Sync Skills + Update F253 Spec + Final Verify

**Files:**
- Run: `pnpm sync:skills`
- Modify: `docs/features/F253-qc-loop.md` — check AC-B1, AC-B2, update timeline

**Step 1: Sync skills**

```bash
pnpm sync:skills
```

**Step 2: Update F253 spec**

- Check AC-B1: `[x]`
- Check AC-B2: `[x]`
- Timeline: add Phase B completion record

**Step 3: Run gate to verify no breakage**

```bash
pnpm gate
```

**Step 4: Commit spec update**

```bash
git add docs/features/F253-qc-loop.md
git commit -m "docs(F253): Phase B complete — AC-B1, AC-B2 ✅

Fresh-context pre-review skill + reviewer delta metric annotation.
Phase B: all SOP/skill documentation, no runtime code.

[宪宪/claude-opus-4-6 🐾]"
```

**Step 5: Push**

```bash
git push origin main
```

## Open Questions

### 技术 OQ
None — Phase B is pure documentation. No runtime ambiguity.

### 价值 OQ
None — fresh-context as optional + finding-generator-only is already confirmed by spec discussion (铲屎官 + 砚砚 + 宪宪 consensus). Author retains full decision authority.
