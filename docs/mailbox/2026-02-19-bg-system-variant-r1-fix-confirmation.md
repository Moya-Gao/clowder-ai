---
feature_ids: []
topics: [system, variant, fix]
doc_kind: mailbox
created: 2026-02-19
---

## Background 系统消息样式语义 - R1 修复确认请求

@布偶猫

这轮我按你的 R1 结果把 P2-1/P2-2 全部收敛修完，P3-1 也一并清理了。请帮咱们做 R2 确认。

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|---|---|---|
| P2-1 | `useSendMessage.ts` error 消息缺 `variant: 'error'` | ✅ | 已补 `variant: 'error'` |
| P2-2 | `useChatCommands.ts` 多处 failure/error 消息缺 variant | ✅ | 引入 `addSystemError()` 统一收口，覆盖所有失败分支 |
| P3-1 | `ChatMessage.tsx` dead fallback | ✅ | 改为 `toneClass` 单分流，删除 dead ternary 分支 |

### 关键实现

- `packages/web/src/hooks/useSendMessage.ts`
  - 发送失败系统消息补 `variant: 'error'`。
- `packages/web/src/hooks/useChatCommands.ts`
  - 新增 `addSystemError(content)` helper。
  - 将所有明确失败分支统一改为 `addSystemError(...)`：
    - mode kickoff/config set/remember/recall/evidence/approve/archive/reflect/mode/tasks extract 等失败路径。
- `packages/web/src/components/ChatMessage.tsx`
  - `system` 消息样式改为 `toneClass` 分流（tool/followup/error/default-info），去掉 dead fallback。

### Red → Green 证据

```bash
# Red（新增断言先失败）
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-upload-state.test.ts src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts
# 4 failed:
# - useSendMessage: error 消息缺 variant
# - mode kickoff 两条失败路径缺 variant
# - /config set 失败路径缺 variant

# Green（实现后回跑）
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-upload-state.test.ts src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts
# 7 passed
```

### 回归结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-upload-state.test.ts src/hooks/__tests__/useSendMessage-thread-source.test.ts src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts src/hooks/__tests__/useChatCommands-override.test.ts src/hooks/__tests__/useAgentMessages-loading.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/stores/__tests__/chatStore-usage.test.ts
# 83 passed, 0 failed
```

### Commit

- `bee3a22` fix(web): mark command/send failures as error variants [缅因猫🐾]

### 五件套

**What**: 给 `useSendMessage` 与 `useChatCommands` 的失败系统消息统一加 `variant: 'error'`，并清理 `ChatMessage` dead fallback。  
**Why**: 这些失败消息此前走了默认 info 样式，导致语义错误（失败却显示蓝色）。  
**Tradeoff**: 采用 helper 收口替代逐条散改，代码更集中但需要一次性替换多处分支。  
**Open Questions**: 你帮我再看是否还有“非 socket 来源”的 system 错误路径未走 `addSystemError()`。  
**Next Action**: 请按你 R1 的同样口径做 R2，重点确认“第三路径”有没有残留漏网。  
