# F052 R1 Fix Confirmation

## 修复确认请求

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | WebSocket 实时路径丢失 `crossPost` | ✅ 已修 | 3 files: types.ts + callbacks.ts + useAgentMessages.ts |
| P1-2 | AC-A5 跨线程 push 去重 | 🔄 Push back | 见下方技术论证 |

### P1-1 修复详情

**根因**: `broadcastAgentMessage` 调用没带 `extra`，前端 `useAgentMessages.ts` 的 callback 路径也没透传 `extra.crossPost`。

**修复 (commit `f547708f`)**:
1. `AgentMessage` 接口新增 `extra?: { crossPost?: ... }` 字段
2. `callbacks.ts` 广播时带上 `extra.crossPost`（仅跨线程）
3. `useAgentMessages.ts` 的 `AgentMsg` 接口 + `addMessage` 调用透传 `extra.crossPost`

**验证**: 142 pass / 0 fail / build clean。

### P1-2 技术论证：AC-A5 现有覆盖已足够

砚砚指出 fallback 路径缺少去重标记。分析如下：

**消息广播路径**（callbacks.ts）: 只执行一次 `broadcastAgentMessage`，无论同线程还是跨线程。不存在重复广播。

**A2A 触发路径**（callback-a2a-trigger.ts）:
- **有 worklist**（正常路径，line 60）: `pushToWorklist` 按 catId 去重，同一只猫不会被 enqueue 两次
- **无 worklist**（fallback 路径，line 108）: 注释明确说 "shouldn't normally happen"。且此路径不产生 push notification——它直接创建 standalone invocation，无独立的推送机制

**Spec A3 原文**: "`cross_post_message` 的 A2A 触发可能导致目标线程收到重复通知（push notification + A2A invocation）"。但实际上：
1. 我们没有独立的 push notification 服务（不是 Web Push）
2. WebSocket broadcast 只在 callbacks.ts 执行一次
3. A2A invocation 是后续行为，不是"通知"

**结论**: AC-A5 的"push 通知不重复"在现有架构下天然满足——不存在能产生重复的路径。添加 `sourceType: 'crossPost'` 标记是冗余的（YAGNI）。如果未来引入独立的 push notification 服务，再按需添加。

**建议**: 在 spec 中将 AC-A5 标注为 "covered by architecture"（架构层天然满足），而非 "partially covered"。

## 测试结果

```
node --test (4 files) → 142 passed, 0 failed ✅
next build            → Compiled successfully ✅
```

## Commits

- `c6f65f4c` — feat(F052): cross-thread identity isolation + message provenance
- `c414b5d3` — docs: add F052 review request to mailbox
- `f547708f` — fix(F052): include crossPost in WebSocket broadcast for real-time badge
