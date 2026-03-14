# Review Request: Issue #83 — Draft Keepalive + Invocation Recovery

## What

社区 Issue [zts212653/clowder-ai#83](https://github.com/zts212653/clowder-ai/issues/83) 的 hotfix：长时间工具调用（>300s）期间刷新页面会丢失进行中消息。

两刀修复：
1. `route-serial.ts` / `route-parallel.ts` 加独立 `setInterval(60s)` keepalive timer，在 streaming 期间每 60s 调用 `draftStore.touch()` 续 TTL
2. `GET /queue` 暴露 `activeInvocations` 字段（`InvocationTracker.getActiveSlots`），前端 `useChatHistory` 消费它恢复 `hasActiveInvocation` 状态

## Why

- Draft TTL 300s，但长工具调用期间无 stream event → 无 touch → draft 过期 → F5 后进行中消息消失
- `/queue` 不暴露 active invocation → 前端刷新后无法恢复 processing 状态
- 关联 F080（设计假设缺口）、F081（残留场景）

## Original Requirements

> 当某只猫正在执行一个很长的工具调用时，页面刷新后，前端会丢失两类进行中 UI：
> 1. 右侧/输入区的"正在处理"状态
> 2. 聊天区里那个进行中的工具调用消息
> — [zts212653/clowder-ai#83](https://github.com/zts212653/clowder-ai/issues/83)

- 来源：社区 Issue #83（Bug report with root cause analysis）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 `setInterval(60s)` 而非增大 TTL：TTL 增大不解决根因（仍然是事件驱动），60s 间隔给了 5 次续命机会
- 选择复用 `InvocationTracker.getActiveSlots()` 而非新增 Redis 持久化：数据源已有，加 1 行即可

## Open Questions

1. **keepalive 间隔 60s 是否合适？** TTL 300s / interval 60s = 5 次机会。太频繁增加 Redis 写压力，太稀疏减少容错
2. **parallel route 的 keepalive 是单 timer 遍历所有 cat drafts**，是否应该 per-cat 独立 timer？当前实现更简单，但如果一只猫完成了另一只还在跑，timer 会 touch 已删除的 draft（无害，Redis touch 对不存在的 key 只做 hset + expire，不会报错）
3. **前端只恢复 `hasActiveInvocation` 布尔值**，没有恢复具体的 `catInvocations` 信息（哪只猫在处理）。是否需要在 `/queue` 暴露更细粒度的 invocation 信息？

## Next Action

请 review 代码改动，重点关注：
- timer 生命周期管理（有没有泄漏风险）
- `/queue` 接口变更的向后兼容性
- 测试覆盖是否充分

## 自检证据

### Spec 合规

| 设计稿验收项 | 状态 |
|-------------|------|
| T1: >300s 静默 tool call 不丢 draft | ✅ keepalive timer 测试覆盖 |
| T2: Tool-first invocation 刷新 | ✅ 已有测试（draft-flush-timing） |
| T3: 活跃 invocation `/queue` 返回 | ✅ InvocationTracker 测试 |
| T4: 完成后 `/queue` 返回空 | ✅ InvocationTracker 测试 |
| T5: 多猫并行 | ✅ InvocationTracker 测试 |
| T6: Timer 无泄漏 | ✅ setInterval/clearInterval 计数测试 |

### 测试结果

```
draft-keepalive.test.js:     4 passed, 0 failed (新增)
draft-flush-timing.test.js:  全部 pass (已有)
draft-store.test.js:         全部 pass (已有)
draft-messages-merge.test.js:全部 pass (已有)
总计 29 + 4 = 33 draft 相关测试全绿
```

### Biome

修改文件 0 error（全量仓库 2 个 pre-existing error 不是本次引入）

### 相关文档

- Plan: `docs/plans/2026-03-14-issue83-draft-keepalive-and-invocation-recovery.md`
- Related: F080, F081

### 改动范围

| 文件 | 改动 |
|------|------|
| `route-serial.ts` | +12 行（keepalive timer） |
| `route-parallel.ts` | +14 行（keepalive timer） |
| `queue.ts` | +3 行（接口 + 响应字段） |
| `useChatHistory.ts` | +8 行（消费 activeInvocations） |
| `draft-keepalive.test.js` | +234 行（新测试文件） |

---

Author: 布偶猫-opus4.6
Branch: `fix/issue83-draft-keepalive`
Worktree: `cat-cafe-issue83-draft-keepalive`
