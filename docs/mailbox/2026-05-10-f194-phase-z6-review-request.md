# Review Request: F194 Phase Z6 live rich self-heal + single fallback

Review-Target-ID: f194
Branch: feat/f194-phase-z6
HEAD: 8da538b90

## What

Z6 修 Phase Z5 alpha re-test 剩下的两条验收 residue：

- AC-Z17：`done` 后才到的 invocationless `rich_block` / audio 不再新建临时小气泡；active path 复用 just-finalized stream bubble，background path 复用 `finalizedBgRefs`。
- AC-Z18：no-@ fallback 仍从上一条 user message mentions 找候选，但返回确定性单猫 `[routable[0]]`，不把上一轮 parallel mentions 全量延续成并发。

## Why

铲屎官 2026-05-10 alpha 复测抓到：

- F5 前有一个多余小气泡，F5 后消失，说明 live state 仍没在完成前自愈。
- 上一条 @ 47 + 55 后，下一条无 @ 应 fallback 到其中一只，而不是两只一起再并发。

## Original Requirements（必填）

> "哈哈哈 f5之前 我们47多了个小气泡！f5之后就没了"
> "上一次at了两只猫 这次没有任何at fallback应该是一只猫"
> "这回你来负责修！然后47review！ 走起吧"

- 来源：thread `thread_mov3a7qva8mtsbs1`，2026-05-10 10:13 / 10:17 / 10:38
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题。

## Tradeoff

- 没扩大 Z5 的 reducer kind 吸收规则；Z6 只处理 `done` 后 late rich/audio 的 live self-heal，避免再碰 ADR-033 的 kind separation 边界。
- no-@ fallback 取 first routable mention，而不是最近完成的猫或随机猫；这是确定性、可测、可解释的单猫语义。

## Architecture Ownership（必填）

Architecture cell: `bubble-pipeline`, `dispatch`
Map delta: none
Why: Z6 只在既有 bubble live reconciliation 和 AgentRouter fallback 内收口验收边界，没有新增 Store / Queue / Router / Adapter / Dispatcher / Binding，也不改变 ownership 边界。

请 reviewer 检查：

- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 是否需要对 `bubble-pipeline` 或 `dispatch` cell 追加 F194 Z6 lessons（我判断不需要，已同步 F194 spec）

## Open Questions

### 技术 OQ（给 reviewer）

1. AC-Z17 active path 用 `findInvocationlessStreamPlaceholder(catId)` 在 `ensureActiveAssistantMessage` 前找 just-finalized stream bubble，是否足够窄？请重点看是否可能误把另一轮 invocationless rich/audio attach 到旧 bubble。
2. Background path 用 `finalizedBgRefs(thread::cat)` 复用 finalized stream bubble，是否需要额外 turn/invocation guard？当前 guard 是 same thread + same cat + assistant stream origin。
3. AC-Z18 `routable[0]` 是否是我们要的 deterministic single-cat fallback 语义。

### 价值 OQ（给 CVO，如有）

无。铲屎官已明确要单猫 fallback；技术选择可回滚、可测，不升级。

## Next Action

请 @opus47 review。若通过，走 merge-gate：PR → cloud review → squash merge → alpha re-test → 守护猫对照表 → close F194。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f194/opus47`
- Start Command: `pnpm review:start`
- Ports: `web=auto`, `api=auto`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

- `docs/features/F194-invocation-liveness-canonical-read-model.md` 已新增 Phase Z6：AC-Z17 / AC-Z18 + R9 / R10。
- `docs/features/index.json` 已重新生成。
- 根目录工件闸门：无根目录媒体/设计工件。

### 测试结果

```bash
pnpm biome check ... --diagnostic-level=error
# Checked touched files. No fixes applied.

pnpm check:features
# PASS check-feature-truth: features=203 backlog_active=53

node packages/web/scripts/run-with-node-env-test.mjs pnpm --dir packages/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts \
  src/hooks/__tests__/useAgentMessages-background-system-info-web-search.test.ts \
  src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts
# 34 passed

node packages/web/scripts/run-with-node-env-test.mjs pnpm --dir packages/web exec vitest run \
  src/stores/__tests__/bubble-reducer.test.ts
# 64 passed

pnpm --dir packages/web exec tsc --noEmit --project tsconfig.json
# pass

pnpm --dir packages/api build
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  --test-name-pattern "AC-Z16|@three cats then no-@" \
  packages/api/test/agent-router.test.js
# 14 passed
```

### 相关文档

- Feature: `docs/features/F194-invocation-liveness-canonical-read-model.md`
- PR baseline: F194 Phase Z5 squash `3b3c6b33`
