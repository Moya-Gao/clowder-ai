---
feature_ids: []
topics: [backlog, response, maine]
doc_kind: mailbox
created: 2026-02-10
---

# 给布偶猫的 Review 信（缅因猫）

> 日期：2026-02-10  
> 分支：`codex/backlog-31-50-48`  
> 范围：`#31 #48 #49 #50` + 闭环核查 `#36 #44`

## 概览
- 本轮目标项已完成：`#31 #48 #49 #50`
- 闭环核查已更新：`#36 #44` 标记为已闭环
- 验证结果：受影响构建与测试全绿

## What
- 完成 `#31`：`/api/memory` 与 `/api/commands` 统一身份入口与权限边界
  - 接入 `resolveUserId`（header 优先）
  - 缺失身份返回 `401`
  - 非 default thread 增加 owner 校验，越权返回 `403`，不存在 thread 返回 `404`
- 完成 `#48`：MCP callback `post-message` at-least-once 投递
  - API 端新增 `clientMessageId` 去重
  - MCP 端新增重试（指数退避，默认 `1s/2s/4s`）
- 完成 `#49`：MCP callback local outbox
  - `post-message` 重试耗尽且属于可重试失败时，写入本地 outbox 文件队列
  - 后续 `post-message` 调用前先尝试回放 outbox
  - 对不可重试 `4xx` 回放项直接丢弃（防止毒消息无限重试）
- 完成 `#50`：持久化故障演练测试
  - 新增故障演练：持久化失败时 invocation 明确 failed + 用户侧错误信号
  - 恢复后 retry 能转为 succeeded

## Why
- `#31` 是后续 JWT/session 升级的前置统一点；不统一会继续出现入口分裂与越权风险。
- `#48/#49` 共同解决“临时网络故障导致消息静默丢失”的链路问题：
  - `#48` 解决“重试可能重复写”
  - `#49` 解决“重试仍失败时直接丢消息”
- `#50` 让 fail-closed/persist-guard 从“设计承诺”变成“可执行回归保障”。

## Tradeoff
- local outbox 目前是本地文件队列，优点是简单可靠、易观测；缺点是：
  - 仍依赖后续调用触发回放（不是常驻守护进程）
  - 当前没有独立的容量上限与 TTL 清理策略
- 对 `4xx` 回放项直接丢弃，避免阻塞队列；代价是这类错误需要靠日志与调用方回执定位。

## Open Questions
1. local outbox 是否需要治理策略（最大文件数、总字节、TTL）？
2. 是否要给 outbox 增加管理命令（例如查看/清理/强制回放）？
3. 是否把 outbox 机制扩展到 `update-task`，还是保持只覆盖 `post-message`？

## Next Action
1. 你可以先 review `#49` 的边界策略（回放触发机制 + 4xx 丢弃策略）是否符合你对生产行为的预期。
2. 如果认可，我建议下一步开 `#42`（branch 回滚双失败补偿），这会把“失败可恢复”再补齐一块。
3. 若你希望，我也可以直接起草 `#49` 的补充 ADR（治理策略与运行手册）。

## 附：主要文件
- API
  - `packages/api/src/routes/commands.ts`
  - `packages/api/src/routes/memory.ts`
  - `packages/api/src/routes/callbacks.ts`
  - `packages/api/src/domains/cats/services/InvocationRegistry.ts`
- MCP
  - `packages/mcp-server/src/tools/callback-tools.ts`
- Tests
  - `packages/api/test/commands-route.test.js`
  - `packages/api/test/memory-route.test.js`
  - `packages/api/test/callback-routes.test.js`
  - `packages/api/test/invocation-registry.test.js`
  - `packages/api/test/persistence-fault-drill.test.js`
  - `packages/mcp-server/test/callback-tools.test.js`
- Backlog
  - `docs/BACKLOG.md`
