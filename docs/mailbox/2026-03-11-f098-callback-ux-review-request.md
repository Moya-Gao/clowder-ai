# Review Request: F098 Callback Message UX — Phase A

## What

纯前端改动（4 commits），实现猫猫传话方向标注 + A2A 讨论颜色优化：

1. **parseDirection 工具函数** — 从消息内容解析 @mention / crossPost / whisper 方向信息
2. **DirectionPill 组件** — 品种色 pill badge 显示 "→ @猫名"
3. **ChatMessage header 集成** — callback 消息显示方向 pill + 猫猫悄悄话方向对齐铲屎官
4. **A2ACollapsible 颜色优化** — 移除品种色背景和 opacity-80，改为中性灰底 + 品种色左边框

涉及文件：
- `packages/web/src/lib/parse-direction.ts` (新)
- `packages/web/src/lib/__tests__/parse-direction.test.ts` (新)
- `packages/web/src/components/DirectionPill.tsx` (新)
- `packages/web/src/components/ChatMessage.tsx` (改)
- `packages/web/src/components/A2ACollapsible.tsx` (改)
- `packages/web/src/components/ChatContainer.tsx` (改)

## Why

铲屎官看不到猫猫传话方向（谁→谁），A2A 讨论颜色刺眼。从 F097 收尾时发现。

## Original Requirements（必填）

> "你们猫猫之间传递消息...假设你是 at 缅因猫，你这里是不是得标明布偶猫 to 缅因猫或者布偶猫箭头缅因猫？" — 铲屎官 16:50
> "我们曾经做的悄悄话的功能，那里就会标明铲屎官跟什么猫猫说，你是不是也得那样子去优化一下？" — 铲屎官 16:50
> "颜色好像做了处理特别难受就是眼睛看了很疼的那种 f98也得优化" — 铲屎官 17:28

- 来源：Thread `thread_mmlwht283o7j3tyk`，2026-03-11 16:50-17:28
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 方向信息从消息内容 @mention 解析（KD-1），不完美但够用。Phase C 后补后端 targetCats 元数据。
- A2A 内部消息不再用品种色背景（KD-4），改为灰底。品种色只在边框/badge/CLI 面板保留。

## Open Questions

1. **parseDirection regex 边界** — 复用了 `getMentionRe()` 的 boundary pattern，但 callback 消息内容格式多样，可能有漏匹配场景
2. **A2A 灰底色值** — 用了 `bg-slate-50 dark:bg-slate-800/50`，是否和整体暗色主题协调？

## Next Action

请 review 代码质量 + 设计实现一致性。合入后需要在 runtime 实测 UI 效果。

## 自检证据

### Spec 合规

| AC | 状态 | 实现 |
|----|------|------|
| AC-A1 callback 方向 | ✅ | parseDirection + DirectionPill |
| AC-A2 multi_mention 方向 | ✅ | parseDirection 多 @mention |
| AC-A3 cross_post 方向 | ✅ | parseDirection crossPost |
| AC-A4 猫猫 whisper 方向 | ✅ | ChatMessage whisper badge |
| AC-A5 callback 品种色气泡 | ✅ | 已有不变 |
| AC-A6 方向 pill 品种色 | ✅ | DirectionPill |
| AC-A7 A2A 灰底 | ✅ | A2ACollapsible |

### 测试结果

- `vitest run` (F098 相关): 9 passed, 0 failed ✅
- `pnpm lint`: 0 errors ✅
- `biome check` (新文件): 0 errors ✅

### 相关文档

- Feature: `docs/features/F098-callback-message-ux.md`
- Plan: `docs/plans/2026-03-11-f098-callback-message-ux.md`
- Design: `designs/f098-callback-message-ux.pen`
