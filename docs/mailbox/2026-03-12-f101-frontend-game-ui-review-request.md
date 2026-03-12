# Review Request: F101 Frontend Game UI Components

## What

F101 狼人杀游戏的完整前端 UI 层：14 个组件/hooks + Zustand store + WebSocket wiring + ChatContainer 集成 + 断线重连恢复。

**9 commits on `feat/f101-frontend`**, 12 new files + 2 modified files:

| Layer | Files | Tests |
|-------|-------|-------|
| State | `gameStore.ts` | 10 |
| WebSocket | `useSocket.ts` (modified) | — |
| Shell | `GameShell.tsx`, `TopBar.tsx`, `PhaseTimeline.tsx`, `PlayerGrid.tsx` | 23 |
| Day UI | `EventFlow.tsx`, `ActionDock.tsx` | 8 |
| Night UI | `NightStatus.tsx`, `NightActionCard.tsx` | 11 |
| God View | `GodInspector.tsx` | 8 |
| Assembly | `GameOverlay.tsx`, `GameOverlayConnector.tsx` | 13 |
| API | `useGameApi.ts` | 6 |
| Reconnect | `useGameReconnect.ts`, `useSocket.ts` (modified) | 3 |
| Integration | `ChatContainer.tsx` (modified) | — |
| **Total** | **14 files** | **82 tests** |

## Why

F101 Mode v2 Game Engine 需要前端 UI 层来渲染游戏状态。后端 game engine 已有 GameView/SeatView 类型定义和 WebSocket event（`game:state_update`），前端需要消费这些数据并渲染 3 种视图：白天讨论、夜晚等待/行动、上帝面板。

## Original Requirements（必填）

> "我们的这个 mode 其实应该是类似于什么，就比如说是假设狼人杀、三国杀这种是需要我们自己额外制作一个系统的"
> "铲屎官可以选择当你们的玩家"
> "也可以选择是上帝视角去观看"
> "甚至我可以选择我来当法官"

- 来源：`docs/features/F101-mode-v2-game-engine.md`（R2-R4）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

本次交付覆盖：玩家视角 UI（日/夜）+ 上帝视角面板 + 断线重连。法官模式和语音模式留后续迭代。

## Tradeoff

- **renderToStaticMarkup 测试**：项目没安装 @testing-library/react，延续现有 SSR 测试模式。可交互行为（click handlers）通过 props 验证而非 DOM event 触发。
- **动态头像用 `<img>` 而非 Next `<Image>`**：座位头像路径是动态的 (`/avatars/${actorId}.png`)，Next Image 的优化在这里收益不大，保留 biome warning。
- **GameShell.onClose 保留但未使用**：接口已定义，关闭按钮待后续 TopBar 整合时实现。

## Open Questions

1. **Zustand selector 粒度**：ChatContainer 里 5 个独立 selector（gameView, isGameActive, isNight, selectedTarget, godScopeFilter）。是否需要合并成一个 selector 减少 re-render？
2. **NightActionCard 目标选择**：当前 `onConfirm` 发送 `vote` action type，实际应根据角色发送不同 action（seer_check, witch_act 等）。后端 action dispatch 完成后需要对齐。
3. **预存测试失败**：web 包有 9 个测试文件 / 20 个测试在 main 也失败（ChatContainer mobile, thinking-mode 等），非本次改动引起。

## Next Action

请 @codex 做代码 review，重点关注：
- Store 设计 + selector 模式是否合理
- WebSocket wiring 是否有竞态风险
- 组件分层是否清晰（Shell → Layout → Feature → Integration）

## 自检证据

### Spec 合规

Quality gate PASS — 14/14 tasks complete, 3/3 ACs satisfied:
- AC-B7: PlayerGrid + PhaseTimeline 等前端组件可用 ✅
- AC-B6: 断线重连恢复 GameView ✅
- B6 前端: GameShell + ActionDock + GodInspector + 日夜氛围 ✅

### 设计稿对照

`designs/f101-werewolf-game-ui.pen` — 3 屏结构对照通过（颜色、布局、组件层级一致）。
无 dev 实例运行态截图（worktree port 3102 未启动，runtime 3001/3002 是 main 分支）。

### 测试结果

```
pnpm test (game files) → 14/14 files, 82/82 tests pass ✅
pnpm lint (next lint)  → 0 errors ✅
biome check            → 0 errors, 2 warnings (noImgElement) ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-12-f101-frontend-game-ui.md`
- Feature: F101 / `docs/features/F101-mode-v2-game-engine.md`
- Design: `designs/f101-werewolf-game-ui.pen`
- Branch: `feat/f101-frontend` (9 commits)
