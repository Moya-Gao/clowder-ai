# Review Request: F079 Voting System

## What

投票系统 — 完整后端 API + 前端 `/vote` 命令 + rich block 结果展示。

变更文件 (9 files, +1261 lines):
- `ThreadStore.ts`: `VotingStateV1` 类型 + `votingState` 字段 + 接口方法
- `RedisThreadStore.ts`: Redis 持久化实现
- `votes.ts`: 4 个 API 端点 (start/cast/get/close)
- `routes/index.ts` + `index.ts`: 路由注册
- `useChatCommands.ts`: `/vote` 命令 (start/cast/status/end + --anonymous/--timeout)
- 3 个测试文件: 31 new tests

## Why

多猫协作时需要系统化投票机制（如"谁最绿茶"、狼人杀投票等），之前只能人工统计。

## Original Requirements（必填）
> "多猫协作时经常需要投票决策（如"谁最绿茶"、狼人杀投票等），目前只能人工统计。需要系统化的投票机制 + 自动汇总 + rich block 展示。"
- 来源：`docs/features/F079-voting-system.md` + Thread `thread_mm4dj9jp0tij0ch3` (2026-03-07)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| Spec 说 | 实际做法 | 理由 |
|---------|---------|------|
| 弹窗配置 | CLI args (`/vote 问题? 选项1 选项2`) | 与现有命令 UX 一致，弹窗可 Phase 2 |
| `[VOTE:xxx]` 消息解析 | `/vote cast <option>` 命令 | 更可靠，无误触发风险 |
| 自动超时关闭 | 超时后拒绝投票 (410) + 手动 `/vote end` | 避免 server-side timer 复杂度 |

## Open Questions

1. **超时策略**: 当前超时后拒绝新投票但不自动关闭——是否需要 cron/timer 自动关闭？
2. **匿名模式 GET 过滤**: GET 返回 `votes: {}` + `voteCount: N`，close 也 strip identities——是否足够？
3. **`useChatCommands.ts` 长度**: 文件已 1102 行（加了 ~136 行），远超 350 硬上限，但这是 pre-existing 问题

## Next Action

请 review 代码质量 + 架构合理性。重点关注：
- 投票状态在 ThreadStore 中的生命周期管理
- 匿名模式的信息泄露风险
- `/vote` 命令解析的边界情况

## 自检证据

### Spec 合规
Quality gate 通过。6 个 AC 覆盖：
- AC1 ✅ `/vote` 命令
- AC2 ✅ 问题+选项+匿名+超时
- AC3 ✅ 投票机制 (via `/vote cast`)
- AC4 ✅ 结果 rich block card with tally
- AC5 ✅ 匿名模式 strip identities
- AC6 ✅ 无模式依赖，任何 thread 可用

### 测试结果
```
pnpm test (API, non-Redis)    # 2909 passed, 7 failed (pre-existing)
pnpm test (Web)               # 862 passed, 0 failed
pnpm -r --if-present run build # exit 0
pnpm check (Biome)            # 0 new errors
```

### 相关文档
- Feature: `docs/features/F079-voting-system.md`
- BACKLOG: F079
