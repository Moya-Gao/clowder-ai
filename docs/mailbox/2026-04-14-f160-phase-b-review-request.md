---
title: "Review Request: F160 Phase B — TaskBoard UI Upgrade"
date: 2026-04-14
author: opus
---

# Review Request: F160 Phase B — 毛线球从隐藏列表到 Workspace Tab

Review-Target-ID: f160
Branch: feat/f160-phase-b

## What

将毛线球（TaskPanel）从 ThreadSidebar 底部的隐藏列表升级为 Workspace 右面板的独立 Tab。

核心改动：
- **chatStore**: `workspaceMode` 联合类型新增 `'tasks'`
- **TaskBoardPanel** (190L): 四段式布局（doing/blocked 展开, todo/done 折叠），stats bar, 空状态引导
- **TaskCard** (106L): 卡片详情展开、状态 pill 循环、owner avatar、border-l-4 色带
- **TaskComposer** (72L): inline 创建表单（title + why），POST `/api/tasks`
- **WorkspacePanel**: 第 4 个 mode pill「任务」+ 路由到 TaskBoardPanel
- **ThreadSidebar**: 移除旧 TaskPanel import 和渲染
- **TaskPanel.tsx**: 已删除（73 行，完全被 TaskBoardPanel 替代）

11 commits，17 个新测试，0 回归。

## Why

毛线球自上线以来从未被任何猫主动使用过。三猫诊断的四个根因之一是"UI 存在感为零"——嵌在 ThreadSidebar 最底部，`tasks.length === 0` 时 `return null`，没人知道它在。Phase A 补齐了协议层（MCP 工具 + system prompt），Phase B 解决 UI 存在感问题。

## Original Requirements（必填）
> "为什么毛线球长期任务从来没有被任何猫用过？是因为这个能力猫猫不知道？"
> "为什么一个东西有两个展示的地方？"
- 来源：`docs/features/F160-task-board-upgrade.md` lines 15-18（铲屎官 2026-04-11 thread 讨论）
- **请对照上面的摘录判断：升级后的 TaskBoard 是否解决了"UI 存在感为零"和"展示边界模糊"两个根因**

## Tradeoff

- 拖拽排序不做（三猫共识：先做好基础，Phase C 再加）
- 负责猫下拉选择在 TaskComposer 中暂未实现（API 层 `ownerCatId` 已支持，前端 Phase C 补）
- 折叠动画用 CSS display toggle 而非 `transition-all`（简单够用，后续可加）

## Open Questions

1. **空状态文案**：当前用了"把长期事项挂在线上，不埋回聊天里" + "何时该用毛线球？"引导。请评估文案是否清晰传达了毛线球 vs 猫猫祟祟的边界。
2. **Stats bar 信息密度**：显示 `{N} 总任务` + 各状态计数。在任务少（<3）时信息冗余，是否需要最小任务数阈值？
3. **Status pill 循环顺序**：`todo→doing→blocked→done→todo`。是否应该跳过某些状态（如 doing 不允许直接到 done）？

## Next Action

请 review 代码质量 + 对照 spec AC B1-B6 验收。前端 UI 请在 review 沙盒中实际打开浏览器确认。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f160/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规（AC 逐项）

| AC | 要求 | 状态 | 代码位置 |
|----|------|------|----------|
| B1 | Workspace Tab 接入 | ✅ | WorkspacePanel.tsx mode pill + 路由 |
| B2 | 四段式布局 | ✅ | TaskBoardPanel.tsx SECTIONS + grouped |
| B3 | 创建入口 | ✅ | TaskComposer.tsx inline form |
| B4 | 卡片交互 | ✅ | TaskCard.tsx expand + status pill |
| B5 | 空状态引导 | ✅ | TaskBoardPanel.tsx EmptyState |
| B6 | 旧 TaskPanel 移除 | ✅ | ThreadSidebar 清理 + TaskPanel.tsx 删除 |

### 设计稿对照
glob `designs/**/*.pen` 匹配 `designs/F160-task-board-phase-b-ux.pen`。
三态对照（主视图/新建任务/空状态）完成，4 个 P2 gap 已修复：
- stats bar 缺失 → 已加
- +新任务 按钮样式（pill vs rectangular）→ 已改为 rounded-full
- 折叠提示文字缺失 → 已加 "{N} 项已折叠"
- 空状态标题不匹配 → 已改为 spec 文案

### Artifact Hygiene
仓库根目录媒体/设计工件：无 ✅

### 测试结果
```
pnpm test                          # 305 files, 2168 tests passed, 0 failed ✅
pnpm lint                          # 0 errors ✅ (361 pre-existing warnings in other files)
pnpm check                         # 0 errors ✅
pnpm -r --if-present run build     # exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F160-task-board-upgrade.md`
- Plan: `docs/plans/2026-04-14-f160-phase-b-task-board-ui.md`
- Design: `designs/F160-task-board-phase-b-ux.pen`
