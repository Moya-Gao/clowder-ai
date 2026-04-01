---
type: review-request
from: opus
to: codex
feature: F148
date: 2026-04-01
---

# Review Request: F148 Phase B — Self-Serve Retrieval Enhancement

## Review Target
- **Review-Target-ID**: f148-phase-b
- **Branch**: `feat/f148-phase-b`
- **Commits**: 5 (store filter + API wiring + keyword scoring + boundary descriptions + biome)

## What

三个改动增强猫猫的主动检索能力：

1. **search_evidence threadId filter** — SearchOptions + SqliteEvidenceStore 三条 SQL 路径（exact anchor, FTS5, keyword fallback）增加 `anchor = 'thread-{threadId}'` 过滤
2. **get_thread_context keyword ranking** — 替换 `.includes()` substring match 为 tokenized term scoring (0-1)，按相关性排序，response 含 relevanceScore
3. **Tool boundary descriptions** — search_evidence = "FIND across project"，get_thread_context = "READ one thread"，BOUNDARY 标记清晰

## Why

Phase A 降了 80%+ context tokens，但猫猫的主动检索能力还是弱：search_evidence 无法限定 thread，get_thread_context keyword 是无排序的 substring match。Phase B 让 L4 (self-serve) 成为真承诺。

## Original Requirements（必填）

> "我觉得感觉最重要的，增量上下文的传输"
> （F148 整体需求：提升猫猫在 thread 中的信息获取效率）

- 来源：F148 spec `docs/features/F148-hierarchical-context-transport.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **threadId filter v1 只匹配 thread-kind 证据**：session-kind 证据需要 threadId→sessionId 映射，Phase D 再做
- **keyword scoring 用 term count ratio 而非 TF-IDF**：够用且零依赖，Phase C 可升级
- **不改 evidence.sqlite schema**：用 anchor prefix filter，不加新列

## Open Questions

1. threadId filter 是否需要覆盖 session-kind 证据？（需要 thread→session 映射）
2. keyword scoring 对中文分词效果如何？（当前按空格分词）

## Next Action

请 review：
- [ ] threadId filter 三条 SQL 路径正确性（`SqliteEvidenceStore.ts`）
- [ ] keyword scoring + sorting 逻辑（`callbacks.ts` + `keyword-relevance.ts`）
- [ ] API route + MCP schema wiring 完整性
- [ ] 现有行为不变（无 threadId/keyword 时原有行为保持）

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|-----|------|----------|----------|
| AC-B1 | search_evidence threadId filter | ✅ | SqliteEvidenceStore.ts (3 SQL paths) + evidence.ts + evidence-tools.ts | f148-phase-b-search-threadid.test.js (4 tests) |
| AC-B2 | keyword ranking | ✅ | keyword-relevance.ts + callbacks.ts | f148-phase-b-keyword-ranking.test.js (9 tests) |
| AC-B3 | tool boundary clarity | ✅ | evidence-tools.ts + callback-tools.ts | description strings (manual review) |

### 测试结果

```
f148-phase-b-search-threadid.test.js   → 4 passed, 0 failed ✅
f148-phase-b-keyword-ranking.test.js   → 9 passed, 0 failed ✅
pnpm lint                              → 0 errors ✅
pnpm check                             → 0 errors ✅
pnpm -r --if-present run build         → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F148-hierarchical-context-transport.md`
- Plan: `docs/plans/2026-04-01-f148-phase-b-self-serve-retrieval.md`

### 改动文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/api/src/domains/memory/interfaces.ts` | 修改 | SearchOptions + threadId |
| `packages/api/src/domains/memory/SqliteEvidenceStore.ts` | 修改 | threadId anchor filter (3 SQL paths) |
| `packages/api/src/routes/evidence.ts` | 修改 | API route threadId param |
| `packages/api/src/utils/keyword-relevance.ts` | 新增 | scoreKeywordRelevance + tokenizeKeyword |
| `packages/api/src/routes/callbacks.ts` | 修改 | keyword ranking + relevanceScore |
| `packages/mcp-server/src/tools/evidence-tools.ts` | 修改 | MCP schema + boundary description |
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | keyword description + boundary |
| `packages/api/test/f148-phase-b-search-threadid.test.js` | 新增 | 4 threadId filter tests |
| `packages/api/test/f148-phase-b-keyword-ranking.test.js` | 新增 | 9 scoring tests |
