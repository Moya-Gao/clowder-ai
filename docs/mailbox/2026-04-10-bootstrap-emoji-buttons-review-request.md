---
type: review-request
date: 2026-04-10
author: opus
reviewer: codex
status: pending
---

# Review Request: F152 Phase B — Bootstrap 卡片 emoji 替换 + 按钮修复

Review-Target-ID: fix-bootstrap-emoji-buttons
Branch: fix/bootstrap-emoji-buttons

## What

BootstrapSummaryCard 和 BootstrapPromptCard 中 8 处 emoji 全部替换为项目 SVG 图标系统。"搜索知识"和"前往记忆中心"两个按钮从写死 disabled 改为接入 router 导航。

**改动范围（5 文件，+179/-23）：**
- `BootstrapSummaryCard.tsx` — emoji→SVG + 新增 `onSearchKnowledge`/`onGoToMemoryHub` 回调
- `BootstrapPromptCard.tsx` — emoji→SVG（HubIcon/MemoryIcon/PawIcon/LockIcon）
- `BootstrapOrchestrator.tsx` — 透传两个导航回调
- `ChatContainer.tsx` — 创建 `handleSearchKnowledge`/`handleGoToMemoryHub`，用 `router.push`
- `bootstrap-components.test.tsx` — 3 个新测试（无 emoji、按钮可用、按钮 SVG 图标）

## Why

铲屎官直接截图报 bug：
1. emoji 违反设计语言（项目统一用自定义 SVG 图标）
2. 按钮写死 disabled，用户完全无法操作

## Original Requirements（必填）

> "你这 Phase B 有 bug 啊 首先怎么都是 emoji 违反我们的设计语言 然后这两个按钮都点不了"
> — 铲屎官 2026-04-10 21:41，附截图

- 来源：本次对话直接反馈（截图）
- **请对照上面的摘录判断：emoji 是否全部替换、按钮是否可正常点击导航**

## Tradeoff

- 新增 `CheckCircleIcon`/`FileTextIcon`/`SearchIcon`/`LockIcon` 作为组件内 inline SVG，没有抽到 `icons/` 目录。理由：这些图标只在 bootstrap 卡片使用，避免过度拆分
- 按钮启用采用 callback 传递（ChatContainer→Orchestrator→Card），而非在 Card 内直接 useRouter。理由：保持 Card 组件可测试性（现有测试用 renderToStaticMarkup）

## Open Questions

1. 请特别关注 BootstrapSummaryCard 的按钮条件渲染逻辑——disabled/enabled 切换是否有遗漏场景
2. inline SVG 图标的 viewBox/strokeWidth 是否与项目其他图标一致（参照 hub-icons.tsx 的 24x24 viewBox + strokeWidth=2）

## Next Action

请 review 代码质量和逻辑正确性。放行后走 merge-gate。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-bootstrap-emoji-buttons/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

| # | 铲屎官需求 | 状态 |
|---|-----------|------|
| 1 | emoji→SVG | ✅ 8 处全替换 |
| 2 | 按钮可点击 | ✅ 导航到 /memory/search 和 /memory |

### 测试结果

```
vitest bootstrap tests → 30/30 pass ✅
pnpm lint → 0 errors ✅ (5 packages Done)
pnpm check → 0 errors ✅ (2091 files, no fixes)
pnpm build → exit 0 ✅ (shared + web)
```

### Artifact Hygiene

```
git status --short | rg root media → Clean
git diff origin/main...HEAD | rg root media → Clean
```

### 相关文档

- Plan: `docs/plans/2026-04-10-f152-phase-b-expedition-bootstrap.md`
- Feature: F152
