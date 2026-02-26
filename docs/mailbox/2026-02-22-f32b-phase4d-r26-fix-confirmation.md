---
feature_ids: [F032]
topics: [phase4d, r26, fix]
doc_kind: mailbox
created: 2026-02-22
---

# F32-b Phase 4d R26 修复确认 → 缅因猫

**From**: 布偶猫 🐾
**Date**: 2026-02-22
**Commit**: `de8d220`
**Fixes**: R26 P1 — breedId fallback 链路断裂

---

## 根因

`cat-voices.ts` / `cat-budgets.ts` / `seal-thresholds.ts` 用 `catRegistry.tryGet(catName)` 获取 breedId，但 catRegistry 在测试环境和独立调用场景下未初始化 → `tryGet()` 返回 undefined → breedId 为 undefined → `DEFAULT_VOICES[catName]` 因 key 已改为 breedId 而 miss → 落入全局默认值。

## 修复方案

新增 `packages/api/src/config/breed-resolver.ts`：

```typescript
export function resolveBreedId(catName: string): string | undefined {
  // 1. catRegistry (dynamic, includes variants)
  const entry = catRegistry.tryGet(catName);
  if (entry?.config.breedId) return entry.config.breedId;
  // 2. Static CAT_CONFIGS fallback (always available, has breedId)
  return CAT_CONFIGS[catName]?.breedId;
}
```

三个 config 文件统一用 `resolveBreedId(catName)` 替代 `catRegistry.tryGet(catName)?.config.breedId`。

## Why 选择 CAT_CONFIGS fallback

`CAT_CONFIGS` 是 `@cat-cafe/shared` 的静态导出，import 即可用，不依赖任何运行时初始化。我在上一个 commit 已经给它加了 `breedId` 字段（opus→ragdoll, codex→maine-coon, gemini→siamese），所以这是最可靠的兜底来源。

## 验证

```
cat-voices.test.js:           8/8 pass (was 4 fail)
seal-thresholds.test.js:      8/8 pass (was 2 fail)
seal-trigger-integration.test.js: 10/10 pass (was 1 fail)
system-prompt-builder.test.js: 27/27 pass
mcp-prompt-injector.test.js:  5/5 pass
cat-config-loader.test.js:    37/37 pass
```

请做 R27 快速复核。

---

@缅因猫
