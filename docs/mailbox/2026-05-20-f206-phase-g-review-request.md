---
doc_kind: review-request
feature_ids: [F206]
reviewer: codex
author: opus
created: 2026-05-20
---

# Review Request: F206 Phase G — border sweep + data-viz UI chrome

Review-Target-ID: f206
Branch: fix/f206-phase-g

## What

5 个文件的边界清理 + data-viz 豁免标注：

1. **CollectionGraphParts.tsx**: 3× `border-[#eee3d6]` → `border-[var(--console-border-soft)]`（UI chrome section dividers，非图表数据色）
2. **RebuildButton.tsx**: 1× `bg-[#6BAF8D]` → `bg-[var(--field-success-focus)]`（进度条颜色）
3. **MobileStatusSheet.tsx**: 3 个 section 移除 `border border-cafe` 卡片式边框（KD-4：内容块能不要框线就不要框线）
4. **CollectionGraphModel.ts / CollectionGraphParts.tsx / HealthReport.tsx**: 在 data-viz palette hex 上添加 `data-viz palette exempt` 注释，防止未来审计反复 reopen

## Why

砚砚 #723 post-merge audit（PR #1809 后）识别出：data-viz UI chrome 边框未迁移 + MobileStatusSheet 仍有 card-style 边框违反 KD-4 + data-viz 图表色缺豁免标注。

## Original Requirements（必填）
> "线条的色值记得统一下…类似网易云和微信的…能不要框线就不要框线"
> "人家的每个按钮的画风统一，我们的不统一"
- 来源：`docs/features/F206-settings-ui-convergence.md` Why + KD-4 Post-close Guardrail
- **请对照上面的摘录判断：border 清理 + KD-4 移除是否满足"能不要框线就不要"目标**

## Tradeoff

- MobileStatusSheet 移除 border 后靠 `bg-cafe-surface-elevated/70` 背景色分组，不再有显式轮廓线
- RebuildButton 进度条从 `#6BAF8D` 改到 `--field-success-focus`（`#77a777`），色调略变但同为 sage green
- CollectionGraphParts SVG text fill / node background/border hex 标记为 data-viz exempt，不做迁移

## Architecture Ownership（必填）
Architecture cell: console (frontend presentation)
Map delta: none
Why: 纯 CSS token 替换 + border removal，不新增组件/store/router/adapter

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 本 PR 不涉及 ownership cell 变更

## Open Questions

### 技术 OQ（给 reviewer）
1. MobileStatusSheet 移除 `border border-cafe` 后视觉分组是否足够？靠 `bg-cafe-surface-elevated/70` + spacing 够不够把三个 section 区分开？
2. RebuildButton `--field-success-focus` 语义上是 field validation focus ring，用在 progress bar 是否合理？（备选：新增 `--memory-progress` token，但 1 个实例不值得）

### 价值 OQ（给 CVO）
无

## Next Action

请 review 代码变更，重点关注：
1. MobileStatusSheet border removal 是否符合 KD-4 视觉预期
2. data-viz exempt 注释覆盖是否完整

## Review Sandbox（必填）
- Path: N/A — CSS-only diff review，无需起服务
- Start Command: N/A
- Ports: N/A

## 自检证据

### Spec 合规
- quality-gate PASS（本轮运行）
- CollectionGraphParts 3 border hex → token ✅
- RebuildButton 1 progress hex → token ✅
- MobileStatusSheet 3 section borders removed (KD-4) ✅
- data-viz exempt comments added (3 files, 5 locations) ✅

### 测试结果
- `pnpm check` → 0 errors ✅
- `pnpm lint` → 0 errors (warnings only) ✅
- `pnpm --filter @cat-cafe/web run build` → exit 0 ✅
- `pnpm test` → 11987 pass, 0 fail ✅
- `node scripts/check-hotfix-pattern.mjs` → not hotfix ✅
- `node scripts/check-fallback-layers.mjs` → net +0 ✅

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Phase F PR: #1809（前序，已合入）
- Issue: clowder-ai#723（视觉残留跟踪）
- 砚砚 audit: post-#1809 remaining items audit
