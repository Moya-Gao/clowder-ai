# Review Request: F101 Phase E — Detective Mode Visual Enhancements

## What

Detective mode 视觉增强：塔罗牌卡背 + 灵魂链接光效 + 紫色侦探主题。

8 files changed (+128/-7):
- `PlayerGrid.tsx`: 新增 `deriveSeatDetectiveClass()` 纯函数 + detective props（`isDetective`, `detectiveBoundSeatId`）
- `GodInspector.tsx`: 新增 `deriveDetectiveIndicatorClass()` — detective 指示器使用紫色主题替代桃色
- `GameOverlay.tsx`: 将 detective props 传入 PlayerGrid
- `globals.css`: detective CSS 变量（`--ww-accent-detective: #9b6dff`）+ soul-link-pulse 动画 + tarot-back 效果
- `tailwind.config.js`: `ww-detective` token 映射
- `gameStore.ts`: 新增 `detectiveBoundSeatId` 字段
- 2 个新测试文件（7 tests, all passing）

## Why

AC-E1 视觉部分："塔罗牌卡背 + 灵魂链接光效 + 翻牌仪式"。Detective mode 后端（`GameViewBuilder` detective 视角）已在 Phase D 完成，Phase E 补前端视觉。紫色（Mystic Purple #9B6DFF）区分 detective 与 god-view（红色）和 player（桃色），三种模式视觉上一眼可辨。

## Original Requirements（必填）

> "只能选择一只猫看他身份，狼人杀观战模式那种"
> — 铲屎官 2026-03-14 1v1 采访

- 来源：`docs/features/F101-mode-v2-game-engine.md` AC-E1 + R17
- 视觉方案来自暹罗猫提案："塔罗牌卡背 + 灵魂链接光效"
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 翻牌仪式（点击揭牌动画）放到后续迭代，本次只做静态视觉（soul link glow + tarot back）
- 没有做 detective 模式的移动端特殊适配（复用现有响应式布局）
- 纯函数 + CSS，无运行时状态逻辑变更（降低 review 风险）

## Open Questions

1. `detective-tarot-back` 的 grayscale(0.6) brightness(0.6) 效果是否足够区分"未知座位"？还是需要更强的遮罩？
2. soul-link-pulse 动画 2s 周期是否合适？会不会太花哨？
3. CSS `!important` 用了两处（soul-link border-color、tarot-back background/border）——因为需要覆盖 Tailwind 动态类名。有更优雅的方案吗？

## Next Action

请 review 代码质量 + 视觉方案合理性。分支：`feat/f101-detective-visuals`，已 push 到 origin。

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-E1 视觉 | ✅ | soul-link-pulse 动画、tarot-back grayscale、紫色主题变量 |
| AC-E1 信息隔离 | N/A（后端已在 Phase D 完成） | `GameViewBuilder` detective 视角测试在 API 包 |

### 测试结果

```
pnpm vitest run (detective tests): 7 passed, 0 failed
  - player-grid-detective.test.ts: 5 passed
  - god-inspector-detective.test.ts: 2 passed
```

全量 web test suite 有 16 个 pre-existing failures（均为未合入的 main 工作区变更导致，与本分支无关）。

### 相关文档

- Feature: F101 / `docs/features/F101-mode-v2-game-engine.md`
- Design: `designs/f101-werewolf-game-ui.pen` Screen 8-9（Detective Lobby Binding + Detective Night View）
- 设计资产: `designs/images/` 14 张 AI 生成头像

[布偶猫🐾]
