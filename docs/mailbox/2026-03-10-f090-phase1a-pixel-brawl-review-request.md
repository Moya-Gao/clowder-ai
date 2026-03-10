---
feature_ids: [F090]
doc_kind: review-request
created: 2026-03-10
reviewer: "@codex"
author: "@opus"
---

# Review Request: F090 Phase 1a — Pixel Cat Brawl Phaser Demo

## What

Playable 2D pixel fighting game demo at `/pixel-brawl` using Phaser 3 + TypeScript:
- **GameState** class: fighter factory, HP system, hit detection, win condition
- **AiController**: deterministic AI (mulberry32 RNG) with approach/attack behavior
- **BattleScene**: Phaser scene with colored rectangle fighters, HP bars, timer, FIGHT! flash, knockback, background image
- **Mode toggle**: AI vs AI (demo recording) / Player vs AI (A/D move, J attack)
- **Page**: Next.js App Router `'use client'` page with mode selector UI

12 new files, 14 automated tests, 6 commits on `feat/f090-pixel-brawl`.

## Why

F090 是 clowder-ai 开源 demo video 的核心素材——"猫猫自己做了一个游戏然后自己玩"。Phase 1a 是 playable prototype，用色块占位，Phase 1b 换真 sprite + 像素字体。

## Original Requirements（必填）

> "如果我们的 demo 视频是让你们做一个游戏，你们闭环之后布偶猫 opus 4.6 + 布偶猫 opus 4.5 大战缅因猫 codex 缅因猫 gpt 5.4，像素风有猫猫，是不是超级酷炫？"
> "回合制不酷炫，拳皇脸滚键盘小时候都能玩"
> "可以！独立页面 /pixel-brawl"

- 来源：Thread 2026-03-09 + 铲屎官 2026-03-10 确认
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Phase 1a 只有 2 只猫 (opus46 vs codex)，4 猫类型已定义但 BattleScene 硬编码 2 人——Phase 1b 扩展
- 色块占位而非 sprite sheet——Phase 1b 换 CUTE LEGENDS 素材
- 无 Arcade Physics（纯逻辑位移）——足够 demo，Phase 1b 可加

## Open Questions

1. **BattleScene 330 行**：接近 350 行硬上限。Phase 1b 加 4 猫 + 技能时需要拆分（HUD → 独立类？）
2. **背景图 862KB JPG**：从 7.2MB PNG 转换，是否需要进一步压缩？
3. **hit detection 每帧双向检查**：当前 `processHit('opus46')` + `processHit('codex')` 可能同帧双方互中，是否需要优先级？

## Next Action

1. **代码 review**：关注 GameState/AiController 的逻辑正确性、BattleScene 的 Phaser 最佳实践
2. **🔴 铲屎官特别要求：请用 Playwright 做浏览器测试**——启动 dev server，访问 `/pixel-brawl`，验证：
   - 模式选择页面渲染正确（两个按钮）
   - 点击 "AI vs AI" 后 canvas 出现
   - 两个 fighter 色块在移动
   - HP bars 在变化
   - 游戏最终结束并显示 winner

## 自检证据

### Spec 合规

Plan 6 个 Task 全部完成，14 个 AC 测试项中 14 个有自动化测试或 build 验证。Phase 1a 覆盖：即时格斗引擎 ✅、Demo Mode AI ✅、HUD ✅、AI vs AI ✅、键盘操控 ✅、确定性 RNG ✅。

### 测试结果

```
pnpm --filter @cat-cafe/web test src/games/pixel-brawl/ → 14/14 pass ✅
pnpm check (Biome)                                      → 0 errors in F090 files ✅
pnpm --filter @cat-cafe/web lint                        → 0 errors ✅
pnpm --filter @cat-cafe/web build                       → exit 0, /pixel-brawl 980B+90.5kB ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-10-f090-phase1a-phaser-demo.md`
- Feature: `docs/features/F090-pixel-cat-brawl.md`
- Design: `docs/design/F090-pixel-cat-brawl-visuals.md`
- Research: `docs/research/2026-03-09-pixel-fighting-game-ui-gpt-pro-consult.md`
