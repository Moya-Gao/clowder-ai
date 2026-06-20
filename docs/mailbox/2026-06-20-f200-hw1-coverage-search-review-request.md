---
feature_ids: [F200]
topics: [coverage-search, memory, review-request]
doc_kind: mailbox
created: 2026-06-20
---

# Review Request: F200 HW-1 Coverage Search Mode

Review-Target-ID: f200-hw1
Branch: feat/f200-hw1-coverage-search

## What

New `CoverageSearchService` + `intent=coverage` parameter on `search_evidence` — multi-scope exhaustive search with coverage matrix output. Three expansion data sources (frontmatter aliases, source-thread links, F242 convention graph edges as soft dep). 7 files changed, 4 commits, 23 new tests.

Files changed:
- `packages/api/src/domains/memory/coverage-search-types.ts` — NEW: terminal schema (types + quota + telemetry)
- `packages/api/src/domains/memory/CoverageSearchService.ts` — NEW: stateless orchestrator
- `packages/api/src/domains/memory/interfaces.ts` — `intent` field added to `SearchOptions`
- `packages/api/src/routes/evidence.ts` — `intent=coverage` dispatch block
- `packages/mcp-server/src/tools/evidence-tools.ts` — `intent` in MCP input schema
- `packages/mcp-server/src/tools/evidence-coverage-nudge.ts` — nudge text updated
- `packages/api/test/memory/coverage-search.test.js` — NEW: 23 tests

## Why

65% search abandon rate + 30% reformulation rate = cats doing manual coverage by repeatedly searching. `intent=coverage` gives them system-level multi-scope search in one call. This was the top HW item in F200 v1.2 backlog, with Design Gate PASS (宪宪+砚砚, 6 OQ resolved).

## Original Requirements（必填）

> 铲屎官 2026-06-19: "HW-1 spec 调研（coverage/source-map 搜索模式）... 现在在做的 f242 code graph 类的 feat 能不能给你们灵感"
> "你先把你的灵感点和想法写到你的f200 feat md？更新一下 然后 再开始？包括 HW-1 + F242 交叉的方向 然后 你做HW-1 的 spec 调研"
> "可以 启动吧 和砚砚完成合作不要老问我嘛"

- 来源：`docs/discussions/2026-06-19-f200-hw1-coverage-search-research/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- No LLM-based expansion (KD-8: give data not conclusions) — keyword + regex + graph edge only
- No auto-trigger (first version nudge-only, explicit `intent=coverage` required)
- No shadow mode (coverage doesn't change ranking — separate pipeline entirely)
- Convention graph is soft dep: unavailable/stale → graceful fallback with degraded note

## Architecture Ownership（必填）

Architecture cell: `memory` primary, `code-intelligence` soft dependency
Map delta: none
Why: Extends memory retrieval surface (new service + types), does not change memory cell boundary

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Expansion search budget**: Each keyword from direct hits triggers a follow-up `searchScope(term, 'docs', 5)`. With many keywords this could be chatty. Current cap: 5 results per keyword term. Is this reasonable or should we add a total expansion search count cap?

2. **Thread ref regex**: Using `/thread-[a-z0-9_-]+/gi` to extract thread references from summaries. May miss non-standard thread ID formats. Worth adding wiki-link `[[...]]` extraction too?

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 review 代码正确性、expansion 策略是否合理、telemetry coverage 是否充分。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f200-hw1/gpt52`
- Start Command: `pnpm review:start`
- Ports: 纯后端，无需起服务。`node:test` 即可验证全部行为

## 自检证据

### Spec 合规

Quality Gate PASSED (2026-06-20 01:30):
- AC-1~AC-9 全部 ✅ met
- Dogfood: CoverageSearchService.search("Redis 圣域") → 3 hits (1 direct + 1 alias + 1 source-thread), telemetry correct
- No hotfix pattern, no follow-up tails, no root artifacts, no new arch names

### 测试结果

```
Memory tests → 1507/1508 pass (1 pre-existing path error in passage-embedding-source-contract.test.js)
Coverage search tests → 23/23 pass
pnpm check → 0 errors (biome format + lint)
pnpm lint → 0 errors (1 pre-existing warning in web/)
pnpm -r --if-present run build → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-06-19-f200-hw1-coverage-search.md`
- Research: `docs/discussions/2026-06-19-f200-hw1-coverage-search-research/README.md`
- Feature: F200 — `docs/features/F200-memory-recall-eval.md` (HW-1 row)
