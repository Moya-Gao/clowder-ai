---
feature_ids: [F192]
topics: [review-request, publish-verdict, task-outcome, schema-spec]
doc_kind: mailbox
created: 2026-06-09
---

# Review Request: F192 task-outcome publish_verdict PR1 contract surface

Review-Target-ID: f192
Branch: feat/f192-task-outcome-publish-verdict-pr1

## What

This PR lands the PR1 half of the `eval:task-outcome` publish pipeline plan:

- adds a schema-only `task-outcome-snapshot` `sourceRefs` kind in API + MCP layers
- updates `eval:task-outcome` base instructions to the honest packet-level 4-class verdict contract
- keeps task-outcome in honest `unsupported_generator` 501 state
- adds regression tests that lock both fake-wire surfaces:
  - handler/MCP schema accepts the new selector shape
  - invocation instructions still do **not** advertise publish for task-outcome
- adds `docs/harness-feedback/SPEC.md` as a reader-facing contract extract

## Why

铲屎官刚明确拍板不要再走 manual hot-fix 路，而是接回统一 `cat_cafe_publish_verdict` 管道，同时把 schema 抽出来给人看。  
这轮只做 contract surface，不 flip runtime generator wire，避免重演 capability-wakeup 当时的 fake-wire。

## Original Requirements（必填）

> "不要 搞这种hot fix？ 就是应该直接和其他a2a 那种那样对接到统一管道？ 顺手把 schema 抽出来写成 docs/harness-feedback/SPEC.md？这样 manual contributor（包括未来社区贡献者）能直接看规范，不用啃代码。"

- 来源：`docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选了两段式闭环：PR1 先落 schema/type/instruction correction，PR2 再原子 flip generator wire
- 不在这一轮补 episode verdict writeback；生产代码现在没有 `updateVerdict()` caller，live DB 的 episode verdict 仍是全 `NULL`
- `SPEC.md` 是从代码抽出来的读者合同，不会反过来取代代码真相源

## Architecture Ownership（必填）

Architecture cell: harness-eval  
Map delta: none  
Why: 本 PR 只扩展现有 harness-eval / publish-verdict contract surface，没有新增并行 Store/Queue/Router/Adapter 边界，也没有改 architecture ownership cell。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

- PR1 是否在所有对外表面都保持 honest 501，而没有留下新的 fake-wire：
  - handler kind map
  - MCP tool input schema
  - `DOMAIN_INSTRUCTIONS['eval:task-outcome']`
  - absence of `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:task-outcome']`
- `docs/harness-feedback/SPEC.md` 的粒度是否合适，还是应该再收窄成只写 live verdict/bundle 机器约束

### 价值 OQ（给 CVO，如有）

无

## Next Action

请按 code review 模式找 blocker / regression / contract drift。若放行，我继续 PR2（real generator + runtime wire flip）。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本 PR 是 schema/instruction/spec surface，无需起 dev server）

## 自检证据

### Spec 合规

- 对照 plan：`docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`
- 本 PR 只做 PR1 touchpoints（schema/type/validation + taxonomy correction + spec doc），未触碰：
  - `verdictGenerators`
  - `wiredPublishDomains`
  - `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:task-outcome']`
  - MCP tool description wired-domains 文案
- Dogfood 豁免：纯内部 contract / schema / docs surface，无 user-visible runtime slice
- Artifact hygiene：仓库根目录媒体/设计工件检查 0 命中
- Architecture ownership: `pnpm check:architecture-ownership` exit 0；只有既有 warning，无本 PR diff noun mismatch

### 测试结果

```bash
pnpm --filter @cat-cafe/api lint
# ✅ tsc --noEmit

pnpm --filter @cat-cafe/mcp-server lint
# ✅ tsc --noEmit

pnpm --dir packages/mcp-server build
# ✅ pass

pnpm --dir packages/api build
# ✅ pass

cd packages/api && bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/harness-eval/publish-verdict.test.js test/harness-eval/eval-cat-invocation-publish-verdict.test.js
# ✅ 29 pass, 0 fail

cd packages/api && node --test ../mcp-server/test/publish-verdict-tool-schema.test.js
# ✅ 9 pass, 0 fail

pnpm check
# ✅ All 22 checks passed
```

### 相关文档

- Plan: `docs/plans/2026-06-09-f192-publish-verdict-task-outcome-wire.md`
- ADR: 无
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
