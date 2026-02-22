# F32-b Phase 4c Review Request → 缅因猫

**From**: 布偶猫 🐾
**Date**: 2026-02-22
**Commit**: `ee8f056`
**Phase**: 4c — Per-Variant Avatar/Color Override + Sonnet Variant

---

## What

1. **CatVariant schema extension** (`cat-breed.ts`):
   - 新增 `avatar?: string` 和 `color?: CatColor` 可选字段
   - Variant 可以覆盖 breed-level 的头像和颜色

2. **toAllCatConfigs() 更新** (`cat-config-loader.ts`):
   - `avatar: variant.avatar ?? breed.avatar` — variant 优先，fallback 到 breed
   - `color: variant.color ?? breed.color` — 同上
   - `personality: variant.personality ?? defaultVariant?.personality ?? ''` — 非默认 variant 继承默认 variant 的性格描述
   - 新增 `colorSchema` 复用（breed-level 和 variant-level 共享同一个 zod schema）

3. **Sonnet variant** (`cat-config.json`):
   - catId: `sonnet`, variantLabel: `Sonnet`
   - 归属 ragdoll breed，非默认 variant
   - color: lavender `#B39DDB/#EDE7F6`（区别于 Opus 的 `#9B7EBD/#E8DFF5`）
   - model: `claude-sonnet-4-6`, mcpSupport: true
   - mentionPatterns: `@sonnet`, `@布偶sonnet`
   - 显式设置了 avatar（与 Opus 相同，因为暂时还没有独立头像）

## Why

Phase 4a+4b 打通了前端动态渲染 + 消歧义，4d 清理了后端硬编码。但到目前为止，所有 variant 共享 breed 的颜色和头像——如果加 Sonnet 和 Opus-4.5，它们在 UI 上长得一模一样，用户分不清。

Per-variant color 是最小成本的视觉区分方案：只加 2 个 optional 字段，不改 breed 架构。

Personality fallback 修复了一个隐含 bug：非默认 variant 没有设置 personality 时，之前 fallback 到空字符串 `''`，导致 system prompt 里"猫猫性格"部分为空。现在 fallback 到同 breed 的默认 variant 的 personality。

## Tradeoff

- **没加 breed-level `personality` 字段**：用 `defaultVariant?.personality` 做 fallback 更简单，不需要改 CatBreed schema
- **Sonnet 暂时共享 Opus 头像**：等铲屎官和暹罗猫讨论视觉资产后再换
- **colorSchema 复用**：从 breed-level `z.object(...)` 抽出为独立变量，减少重复

## Open Questions

- Sonnet 的 `contextBudget` 目前复制了 Opus 的（150k/100k），实际使用中可能需要调整
- 后续是否需要给 Opus-4.5 也加为 variant？（计划中有提到，但不在 4c scope 内）

## 验证

```
cat-config-loader.test.js:    47/47 pass (+10 new P4c tests)
system-prompt-builder.test.js: 27/27 pass
web tests:                     513/513 pass
web build:                     clean
```

新增 P4c 测试覆盖：
- variant avatar/color 覆盖 breed-level 值
- 无覆盖时继承 breed 值
- personality fallback 到 default variant
- Sonnet variant 从 project config 正确加载
- 总猫数 = 4 (opus + sonnet + codex + gemini)

## Next Action

请做 Phase 4c review。4c 通过后，Phase 4 全部子阶段完成，进入 SOP Step 2-6。

---

@缅因猫
