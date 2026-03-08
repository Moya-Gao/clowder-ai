# Review Request: F079 Voting System Phase 2 — VoteConfigModal + [VOTE:xxx] interception

## What

F079 Phase 2 重写投票系统 UX：
1. **VoteConfigModal** 弹窗替代 CLI 单行解析（问题/选项/CatSelector/匿名/超时）
2. **[VOTE:xxx] regex 拦截** 在 route-serial.ts 消息处理管线中，猫猫回复自动计票
3. **Auto-close**：全员投完自动关闭 + setTimeout 超时自动关闭
4. **VoteActiveBar** 投票进行中指示器（ChatInput 上方，倒计时 + 手动结束按钮）
5. **Auto-dispatch**：发起后自动 @mention 投票猫猫，触发 A2A routing

## Why

Phase 1 (PR #287) 的 CLI UX 被铲屎官痛批"反人类"——空格切割 token、emoji 变选项、没有通知猫猫。

## Original Requirements（必填）
> "你这好反人类做的投票系统！" — 铲屎官 2026-03-08
> "投票 特么都没转发给任何一只猫" — 铲屎官 2026-03-08
> "看看最近新作的AT猫猫的F80的那些UX体验" — 铲屎官 2026-03-08
> "重新写你的F79的Markdown, 然后你直接开始写代码" — 铲屎官 2026-03-08
- 来源：Thread `thread_mm4dj9jp0tij0ch3` (2026-03-08)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 用弹窗取代 CLI 解析：放弃了命令行快速操作，换取可靠的 UX
- route-serial 拦截而非单独 API：猫猫不需要调 HTTP，自然嵌入回复即可
- setTimeout 超时（内存 Map，restart 丢失）：投票时间短，可接受
- VoteActiveBar 用轮询（5s）而非 WS：简单可靠，避免新 WS 事件复杂度

## Open Questions

1. **route-serial.ts 已 673 行**（主要是 Phase 1 前的复杂度），interception +42 行，review 时请判断是否需要抽取
2. **Auto-close rich block 注入**：route-serial 中 auto-close 时把 rich block push 进 allRichBlocks，这比 WS broadcast 更简单，但和 HTTP close 路径的 broadcast 不一致——请评估
3. **votes.ts closeVoteInternal 和 DELETE handler 有重复的 close 逻辑**——是否该 DRY

## Next Action

请审查代码质量和架构决策，放行或提 P1/P2。

## 自检证据

### Spec 合规
9/9 AC 通过（详见 quality-gate report）

### 测试结果
```
node --test vote-routes.test.js vote-intercept.test.js → 39/39 pass, 0 fail
vitest run vote-config-modal.test.ts useChatCommands-vote.test.ts → 16/16 pass, 0 fail
pnpm --filter @cat-cafe/api build → exit 0
pnpm --filter @cat-cafe/web build → exit 0
pnpm lint → 0 new errors
```

### 相关文档
- Spec: `docs/features/F079-voting-system.md`
- Feature: F079 / BACKLOG
