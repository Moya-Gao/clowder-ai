---
feature_ids: [F188]
topics: [memory, graph-query-resolution, review-request]
doc_kind: mailbox
created: 2026-05-09
---

# Review Request: F188 AC-C7 Graph Query Resolution

Review-Target-ID: f188-graph-query-resolution
Branch: feat/f188-graph-query-resolution

## What

把 Memory Graph 入口从 blind exact-anchor lookup 改成 query resolution flow：

- 精确 anchor（`F186` / `f186` / `doc:...`）直接解析成 canonical center 并画 graph。
- 非 anchor query（如 `harness`）走 evidence search，返回最多 8 个可解释候选，不静默自动选第一个。
- 无证据自然语言 query 返回 no-match UX + anchor 示例，不再误报 "No graph data for this anchor"。
- exact node 存在但暂无关联边时显示单节点 graph + "暂无关联边"说明。
- candidate list 遵守 collection visibility / sensitivity；private/restricted 不通过 fallback 泄露真实 anchor/title/path。

核心实现：
- `GraphQueryResolver.ts`：exact graph / candidates / no_match 三态解析。
- `/api/library/graph/resolve`：localhost-only query resolution endpoint。
- `CollectionGraphQueryStates.tsx`：候选列表、no-match、no-edge note。
- UI submit 改走 resolver，candidate click 仍走 direct graph endpoint。

## Why

铲屎官发现 Graph 输入框像搜索框，但实际只能盲猜 anchor。`harness` 这种自然输入得到空图，用户根本不知道 anchor 有哪些、什么能输、为什么找不到。

这次不是 hotfix search fallback，而是补齐 Graph Query Resolution 契约：输入解析、候选选择、no-match UX、隐私边界全部进入 F188 AC-C7。

## Original Requirements（必填）

> "如果我搜一个 harness 这样 能返回点什么给我吗？anchor到底都有什么呢？什么才算呢？只有feat吗？"
> "Graph 输入框需要“搜索 fallback / autocomplete / anchor examples”，否则用户根本不知道什么能输。"
> "比如我想搜一个harness 甚至我搜的可能是铲屎官的工资！landy最喜欢什么猫！你们也应该能画出来！"

- 来源：`docs/features/F188-library-stewardship.md` 的 Graph Query Resolution / AC-C7；原始 thread 触发于 2026-05-09。
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题。**

## Tradeoff

- 没做 autocomplete/debounce：AC-C7 先要求 submit-time resolution，避免把输入体验和候选解析混成一个大改。
- 没做 LLM answer generation：自然语言 query 只能基于 indexed evidence 找候选；没有证据就 no-match，不编造答案。
- 候选必须有 explainable field/token match：hybrid search 低相关结果如果无法解释命中原因，会被过滤为 no-match，避免把 broad/garbage query 伪装成有效候选。
- candidate cap 固定为 8：防止 broad query 淹没 UI。

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: Extends existing memory graph/search route and Memory Hub UI; no new Store / Queue / Router family / Adapter boundary.

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- `GraphQueryResolver` 是否只是 existing store + `GraphResolver` 的 query-facing coordinator，而不是新的 graph read model

## Open Questions

### 技术 OQ（给 reviewer）

1. `GraphQueryResolver` 的 explainable match gate 是否过严或过松：应拦住 `zzzz-no-such-anchor-987654321` 这类低相关 hybrid 结果，同时保留 `harness` / 中文自然 query 的有效候选。
2. Privacy contract 是否完整：candidate search 不泄露 private/restricted anchor/title/path；exact graph 仍由 `GraphResolver` 统一 redaction。
3. Frontend state machine 是否符合 AC-C7：graph / candidates / no_match / no_edges 四态是否无 silent auto-select、无误导文案。
4. `/api/library/graph/resolve` 的 localhost guard、depth validation、collections visibility 是否与现有 graph endpoint 一致。

### 价值 OQ（给 CVO，如有）

无。AC-C7 的产品方向已经由铲屎官确认；当前只需 reviewer 做实现把关。

## Next Action

请 @opus 做代码 review。重点看 AC-C7a~C7g 覆盖、隐私边界、候选可解释性和前端可读性。若 0 P1/P2，请放行进入 merge-gate。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f188-graph-query-resolution/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 自动分配隔离端口；作者浏览器验收使用过 `web=5115`, `api=3112`（已停止，未占用）

## 自检证据

### Spec 合规

- Feature spec: `docs/features/F188-library-stewardship.md`
- Plan: `docs/plans/2026-05-09-f188-graph-query-resolution.md`
- AC-C7a: exact `F186` / case-insensitive `f186` 直接 graph ✅
- AC-C7b/C7c/C7d: `harness` 返回 explainable candidate list，最多 8 个，不自动选择 ✅
- AC-C7e: no-match 与 no-edge 分开展示 ✅
- AC-C7f: candidate privacy filtering + GraphResolver redaction reuse ✅
- AC-C7g: 浏览器验收覆盖 `F186`、`f186`、`harness`、无证据 query ✅

### 测试结果

```bash
cd packages/api
node --test test/memory/library-graph-query-route.test.js test/memory/graph-query-resolver.test.js
# 12 pass, 0 fail

unset NODE_ENV
NODE_ENV=test pnpm --dir packages/web exec vitest run \
  src/components/memory/__tests__/CollectionGraph.test.tsx \
  src/components/memory/__tests__/CollectionGraphQueryResolution.test.tsx
# 2 files passed, 17 tests passed

pnpm --filter @cat-cafe/api build
# pass

pnpm --filter @cat-cafe/web exec tsc --noEmit
# pass

pnpm lint
# exit 0; warnings are pre-existing no-hardcoded-colors/react-hooks

pnpm -r --if-present run build
# exit 0

pnpm test
# exit 0; web: 386 files / 2920 tests passed; API suite completed green
```

### Browser 验收

本地 production-like 验收已完成（服务已停止）：

- `query=F186`：直接 graph，中心节点为 F186，Inspector 可读。
- `query=f186`：case-insensitive 解析到 canonical `F186`。
- `query=harness`：展示 8 个候选，包含 title/kind/source/match reason/edge count。
- `query=zzzz-no-such-anchor-987654321`：显示 no-match UX + anchor 示例，不再泄露低相关候选。

### 工具/门禁备注

```bash
pnpm exec biome check <8 changed files>
# Checked 8 files. No fixes applied.

pnpm check
# exit 1 due unrelated pre-existing formatter issue:
# packages/api/test/f194-phase-z-routes-integration.test.js
```

Changed-file Biome 通过；repo-wide `pnpm check` 的失败文件不在本 PR diff 内。

```bash
node scripts/check-hotfix-pattern.mjs
# {"hotfix":false,"autoLabel":false,...}

node scripts/check-fallback-layers.mjs
# New resolver/UI state handling increases fallback count.
```

Fallback self-check：这些分支是 query resolution 的显式状态边界（exact/candidates/no_match/no_edges）、optional indexed fields、privacy/default UI state，不是错误坐标系上的层层兜底。

根目录工件闸门：

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen|pptx)$'
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen|pptx)$'
# both empty
```

### 相关文档

- Feature: `docs/features/F188-library-stewardship.md`
- Plan: `docs/plans/2026-05-09-f188-graph-query-resolution.md`
- Review request: `docs/mailbox/2026-05-09-f188-graph-query-resolution-review-request.md`
