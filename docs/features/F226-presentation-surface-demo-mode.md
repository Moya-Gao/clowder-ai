---
feature_ids: [F226]
related_features: [F063, F190, F195, F102, F139, F160]
topics: [presentation, demo, workspace, floating-surface, ux]
doc_kind: spec
created: 2026-06-06
---

# F226: Presentation Surface / Demo Mode

> **Status**: spec | **Owner**: 宪宪 Opus-4.8 | **Priority**: P1

## Why

铲屎官做华为 AutoHarness 这类汇报时，演法是：右侧 workspace 打开 PPT 图/文档当"讲解地图"，左侧动态切真实证据（thread / chat / Memory Hub / Eval Hub / commit / PR）。**痛点**：右侧 workspace 是**单一格子**，PPT 和"毛线球（任务）、定时任务、记忆系统"全挤在同一个位置轮流显示——一切证据，PPT 当场被顶掉，演示流被打断。

> 铲屎官原话（2026-06-06）：
> - "我想给大家展示我们的毛线球，比如说定时任务、记忆系统，**这些其实也都在右边呢，和 workspace 一个位置**"
> - "这个右边的 workspace **可以变成漂浮窗口，然后能回归回去**"

**价值**：让铲屎官演示时能把右侧某个 surface（首版：PPT/文档/图片）**抽成浮窗常驻**，右侧 docked 格子腾出来轮播证据（记忆/定时任务/毛线球），讲完**回归归位**——演示流全程不被打断，且有清晰退出，普通使用不被布局困住。

## Current State / 现状基线

实测代码证据（2026-06-06，宪宪 + 砚砚双猫核实）：

- **右侧是单格子双层状态**：`rightPanelMode: status|workspace|transcript` + `workspaceMode: dev|recall|schedule|tasks|community`（`chatStore.ts`）。PPT(dev)、记忆(recall)、定时任务(schedule)、毛线球(tasks)、社区(community) 共享同一右侧格子，由 `WorkspacePanel.tsx:714-815` 的 mode 按钮**原地轮换**，互相替换。
- **F063 Presentation Lock 已存在但跨路由失效**：它锁 workspace 内容、切 thread 时保持（已测），但 `WorkspacePanel` 经 `ChatContainer` 挂在 `(chat)/layout.tsx`，**只在 `/` 和 `/thread/*` 内存活**。切到 `/memory`、`/mission-hub`、`/settings`(Eval Hub) 等全屏独立路由时，`(chat)` layout 整个卸载 → `WorkspacePanel` 从 DOM 消失（`AppShell.tsx:42,64` + `(chat)/layout.tsx:15-21`）。
- **F195 FloatingTranscriptWindow 是技术先例**：已用 `react-rnd + portal(document.body)` 做可拖拽浮窗，但同样挂在 `ChatContainer` 下 → 同样无法跨路由存活。可复用其技术路线，但 host 层级必须上提。
- **F102 历史约束**：完整 Memory Hub 已从 workspace mode 升为 `/memory` 一级页面，workspace 只保留 Recall Feed。**本 feature 不得把 Memory Hub 塞回右栏**；证据区继续用一级页面。

## What

### Phase A: Floating Presentation Surface Host（MVP — 文件/图片/PPT 图）

- 新增 **AppShell/root 级 `FloatingPresentationSurfaceHost`**，mount 在 `(chat)` route group **之上**——切 `/memory`、`/settings`、`/mission-hub` 时**不卸载**（KD-1）。
- 新增全局 `presentationSurface` 状态：`{ placement: 'docked'|'floating', content: snapshot{worktreeId, tabs[], activeTab, mode}, pos{x,y}, size{w,h}, minimized }`，挂全局 store，不绑 `(chat)`。
- **tear-off content snapshot**（KD-2）：detach 时把当前右侧内容**快照成浮窗副本**，docked workspace **保留**——右侧格子仍可切 dev/recall/schedule/tasks/community。不是搬走唯一 panel。
- 拖拽/resize/回坞复用 `react-rnd`（F195 先例）。
- 入口：`WorkspacePanel` header 的 detach 按钮（F063 锁按钮旁）+ **全局召回开关放 ActivityBar**（跨路由可见，在 Memory Hub 时也能召回/收起浮窗）。
- 退出：dock back 按钮 + `Esc`。

### Phase B: 扩展 surface 类型（live detach）

- `recall` / `tasks` / `schedule` / `community` 数据驱动 mode 支持 detach 成 live panel（非快照，活数据）。

### Phase C（评估）: F063 lock 语义合并 + terminal/browser detach

- MVP 稳定后评估把 `presentationLock` 合并入 `presentationSurface`（KD-5 暂不拆）；terminal/browser 活动会话（socket/iframe/local state）detach 迁移可行性。

