## Review 请求: Tool Events 历史持久化修复

### 背景

铲屎官发现重启服务后，聊天记录里猫猫的 tool use 不再显示。根因是 tool_use/tool_result 事件只通过 SSE 实时推给前端，从未存入 messageStore，导致历史加载时丢失。

方案选择经过三猫讨论：
- 方案 A（纯前端重建）：不可行，因为后端历史中没有 tool 数据可供重建
- 方案 B（单独存 toolEvents）：可行但会和 contentBlocks 产生双写漂移
- **方案 C（采纳，缅因猫建议）**：后端持久化 tool 轨迹，API 统一返回 toolEvents，前端实时/历史走同一渲染路径

### 设计文档
- 无独立 spec（bug fix，非新 feature）
- 讨论记录在 cat-cafe 对话中（铲屎官 + 三猫讨论 2026-02-16）

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 后端 tool_use/tool_result 落库 | ✅ | route-strategies.ts 两条路径均已覆盖 |
| 2 | Redis 序列化/反序列化 | ✅ | RedisMessageStore 新增 toolEvents 字段处理 |
| 3 | API 返回 toolEvents | ✅ | messages.ts TimelineItem 映射 |
| 4 | 前端历史加载映射 | ✅ | useChatHistory.ts 新增 toolEvents 映射 |
| 5 | hardDelete 清理 toolEvents | ✅ | 两个 Store 实现均已更新 |
| 6 | 测试覆盖 | ✅ | 4 个新测试覆盖存储、routeSerial、routeParallel |
| 7 | 类型安全（无 any） | ✅ | StoredToolEvent 类型定义完整 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/cats/services/MessageStore.ts` | 修改 | 新增 `StoredToolEvent` 类型 + `toolEvents` 字段 + hardDelete 清理 |
| `packages/api/src/domains/cats/services/RedisMessageStore.ts` | 修改 | 序列化/反序列化 toolEvents + hardDelete 清理 |
| `packages/api/src/domains/cats/services/route-strategies.ts` | 修改 | 流式累积 tool events + 落库（serial + parallel） |
| `packages/api/src/routes/messages.ts` | 修改 | API 响应包含 toolEvents |
| `packages/web/src/hooks/useChatHistory.ts` | 修改 | 历史加载映射 toolEvents |
| `packages/api/test/message-store.test.js` | 修改 | 新增 toolEvents 存储 + hardDelete 测试 |
| `packages/api/test/route-strategies.test.js` | 修改 | 新增 serial/parallel toolEvents 持久化测试 |

### Git SHA
- Base: ae873cd (main)
- Head: e343d5b

### 测试状态
```
message-store + route-strategies + messages-endpoint: 69 passed, 0 failed
```

### Review 重点
1. `toStoredToolEvent()` helper 的 detail 截断逻辑是否和前端 `safeJsonPreview` / `compactToolResultDetail` 保持一致（故意简化了，不完全一致）
2. routeParallel 的 per-cat tool events 累积是否有竞态风险（mergeStreams 是顺序 yield 的，应该安全）
3. 向后兼容性：旧消息没有 toolEvents 字段，前端 `...(m.toolEvents ? {...} : {})` 处理是否充分

### 五件套

**What**: 修复 tool use 事件在服务重启后从历史记录消失的 bug。后端流式累积 tool events 并存入 messageStore，API 返回给前端。
**Why**: tool_use/tool_result 事件只存在于 SSE 实时流的内存状态，从未持久化。重启后前端从 API 加载历史时无法恢复。
**Tradeoff**: 放弃方案 A（纯前端重建，数据不足）和方案 B（独立存 toolEvents，漂移风险）。方案 C 在存储时累积 tool events 和 content 一起存，统一数据源。
**Open Questions**: route-strategies.ts 已 837 行（原 779 行），超过 350 行限制，但这是预存问题，将在 F23 重构中解决。
**Next Action**: 请 review 上述 7 个文件
