# Review Request: fix(#117) setTargetCats replace→merge 防止多猫并行 ParallelStatusBar 只显示单猫

## What
`chatStore.ts` 中 `setTargetCats` 和 `setThreadTargetCats` 从 replace 语义改为 merge 语义。新增 7 个回归测试。

核心变更：
- `setTargetCats(cats)`: 将 `cats` union 到已有 `targetCats`，仅为**新增**猫设 `pending`，已有 catStatuses 不重置
- `setThreadTargetCats(threadId, cats)`: 同上，flat path 和 background thread path 都已修复
- `clearCatStatuses()` 仍可完整重置（不受影响）

## Why
`callback-multi-mention-routes.ts` L147 在分发多猫并行时，为**每只猫**分别 emit 一次 `intent_mode { targetCats: [singleCat] }`。原先 replace 语义导致每次 emit 覆盖上一次，最终 UI 只显示最后一只猫。

约束：**不改后端**——后端 7 个 `intent_mode` 发射点都已验证逻辑正确，问题在前端 store 的 replace 语义。

## Original Requirements（必填）
> 铲屎官原话（来自 GitNexus thread `thread_mmst8x2uru65azwu`）：
> "我这边显示独立观点采样中只有布偶猫，但是其实金渐层和缅因猫都已经发消息回我了，倒是布偶猫，此时我在前端还看不到它的消息，然后我等了还蛮久的，我按一下F5，布偶猫的消息就出来了。"

- 来源：GitNexus thread `thread_mmst8x2uru65azwu`，timestamp `1773703183968`
- Issue: https://github.com/zts212653/clowder-ai/issues/117
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **不在后端 `callback-multi-mention-routes.ts` 改为只发一次聚合 `intent_mode`**：虽然可以一劳永逸，但会改变已有的每猫独立 invocation 追踪语义，影响面更大。前端 merge 语义是最小改动。
- **Symptom 2（布偶猫消息 F5 后才出现）未修复**：调查后确认 `handleAgentMessage` 不依赖 `targetCats`/`catStatuses`，dual-pointer guard 对所有猫一视同仁。可能是瞬时 socket 断连导致，无法复现。**请 reviewer 独立定位此现象**——铲屎官明确要求 reviewer 从原始观察出发独立验证，不要被我的分析带偏。

## Open Questions
1. **Symptom 2 根因**：布偶猫消息需 F5 才可见——请 reviewer 独立从铲屎官原始描述出发定位，看看是否能复现或找到不同根因
2. **merge 语义的边界**：当用户在并行进行中发送新的单猫 @ 消息时，merge 会累积所有猫。是否需要一个"重置窗口"（例如用户新消息发出时 clear）？当前 `clearCatStatuses()` 在 thread switch 时已被调用，应能覆盖
3. **F055 已知问题**：`docs/features/F055-plan-board.md` 记载 "targetCats 只反映最新一次 intent_mode，丢失其他猫"——本修复是否完全解决该 known issue？

## Next Action
请 @codex 做代码 review + 独立定位 Symptom 2。

## 自检证据

### Spec 合规
- Issue #117 Symptom 1（ParallelStatusBar 只显示单猫）：已修复 + 7 个测试覆盖
- Issue #117 Symptom 2（消息需 F5 才可见）：调查未发现确定根因，已在 Open Questions 标注

### 测试结果
```
pnpm --filter @cat-cafe/web vitest run   # 1475 passed, 1 failed (pre-existing: useChatHistory-pagination)
pnpm --filter @cat-cafe/api vitest run   # all passed
TypeScript:                              # 0 errors in modified files (pre-existing errors in chatStore-interactive-block.test.ts)
```

### 相关文档
- Issue: https://github.com/zts212653/clowder-ai/issues/117
- Known issue ref: `docs/features/F055-plan-board.md`
- Tech debt ref: `docs/TECH-DEBT.md` TD082
- Write path audit: `docs/features/F081-write-path-audit.md` L122 (path #15)

### 改动文件
- `packages/web/src/stores/chatStore.ts` (23 insertions, 4 deletions)
- `packages/web/src/stores/__tests__/chatStore-parallel-status-merge.test.ts` (new, 155 lines)

### Branch
`fix/117-parallel-status-overwrite` @ `bee89c2c`
