# Review Request: fix(steer): 永久 "正在回复中" 卡死 bug

## What
Steer 后旧 invocation 的 "正在回复中" 永远不消失，新 invocation 无法正常 dispatch。

**P0 修复**：`queue.ts` steer handler 缺少 cancel 广播 — 补 `buildCancelMessages` 调用。
**P2 修复**（砚砚发现）：`buildCancelMessages` 的 `done` 事件不带 `invocationId`，导致前端 `activeInvocations` map 残留旧 slot → 改 fallback 为 `clearAllActiveInvocations()`。

## Why
铲屎官在 dev 环境 (localhost:3203) 实测发现 steer 后永远卡在加载态。根因：steer handler 调用 `invocationTracker.cancel()` 后没有广播 cancel+done 消息，前端不知道旧 invocation 已取消。

## Original Requirements（必填）
> 铲屎官：「它 steer 之后永远显示正在回复中」「我们不要把这个问题跳过」「如果你定位不出来问题，我建议你找砚砚一起讨论一下」
> 砚砚(GPT-5.4)：「buildCancelMessages 的 done 不带 invocationId → setHasActiveInvocation(false) 只清 flag 不清 map → 残留 slot」
- 来源：本 thread session #1 (铲屎官语音消息 02:33 + 砚砚 review 02:57)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 方案 A（采用）：前端 fallback 改为 `clearAll`，简单可靠
- 方案 B（未采用）：让 `buildCancelMessages` 携带 `invocationId` — 更精确但 cancel 路径不一定知道 invocationId，侵入性更大

## Open Questions
1. 前端 `clearAllActiveInvocations` 在多猫并发场景下会不会误清其他猫的 slot？（理论上 cancel 发生时旧猫的 invocation 已经 abort，新猫还没 start，所以安全）
2. 是否需要给 `buildCancelMessages` 补 invocationId 作为后续优化？

## Next Action
请 review 6 个文件的改动，重点关注 Open Question #1 的多猫并发安全性。

## 自检证据

### Spec 合规
- ✅ Steer cancel 广播 done+system_info（queue.ts:208-213）
- ✅ 前端 done(无invocationId) 清 map（useAgentMessages.ts:518-520）
- ✅ Background thread 同步修复（useSocket-background.ts:256）
- ✅ 类型补全（useSocket-background.types.ts:80）

### 测试结果
```
pnpm test (api, steer 相关)  → 16/16 pass, 0 failed ✅
pnpm test (web, 相关文件)    → 79/79 pass, 0 failed ✅
pnpm lint                    → 0 errors ✅
pnpm check (biome, 改动文件) → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 变更文件（6 files, +50 -7）
| 文件 | 变更 |
|------|------|
| `packages/api/src/routes/queue.ts` | +9 -1: 补 buildCancelMessages 广播 |
| `packages/api/test/queue-api.test.js` | +11 -2: 补 broadcastAgentMessage 断言 + releaseSlot mock |
| `packages/web/src/hooks/useAgentMessages.ts` | +7 -2: fallback → clearAllActiveInvocations |
| `packages/web/src/hooks/useSocket-background.ts` | +6 -2: fallback → clearAllThreadActiveInvocations |
| `packages/web/src/hooks/useSocket-background.types.ts` | +1: BackgroundStoreLike 补方法 |
| `packages/web/src/stores/chatStore.ts` | +23: clearAllThreadActiveInvocations 类型+实现 |

---
[宪宪/Opus-46🐾]
