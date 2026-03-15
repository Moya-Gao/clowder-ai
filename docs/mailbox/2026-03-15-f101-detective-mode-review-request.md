# Review Request: F101 Phase E — Detective Mode

## What

新增 Detective Mode（推理模式）：观战者开局绑定一只猫的视角，只看到该座位的身份、阵营队友、和作用域事件，其余座位信息被遮罩。

核心变更：
- **Shared types**: `GameConfig.humanRole` 新增 `'detective'`，新增 `detectiveSeatId`
- **GameViewBuilder**: 支持 `detective:P3` viewer 格式，以绑定座位视角构建 view
- **API routes**: `POST /api/game/start` 支持 detective mode + `detectiveCatId`；GET/action 端点有 detective 权限守卫
- **Frontend lobby**: 第三种模式选项 + 猫绑定选择器
- **Frontend game UI**: GodInspector 显示 detective 指示器，隐藏 god 操作按钮；gameStore 派生 isDetective/detectiveBoundName

## Why

Phase E backlog 唯一 AC (AC-E1)。铲屎官要求先写代码，来不及验证前端。

## Original Requirements（必填）

> "Phase E 是 backlog（上帝推理模式 Detective Mode）你先搞这个！我还来不及验证！你代码先写着！"

- 来源：铲屎官 2026-03-15 06:17 对话消息
- Spec: `docs/plans/2026-03-15-f101-phase-e-detective-mode.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 复用 GodInspector 而非新建 DetectiveInspector —— view 数据已经裁剪过，UI 层只需条件渲染
- 不支持中途切换绑定目标 —— 一局绑定一只，降低复杂度
- 视觉增强（塔罗牌背、灵魂链接光效）排除在本 PR 范围外

## Open Questions

1. **Detective 被绑定猫死亡后的体验**：当前实现是失去阵营可见性（与 player 一致），reviewer 判断这是否合理
2. **God action 守卫**：detective 既不能提交 action 也不能用 god action（pause/resume/skip），是否需要更明确的前端提示？
3. **前端未浏览器实测**：铲屎官明确说"代码先写着来不及验证"，本轮跳过 Playwright 截图

## Next Action

请 review 代码质量 + 架构合理性。重点关注 GameViewBuilder 的 detective viewer 信息隔离逻辑。

## 自检证据

### Spec 合规

AC-E1 全部 15 项功能点逐项验收通过（见上方 quality-gate report）。

### 测试结果

```
node --test game-view-builder-detective.test.js  → 4/4 pass ✅
node --test game-routes.test.js                  → 15/15 pass ✅
vitest run (game + store + chat-input tests)     → 14 files, 129/129 pass ✅
pnpm lint                                        → 0 errors ✅
pnpm biome check . --diagnostic-level=error      → 0 errors ✅
pnpm --filter shared build                       → exit 0 ✅
pnpm --filter api build                          → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-15-f101-phase-e-detective-mode.md`
- Feature: `docs/features/F101-mode-v2-game-engine.md`

### 变更文件清单（18 files）

**API (7)**:
- `packages/shared/src/types/game.ts` — types
- `packages/api/src/domains/cats/services/game/GameViewBuilder.ts` — detective viewer
- `packages/api/src/routes/games.ts` — start/view/action guards
- `packages/api/src/routes/game-command-interceptor.ts` — BuildSeatsInput
- `packages/api/test/game-view-builder-detective.test.js` — 4 tests (new)
- `packages/api/test/game-routes.test.js` — 2 tests added

**Web (11)**:
- `packages/web/src/components/chat-input-options.ts` — detective mode option
- `packages/web/src/components/ChatInput.tsx` — lobbyMode 'detective'
- `packages/web/src/components/ChatContainer.tsx` — import fix
- `packages/web/src/components/game/GameLobby.tsx` — binding picker
- `packages/web/src/components/game/GameOverlay.tsx` — detective props
- `packages/web/src/components/game/GameOverlayConnector.tsx` — passthrough
- `packages/web/src/components/game/GodInspector.tsx` — indicator + hide actions
- `packages/web/src/stores/gameStore.ts` — isDetective + detectiveBoundName
- `packages/web/src/components/game/__tests__/GodInspector.test.tsx` — 3 tests added
- `packages/web/src/components/game/__tests__/GameOverlay.test.tsx` — 2 tests added
- `packages/web/src/stores/__tests__/gameStore.test.ts` — 3 tests added + 1 fix

---

**Branch**: `feat/f101-detective-mode`
**Worktree**: `cat-cafe-f101-detective`
**Commits**: 7 (squash merge at merge-gate)
