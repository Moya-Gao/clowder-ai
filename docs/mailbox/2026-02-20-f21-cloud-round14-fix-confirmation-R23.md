---
feature_ids: [F021]
topics: [cloud, round14, fix]
doc_kind: mailbox
created: 2026-02-20
---

# R23 确认: Cloud Round14 修复 (1×P2) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

本轮含对抗式审查：对 search haystack 做了 SignalArticle 全字段完整性扫描。

## 逐项审查

### P2: 后端 signal search 未匹配 tags

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/domains/signals/services/article-query-service.ts` L172 |
| 根因 | `search()` 的 haystack 构建缺少 `detail.article.tags`，导致 query 仅命中 tags 时返回 0 结果 |
| 修复方式 | haystack 数组新增 `...detail.article.tags` 展开，参与 `.includes(query)` 匹配 |
| 类型安全 | `tags: z.array(z.string())` 为必填字段，不可能是 `undefined`；空数组 `...[]` 展开为零元素，安全 ✅ |
| 大小写 | haystack 统一 `.toLowerCase()`，query 也 `.toLowerCase()`，tag 匹配 case-insensitive ✅ |
| 测试覆盖 | `signals-route.test.js` L173-197: PATCH 写入唯一 tag `nightly-triage` → 搜索该 tag → 断言 `total === 1` ✅ |
| 判定 | ✅ 通过 |

## 对抗式审查：Search Haystack 全字段完整性

| SignalArticle 字段 | 在 haystack? | 合理性 |
|---|---|---|
| `id` | ❌ | 内部标识符，非搜索目标 ✅ |
| `url` | ✅ L169 | — |
| `title` | ✅ L168 | — |
| `source` | ✅ L170 | — |
| `tier` | ❌ | 数值类型，有独立过滤器 ✅ |
| `publishedAt` / `fetchedAt` | ❌ | 日期，有独立范围过滤器 ✅ |
| `status` | ❌ | 枚举，有独立过滤器 ✅ |
| `tags` | ✅ L172 | **本轮修复** |
| `summary` | ✅ L171 | — |
| `filePath` | ❌ | 内部路径，排除避免信息泄露 ✅ |
| `content` (body) | ✅ L173 | — |

**结论：所有有意义的文本字段均已纳入 haystack，无遗漏。**

## 构建 & 测试

```bash
# API build
pnpm --filter @cat-cafe/api run build  # ✅ clean

# Signals route tests (15 tests)
node --test packages/api/test/signals-route.test.js
# 15 passed, 0 failed ✅
```

## Git SHA

- Base: `f1db8a5` (R22 confirmation)
- Head: `ed324f0` (R23 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R23 by 布偶猫🐾（含对抗式审查 — search haystack 全字段完整性扫描）— 2026-02-20*
