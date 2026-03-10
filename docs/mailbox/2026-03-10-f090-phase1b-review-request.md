# Review Request: F090 Pixel Brawl Phase 1b — 4 Cats + Pixel Fonts + Skills

## What

Expand Pixel Cat Brawl from 2-fighter demo to full 4-cat brawl with pixel fonts and a unique skill system per cat.

Core changes (8 commits, `feat/f090-pixel-brawl-1b`):
- **N-fighter GameState**: Array-based `fighters[]` replacing hardcoded p1/p2, with backward-compat getters
- **4 unique skills**: 架构禁锢 (stun), 逻辑丝线 (brief-stun), 代码洪流 (knockback), 金级 Review (stun)
- **Per-fighter stats**: moveSpeed, attackDamage, skillId differentiate each cat
- **BattleHud extraction**: Separated 146-line HUD from BattleScene (was 340→313 lines, under 350 limit)
- **Pixel fonts**: Press Start 2P (display) + Silkscreen (HUD) via Google Fonts `<link>` + `document.fonts.ready`
- **AI skill usage**: 25% chance when off cooldown + in range; stunned fighters forced idle
- **Combat pacing tuning**: Longer matches (~45s target) via cooldown/range/knockback/damage adjustments
- **Sprite placeholders**: `sprites.ts` with null configs ready for CUTE LEGENDS asset integration

## Why

铲屎官要求扩展 Phase 1a 的 2 猫演示为完整 4 猫格斗 + 技能系统 + 像素字体。Phase 1b 是功能完善阶段。

## Original Requirements（必填）

> `@opus 走起！！！ 4 猫，加像素字体 + 技能`
> `Subagent-driven execution (this session) 走起！ 自己闭环不要喊我！`
> `test in browser 你让codex用playwright做！ 你自己做完 quality-gate让他帮你测试！不要自己测试`

- 来源：Cat Café thread 对话，2026-03-10
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Colored rectangles over sprites**: CUTE LEGENDS 付费资产未到磁盘，用带颜色矩形占位（opus46=#2C57A6, opus45=#79C9FF, codex=#2FA56E, gpt54=#D7AB43），HUD 标签标识每只猫
- **Google Fonts `<link>` over next/font**: `next/font/google` 不能注入 Phaser canvas，改用 `<link>` + `document.fonts.ready` 等待加载
- **Nearest-living-enemy targeting over team-based**: 4 猫 free-for-all 模式，每只猫攻击最近的活着的敌人

## Open Questions

1. **Browser 行为验证**：请用 Playwright 打开 `/pixel-brawl`，测试两种模式（4-Cat Brawl AI + Player vs AI），确认 4 只猫出现、HP bars 正确、技能冷却条可见、战斗在 ~45s 结束
2. **K 键技能触发**：PvAI 模式下按 K 键应触发技能（如果冷却完毕），确认有视觉效果（flash）
3. **Font 加载时序**：确认 "FIGHT!" 和 "K.O.!" 文字使用 Press Start 2P 字体而非 fallback

## Next Action

请 @codex 做 Playwright 浏览器验收测试，重点验证上面 3 个 Open Questions。

## 自检证据

### Spec 合规
- ✅ 4 fighters with unique stats and skills
- ✅ Pixel fonts (Press Start 2P + Silkscreen)
- ✅ Skill system with cooldowns, effects (stun/knockback), visual feedback
- ✅ N-fighter generalization with backward-compat
- ✅ Combat pacing tuned for ~45s matches
- ✅ All files under 350-line limit (max: BattleScene 315)

### 测试结果
```
pnpm vitest run src/games/pixel-brawl/  # 37 passed, 0 failed (4 test files)
tsc --noEmit | grep pixel-brawl         # 0 pixel-brawl type errors
```

### File sizes
```
BattleScene.ts   315 lines
game-state.ts    204 lines
BattleHud.ts     147 lines
page.tsx         145 lines
types.ts         142 lines
ai-controller.ts  50 lines
sprites.ts        24 lines
rng.ts            24 lines
```

### 相关文档
- Plan: `docs/plans/2026-03-10-f090-phase1b-4cats-fonts-skills.md`
- Feature: F090 / Pixel Cat Brawl
