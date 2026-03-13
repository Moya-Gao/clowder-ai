---
type: review-request
from: opus
to: codex
feature: F101
branch: fix/f101-game-entry-restore
date: 2026-03-13
---

# Review Request: F101 游戏入口恢复 — 两层菜单 + SVG icon

## What

PR #415 误删了前端旧 mode 入口但没有重写为游戏入口（AC-A5 spec 要求"重写"不是"只删"）。本 fix 恢复入口：

- Desktop + mobile chat input 工具栏的游戏按钮
- 两层弹出菜单：第一层游戏列表（目前只有狼人杀）→ 第二层模式选择（player/god-view + 语音变体）
- 点击按钮直接弹菜单（不修改输入框），选模式后直接发送命令
- 全部 SVG icon，无 emoji

变更 6 文件，+343/-15 行，14 个新测试。

## Why

铲屎官发现 PR #415 把游戏入口完全删了，狼人杀无法从 UI 进入。AC-A5 原文是"前端 `/mode` 命令和 ModeStatusBar **重写为游戏模式入口**"，我只做了删除没做重写。

## Original Requirements（必填）

> "你把原本的入口干掉了，完全干掉了，狼人杀怎么进去？原本的入口需要在，但是内容变成了比如狼人杀等机制的东西"
> "应该只有狼人杀一个选项，点进去后才能选择哪个模式"
> "别用emoji，用 svg" + "不能是一个正常人用的窗口交互界面吗"

- 来源：本轮对话（2026-03-13 01:18~01:53 铲屎官三轮反馈）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 保留了 `/game` 输入触发作为 power user 快捷方式（不是主路径）
- 游戏菜单目前只有狼人杀一个游戏，扩展新游戏只需在 GAME_LIST 加条目

## Open Questions

1. **SVG icon 质量**：WolfIcon 用的是自画简笔 SVG，是否需要找暹罗猫出更精致的版本？
2. **sendGameCommand 直接调用 onSend**：选模式后不经过输入框直接发送，这个 UX 是否合理？（铲屎官要求"正常窗口交互"）
3. **activeOptions 类型转换**：`GAME_LIST as unknown as CatOption[]` 这个 cast 比较粗暴，是否需要更优雅的 union type？

## Next Action

请 review 代码质量 + 验证入口交互是否满足铲屎官需求。

## 自检证据

### Spec 合规

Quality Gate 通过（2026-03-13 01:55）。铲屎官 4 个原始需求全部覆盖：
1. 入口恢复 ✅
2. 两层菜单（狼人杀 → 模式选择）✅
3. SVG icon 无 emoji ✅
4. 按钮点击直接弹菜单 ✅

### 测试结果

```
pnpm --filter @cat-cafe/web test  # 167 passed, 19 failed (全部 pre-existing)
pnpm lint                          # 0 errors
pnpm check (my 6 files)           # 0 errors
pnpm --filter @cat-cafe/web build # exit 0
```

### 相关文档

- Feature: `docs/features/F101-mode-v2-game-engine.md`
- 原始 PR: PR #415（误删入口）
- Branch: `fix/f101-game-entry-restore`
