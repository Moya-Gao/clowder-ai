# Review Request: F079 Bug 1 fix + Gap 4 cat-initiated vote MCP

## What

两个改动：

1. **Bug 1 fix**: 删除 `route-serial.ts:450` 和 `route-parallel.ts:407` 的 `allRichBlocks.push(richBlock)`。当最后一票触发 auto-close 时，结果卡片同时被注入猫的消息和独立 connector 消息，导致重复。现在只保留 connector 消息。

2. **Gap 4**: 新增 MCP 工具 `cat_cafe_start_vote`，让猫猫能通过 MCP 自主发起投票。新增 callback 端点 `POST /api/callbacks/start-vote`，绕过 thread 所有权检查（猫不是 thread 创建者），`createdBy` 设为发起的 catId，投票通知消息带 @mentions 路由到 voters。

## Why

- Bug 1: 铲屎官报告投票结束后看到两份结果卡片
- Gap 4: 猫猫协作讨论时需要集体决策但无法自主发起投票，必须请铲屎官操作

## Original Requirements（必填）

> F079 Bug 1（投票结果卡片重复）还没修——最后一票触发 auto-close 时，猫的回复和系统各生成了一份结果卡。
> F079 Gap 4（猫猫发起投票 MCP）spec 已写好，按 gpt52 建议不和 F086 M1 混着做。

- 来源：Thread `thread_mmgfvvq1iut03rjs` (2026-03-08) + `docs/features/F079-voting-system.md` Known Bugs / Gap 4
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Gap 4: 选择在 callbacks.ts 内联实现而非抽取 `startVoteInternal` 共享函数。代价是 ~40 行重复的 vote state 构造，但避免了过度重构 votes.ts。通过 export `voteTimers`/`closeVoteInternal`/`clearVoteTimer` 共享 timer 管理逻辑。
- Bug 1: 只删一行，没有重构 close 路径的重复代码（3 处 richBlock 构造）。这些重复是 Phase 2 已有的，不属于本次 scope。

## Open Questions

1. Bug 1 fix 只处理了 route-serial 和 route-parallel 路径。HTTP cast 路径（votes.ts:238-292）不受影响（它不往猫消息注入），但请确认。
2. Gap 4 的 `voters` 字段是必填的（HTTP 路径是 optional）。理由：猫发起投票必须指定 voters，不能开放式。这个设计是否合理？

## Next Action

请 review 代码变更，重点关注：
- Bug 1 fix 是否完整（有没有遗漏的路径）
- Gap 4 callback 端点的安全性（auth、重复投票防护）
- MCP 工具定义是否合理

## 自检证据

### Spec 合规

| # | 要求 | 状态 |
|---|------|------|
| Bug 1 | 结果卡不注入猫消息 | ✅ route-serial + route-parallel |
| Gap 4 AC1 | MCP tool 可调用 | ✅ tool-registration 8/8 |
| Gap 4 AC2 | 复用现有 vote API | ✅ 共用 voteTimers/closeVoteInternal |
| Gap 4 AC3 | createdBy = catId | ✅ 测试验证 |
| Gap 4 AC4 | 通知路由到 voters | ✅ mentions CatIds |

### 测试结果

```
vote-routes.test.js          — 35 pass, 0 fail
callback-start-vote.test.js  — 7 pass, 0 fail
tool-registration.test.js    — 8 pass, 0 fail
pnpm build (api + mcp)       — exit 0
pnpm lint                    — 0 errors
```

### 相关文档

- Feature: `docs/features/F079-voting-system.md`
- Branch: `feat/f079-bug1-gap4`

### Changed files

| File | Change |
|------|--------|
| `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` | Remove `allRichBlocks.push(richBlock)` |
| `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` | Same fix |
| `packages/api/src/routes/votes.ts` | Export `voteTimers`, `closeVoteInternal`, `clearVoteTimer` |
| `packages/api/src/routes/callbacks.ts` | New `POST /api/callbacks/start-vote` endpoint |
| `packages/mcp-server/src/tools/callback-tools.ts` | New `cat_cafe_start_vote` tool |
| `packages/mcp-server/test/tool-registration.test.js` | Add new tool to expected lists |
| `packages/api/test/callback-start-vote.test.js` | 7 new tests (NEW) |
