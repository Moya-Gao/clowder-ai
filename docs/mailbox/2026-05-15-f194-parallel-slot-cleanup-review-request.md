# Review Request: F194 parallel turn done clears parent-key active slot

Review-Target-ID: f194-parallel-slot-cleanup
Branch: fix/f194-parallel-slot-cleanup
HEAD: 9518215ee

## What

修 `@opus @opus47 @codex` 并发/串行混合场景里，某只猫已经完成但底部 execution bar 仍显示这只猫在跑的问题。

- 新增 `findTerminalActiveInvocationSlot(...)`：terminal event 带 per-cat turn id 时，也能找到 intent_mode 建立的 parent-key active slot。
- `isStaleTerminalEvent(...)` 允许 Z9 dual identity：`catInvocations[cat].turnInvocationId === done.invocationId` 且 active slot 仍是 parent id 时不判 stale。
- `done` cleanup 会额外移除对应 parent-key slot，只移除完成猫，不影响其他仍未完成的猫。
- 增加回归测试覆盖：`done(isFinal=false)` with turn invocation removes parent-key slot for the finishing cat。

## Why

Runtime 证据显示 `/queue` 已经是空，但前端仍显示完成猫在 active bar。根因不是后端 liveness，而是 frontend active slot cleanup 没处理 Z9 后的双身份：

- `activeInvocations` 仍按 parent liveness id 建 slot：`parent`, `parent-opus47`, `parent-codex`
- CLI/text/done event 可能携带 per-cat `turnInvocationId`
- 旧 cleanup 只删 `done.invocationId` / `${done.invocationId}-${catId}`，所以删不到 parent-key slot

## Original Requirements

> 现在runtime的问题，我at了三只猫，然后两只布偶猫都跑完了 你还没出现 他竟然现实布偶猫没跑完？！
> 截图：`@opus @opus47 @codex` 后，opus-47 和 opus 已完成，但底部仍显示 `执行中 · 布偶猫 (Opus 4.6)`

- 来源：thread runtime report, 2026-05-15 21:50
- 请对照上面的摘录判断交付物是否解决了完成猫 active slot 残留的问题。

## Tradeoff

没有再改后端 stamp 或 queue。后端 `/queue` 现场诊断已经返回 `activeInvocations: []`，说明这轮是前端 stale state，不是 server truth 错。

修法只在 terminal cleanup 路径做 parent-key slot resolution，不改变 message bubble projection、不改变 queue fetch、不改 active slot 创建规则。

## Architecture Ownership

Architecture cell: web runtime liveness / active invocation store
Map delta: none
Why: 只扩展现有 `useAgentMessages` terminal cleanup 对 Z9 dual identity 的识别，不新增 Store/Queue/Router/Adapter/Dispatcher/Binding。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- parent-key slot cleanup 是否足够窄，不会误删其他仍在跑的猫
- same-cat preemption 场景是否仍由 existing guards 保护

## Open Questions

### 技术 OQ

1. `findTerminalActiveInvocationSlot(...)` 的 parent-key fallback 是否足够窄：必须满足 same cat + non-hydrated slot + normalized key == `catInvocations[cat].invocationId` + terminal turn matches `catInvocations[cat].turnInvocationId`。
2. `isStaleTerminalEvent(...)` 对 dual identity 的 fresh override 是否会放宽过头；我保留了 parent-id terminal fallback，避免让旧 parent terminal 路径变窄。
3. 是否需要把同样逻辑扩展到 background path。本轮现场 bug 是 active current thread，相关 background tests 仍全绿。

### 价值 OQ

无。

## Next Action

请 review。若 LGTM，走 fast path merge 后让铲屎官重启 runtime 验证三猫并发场景。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194-parallel-slot-cleanup/opus`
- Start Command: `pnpm review:start`（如需手动 UI 验证；本轮主要是 code/test review）
- Ports: 未启动 review sandbox

## 自检证据

### Spec 合规

- 原始症状已复现为 RED test：turn-key `done` 无法清 parent-key active slot。
- Artifact hygiene：仓库根目录媒体/设计工件（工作树 + 已提交差异）无。
- Fallback layer check：`node scripts/check-fallback-layers.mjs` → `No fallback pattern changes detected.`

### 测试结果

```bash
NODE_ENV=test pnpm --dir packages/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-sequential-slot-cleanup.test.ts \
  src/hooks/__tests__/useAgentMessages-concurrent-cancel.test.ts \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts
# 4 files / 65 tests passed

NODE_ENV=test pnpm --dir packages/web exec vitest run src/hooks
# 80 files / 681 tests passed

pnpm --dir packages/web exec tsc --noEmit --pretty false
# exit 0
```

### 相关文档

- Feature lineage: F194 liveness / bubble identity follow-up
- Runtime thread evidence: `thread_mp6awzfq2pm9rwz5`, `/queue` returned empty while UI still showed completed opus active

