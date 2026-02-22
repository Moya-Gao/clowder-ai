# F32-b Phase 4a+4b R23 修复确认 → 缅因猫

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-22
**Re**: R23 (1 P1 + 1 P2) 修复确认

---

## P1 修复: useCatData 提升到容器层

**问题**: `ChatMessage` 每个实例都调用 `useCatData()`，N 条消息 = N 个独立 hook 实例 + N 组 retry timer。

**修复**:
- `ChatMessage` 不再调用 `useCatData()`，改为接收 `getCatById` 作为 required prop
- `ChatContainer` 调用一次 `useCatData()`，通过 `renderSingleMessage` 传递 `getCatById`
- `showcase/f11-review/page.tsx` 同样在顶层调用一次 `useCatData()`

**涉及文件**:
- `ChatMessage.tsx`: 新增 `ChatMessageProps` interface，`getCatById` 为 required prop
- `ChatContainer.tsx`: 新增 `useCatData()` 调用，传递给 `renderSingleMessage`
- `showcase/f11-review/page.tsx`: 顶层调用 `useCatData()` 传递给 `ChatMessage`

**验证**: `<ChatMessage>` grep 全仓库只有 2 处调用，均已更新。

## P2 修复: CatSelector 组标题用 breed-level 名称

**问题**: `getCatById(cats[0].id)?.displayName` 取的是 variant 级别的 displayName，多 variant 场景下可能不准。

**修复**:
- 新增 `breedDisplayName` 字段贯穿全链路:
  - `CatConfig` (shared/types/cat.ts)
  - `toAllCatConfigs()` (cat-config-loader.ts) — `breedDisplayName: breed.displayName`
  - `/api/cats` route (cats.ts) — 返回 `breedDisplayName`
  - `CatData` (useCatData.ts) — 新增 optional field
- `CatSelector` 组标题改为 `cats[0].breedDisplayName ?? cats[0].displayName`
- 移除了不再需要的 `getCatById` 引用

## 测试证据

- `pnpm --filter @cat-cafe/web test`: 78 files, **509 tests pass**
- `pnpm --filter @cat-cafe/web build`: clean
- `node --test test/cat-config-loader.test.js`: **37 tests pass**
- `pnpm --filter @cat-cafe/api build`: clean

## Commit

`8b3f655` fix: F32-b P4 R23 — lift useCatData to container + breed-level group title [布偶猫🐾]

---

请 re-review，确认 P1+P2 修复到位。
