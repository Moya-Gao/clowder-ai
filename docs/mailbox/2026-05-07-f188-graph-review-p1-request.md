---
feature_ids: [F188]
topics: [memory, graph, review, p1]
doc_kind: review-request
created: 2026-05-07
author: codex
reviewer: opus
---

# Review Request: F188 Graph Review P1 Follow-up

Review-Target-ID: f188-graph-review-p1
Branch: `fix/f188-graph-review-p1`
Commit: `5fbb4d7cb`

## What

修复 PR #1585 合入后云端 review 仍指出的两条 P1：

- `GraphResolver.ts`: private/restricted edge 指向 unresolved anchor 时，不再把原始 anchor 字符串暴露到 placeholder node 和 edge endpoint。
- `IndexBuilder.ts`: content `doc_link` 的 source path 不再对 scanner 已返回的 relative path 二次 `relative(scanRoot, ...)`；同时兼容 `docs/...` 与去掉 `docs/` 前缀的 path key，修复 GenericRepoScanner 下 `/docs/...` 链接漏边。

## Why

宪宪把两条 P1 降级为 P3 的依据不成立：

- unresolved anchor 不只会是公开 feature ID；WikiLink 可以来自 private 文档正文，任意字符串会成为 unresolved anchor。
- `doc_link` 漏边可在 GenericRepoScanner flow 里复现：`/docs/features/F186.md` 会被 extractor 转成 `features/F186.md`，但旧 `pathToAnchor` 只有 `docs/features/F186.md`。

## Original Requirements（必填）

> 你来 P1 "Redact unresolved anchor strings": anchor 是公开 feature ID，无敏感数据
> P1 "Re-relativization CWD dependency": 所有部署/测试环境 CWD===projectRoot，28 tests 全绿，无复现证据 看看宪宪说的对吗？

- 来源：thread handoff（2026-05-07，铲屎官 → @codex）
- **请对照上面的摘录判断：两条 P1 的处理是否应该退回为必须修，而不是 P3 pushback。**

## Tradeoff

- 没有改 `edge-extractors.ts` 的 public API；在 `IndexBuilder` 构建 `pathToAnchor` 时补齐两种 key，降低影响面。
- unresolved public edge 仍保留原始 anchor，避免把公开 graph 的可调试性一起抹掉；只有 private/restricted edge 导致的 unresolved placeholder 才 opaque redaction。

## Architecture Ownership（必填）

Architecture cell: `memory`
Map delta: `none`
Why: 修复现有 memory graph resolver/index builder 的边界行为；没有新增 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- redaction 是否覆盖 private/restricted unresolved placeholder 与 edge endpoint
- path normalization 是否只影响 `doc_link` resolution，不破坏既有 CatCafeScanner relative link 行为

## Open Questions

- `GraphResolver` 的 opaque unresolved node 是否应该仅在 private/restricted edge 下触发？当前实现是“是”。
- `IndexBuilder` 同时注册 `docs/...` 与去前缀 key 是否足够覆盖 CatCafeScanner + GenericRepoScanner 两类 flow？

## Next Action

请做跨猫 code review。若放行，再进入 merge-gate 开 PR 合入 `main`。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f188-graph-review-p1/opus`
- Start Command: `pnpm review:start`
- Ports: API-only fix；未启动 dev server

## 自检证据

### Spec 合规

- P1-1: RED 证明 private unresolved anchor `SecretCodename` 会出现在 graph JSON；GREEN 后 JSON 不含原始字符串，node/edge 均使用 opaque anchor。
- P1-2: RED 证明 Generic repo `/docs/features/F186-b.md` 不生成 `doc_link` edge；GREEN 后 `F188 -> F186` edge 存在。
- Architecture ownership: `memory`, map delta `none`。
- Root artifact gate: no root media/design artifacts in this branch.

### 测试结果

```bash
# RED before fix: both cloud-P1 tests failed
NODE_ENV=development pnpm --filter @cat-cafe/api build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 REDIS_URL=redis://localhost:6398 NODE_ENV=test \
  bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/memory/graph-resolver.test.js test/memory/edge-extraction-integration.test.js

# GREEN after fix
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 REDIS_URL=redis://localhost:6398 NODE_ENV=test \
  bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/memory/edge-extractors.test.js test/memory/edge-extraction-integration.test.js \
  test/memory/graph-resolver.test.js test/memory/schema-v18-edges-verify.test.js \
  test/memory/collection-read-model.test.js
# tests 46, pass 46, fail 0

pnpm exec biome check \
  packages/api/src/domains/memory/GraphResolver.ts \
  packages/api/src/domains/memory/IndexBuilder.ts \
  packages/api/test/memory/graph-resolver.test.js \
  packages/api/test/memory/edge-extraction-integration.test.js
# exit 0; only pre-existing complexity/noNonNullAssertion warnings in memory files
```

Full API suite was attempted with `REDIS_URL=redis://localhost:6398`; current local run is blocked by an unrelated `capabilities-route.test.js` project-skills symlink assertion after MCP server build. No failing test touches the four files in this branch.

### 相关文档

- Feature: `docs/features/F188-library-stewardship.md`
- Original PR: #1585
