# Review Request: F101 AC-D5 Token-Only Theme Layer (werewolf-cute CSS vars)

## What
3 文件、98 行新增，为狼人猫猫风主题搭建 CSS vars token 层：
- `globals.css`: 25 个语义化 CSS custom properties（背景/文本/强调/状态/角色/阵营/边框），含 day/night phase 变体
- `GameShell.tsx`: 挂载 `data-theme="werewolf-cute"` + `data-phase={isNight ? 'night' : 'day'}`
- `tailwind.config.js`: `ww.*` color/text/border/shadow tokens 映射到 CSS vars

**零视觉变化** — 所有组件仍用硬编码色值，token 只是定义了但没人消费。PR-B 才逐组件替换。

## Why
AC-D5 要求狼人猫猫风 UX。你在 review 放行 PR #463 后建议拆分为 PR-A (token-only) + PR-B (component replacement)，降低回归风险。这是 PR-A。

## Original Requirements（必填）
> "猫猫装狼人那种可爱的带点黑色的风格" — 铲屎官 2026-03-14 采访
- 来源：`docs/features/F101-mode-v2-game-engine.md` R15 / KD-22
- **请对照上面的摘录判断 token 命名和色值是否符合"可爱+暗色+猫猫cosplay"定位**

## Tradeoff
- 选择 CSS custom properties + `data-theme` 而非 Tailwind plugin，因为更简单且与现有 cat character color 系统一致
- Day/night 是同 hue 调光温，不是两套分裂皮肤（你的建议 #2）

## Open Questions
1. token 命名 `--ww-*` 前缀是否合适？（ww = werewolf）
2. day/night phase 亮度偏移量（+10% / -略深）是否需要微调？
3. `--ww-role-witch: #c084fc` 这个紫色是否和现有 `--color-opus-primary` 太接近？

## Next Action
请 review 3 个文件，重点关注 token 语义完整性和命名规范。通过后我开 PR-B 做组件替换。

## 自检证据

### Spec 合规
- AC-D5 token 定义 ✅（25 tokens 覆盖 bg/text/accent/state/role/faction/border）
- 砚砚 4 条硬约束全满足：语义化 ✅ | 日夜同 hue ✅ | 改造顺序固定（PR-B 执行） | 验收证据（PR-B 附截图）

### 测试结果
- `pnpm --filter @cat-cafe/web test` → 186 passed, 22 failed（与 main 基线一致，0 new failures）
- `pnpm lint` → 0 errors, 2 warnings
- `pnpm check` → 24 errors（与 main 基线一致，我们 3 个文件 0 errors）

### 相关文档
- Feature: `docs/features/F101-mode-v2-game-engine.md` AC-D5
- Design: `designs/f101-werewolf-game-ui.pen` (4 themed screens)
- Branch: `feat/f101-ac-d5`
