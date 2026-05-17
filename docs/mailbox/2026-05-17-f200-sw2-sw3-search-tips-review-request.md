---
title: F200 v1.2 SW-2/SW-3 Search Tips + Coverage Nudge Review Request
date: 2026-05-17
type: review-request
feature: F200
branch: feat/f200-sw2-sw3-search-tips
---

# Review Request: F200 v1.2 SW-2/SW-3 Search Tips + Coverage Nudge

Review-Target-ID: f200-sw2-sw3-search-tips
Branch: feat/f200-sw2-sw3-search-tips

## What

Implemented the two F200 v1.2 soft-power follow-ups:

1. **SW-2 MCP description tips**
   - `search_evidence`: says coverage/source-map questions are not solved by a single top-k search; points cats to `memory-search-best-practices`.
   - `list_recent`: documents `updatedAt` semantics after DF-1 (`file mtime`, not index rebuild time) and scope/kinds intersection behavior.
   - `graph_resolve`: warns that `depth>=2` without `relations` can trigger hub fan-out.
2. **SW-3 coverage intent inline nudge**
   - `search_evidence` now appends a coverage-task nudge when the query contains coverage intent keywords like `哪些`, `所有`, `历史上`, `提过`, `沉淀`, plus English source-map/provenance terms.
   - The nudge is independent of result count. A high-confidence result set can still be incomplete for "find all mentions" tasks.
   - The nudge deliberately does **not** reuse the existing `🧭 Memory navigation` marker, so F188 navigation nudge telemetry stays scoped to graph/list routing.

## Why

The AUDHD recall dogfood showed that the engine could return good results, but different cats stopped at different depths. The gap was behavior, not just ranking: coverage tasks need query expansion, separate docs/threads passes, drill-down, and Read of canonical/source items.

This PR makes that workflow visible at the tool boundary without hard-coding domain-specific query expansion into the search engine.

## Original Requirements（必填）

> "我们需要更新配套软实力了？（skills mcp description优化）"
> "现在开 → 我去 @ 砚砚让他做两件软实力（半天活）-》走起"
> "Query expansion ... 不应该自动展开 ... 而是我们可能需要有 hook 或者 mcp tools 描述要告诉猫猫如何搜索"

- 来源：当前 thread + `docs/features/F200-memory-recall-eval.md` v1.2 backlog
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Did **not** implement engine-level query expansion. The system should not guess that `AUDHD` means `sensory gating / hyperfocus / 2e / RSD / PDA`; agents should do that through the `memory-search-best-practices` skill.
- Did **not** tie the nudge to result count. This follows the reviewed v1.2 decision: ten results can still be a partial coverage set.
- Did **not** count coverage nudges as the old F188 navigation nudge. If we want metrics for coverage nudges, that should be a separate `nudgeType` decision.

## Architecture Ownership（必填）

Architecture cell: memory-recall / mcp-tooling
Map delta: none
Why: extends existing MCP tool descriptions and result formatting; no new Store / Queue / Router / Adapter / Dispatcher / Binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. Coverage trigger precision: are the keyword patterns too broad or too narrow? I narrowed Chinese `所有` to avoid `所有权`, but English `all/which/history` may still be broad.
2. Telemetry separation: is it correct that this nudge avoids the `🧭 Memory navigation` marker and therefore does not increment existing F188 navigation nudge metrics?
3. Tool description length: are the SEARCH TIPS clear enough without making MCP descriptions too heavy?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review the MCP description wording, coverage-intent trigger, and nudge formatting. If no P1/P2, approve so I can proceed to merge-gate.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f200-sw2-sw3-search-tips/opus`
- Start Command: `pnpm --filter @cat-cafe/mcp-server build && node --test packages/mcp-server/test/*.test.js`
- Ports: `web=N/A`, `api=N/A`（pure MCP/server formatting change; no browser review needed）

## 自检证据

### Spec 合规

- F200 v1.2 SW-2: MCP tool description search tips implemented for `search_evidence`, `list_recent`, `graph_resolve`.
- F200 v1.2 SW-3: coverage intent inline nudge implemented for coverage/source-map queries.
- Architecture ownership: no map delta, no new ownership boundary.
- UI/design: no frontend changes. Existing memory `.pen` files are unrelated; no design comparison required.
- Root artifact guard: no root media/design artifacts in working tree or committed diff.
- Fallback check: `✅ No fallback pattern changes detected.`
- Hotfix check: `{"hotfix":false,"autoLabel":false,"labelApplied":null,"labelError":null}`.

### 测试结果

```bash
pnpm --filter @cat-cafe/mcp-server build
# success

node --test packages/mcp-server/test/evidence-tools-nudge.test.js packages/mcp-server/test/evidence-tools.test.js packages/mcp-server/test/recent-tools.test.js packages/mcp-server/test/graph-tools.test.js
# 29/29 pass

node --test packages/mcp-server/test/*.test.js
# 203/203 pass

pnpm check
# pass

pnpm -r --if-present run build
# pass

pnpm check:architecture-ownership
# pass with existing warnings only
```

### 相关文档

- Feature: `docs/features/F200-memory-recall-eval.md`
- Skill referenced by descriptions: `cat-cafe-skills/memory-search-best-practices/SKILL.md`
