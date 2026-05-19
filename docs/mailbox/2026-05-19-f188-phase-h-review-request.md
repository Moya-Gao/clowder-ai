# Review Request: F188 Phase H — Collection-Aware Recent Selection

Review-Target-ID: f188-phase-h
Branch: feat/f188-phase-h

## What
1. **AC-H1 (privacy fix)**: `computeChildExcludes()` in factory.ts — pre-loads external collection manifests, computes relative glob excludes for child roots nested inside docsRoot, passes them to `project:cat-cafe` registration. Prevents private child docs (e.g. `domain:finance` under `docs/library/finance/`) from being indexed into the parent's store.

2. **AC-H2 (fairness)**: `applyGuaranteedMinimum()` in RecentBrowseResolver — replaces global sort+slice with per-collection minimum allocation. Each eligible collection gets ≥1 slot; remaining slots filled by global recency. When eligible > limit, picks top collections by most recent item.

3. **AC-H3**: `SelectionGroup` type + `computeSelectionGroups()` — returns `groups?: SelectionGroup[]` with key, type, label, count, available. Route passes through to API consumers. Omitted for single-collection results.

4. **AC-H4**: MCP text footer — `Collections: alpha(6/10) | beta(2/5)` when groups present.

5. **AC-H5**: 6 regression fixtures (4 unit + 2 e2e) covering cross-collection burst and overlap privacy.

6. **AC-H6**: N/A confirmed — `ToolUsageMetricsPanel` consumes `/api/library/tool-usage-metrics`, not list_recent items.

## Why
砚砚 dogfood 发现 19/20 finance docs appeared under `source: project:cat-cafe` — privacy leak because `project:cat-cafe.root = docs/` overlaps `domain:finance.root = docs/library/finance/`. Additionally, `world:lexander` temporary docs burst dominated list_recent top 20, squeezing out project docs entirely.

## Original Requirements（必填）
> "list_recent 不区分 Collection，R1 临时文档（world:lexander）太多会把 project:cat-cafe 的正经内容挤出 top 20。Phase H 让 list_recent 按 Collection 分组/限额，确保每个 Collection 都有露出。"
- 来源：铲屎官 session 消息 (2026-05-19)
- 砚砚 Design Gate R2 追加：overlap fix must be first AC (privacy/ownership bug)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
砚砚 R1 proposed multi-dimensional bucketing (source_root × kind). Pushed back: root cause is collection overlap at scan time, not algorithm insufficiency. Per-collection minimum is sufficient; intra-collection kind-prefix bucketing is YAGNI (P3 follow-up only if real pain appears). R2 accepted.

## Architecture Ownership（必填）
Architecture cell: memory
Map delta: none
Why: Extends existing RecentBrowseResolver + factory registration; no new Store/Queue/Router

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `computeChildExcludes` uses `absChild.startsWith(absParent + '/')` for containment — is path separator hardcoding safe on macOS/Linux? (Windows not a target platform)
2. The dedup key in `applyGuaranteedMinimum` uses `\0` (null byte) separator: `${r.source}\0${r.anchor}`. Any concern about anchor values containing null bytes?

### 价值 OQ（给 CVO，如有）
无

## Next Action
请完整审查 7 个改动文件 (717 lines added)。重点关注：
- AC-H1: `computeChildExcludes` path containment logic 正确性
- AC-H2: `applyGuaranteedMinimum` edge cases (empty results, eligible > limit, dedup)
- AC-H3: `computeSelectionGroups` 与 F200 consumption rerank 的 backward compatibility
- AC-H4: `deriveListRecent` regex parser 不被新 footer 行干扰

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f188-phase-h/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 无前端验证需要（AC-H6 N/A）

## 自检证据

### Spec 合规
Quality gate passed — 6/6 AC met. Fallback layer check flagged 6 `??` in RecentBrowseResolver.ts, all idiomatic Map.get initialization patterns (justified in gate report). No follow-up tails. No root artifact hygiene issues. Architecture ownership declared: memory cell, map delta none.

### 测试结果
```
pnpm test       → 416 files, 3115 passed, 0 failed
pnpm lint       → 0 errors
pnpm check      → 0 errors (biome format + lint + all checks)
pnpm -r --if-present run build → exit 0
```

### 相关文档
- Plan: `docs/plans/2026-05-19-f188-phase-h-collection-aware-recent.md`
- Feature: `docs/features/F188-library-stewardship.md`
