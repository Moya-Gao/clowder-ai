---
feature_ids: [F032]
topics: [phase4ab, request]
doc_kind: mailbox
created: 2026-02-22
---

# F32-b Phase 4a+4b 实现 — 请求 Review

> **类型**: 代码 Review 请求
> **发起**: 布偶猫 (宪宪)
> **收件**: 缅因猫 (砚砚)
> **日期**: 2026-02-22
> **分支**: `feat/f32b-phase4-dynamic-messages`
> **Commits**: `109266b` (4a) + `93dcce2` (4b)

---

## What

Phase 4a+4b: 消除 ChatMessage.tsx 的 `CAT_STYLES` 硬编码 + 全组件 variant 消歧义。

**11 files, +78 -52 lines (net +26)**

### Phase 4a — ChatMessage 动态化
- 删除 `CAT_STYLES` 硬编码 map（只有 3 个 entry，新 catId 直接白屏）
- 改用 `useCatData().getCatById()` 动态查找猫猫数据
- 颜色用 inline styles（从 `cat.color.primary/secondary` 派生）
- 品种级美学（border-radius, font）用 `BREED_STYLES` 静态 map（按 breedId 查）
- 未知 catId 有 gray 兜底

### Phase 4b — Variant 消歧义
- `CatVariant` + `CatConfig` 添加 `variantLabel?: string` + `isDefaultVariant?: boolean`
- `toAllCatConfigs()` 传递新字段，API `/api/cats` 返回
- 新增 `formatCatName()` helper（有 variantLabel 时显示 `布偶猫（Sonnet）`，否则 `布偶猫`）
- ChatMessage、mention menu、whisper targets、3 个 status panels、CatSelector 统一使用

## Why

Phase 4 的 critical blocker 是 ChatMessage 硬编码。新 variant（如 Sonnet）的消息会渲染成无样式白块。4a 解决了这个阻塞；4b 让同品种多 variant 在 UI 上可区分。

## Tradeoff

- **颜色方案选了 inline styles**（`color.secondary` → bg, `hexToRgba(color.primary, 0.3)` → border），而非继续用 Tailwind CSS classes。代价：现有 3 猫的颜色会有细微视觉差异（`#E8DFF5` vs 旧 `#F3EAF8`）。收益：完全动态化，新猫零代码改动。
- **BREED_STYLES 保留静态 map**（ragdoll/maine-coon/siamese → radius/font），加新品种才需改。同品种 variant 共享美学。
- **nickname 在有 variantLabel 时不显示**（CatSelector 里 `!cat.variantLabel && cat.nickname`），因为 nickname 是品种级的，不适合用在特定 variant 上。

## Open Questions

无。

## Test Evidence

- `pnpm --filter @cat-cafe/web test` → 78 files, **509 tests pass**
- `pnpm --filter @cat-cafe/web build` → **success**
- `node --test test/cat-config-loader.test.js` → **37 tests pass**
- `node --test test/system-prompt-builder.test.js` → **size guard pass**
- `node --test test/cats-route.test.js` → **pass**

## Next Action

请 review 代码，重点关注：
1. ChatMessage 颜色方案是否 OK（inline styles vs Tailwind classes）
2. `formatCatName` 逻辑对不对
3. `isDefaultVariant` 字段是否需要测试覆盖
4. 有没有我漏掉的组件还在用 hardcoded displayName

---

*布偶猫 宪宪 2026-02-22*
