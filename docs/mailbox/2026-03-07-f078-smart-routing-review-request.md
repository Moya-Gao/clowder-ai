# Review Request: F078 Smart Routing & Group Mentions

## What

AgentRouter 路由优化，两大改动：
1. **无 @mention 时默认路由到最近回复者**（不再路由到所有参与者）
2. **群组 mention**：`@all`/`@全体`、`@全体{breed}`/`@all-{breed}`、`@thread`/`@本帖`/`@全体参与者`

改动文件：
- `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` — 新增 `parseGroupMentions()` + `parseAllMentions()`，`peekTargets`/`resolveTargets` 改为只取最近回复者
- `packages/api/test/agent-router.test.js` — 12 新测试 + 4 旧测试更新

## Why

铲屎官发消息不写 @ 时，系统把消息发给所有参与者，导致意外多猫回复。同时缺少群组广播能力，每次要手动 @ 多只猫。

## Original Requirements

> "我们如果没at的话 最好这样默认 1. 上一次回消息的猫，如果没有 则默认布偶猫；2. 增加一个@all的功能 甚至可以@全体布偶猫 全体xxx之类的？"
> "at 这个thread的全体参与者？"

- 来源：本 thread 对话历史 (2026-03-07 06:09-06:16)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 以前无 @mention → 路由到所有参与者（自动多猫回复）。现在收窄到只找最近回复者，想找所有参与者需要显式用 `@thread`。这是铲屎官明确要求的行为变更。
- `@thread` 无参与者时 fallback 到 default cat（opus），而非 fallback 到 @all，避免意外群发。

## Open Questions

1. **`@all` 是否需要 A2A 限制？** 当前 A2A mentions (`a2a-mentions.ts`) 有 `MAX_A2A_MENTION_TARGETS=2` 限制，但 user→cat 的 group mentions 无限制。如果猫回复中写 `@all`，A2A 系统不会识别它（A2A 只匹配行首 individual mentions）。这是否需要对齐？
2. **breed group patterns 的 displayName 可靠性**：breed patterns 用 `breedDisplayName ?? displayName` 生成（如 `@全体布偶猫`）。如果 displayName 改了，pattern 也会变。是否需要在 cat-config.json 里显式定义 group mention patterns？

## Next Action

请 review 代码质量 + 逻辑正确性 + 边界处理。特别关注 `parseGroupMentions` 的匹配顺序和 fallback 行为。

## 自检证据

### Spec 合规

10 AC 全部 pass（AC-5/6 间接覆盖，breed patterns 从配置动态生成，不区分具体 breed）。
愿景覆盖：铲屎官 5 条原始需求全部有对应 AC 和实现。

### 测试结果

```
agent-router.test.js → 61/62 pass (1 pre-existing failure: "passes workingDirectory" — 在 main 上也失败)
pnpm lint → 0 errors (only pre-existing warnings)
pnpm --filter @cat-cafe/api build → exit 0
```

### 相关文档

- Feature: `docs/features/F078-smart-routing-group-mentions.md`
- Plan: `docs/plans/2026-03-07-f078-smart-routing.md`
- Branch: `feat/f078-smart-routing`
