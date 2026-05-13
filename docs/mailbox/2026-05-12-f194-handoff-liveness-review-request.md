# Review Request: F194 handoff active liveness hotfix

Review-Target-ID: f194-handoff-liveness
Branch: fix/f194-handoff-liveness
HEAD: 2a1c59223

## What

修复 A2A 串行传球时 active status 短窗口显示上一只猫的问题。

- Backend `a2a_handoff` 事件新增机器可读 `targetCatId`
- `route-serial` 两处 handoff yield 都带上 `targetCatId: pendingCat`
- Active-thread frontend handler 收到 `a2a_handoff + invocationId + targetCatId` 时，立即复用现有 `maybeMigrateSequentialInvocationOwnership(...)` 把 parent invocation active slot 从上一只猫迁移到下一只猫
- R2：如果上一只猫的 `done(isFinal=false)` 已经先清掉 parent active slot，`a2a_handoff` 也会重建下一只猫的 active slot，避免 handoff gap 期间 cancel 按钮消失

## Why

铲屎官现场看到：`缅因猫 -> 布偶猫` routing pill 已出现，但底部 still 显示缅因猫在跑；F5 后才恢复成布偶猫。代码链路确认后端 handoff 已经知道下一只猫并 track A2A slot，但前端 `a2a_handoff` handler 只展示 routing pill，不迁移 active slot；迁移只等较晚的 `invocation_created`，造成 visible stale-cat window。

R1 后铲屎官又验证到：交棒后仍有约几秒无 cancel 按钮，直到布偶猫真正开始输出才恢复。根因是另一条时序：前一只猫的 `done(false)` 正常清掉了自己的 slot，此时 helper 因 `primarySlot` 不存在而 no-op。R2 把 handoff helper 从“只迁移已有 slot”扩展为“迁移或重建 parent-chain slot”。

## Original Requirements

> "我发现新问题了！！ 你看 缅因猫 -》 布偶猫 但是这里还显示缅因猫正在跑，缅因猫正在回复其实你回复完成了！ 然后我f5之后就正常了变成了布偶猫了"

- 来源：thread `thread_mov3a7qva8mtsbs1`，2026-05-12 17:08 PT，铲屎官截图反馈
- 请对照上面的摘录判断交付物是否解决了 stale active cat 状态，而不是只看 routing pill 是否显示
- R2 补充：2026-05-12 17:28 PT 铲屎官反馈 “差不多几s 左右的没有cancel按钮，布偶猫出来之后就有了”

## Tradeoff

没有再改 `/queue` 或 liveness helper。原因：这次症状的最短闭环在 live handoff event contract 上，后端已经知道 `pendingCat`，前端缺的是结构字段和即时迁移；改 queue 会扩大 scope，且不能消除 handoff 到 invocation_created 之间的首屏窗口。

没有从 `content` 文本解析目标猫。原因：routing pill 文本是 display-only，解析会再次引入本地化/昵称歧义。

## Architecture Ownership

Architecture cell: dispatch
Map delta: none
Why: 只扩展现有 serial route event contract，并复用既有 active slot migration helper；没有新增 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否仍有其他 `a2a_handoff` producer 缺 `targetCatId`
- frontend migration 是否只在 active thread path 生效，避免误动 background thread 状态
- R2 helper 在 `primarySlot` 不存在时创建 slot 是否足够窄：要求仍然只在 `a2a_handoff + targetCatId + invocationId` 且没有显式 next-cat slot 时触发

## Open Questions

### 技术 OQ

1. `targetCatId` 是否应该同时写入 background handler？我当前没有做，理由是用户症状是 active thread bottom status stale；background thread 不显示当前输入区 active bar，贸然迁移可能需要 thread-scoped targetCats 语义复核。
2. `a2a_handoff` 的 `targetCatId` 是否还要进入 persisted system message `extra`？当前只是 live event contract，不改变消息持久化格式。

### 价值 OQ

无。

## Next Action

请做 binding review。若 LGTM，建议沿用 F194 fast path：merge gate 本地 gate 后 squash merge，runtime 重启后用同样 `缅因猫 -> 布偶猫` 串行传球场景 alpha 验证 active bar 是否立即迁移到布偶猫。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194-handoff-liveness/opus`
- Start Command: `pnpm review:start`（如需 UI 复测）
- Ports: 未启动；本轮作者侧没有启动 dev server，真实 UI 复测建议合入后走 runtime/alpha

## 自检证据

### Spec 合规

- 原始症状：handoff pill 已显示 next cat，但 active status 仍停在 previous cat
- 代码位置：
  - `packages/api/src/domains/cats/services/types.ts`
  - `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
  - `packages/web/src/hooks/useAgentMessages.ts`
- 测试覆盖：
- API handoff event must carry machine-readable `targetCatId`
- Frontend active handler must migrate parent invocation slot immediately on `a2a_handoff`
- Frontend active handler must recreate next-cat parent slot when previous non-final done already cleared the old slot
- Artifact hygiene：根目录媒体/设计工件检查为空
- Hotfix pattern：`check-hotfix-pattern` 未命中 hotfix label 条件
- Fallback layer：无新增多层 fallback

### 测试结果

- `NODE_ENV=test pnpm --dir packages/web exec vitest run src/hooks/__tests__/useAgentMessages-invocation-created.test.ts` -> 8/8 pass
- `NODE_ENV=test pnpm --dir packages/web exec vitest run src/hooks/__tests__/useAgentMessages-invocation-created.test.ts -t "a2a_handoff|keeps the cancel affordance"` -> 2/2 pass
- `NODE_ENV=test pnpm exec vitest run <22 useAgentMessages test files>` -> 254/254 pass
- `pnpm --filter @cat-cafe/api build` -> pass
- `node --test packages/api/test/route-strategies.test.js --test-name-pattern "yields a2a_handoff"` -> 96/96 pass
- `node --test packages/api/test/integration/a2a-chain.test.js packages/api/test/route-serial-z9-yield-stamps-own-turn.test.js packages/api/test/route-parallel-z9-done-yield-stamp.test.js` -> 9/9 pass
- `pnpm --filter @cat-cafe/web build` -> pass (existing hardcoded-color warnings only)
- `pnpm check` -> pass

### 相关文档

- Feature: `docs/features/F194-invocation-liveness-canonical-read-model.md`
- Close reflection: `docs/reflections/2026-05-12-f194-invocation-liveness-capsule.md`
