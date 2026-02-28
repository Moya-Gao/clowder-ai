---
feature_ids: [F047]
topics: [queue, steer, ux]
doc_kind: review_request
created: 2026-02-28
---

## Review 请求: F047 Queue Steer（queued 立即执行 / 提到队首）[砚砚/Codex🐾]

### 背景
铲屎官在 Codex 原生队列里用 Steer：当消息在队列等待时，Steer 后会把“那条排队消息”立刻推进猫的处理流程。我们希望把这个体验补到 Cat Café 的 QueuePanel 上，但**先不做 processing steer**（只对 queued 生效）。

### 铲屎官原始需求（🔴 必填）
- Discussion/Interview: N/A（来自 2026-02-28 铲屎官实测反馈 + 截图）
- **原始需求摘录（≤5 行，原话）**：
  > “我体验的效果是当我有消息在消息队列，我 steer 后，你这只大猫就瞬间收到那个我在消息队列里被我 steer 出去的那条。”
  > “开始吧！先不做 processing 的 steer。”
- 核心痛点：队列里“那条消息”需要一键升级优先级（立即执行/提到队首），而不是只能撤回/挪顺序/再发一条。
- 请 reviewer 对照上面的摘录判断：交付物是否实现了“steer 让队列消息立刻进入处理流程”的体验。

### 设计文档
- Feature: `docs/features/F047-queue-steer.md`
- Plan: `docs/plans/2026-02-28-f047-queue-steer.md`
- Pencil: `pencil-new.pen` nodes `58L25`（QueuePanel）/ `WvfXb`（Steer modal）

### Spec Compliance 自检（Step 2）

**愿景覆盖度（Step 0）**

| # | 需求 | 实现覆盖？ |
|---|------|-----------|
| 1 | queued 消息可 Steer 触发“立即执行” | ✅ 后端 `mode=immediate` + 前端 modal |
| 2 | queued 消息可 Steer “提到队首” | ✅ 后端 `mode=promote` + 前端 modal |
| 3 | 不做 processing steer | ✅ 前端仅对 `status==='queued'` 渲染 Steer；后端对 processing 返回 409 |

**功能验收**

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | queued 条目显示 Steer | ✅ | `packages/web/src/components/QueuePanel.tsx` | `queue-panel-steer.test.ts` |
| 2 | Steer 弹窗二选一 + 可取消 | ✅ | `packages/web/src/components/SteerQueuedEntryModal.tsx` | `queue-panel-steer.test.ts` |
| 3 | immediate：cancel 当前 invocation + 立刻执行该 entry | ✅ | `packages/api/src/routes/queue.ts` | `queue-api.test.js` |
| 4 | promote：移动到队首（不取消） | ✅ | `InvocationQueue.promote()` | `queue-api.test.js` |
| 5 | processing entry steer → 409 | ✅ | `packages/api/src/routes/queue.ts` | `queue-api.test.js` |
| 6 | WS `queue_updated` 发出 steer action | ✅ | `packages/api/src/routes/queue.ts` | API tests（emitToUser calls） |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/routes/queue.ts` | 修改 | 新增 `POST /queue/:entryId/steer`（promote/immediate） |
| `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts` | 修改 | 新增 `promote()` |
| `packages/api/src/index.ts` | 修改 | 注入 `invocationTracker` 给 `queueRoutes` |
| `packages/api/test/queue-api.test.js` | 修改 | 新增 steer API 回归测试 |
| `packages/web/src/components/QueuePanel.tsx` | 修改 | queued 条目新增 Steer + modal 调用 + toast |
| `packages/web/src/components/SteerQueuedEntryModal.tsx` | 新增 | Steer 弹窗（两种模式） |
| `packages/web/src/components/__tests__/queue-panel-steer.test.ts` | 新增 | Steer UI + API payload 测试 |

### Git SHA
- Base: `origin/main`
- Head: `f61e8db`（分支：`feat/f047-queue-steer`）

### 测试状态
- ✅ `pnpm -r --if-present run build` 通过（web next build + api/mcp-server tsc）
- ✅ API（局部）：`cd packages/api && pnpm run build && node --test test/queue-api.test.js`
- ✅ Web（局部）：`cd packages/web && pnpm test src/components/__tests__/queue-panel-steer.test.ts`
- ✅ MCP Server：`cd packages/mcp-server && pnpm test`
- ⚠️ Root `pnpm test` 在当前环境会因为 `REDIS_URL` + 未设置 `CAT_CAFE_REDIS_TEST_ISOLATED=1` 而失败（Redis 隔离 guard）；这不是本改动引入的新失败。

### Review 重点
1. **Immediate mode 的并发/互斥语义**：取消当前 invocation 后立刻 `processNext` 是否会引入竞态/双执行风险？
2. **promote 的定义**：当前实现是“移动到 queued 队首（在 processing 之后）”，是否符合产品语义？
3. **WS action 命名**：`steer_promote` / `steer_immediate` 是否需要前端特殊处理，或只作为观测字段？

### 五件套

**What**: 为 queued 队列条目提供 Steer（立即执行/提到队首）+ modal + 后端 API。  
**Why**: 复刻 Codex 原生 Steer 体验，让“队列里那条消息”能被一键提权。  
**Tradeoff**: 不做 processing steer（范围会膨胀到运行中注入/重路由）。  
**Open Questions**: immediate 模式在“QueueProcessor 正在执行”场景下是否需要更强的互斥保障（当前靠 `processNext` started=false 返回 409）。  
**Next Action**: 请宪宪按上述 review 重点审阅并给出 R1 结论。

