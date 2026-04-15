---
feature_ids: [F102]
topics: [review-request, memory, evidence-search, recall]
doc_kind: note
created: 2026-04-14
---

# Review Request: evidence recall raw gap fix

Review-Target-ID: fix-evidence-recall-raw-gap
Branch: fix/evidence-recall-raw-gap

## What

这次修了两条 dogfooding 暴露出来的真实问题：

1. `CatCafeScanner` 现在会把 markdown 二级及以下 section heading 合并进 `keywords`，避免多 section 文档只有首段摘要可被 lexical recall 命中。
2. MCP `search_evidence` 工具现在会区分 `raw_lexical_only` 和真正的 `evidence_store_error`，不再把“按 lexical 降级执行成功”误报成存储错误。

改动文件 4 个：

- `packages/api/src/domains/memory/CatCafeScanner.ts`
- `packages/mcp-server/src/tools/evidence-tools.ts`
- `packages/mcp-server/test/evidence-tools.test.js`
- `packages/api/test/memory/cat-cafe-scanner-recall.test.js`

## Why

这次吃猫粮时，暴露的是两类不同层级的问题：

1. `depth=raw + mode=hybrid` 其实早已在 API 层按契约降级为 lexical，但 MCP 文本化输出一直报 `[DEGRADED] Evidence store error`，会误导调用方。
2. `docs/stories/cat-names/README.md` 这类多 section 文档里，像“砚砚”这种出现在后段 section heading 的关键词，之前没有进入 scanner 关键词索引，导致 lexical raw recall 明显偏弱。

目标是把“吃猫粮时看到的真实缺口”补平，而不是扩大成一次新的检索架构改造。

## Original Requirements（必填）

> `@gpt52 吃吃自己的猫粮看看你们现在检索效果如何了`
> `@gpt52 来啊 开woektree 跳差清楚然后修复？`
> `@gpt52 那你喊宪宪去你的woektree review看看？ 然后走sop`

- 来源：当前 thread
  - `0001776230000737-000011-7362d6b0`
  - `0001776234657373-000002-86982650`
  - `0001776235344123-000028-ad7371b2`
- **请对照上面的原话判断：这次修复是否真正改善了吃猫粮时暴露的检索体验，而不是只改了表面文案。**

## Tradeoff

- 没有扩大到“正文全文索引增强”或 query normalization。原因：这次锁定的真实漏召回点是 section heading 没进关键词，而不是 tokenizer 全面失效。
- 没有改 API route 契约，只修 MCP adapter 的降级呈现。原因：route 已经返回 `degradeReason=raw_lexical_only` + `effectiveMode=lexical`，问题出在消费层包装错误。
- `extractSectionKeywords()` 只抓 `##+` heading，不抓普通正文句子，避免把文档正文无差别膨胀成关键词池。

## Open Questions

1. 把 `##/###` heading 合并进 `keywords`，对我们现有 docs 集合来说是否是合适的最小召回增强，还是会带来过宽匹配？
2. MCP 层把 `raw_lexical_only` 单独翻译为 graceful degradation，是否足够，还是应进一步把 `degradeReason/effectiveMode` 原样暴露给调用方？
3. 这次修复后，“砚砚 名字由来”已能 lexical 命中；但像“砚是磨墨的”这类正文短句仍主要依赖 semantic/hybrid。这个边界是否接受？

## Next Action

请在我的 worktree 上 review 这次 fix，重点看：

1. 这是不是最小正确修法，而不是新的隐性范围膨胀。
2. scanner 关键词增强是否有回归风险。
3. MCP degraded 文案分支是否准确反映了现有 API 契约。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-evidence-recall-raw-gap/opus`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本次改动为 backend/MCP recall 修复，无前端页面验收）

## 自检证据

### Spec 合规

这是一次 F102 相关 bug fix，不是新 feature phase。目标是补平吃猫粮时发现的两条真实缺口：

1. lexical raw recall 对多 section 文档的后段 heading 漏召回。
2. MCP 对 `raw_lexical_only` 的降级原因误报。

`.pen` 设计稿对照：不适用。本次无 UI 改动。

Artifact Hygiene：

- `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空 ✅

### 测试结果

```text
pnpm lint                                              → exit 0
pnpm check                                             → exit 0
pnpm -r --if-present run build                         → exit 0
node --test packages/api/test/memory/cat-cafe-scanner-recall.test.js
                                                      → 1 passed, 0 failed
node --test packages/mcp-server/test/evidence-tools.test.js
                                                      → 2 passed, 0 failed
node --test packages/api/test/evidence-route.test.js \
           packages/api/test/memory/raw-passage-ranking.test.js \
           packages/api/test/memory/index-builder.test.js
                                                      → 80 passed, 0 failed
```

补充说明：

- 全量 `pnpm test` 在当前环境会被仓库现有的 Redis isolation 门禁拦住，失败点来自未触碰的 Redis 相关测试，不是本次 diff 引入；因此这轮用“改动相关测试集 + 全量 check/build”做 gate。

### 相关文档

- Feature: `docs/features/F102-memory-adapter-refactor.md`
- Current thread evidence:
  - `0001776230000737-000011-7362d6b0`
  - `0001776234657373-000002-86982650`
  - `0001776235344123-000028-ad7371b2`
