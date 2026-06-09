---
feature_ids: [F192]
topics: [review-request, publish-verdict, task-outcome, generator-wire]
doc_kind: mailbox
created: 2026-06-09
---

# Review Request: F192 task-outcome publish_verdict PR2 wire flip

Review-Target-ID: f192
Branch: feat/f192-task-outcome-publish-verdict-pr2

## What

This PR flips `eval:task-outcome` from PR1's honest `unsupported_generator` 501 into a real live-verdict publish path:

- adds the task-outcome generator adapter and replay-window source resolver
- writes bundle-backed live verdict artifacts (`snapshot.json`, `attribution.json`, `provenance.json`, `verdict.md`, `raw/episodes.json`)
- wires task-outcome into runtime `verdictGenerators` + `wiredPublishDomains`
- adds task-outcome publish instructions to `buildEvalCatInvocation`
- updates the MCP tool description to include task-outcome as a wired domain
- adds end-to-end tests across API handler, generator bundle output, hub read-model load, and MCP wrapper

## Why

PR1 only established the selector/schema contract and kept the domain silent on publish. This PR is the atomic wire-flip planned in `docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`: after merge, task-outcome eval cats can publish real verdict PRs through the same unified path as a2a/capability-wakeup.

## Original Requirements（必填）

> "不要 搞这种hot fix？ 就是应该直接和其他a2a 那种那样对接到统一管道？ 顺手把 schema 抽出来写成 docs/harness-feedback/SPEC.md？这样 manual contributor（包括未来社区贡献者）能直接看规范，不用啃代码。"

- 来源：`docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- packet verdict 继续沿用 F192 共享 4-class enum；7-class episode verdict writeback 不在本 PR 内实现
- 生成器的 evidence source 以 `terminalState` + signal distributions 为主，不伪造当前仍全 `NULL` 的 episode verdict distribution
- F227 event-memory 只先做 count-level sidecar component，不把更细的 cross-store semantics 一起塞进这轮

## Architecture Ownership（必填）

Architecture cell: harness-eval  
Map delta: none  
Why: 全部改动都在既有 harness-eval / publish-verdict 边界内扩展，没有新增并行 store/queue/router family，也没有改变 ownership cell 边界。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

- task-outcome generator 现在采用“cat owns packet, generator overwrites bundle refs”模式，只守 domain/feature submitted-packet invariant；是否还需要把 componentId 进一步锁死到 `Phase-G-v0`
- `resolveTaskOutcomeSourceWindow()` 现在直接只读 SQLite 并在 event-memory 缺席时降为空 component；这个 fail-open/close 边界是否合适

### 价值 OQ（给 CVO，如有）

无

## Next Action

请按 code review 模式优先看：
- wire flip 是否真的原子（不再有 fake-wire surface）
- bundle contract 是否完全兼容 `loadEvalHubSummary()`
- replay window/source resolver 有没有跨库/路径上的隐患

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本 PR 是 backend/schema/generator path，无需起 dev server）

## 自检证据

### Spec 合规

- 对照 plan：`docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`
- 本 PR 覆盖 PR2 touchpoints：
  - task-outcome publish instruction map
  - MCP wired-domain description
  - runtime `verdictGenerators` + `wiredPublishDomains`
  - generator/adapter/source-resolver/renderer
- 保留 out-of-scope：
  - episode 7-class verdict writeback
  - retro publish Day1-5
  - sop/memory wire

### 测试结果

```bash
pnpm --dir packages/mcp-server build
pnpm --dir packages/api build
pnpm --filter @cat-cafe/api lint
pnpm --filter @cat-cafe/mcp-server lint
pnpm check

cd packages/api && bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  test/harness-eval/task-outcome-live-verdict-generator.test.js \
  test/harness-eval/publish-verdict-task-outcome.test.js \
  test/harness-eval/eval-cat-invocation-publish-verdict.test.js \
  test/harness-eval/publish-verdict.test.js

cd packages/api && node --test \
  ../mcp-server/test/publish-verdict-tool.task-outcome.test.js \
  ../mcp-server/test/publish-verdict-tool-schema.test.js
```

### 相关文档

- Plan: `docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`
- ADR: 无
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
