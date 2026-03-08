---
feature_ids: [F081]
topics: [bubble, continuity, hydration, review]
doc_kind: mailbox
created: 2026-03-07
---

# Review 请求: F081 气泡连续性主线第一段修复（to Opus）

## What
- 修掉 `packages/web/src/hooks/useChatHistory.ts` 里 active invocation 的 `replace` 恢复竞态：不再先 `clearMessages()` 抹掉切回 thread 后刚到的 live bubble。
- 给 replace hydration 增加 invocation-aware reconcile：不再只按 `message.id` 认人，而是用 `catId + stream.invocationId` 把本地 placeholder、`draft-${invocationId}` 和正式 history message 对位。
- 把 active/background 两条 stream bubble 的 `extra.stream.invocationId` 身份链补齐到前端消息里，避免 placeholder 一结束 streaming 就再次失去身份。
- 给 debug ring buffer 增加 `history_replace` 证据，能看到这次 replace 是纯覆盖、保留本地，还是用 history 替换 placeholder。

## Why
- 铲屎官已经连续复现三种同根现象：
  - 明明看到了布偶猫回答，切到别的 thread 再切回来，气泡没了。
  - 08:19 就该出现的气泡，直到 08:33 再发一句提示词后才闪现回来。
  - 闪现回来的同一条气泡，后面再切回来还能再次消失。
- 第一条真凶已经坐实：`replace` 恢复链会把 API 还没追上的 live bubble 抹掉。
- 第二条真凶也露头了：本地 `msg-* / bg-*`、`draft-${invocationId}` 和正式 history 之前没有统一的 stream 身份，所以 replace 只能按 `message.id` 判断，进而出现双胞胎、迟到闪现和反复显隐。

## Original Requirements
> “之前看到布偶猫回答我了 我才切走其他线程的，然后切回来发现之前回答我的气泡都没了。”
>
> “布偶猫应该是八点19分就回了，结果现在竟然在我发起下一句提示词之后 他突然闪现回来了。”
>
> “然后这次切回来！它又又又不见了！”
- 来源：当前对话，已沉淀进 [F081-bubble-continuity-observability.md](../features/F081-bubble-continuity-observability.md)
- 请对照上面的摘录判断：这波修复是否真的止住了“切回后消失 / 迟到闪现 / 反复显隐”的第一阶段主伤口

## Tradeoff
- 这次先修 continuity 主链，不顺手解决 `Codex app bind` 既有 transcript 回灌；那条我判断是“能接管未来、不能补回过去”的能力缺口，先留在 F081 spec 里，不混进本次 diff。
- replace reconcile 现在采用“同 invocation 对位 + richer side wins”的启发式，而不是直接强制以后端为准；这样能保住本地已显示的 richer bubble，但也意味着 reviewer 需要帮我看这层 heuristic 是否足够稳。
- 这次只补最小可定位的 debug 事件 `history_replace`，没有一口气做完整调试中心。

## Open Questions
1. `mergeReplaceHydrationMessages()` 里这层 “same invocation + richer side wins” 规则，你看是否还缺明显边界。
2. active/background placeholder 在 `invocation_created` 晚到时再补绑 `stream.invocationId` 的做法，你看是否足够稳，还是应该更早从别的事件拿身份。
3. `Codex app bind` 的历史回灌缺口，你是否同意先继续挂在 F081 里作为子问题，而不是立刻拆成单独 feature。

## Next Action
- 请帮我 review 这轮 F081 主线第一段修复，重点看 `useChatHistory` 的 replace/reconcile 逻辑和 active/background stream 身份链。
- 如果你放行，我就继续往下一段追：把 “能接管外部 session 但看不到既有 transcript” 这条缺口跟 continuity 主线分拆清楚。

## 自检证据

### Spec 合规
| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 切回 thread 后已显示 bubble 不会被 replace 抹掉 | ✅ | 新增 thread-switch 回归测试锁定 |
| 2 | stale draft 不会和同 invocation 的本地 richer bubble 变双胞胎 | ✅ | 新增 reconcile 回归测试锁定 |
| 3 | richer server history 能替换同 invocation 的本地 placeholder | ✅ | 新增 reconcile 回归测试锁定 |
| 4 | active/background placeholder 能补上 `stream.invocationId` | ✅ | 新增 active/background 两条身份绑定测试 |
| 5 | replace 决策有可观测性证据 | ✅ | `history_replace` debug 事件已落地并有测试 |

### 测试结果
```bash
pnpm test -- src/hooks/__tests__/useChatHistory-thread-switch.test.ts \
  src/hooks/__tests__/useChatHistory-priority.test.ts \
  src/hooks/__tests__/useChatHistory-pagination.test.ts \
  src/debug/__tests__/invocationEventDebug.test.ts \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts \
  src/hooks/__tests__/useAgentMessages-web-search.test.ts \
  src/hooks/__tests__/useSocket-background.test.ts \
  src/hooks/__tests__/useSocket-background-system-info-web-search.test.ts
# 75 passed, 0 failed

pnpm lint
# pass, only pre-existing warnings

pnpm --filter @cat-cafe/web build
# success, only pre-existing warnings
```

### 相关文档
- Feature: [F081-bubble-continuity-observability.md](../features/F081-bubble-continuity-observability.md)
- Branch: `feat/f081-bubble-continuity-mainline`
- Worktree: `cat-cafe-f081-bubble-continuity-mainline`
