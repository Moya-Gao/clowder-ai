---
feature_ids: [F102]
topics: [review-request, memory, evidence-search, scope-filter]
doc_kind: note
created: 2026-04-15
---

# Review Request: F102 docs scope filter fix

Review-Target-ID: f102
Branch: fix/f102-scope-docs-filter

## What

这次只修 `scope="docs"` 的过滤契约，不改排序算法、schema 或 route 输出：

1. `SqliteEvidenceStore` 在 `scope="docs"` / `scope="memory"` 路径下，补齐对 `kind='thread'` 的排除。
2. 保留 `kind='discussion'`，因为它代表 file-backed discussion 文档，不是 thread digest。
3. 新增 lexical regression test，钉住 `scope=docs` 不再混入 thread/session，同时 discussion doc 仍可返回。
4. 给 semantic / hybrid 的 scope 行为补回归测试，防止后续路径再把 thread digest 漏进 docs scope。

改动文件：

- `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- `packages/api/test/memory/sqlite-evidence-store.test.js`
- `packages/api/test/memory/search-mode-split.test.js`

## Why

今晚 `F148` 深术语 dogfood 里，`scope="docs", depth="summary"` 明显被 thread digest 挤占结果位，看起来像“深术语召回弱”。顺藤摸瓜后，根因不是 ranking，而是 docs scope 过滤漏了 `thread`：

- 代码注释写的是“exclude sessions + threads”
- 实现实际只排了 `session`
- `mapKindToSourceType('thread') === 'discussion'`，所以 thread digest 在 UI 上会伪装成 discussion，肉眼更容易误判

这轮 fix 的目标是先把错误数据集收干净，再讨论排序和 benchmark，避免在错误候选集上继续调 recall。

## Original Requirements（必填）

> 三件事完成 = 记忆系统"跑起来"：
> 1. 启动自动 rebuild
> 2. search 默认 SQLite
> 3. memory status 可观测
>
> Canary：至少 3 条固定 query 稳定返回预期 anchor

- 来源：`docs/discussions/2026-03-14-f102-activation-meeting-notes.md`
- **请对照上面的摘录判断：这次 docs scope 修复是否让 query 验收更可信，而不是继续把 thread digest 当成 docs 结果。**

## Tradeoff

- 没有扩大到 recall/ranking 调参。今晚 `F148` 暴露出来的主因先是过滤层 bug，不是排序层。
- 没有按“排掉所有 discussion”来修，因为 `discussion` 里有真正的 file-backed 文档；这次只排 `thread` + `session`。
- 没有动 `mapKindToSourceType()` 的展示层映射；先把检索契约修正，显示命名是否要拆开另议。

## Open Questions

1. 你是否认同 `scope="docs"` 的正确边界是“排 `thread/session`，保留 file-backed `discussion`”？
2. semantic / hybrid 的 guard test 我一并补了，但真正的 red case 是 lexical；这个测试面是否合适？
3. 这轮修完后，你是否建议立刻 re-dogfood `F148` 深术语样本，再决定要不要继续调 docs/summary 的 recall？

## Next Action

请直接 review 这次最小修法，重点看：

1. 过滤契约是否修到正确边界，而不是过度排除。
2. 新 regression test 是否准确钉住了 `scope=docs` 漏入 thread digest 的问题。
3. 这轮是否已经足够作为“先修 filter，再 re-dogfood”的闭环起点。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f102/opus`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本次为 backend scope filter 修复，无前端页面验收）

## 自检证据

### Spec 合规

- 当前目标是 `F102` 检索链的契约修复，不是新一轮检索架构改造。
- `scope="docs"` 应该返回文档真相源，不该被 thread digest 占位；这轮修法直接对应今晚 dogfood 暴露的问题。
- `designs/F102-*.pen` 虽存在，但本次 diff 不含 `packages/web/` 变更，属于纯 backend 修复，无新增 UI 对照面。

Artifact Hygiene：

- `git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空 ✅

### 测试结果

```text
pnpm --dir packages/api build
  → exit 0

pnpm --dir packages/api run lint
  → exit 0

pnpm check
  → exit 0

pnpm --dir packages/api run test:redis
  → 8149 passed, 0 failed

pnpm --dir packages/api build && \
  CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  bash ./scripts/with-test-home.sh \
  node --test test/memory/sqlite-evidence-store.test.js test/memory/search-mode-split.test.js
  → 38 passed, 0 failed
```

说明：
- 直接跑 `pnpm --dir packages/api test` 时，仓库当前 shell 环境下会被 Redis 隔离护栏拦住；按仓库标准路径改跑 `test:redis` 后全绿。

### 相关文档

- Feature: `docs/features/F102-memory-adapter-refactor.md`
- Plan: `docs/plans/2026-04-13-f102-phase-k-contract-closure.md`
- Discussion: `docs/discussions/2026-03-14-f102-activation-meeting-notes.md`
