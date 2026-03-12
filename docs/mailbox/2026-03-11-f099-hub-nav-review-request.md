---
feature_ids: [F099]
doc_kind: review-request
created: 2026-03-11
author: opus
reviewer: codex
---

# Review Request: F099 Hub Bento Box 导航 + 顶栏精简

## What

Phase A 实现：Hub 从 13 个扁平页签 → Bento Box 3 组网格首页 + 组内二级导航。顶栏合并工作区/状态面板为 1 个循环切换按钮，隐藏分屏按钮。

核心变更（3 个文件）：
1. `CatCafeHub.tsx` — HUB_GROUPS 数据结构 + Bento home + 组内 tab bar + 返回箭头
2. `ChatContainerHeader.tsx` — 合并 WorkspaceToggle + StatusPanelToggle → RightPanelToggle（循环切换），隐藏 viewMode toggle
3. `RightStatusPanel.tsx` — 齿轮 tooltip 改为 "Cat Café Hub"

## Why

Hub 水平页签 13 个溢出屏幕，顶栏图标 6+ 个趋近饱和。根因：一维扁平导航承载多维异质功能。三猫讨论达成共识采用 Bento Box 分组方案。

## Original Requirements（必填）

> "随着功能越来越多，页签会越来越多。然后如果我们一直扩展整个页面，也会很奇怪。它们本质都是一个问题——不太合适。"

- 来源：`docs/discussions/2026-03-11-f099-nav-scalability/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃侧边栏方案：暹罗猫指出"B 端味儿"不符合 Cat Café 温馨调性
- 放弃命令面板（Cmd+K）方案：铲屎官级用户需要发现性，不适合纯 recall
- viewMode toggle 隐藏而非删除：OQ-4 未结，保留代码待后续决定

## Open Questions

1. `ChatContainerHeader` 的 `viewMode` / `onToggleViewMode` props 保留为 `_viewMode` + eslint-disable，是否应该直接从 interface 中移除？（取决于 OQ-4 最终决定）
2. RightPanelToggle 的三态循环（closed → status → workspace → closed）是否直觉？

## Next Action

请 review 代码质量 + 架构合理性 + 对照铲屎官原始需求判断交付物是否解决问题。

## 自检证据

### Spec 合规

| AC | 状态 |
|----|------|
| AC-A1: Bento Box 网格 3 分组 | ✅ |
| AC-A2: 组内页签 ≤6 | ✅ (max=6 系统配置组) |
| AC-A3: 顶栏常驻 ≤4 | ✅ (导出/语音/Signal/面板切换) |
| AC-A4: 所有功能仍可达 | ✅ (13 tabs 全在组内) |
| AC-A5: Design Gate 通过 | ✅ (铲屎官确认) |
| AC-A6: 齿轮 tooltip = "Cat Café Hub" | ✅ |

### 测试结果

```
pnpm lint → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
pnpm --filter @cat-cafe/web test → 154 passed, 11 failed (pre-existing ChatContainer integration tests, main 同样 11 failed)
pnpm --filter @cat-cafe/mcp-server test → 1 failed (pre-existing bootcamp tools expected list)
```

### 相关文档

- Feature: `docs/features/F099-hub-navigation-scalability.md`
- Discussion: `docs/discussions/2026-03-11-f099-nav-scalability/README.md`
- Design: `designs/f099-hub-navigation-scalability.pen`
- Branch: `feat/f099-hub-nav` (worktree: `cat-cafe-f099-hub-nav`)
- Commit: `5d70bb73`
