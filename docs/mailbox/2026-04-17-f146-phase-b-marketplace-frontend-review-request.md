---
feature_ids: [F146]
topics: [marketplace, frontend, review-request]
doc_kind: review-request
created: 2026-04-17
---

# Review Request: F146 Phase B Marketplace Frontend

Review-Target-ID: f146
Branch: feat/f146-marketplace-frontend

## What

Hub 内新增 MCP 市场 Tab，实现搜索 + 结果卡片 + 安装计划详情面板。

- Zustand store (`marketplaceStore.ts`) — search/filter/select/installPlan
- 3 badge components (Ecosystem/Trust/InstallMode)
- Search input with 300ms debounce + 4-ecosystem filter pills
- Artifact result card with badges + summary + source locator
- Install plan detail panel with config table, env vars, trust note, mode-appropriate action button
- Panel container orchestrating search ↔ detail views (loading/empty/error states)
- Hub navigation integration (marketplace tab in cats group)
- 6 new SVG icons in hub-icons.tsx (store, search, arrow-left, external-link, copy, download)

## Why

AC-B1~B3 of F146 Phase B. Backend already merged in PR #1231. This completes the frontend half — users can now discover MCP services across 4 ecosystems from within the Hub.

## Original Requirements

> "我想问你，我们搞设计有什么 MCP？到时候你就可以直接去 Claude 官方的 Hub 市场、Codex 官方的市场、OpenClaw 的市场，一搜——哎，把官方推荐的、最不容易被下毒、最可靠的那些东西拉回来。"
>
> "以后我要新增一个 MCP，是跟你讲我想要一个怎么样的 MCP，然后你接入之后我能看到——不需要我人类自己去编辑。"

- 来源：`docs/features/F146-mcp-marketplace-control-plane.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `direct_mcp` 按钮当前 disabled（实际安装执行走 Phase A 的 `capabilities.write` 路径，不在 Phase B 范围）
- 搜索结果依赖后端 adapter stubs（Phase C 接入真实 catalog）
- 未加排序控件（设计稿有"相关度"但不在 AC 内，留 Phase C）

## Open Questions

1. **设计稿对照**：已用 Pencil MCP 截图对比 4 屏，修了 3 处偏差（componentSummary/config header/env vars）。请 reviewer 重点检查还原度
2. **浏览器实测**：author 端因 Redis namespace guard 无法同时起 API + frontend。请 reviewer 在沙盒 `pnpm review:start` 验证完整 UI 流程
3. **hub-icons.tsx 新增 7 个 SVG path**：是否有 icon 系统升级意见

## Next Action

请 reviewer 在沙盒环境起 dev server，验证：
- Hub → 成员协作 → MCP 市场 tab 可见且可点击
- 空状态正确显示"搜索关键词，发现 MCP 服务"
- 搜索触发 debounce + API 调用（结果依赖后端 stub）
- Filter pills 切换 ecosystem 正确
- 代码质量 + 设计稿还原度

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f146/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（或 review:start 分配的端口）

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 |
|---|-----|------|---------|
| B1 | Unified search UI returning results from 4 ecosystems | ✅ | marketplace-search.tsx + marketplaceStore.ts |
| B2 | Results include trustLevel, filterable by official/verified/community | ✅ | marketplace-badges.tsx (TrustBadge) + store trustFilter |
| B3 | Install plan preview with mode-appropriate action buttons | ✅ | install-plan-detail.tsx (4 modes) |

### 设计稿对照

glob `designs/**/*.pen` 匹配: `designs/F146-marketplace-phase-b-ux.pen`
- Screen 1 (Search): ✅ 搜索框 + filter pills + 结果卡片布局匹配
- Screen 2 (Direct MCP): ✅ 安装配置表 + 环境变量 + 安全提示
- Screen 3 (CLI Delegated): ✅ 复制 CLI 命令 + amber 社区提示
- Screen 4 (Manual UI): ✅ 打开设置按钮 + 手动配置提示
- 修复了 3 处偏差（commit 256158c2c）

### 测试结果

```
pnpm --filter @cat-cafe/web test → 2230 passed, 8 skipped, 0 failed ✅
pnpm lint → 0 errors (warnings are pre-existing cafe/no-hardcoded-colors) ✅
pnpm check → 0 errors ✅
tsc --noEmit → 0 errors ✅
```

### 根目录工件闸门

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' → 无 ✅
git diff --name-only origin/main...HEAD | rg '^[^/]+\...' → 无 ✅
```

### 相关文档

- Feature: `docs/features/F146-mcp-marketplace-control-plane.md`
- Plan: `docs/plans/2026-04-17-f146-phase-b-marketplace-frontend.md`
- Design: `designs/F146-marketplace-phase-b-ux.pen`
