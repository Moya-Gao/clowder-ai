---
doc_kind: review-request
feature_ids: [F206]
reviewer: codex
author: opus
created: 2026-05-20
---

# Review Request: F206 Phase F — MissionControl semantic token migration

Review-Target-ID: f206
Branch: fix/f206-phase-f

## What

22 个 mission-control/*.tsx 子组件文件中 356 处 raw hex color 全部替换为 CSS custom properties。新增 24 个 semantic token（light + dark mode）到 console-shell.css：

- `--mc-status-{open,suggested,dispatched,done}-{dot,bg,text}` — backlog 状态色
- `--mc-status-risk` — 风险标记色
- `--mc-edge-{evolved,blocked,related}` — DAG 依赖图边色
- `--mc-accent` / `--mc-accent-hover` — 操作按钮主色
- `--mc-slice-{learning,value,hardening}` — 切片类型色
- `--mc-risk-{critical,high,medium}` — 风险严重度色

替换模式：
- Tailwind class hex (`text-[#xxx]`, `bg-[#xxx]`, `border-[#xxx]`) → semantic token class
- JS object hex (`'#xxx'` in TYPE_COLORS, SEVERITY_COLORS, EDGE_STYLES, STATUS_COLORS) → `'var(--mc-*)'`
- Inline style hex (`background: '#xxx'`, `border: '1px solid #xxx'`) → `'var(--mc-*)'`

## Why

砚砚 Phase E 后审计显示 mission-control/ 目录有 356 处 raw hex，是全仓最大残留热区。铲屎官 2026-05-20 directive："线条的色值记得统一下…类似网易云和微信的…能不要框线就不要框线"。

## Original Requirements（必填）
> "线条的色值记得统一下…类似网易云和微信的…能不要框线就不要框线"
> "人家的每个按钮的画风统一，我们的不统一"
- 来源：`docs/features/F206-settings-ui-convergence.md` Why 章节 + Post-close Guardrail
- **请对照上面的摘录判断：22 文件 zero raw hex 是否满足色值统一目标**

## Tradeoff

- 纯机械替换，不做布局/交互重构（scope 收窄到 token 层）
- data-viz 41 处 hex 豁免（图表颜色需要独立 policy，不混入本 PR）
- text-[10px] 510 处留给 Phase G bulk migration

## Architecture Ownership（必填）
Architecture cell: console (frontend presentation)
Map delta: none
Why: 纯 CSS token 替换，不新增组件/store/router/adapter

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 本 PR 不涉及 ownership cell 变更

## Open Questions

### 技术 OQ（给 reviewer）
1. dark mode token 色值选取是否合理？用了 `color-mix(in srgb, <color> 12-14%, var(--console-card-bg))` 做背景混合
2. STATUS_COLORS 在 dag-graph-utils.ts 里是 JS object 赋值 `var(--mc-*)` string，React 通过 inline style 渲染——这个模式和 Phase D/E 一致，但请确认无遗漏

### 价值 OQ（给 CVO）
无

## Next Action

请 review 代码变更，重点关注：
1. token 命名是否与现有 `--console-*` / `--cafe-*` 体系一致
2. dark mode 色值可读性
3. 有无遗漏的 raw hex

## Review Sandbox（必填）
- Path: N/A — CSS-only diff review，无需起服务
- Start Command: N/A
- Ports: N/A

## 自检证据

### Spec 合规
- quality-gate PASS（本轮运行）
- AC-F1 ✅ 22 files migrated（git diff --stat）
- AC-F2 ✅ 24 tokens defined（console-shell.css +48 lines）
- AC-F3 ✅ zero raw hex（rg '#[0-9a-fA-F]{3,8}' mission-control/ → No matches）
- AC-F4 ✅ check + lint + build green

### 测试结果
- `pnpm biome check mission-control/ console-shell.css` → 0 issues ✅
- `env -u NODE_ENV pnpm check` → exit 0 ✅
- `env -u NODE_ENV pnpm lint` → exit 0 (warnings only) ✅
- `env -u NODE_ENV pnpm --filter @cat-cafe/web run build` → exit 0 ✅
- `node scripts/check-hotfix-pattern.mjs` → not hotfix ✅
- `node scripts/check-fallback-layers.mjs` → net +0 ✅

### 相关文档
- Feature: `docs/features/F206-settings-ui-convergence.md`
- Phase E PR: #1808（前序，已合入）
- Issue: clowder-ai#723（视觉残留跟踪）
