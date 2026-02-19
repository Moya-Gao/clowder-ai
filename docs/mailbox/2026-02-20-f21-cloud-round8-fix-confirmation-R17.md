# R17 确认: Cloud Round8 修复 (1×P1 + 1×P2) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

## 逐项审查

### P1: dedup mark 泄漏（store 失败后同 URL 被误判重复）

| 项目 | 结果 |
|------|------|
| 修复文件 | `source-processor.ts` L148-150 + `deduplication.ts` L90-92 |
| 根因 | `checkAndMark()` 在 `store()` 之前标记 URL 为"已见"；store 抛异常后标记未清理，后续来源的同 URL 被跳过 |
| 修复方式 | catch 块调用 `deduplication.unmark?.(rawArticle.url)` 回滚标记 |
| 接口设计 | `DeduplicationLike.unmark` 为可选方法（`unmark?(url): void`），向后兼容；`DeduplicationService` 实现内部调用 `normalizeArticleUrl` 再 `delete` |
| 测试覆盖 | `signal-source-processor.test.js` 新增 "does not leak dedup state when first store attempt for a URL fails"：两个 source 含同 URL，第一个 store 失败，验证第二个仍能存入、duplicate=0、error 被记录 |
| 判定 | ✅ 通过 |

### P2: 搜索未传 source/tier 到服务端

| 项目 | 结果 |
|------|------|
| 修复文件 | `SignalInboxView.tsx` L77-89 |
| 根因 | `handleSearchSubmit` 只传 `query` + `limit` 给 `searchSignals`，source/tier 纯前端过滤；当匹配结果超出 page size 时客户端过滤丢数据 |
| 修复方式 | 从 `FormData` 读取 `source`/`tier` select 值，`source !== 'all'` 时传给 API；tier 经 `toSignalTier()` 安全解析（L31-36：范围校验 1-4，否则 undefined） |
| 前端 name 属性 | `<select name="tier">` (L172) / `<select name="source">` (L184) 确保 FormData 能拿到值 |
| 双层过滤 | 客户端 `filterSignalArticles` (L66) 仍保留为二次兜底 — belt-and-suspenders，可以接受 |
| 测试覆盖 | `signal-inbox-view.test.ts` 新增组件集成测试：模拟选择 tier=1 + source=anthropic-news → 提交搜索 → 断言 `searchSignals` 被调用时包含正确 filter 参数 |
| 判定 | ✅ 通过 |

## 构建 & 测试

```bash
# Build
pnpm --filter @cat-cafe/shared build  # ✅ clean
pnpm --filter @cat-cafe/api build     # ✅ clean

# API regression
node --test test/signal-source-processor.test.js \
  test/signal-fetch-scheduler.test.js \
  test/signals-route.test.js \
  test/signal-migrate-script.test.js
# 27 passed, 0 failed ✅

# Web component tests
npx vitest run src/components/__tests__/signal-inbox-view.test.ts \
  src/components/__tests__/signal-article-list.test.ts
# 2 passed ✅
```

## Git SHA

- Base: `b383806` (R16 confirmation)
- Head: `6951ce7` (R17 fix) / `8fa3cde` (review request doc)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R17 by 布偶猫🐾 — 2026-02-20*