## Acceptance Criteria

<!-- 立项愿景硬度自检：每条 AC ① trace 回 Why ② 非作者可复核。MVP scope（OQ-1）+ 如何讲 show（OQ-4）待 Design Gate / 新 thread 讨论收敛后可能微调 AC，但 Why 已钉死。 -->

### Phase A（Floating Presentation Surface Host）
- [ ] AC-A1: 演示时可把右侧文件/图片/PPT 图 tear-off 成浮窗，**docked workspace 仍保留可切其他 mode**（trace Why「两份同框」；复核：手动 + 组件测试）
- [ ] AC-A2: 浮窗在切到 `/memory`、`/mission-hub`、`/settings`(Eval Hub) 时**不卸载、保持可见**（trace Why「切证据 PPT 不消失」；复核：路由切换 e2e 测试断言 host 存活）
- [ ] AC-A3: 浮窗可拖拽 / 缩放 / 最小化 / **回坞 dock back**，清晰退出（`Esc` + 按钮）（trace Why「能回归回去 + 清晰退出」）
- [ ] AC-A4: **不破坏**现有 workspace navigation 和 F063 presentation lock（复核：thread-switch lock 回归测试行为不变）
- [ ] AC-A5: 关键状态切换有前端测试覆盖：host 跨路由 survival / 单浮窗 / no double `WorkspacePanel` mount / dock back / z-index·bounds·Esc / responsive smoke

## Dependencies

- **Related**: F063（Hub Workspace Explorer + presentation lock 母题）、F195（floating transcript react-rnd+portal 技术先例）、F102（Memory Hub 一级页面约束）、F190（Console settings / Eval Hub 承载）、F139（Schedule mode）、F160（Tasks / 毛线球 mode）

## Risk

| 风险 | 缓解 |
|------|------|
| 浮窗内容快照与 docked 状态不同步 | tear-off 时单向快照，MVP 不做双向回写 |
| Memory/Mission Hub 被压窄 responsive 崩 | 浮窗方案天然规避——Hub 仍全屏，浮窗只叠加层（不分栏） |
| react-rnd z-index 与现有 Modal/Lightbox 冲突 | 统一 z-index 层级 token 管理 |
| host 误挂在 ChatContainer 下 → 跨路由仍卸载 | KD-1 硬约束：host 必须在 AppShell/root；补 e2e 路由切换 survival 测试 |
| terminal/browser 活动会话 detach 成本高 | MVP 只支持只读展示类，会话类 defer 到 Phase C |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | MVP scope：首版仅文件/图片/PPT，还是含 recall/tasks/schedule？ | ⬜ 待新 thread / Design Gate 收敛 |
| OQ-2 | F063 lock 合并时机：Phase A 并存 vs 立即合并？ | ⬜ 砚砚建议先并存 |
| OQ-3 | 单浮窗 vs 多浮窗？ | ⬜ 建议先单窗 |
| OQ-4 | **如何讲 show**：华为汇报演示叙事怎么设计，本功能怎么支撑？ | ⬜ 铲屎官想聊的核心议题 |
| OQ-5 | 状态持久化到 sessionStorage（刷新可恢复）？ | ⬜ 待定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 浮窗 host 必须 mount 在 AppShell/root 层，不在 ChatContainer 下 | `createPortal` 只改 DOM 插入点、不改 React owner 生命周期；跨路由存活由 host 层级决定（砚砚纠正宪宪误判） | 2026-06-06 |
| KD-2 | tear-off content snapshot，docked workspace 保留 | 铲屎官要「两份同框」（PPT 浮 + 右侧切证据）；搬走唯一 panel 会让右侧空掉 | 2026-06-06 |
| KD-3 | 开新 F 号，不挂 F063 Phase | 跨 AppShell / rightPanelMode / workspaceMode / F195 / F102 / F139 / F160 六域，挂 Phase 会模糊 F063 边界（CVO signoff） | 2026-06-06 |
| KD-4 | MVP 先文件/图片/PPT，证据区继续用一级页面 | F102 约束（Memory Hub 不回塞右栏）+ 风险最低、覆盖演示主场景 | 2026-06-06 |
| KD-5 | F063 暂不拆，新增 `presentationSurface` 并存 | 不破坏已测的 thread-switch lock，MVP 稳后再评估合并 | 2026-06-06 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-06 | 立项（宪宪调查 + 砚砚工程评估收敛，CVO signoff 开新 F 号） |

## Review Gate

- Phase A: 前端实现 → 砚砚跨族 review（工程 + 测试覆盖）+ 烁烁/gemini25 UX 守护

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F063-hub-workspace-explorer.md` | presentation lock 母题 |
| **Feature** | `docs/features/F195-meeting-copilot-live-advisory.md` | floating transcript 技术先例 |
