---
feature_ids: [F102]
topics: [review-request, memory, evidence-search, lexical-recall]
doc_kind: note
created: 2026-04-15
---

# Review Request: F102 lexical recall gate fix

Review-Target-ID: fix-f102-recall-gate
Branch: fix/f102-recall-gate

## What

这次只修 lexical recall 的候选集与排序，不碰 schema、route 契约或索引器：

1. `SqliteEvidenceStore` 把原来“只有 `keywords` 且仅在 `results.length <= 1` 才触发”的 fallback，改成 title / summary / keywords 三路 substring backfill。
2. 新增 `lexical-backfill.ts`，把 backfill 的 coverage 计算和排序信号抽出去，不继续把 `SqliteEvidenceStore.ts` 往大文件里塞。
3. 新增独立测试文件，钉住两个回归：
   - section-heading keyword hit 要压过噪声 FTS hit
   - FTS tokenizer miss 时，title/summary substring 仍能把目标文档补进结果集

改动文件 3 个：

- `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- `packages/api/src/domains/memory/lexical-backfill.ts`
- `packages/api/test/memory/sqlite-evidence-store-lexical-backfill.test.js`

## Why

runtime 重建索引后，`heading -> keywords` 已经生效，但 dogfood 还剩一层独立问题：

1. `宪宪` 这类 query 会先被 FTS 命中“正文里偶然提到宪宪”的噪声文档，真正的命名文档虽然有 section-heading keyword，却进不了前排。
2. `花名册 命名` 这类 query 会被 unicode61 FTS 的中文 token 边界卡住；当前 fallback 又只查 `keywords`，导致 title 里的 `花名册` 根本进不了候选集。

目标是把这层 recall gate 补平，让“关键词已进索引”真的体现在结果集里，而不是停留在 SQLite 行数据正确。

## Original Requirements（必填）

> `如果你要，我下一步可以直接收这个 recall gate，专门把 \`宪宪 / 砚砚 / 花名册 命名\` 这类 query 修到稳定命中。`
> `@gpt52 那你继续？ 走起吧！`

- 来源：当前 thread
  - `0001776269507923-000002-07167df0`
  - `0001776269900148-000006-3cddf4e1`
- **请对照上面的原话判断：这次交付是否真正补平了 recall gate，而不是只让索引数据“看起来对”。**

## Tradeoff

- 没有扩大到 FTS schema/migration，把 `keywords` 并进 FTS5；这会引入重建策略和迁移面，超出本轮 fix 的最小边界。
- 没有做 query normalization / 同义词表（如“命名”→“名字由来”）；这属于更高一层的检索语义增强，不是这次 runtime 真实暴露的核心缺口。
- 没有继续往 `sqlite-evidence-store.test.js` 追加测试；单开测试文件，避免把已有 376 行老文件继续堆大。

## Open Questions

1. 这版把 substring backfill 扩到 `title + summary + keywords`，并用 `keywordHits/titleHits/textHits` 做局部重排，这个排序强度是否合适？
2. 我保留了 exact-anchor first 语义，并只在 lexical candidate 阶段做 backfill；这会不会影响 hybrid 的 BM25 candidate 质量，还是正好是想要的补强？
3. `SqliteEvidenceStore.ts` 这次是替换原 fallback 逻辑，不是继续堆 if/else；从 reviewer 视角看，这个拆分是否已经足够，还是还需要再抽一层 query builder？

## Next Action

请在我的 worktree 上 review 这次 fix，重点看：

1. 这是不是最小正确修法，而不是把 recall 问题扩大成检索架构改造。
2. 新 helper 的 coverage / ranking 信号是否会误伤现有 lexical 排序。
3. 新测试是否钉住了 runtime 真问题，而不是只测 toy case。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-f102-recall-gate/opus`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本次为 backend recall 修复，无前端页面验收）

## 自检证据

### Spec 合规

这次是 F102 的后续 bug fix，目标不是“再做一套检索策略”，而是把 runtime 已暴露的 recall gate 补齐：

1. keyword hit 能进入前排，而不是被 incidental FTS hit 压住。
2. FTS miss 时，title/summary substring 也能成为 lexical 候选。

Artifact Hygiene：

- `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空 ✅

### 测试结果

```text
pnpm --filter @cat-cafe/api build
  → exit 0

node --test packages/api/test/memory/sqlite-evidence-store.test.js \
             packages/api/test/memory/sqlite-evidence-store-lexical-backfill.test.js \
             packages/api/test/memory/cat-cafe-scanner-recall.test.js \
             packages/api/test/memory/search-mode-split.test.js
  → 40 passed, 0 failed

node --test packages/api/test/evidence-route.test.js
  → 13 passed, 0 failed

pnpm --filter @cat-cafe/mcp-server build
  → exit 0

node --test packages/mcp-server/test/evidence-tools.test.js
  → 2 passed, 0 failed

pnpm lint
  → exit 0 (存在仓库既有 web hardcoded-color warnings，与本次 diff 无关)

pnpm check
  → exit 0
```

### 相关文档

- Feature: `docs/features/F102-memory-adapter-refactor.md`
- Current thread evidence:
  - `0001776269507923-000002-07167df0`
  - `0001776269900148-000006-3cddf4e1`
