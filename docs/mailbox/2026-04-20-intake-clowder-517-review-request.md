# Review Request: intake(clowder-ai#517) draft badge absorb

Review-Target-ID: intake-clowder-517
Branch: fix/intake-clowder-517

## What
吸收 `clowder-ai#517` 已 merge 的草稿 badge patch：
- 把文本/图片草稿判断抽成 `thread-drafts.ts`
- `ChatInput` 在草稿变化时同步 `threadState.hasDraft`，并在图片草稿 LRU 驱逐后清除被驱逐线程的 stale badge
- `ThreadItem` 对非当前线程渲染红色 `[草稿]`
- 补 `thread-item-draft-badge.test.tsx`，并扩展 `chat-input-draft-persistence.test.ts` / `chatStore-multithread.test.ts`

## Why
这条社区 PR 已在 `clowder-ai` merge，且全量落在 `packages/web/**` 共享路径。回家 intake 的目标是把这个真实 UX 缺口补齐，同时避免常见 intake 失误：
- 不只 cherry-pick UI 文本，要把状态同步与 LRU 清理一起带回家
- 不只 record，要先立 Intent Issue 做逐文件验收
- 不把 unrelated brand/public repo 差异误带回家

## Original Requirements（必填）
> 当某个 thread 存在未发送草稿时，会话列表项应显示一个明显但轻量的标记，例如红色 `[草稿]`。  
> 这个标记至少应覆盖：有未发送文本草稿；有未发送图片草稿。  
> 实现应尽量小，不重做现有 draft 数据流。  
> 一种低风险做法是把草稿状态判断抽成共享小模块，由 `ChatInput` 写入，`ThreadItem` 只读取并渲染标记。
- 来源：`clowder-ai#510`
- **请对照上面的摘录判断：这次 absorbed 是否既解决了 thread list 的可见性问题，又保持了“小修、不中断现有 draft flow”的边界**

## Tradeoff
我保留了 upstream 的“小步修复”形状，没有借这次 intake 顺手重构成独立 draft store / `useSyncExternalStore` 源。这样做的代价是 `hasDraft` 仍是 `chatStore` 上的派生态；好处是吸收面窄、和社区已验证 patch 一致，reviewer 更容易逐文件验收。

## Open Questions
1. `cat-cafe#1305` 的 8 个 `absorb` 文件是否都在本分支完整落地，没有漏掉状态层或测试层？
2. `ThreadItem` 的 `[草稿]` badge 条件是否严格限定为“非当前线程 + `threadState.hasDraft`”？
3. 浏览器端我只拿到了 API / thread creation 证据，没有拿到端到端 badge 截图；现有组件测试是否足以支撑这轮 intake，还是你希望我在 receive-review 再补一轮 UI 取证？

## Next Action
请按 Intake Review Guard 对照 `cat-cafe#1305` 做 review，重点看：
1. 8 个 `absorb` 文件和逐文件决策表是否一一对应；
2. `ChatInput` 的 LRU eviction 修复是否真正消掉了 stale badge；
3. `ThreadItem` / `chatStore` / tests 三层是否共同覆盖了文本草稿、图片草稿、线程切换三个场景；
4. 通过后在 absorb PR 上留 formal review/comment 放行。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/intake-clowder-517/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Intake Intent Issue：`cat-cafe#1305`
- Quality Gate：`docs/mailbox/2026-04-20-intake-clowder-517-quality-gate.md`
- Community PR：`clowder-ai#517`
- `bash scripts/intake-from-opensource.sh --pr 517 --mode=plan` → `8 safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound --from-index` → `✓ No brand violations detected`

### 测试结果
- `NODE_ENV=development pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chatStore-multithread.test.ts src/components/__tests__/thread-item-draft-badge.test.tsx src/components/__tests__/chat-input-draft-persistence.test.ts` → `63 passed, 0 failed`
- `NODE_ENV=development pnpm --filter @cat-cafe/web exec tsc --noEmit` → success
- `NODE_ENV=development pnpm --filter @cat-cafe/web lint` → success（仅既有 warnings）
- `NODE_ENV=development pnpm check` → blocked by pre-existing unrelated formatter failure in `packages/api/test/f148-phase-g.test.js`
- `git diff --check` → clean

### 相关文档
- Intake Intent：`cat-cafe#1305`
- Quality Gate：`docs/mailbox/2026-04-20-intake-clowder-517-quality-gate.md`
- Source Issue：`clowder-ai#510`
- Source PR：`clowder-ai#517`
