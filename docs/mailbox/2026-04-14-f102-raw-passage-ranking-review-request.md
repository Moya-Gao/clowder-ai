---
feature_ids: [F102]
topics: [review-request, memory, evidence-search]
doc_kind: note
created: 2026-04-14
---

# Review Request: F102 depth=raw passage ranking fix

Review-Target-ID: fix-f102-raw-passage-ranking
Branch: fix/f102-raw-passage-ranking

## What

`SqliteEvidenceStore.search()` 在 `depth=raw` 模式下，对结果排序做了一个修复：

1. `results.sort()` 在 `slice(0, limit)` 前，把有 `passages` 的结果提升到前排
2. `PassageResult` 接口新增 `rank` 字段，保留 BM25 分数供后续排序用
3. `searchPassages()` 的 map 步骤保留 `r.rank`

改动 3 处，共 ~10 行实现 + 87 行测试。

## Why

砚砚(GPT-5.4) 在 F102 Phase K 愿景守护时发现：`depth=raw`（消息级检索）在低 limit 下，top-N 结果可能全是没有 `passages` 的 doc-level 命中——用户选了"看消息"却看不到消息。

根因：doc-level BM25 命中先进 `results` 数组，passage-only 命中被合并/追加到数组尾部，`slice(0, limit)` 把它们裁掉了。

## Original Requirements（必填）

> 砚砚(GPT-5.4)："limit=1 时，第一条结果可能是 passages: []。要到 limit=3 甚至 limit=5，才稳定出现真正的 passage 命中。"
> 砚砚(GPT-5.4)："用户选了'消息级检索'，直觉上 top 结果就该优先给我'有消息片段'的命中。"
> 铲屎官："我问的是质量！"（要求 dogfooding 验证，不只是 AC 打勾）

- 来源：当前 thread（2026-04-14 对话），砚砚 Phase K dogfooding report
- **请对照上面的摘录判断：低 limit 下 passage-bearing 结果是否稳定出现在 top-N？**

## Tradeoff

- 用 `passages.length > 0` 做 boolean 前置而非按 best passage rank 排序。原因：这是最小正确修法，passage rank 已保留到 `PassageResult.rank` 供后续精排使用，但本次不做 rank-based 排序避免过度实现
- 排序是 stable sort（JS 规范保证），同组内保持原有 BM25 顺序

## Open Questions

1. 是否需要进一步按 best passage rank 排序 passage-bearing 结果？（当前只做 boolean 分层）
2. `PassageResult.rank` 字段是否需要暴露到 API 响应？（当前只在 store 内部使用）

## Next Action

请 review 排序逻辑正确性 + 回归安全性。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-f102-raw-passage-ranking/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 沙盒分配（非 3001/3002/3011/3012）

## 自检证据

### Spec 合规

P2 bug fix，非 feature AC。砚砚定位的排序问题已修复，passage-bearing 结果在 limit=1/2 下稳定前置。

### 测试结果

```
raw-passage-ranking.test.js      → 4 passed, 0 failed ✅
sqlite-evidence-store.test.js    → 21 passed, 0 failed ✅
evidence-route.test.js           → 19 passed, 0 failed ✅
passage-permanence.test.js       → 7 passed, 0 failed ✅
pnpm lint                        → 0 errors ✅
pnpm check                       → 0 errors ✅
```

### 相关文档

- Feature: `docs/features/F102-memory-adapter-refactor.md` (Phase K)
- ADR: `docs/decisions/020-f102-memory-system-architecture.md`
