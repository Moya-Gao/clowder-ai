# F227 Event Memory Implementation Plan

**Feature:** F227 — `docs/features/F227-event-memory.md`
**Design Gate:** `docs/discussions/2026-06-06-f227-design-gate.md`（thick-slice / no-scaffold，已 accepted）
**Goal:** 把猫的认知状态转折（拉闸 / aha / 坐标系纠正）做成一等公民的 typed Event Memory 索引，可检索、可 teleport 到精确 message。
**Acceptance Criteria:**（抄自 feat doc，plan 必须覆盖全部）
- AC-A1 Event schema 终态 10 字段 + 测试 + 文档；可承载 B/C
- AC-A2 从 L0 的 10 个 magic word 回扫历史生成 event 索引；置信度分级有测试
- AC-A3 只读 timeline UI，filter by magic word / 事件类型；低置信折叠
- AC-A4 `teleport(threadId, messageId)` 端到端可演示（搜 → 找坐标 → 精确跳 message）
- AC-A5 magic word 含义从 L0 读，不重复定义
- AC-B1 `cat_cafe_mark_event` + 无分类器路径（no-classifier）
- AC-B2 跨 thread 重复诉求聚合
- AC-B3 面板两轨 filter
- AC-C1 事件关联 harness 改动（resolution 链）
- AC-C2 趋势不单独当证据
- AC-C3 "骂完长出什么能力"可视化

**Architecture cell:** `memory`（事件存储/查询）+ `thread-navigation`（teleport 语义）；`hub-action-surface` 为 teleport 的 typed execution surface
**Map delta:** update required
**Map delta why:** memory cell 新增 typed event index（不造平行 MemoryStore）；thread-navigation 新增 message 级 teleport 语义（不扩 `workspace_navigate`）。两者均扩展现有 cell，不新造大 cell。
**Architecture:** 终态 10 字段 `EventMemory` model 先行 → memory domain 内 `EventMemoryStore`（SQLite-backed，参考 `SqliteEvidenceStore`）→ query route（参考 `routes/evidence.ts`）→ generic `teleport` MCP/callback（参考 `handleWorkspaceNavigate` 但走独立 socket 事件）+ 前端复用 `scrollToMessage`/cross-post pending-scroll 基座。所有 lane（backfill / mark_event / resolution）读写同一 model。
**Tech Stack:** TypeScript, Node (packages/api), MCP server (packages/mcp-server), React/Zustand (packages/web), SQLite evidence store, Socket.io, node:test + Redis 测试隔离
**前端验证:** Yes — teleport 端到端（timeline → 点击 → 跨 thread → scroll 到 message）必须 Playwright/Chrome 实测

---

## Straight-Line Check (A→B, No Detour)

**B（终点一句话）：** 用户/猫能在 Hub 看到一条认知校准事件时间线，点任意事件一键 teleport 到那条 thread message；猫能 `mark_event` 主动声明转折；所有事件是同一套 typed 10 字段 model。

**NOT building（本 feature 不做）：**
- ❌ Magic Word-only 面板冒充 Event Memory（KD-1）
- ❌ 分类器 / 小模型 / regex 猜猫 aha（KD-3 no-classifier）
- ❌ 临时 JSON / markdown 索引 / UI-local event list（design gate No-Scaffold）
- ❌ 临时 URL 字符串跳转（teleport 必须 typed action）
- ❌ 趋势单独当"自进化有效"证据（KD-7）
- ❌ 回扫"近 N 月"作为产品语义（OQ-1：全 corpus）

**终态 schema（步骤围绕它建，非脚手架）：**
```typescript
// packages/shared/src/types/event-memory.ts （端到端共享类型）
export type CognitiveTransition =
  | 'user_brake' | 'self_brake' | 'coordinate_correction' | 'capability_gap'
  | 'scope_correction' | 'aha' | 'repeated_need' | 'harness_internalized' | 'lesson_crystallized';
export type EventTrigger = 'human_brake' | 'cat_brake' | 'cat_shout' | 'flywheel_selffix' | 'lesson_settle';
export type EventConfidence = 'high' | 'mid' | 'low';

export interface EventMemoryRecord {
  type: string;                 // 事件类型（magic word slug / 'cat_declared' / ...）
  trigger: EventTrigger;        // 五类信号
  cat: string;                  // 当事猫 catId
  threadId: string;             // teleport 坐标
  messageId: string;            // teleport 坐标（精确到 message）
  timestamp: number;
  summary: string;              // 原话摘要
  cognitiveTransition: CognitiveTransition | null;  // nullable（不为 Phase A 强猜 aha）
  relatedHarness: string[] | null;                  // commit/hook/skill/rule 锚点（Phase C 填）
  confidence: EventConfidence;
}
```

**三问检查（每个 PR 过）：**
- 输出留在终态系统（只扩展不重写）？ → 10 字段 model / typed store / generic teleport 都是终态部件 ✅
- 每个 PR 能 demo 什么？ → PR-1：teleport 跳 message；PR-2：只读 magic-word 时间线 ✅
- 删掉这个 PR 的代价？ → 删 PR-1 = 没有事件存储和跳转底座，后续全悬空 ✅

---

## PR-1：Core Event Memory substrate + generic teleport

> **为什么不是 disposable MVP**：PR-1 落的是终态 10 字段 model、typed store/query、generic teleport——PR-2/3/4 全部复用，零重写。teleport 从第一版就吃真实 `(threadId, messageId)`，timeline 后面只调同一个 action。

### Task 1: 终态 EventMemory 共享类型
**Files:** Create `packages/shared/src/types/event-memory.ts`；Modify `packages/shared/src/index.ts`（导出）；Test `packages/shared/test/event-memory-types.test.ts`
- Step 1: 写类型守卫测试（`isEventMemoryRecord` 校验 10 字段 + enum 合法性）→ 跑红
- Step 2: 写上方 schema + 守卫函数 → 跑绿
- Step 3: `pnpm --filter @cat-cafe/shared build`（shared 改后必须 build）
- Step 4: commit `feat(F227): terminal EventMemory schema (10 fields)`

### Task 2: EventMemoryStore（memory cell，SQLite-backed）
**Files:** Create `packages/api/src/domains/memory/EventMemoryStore.ts`；Modify `packages/api/src/domains/memory/interfaces.ts`（加 `IEventMemoryStore`：`markEvent` / `listEvents(filter)` / `getByCoord` / `initialize` / `health`）；Modify `packages/api/src/domains/memory/factory.ts`（`MemoryServices.eventMemoryStore` + 工厂构造）；Test `packages/api/test/memory/event-memory-store.test.js` + Redis variant（如索引/分页逻辑涉及）
- Step 1: 写失败测试——`markEvent` 写入后 `listEvents({trigger:'human_brake'})` 能取回；filter by cat/type/confidence/时间窗；分页边界（**用 Redis-backed 或模拟索引行为的 stub，不用纯 in-memory**，LL: in-memory dense 掩盖索引/分页 bug）
- Step 2: 实现 `EventMemoryStore`（参考 `SqliteEvidenceStore` 的 schema/upsert/query 模式，provenance 字段对齐 F102）→ 跑绿
- Step 3: wiring 进 factory + 启动链路冒烟
- Step 4: commit `feat(F227): EventMemoryStore typed event index in memory cell`

### Task 3: Event query route
**Files:** Create `packages/api/src/routes/events.ts`（`GET /api/memory/events` filter+分页，参考 `routes/evidence.ts` 的 searchSchema + 执行 meta）；Modify route 注册入口；Test `packages/api/test/routes/events.test.js`（参考 `evidence-route.test.js`）
- Step 1-4: 失败测试（filter 参数 → 正确事件集 + 分页）→ 实现 → 绿 → commit

### Task 4: generic teleport（MCP + callback route + 前端）
**Files:**
- Create `packages/mcp-server/src/tools/event-memory-tools.ts`（`teleportInputSchema {threadId, messageId}` + `handleTeleport` 走 `callbackPost('/api/memory/teleport',...)`，参考 `handleWorkspaceNavigate`）
- Modify `packages/mcp-server/src/tools/index.ts`（导出）+ `server-toolsets.ts`（注册 + `AGENT_KEY_TOOLS` 加 `cat_cafe_teleport`）
- Create `POST /api/memory/teleport`（在 `routes/events.ts` 或 workspace 同款，`socketEmit('thread:teleport', {threadId, messageId, eventId}, ...)`，**独立 socket 事件，不污染 `workspace:navigate`**）
- Create `packages/web/src/utils/teleport.ts`：`teleportToMessage(threadId, messageId)` — 当前 thread 直接 `scrollToMessage`；跨 thread 则导航 + 设 pending(messageId)，在 `useChatHistory` 渲染后 `scrollToMessage`（复用 cross-post 的 raf retry 思路，**直接吃 messageId，不走 invocationId lookup**）
- Modify `packages/web/src/hooks/useWorkspaceNavigate.ts` 同款新增 `thread:teleport` socket 监听（或新 hook）
- Test `packages/web/src/utils/__tests__/teleport.test.ts`（参考 `crosspost-scroll-target.test.ts`：同 thread / 跨 thread / message paged-out fallback）
- Step 1-5: 前端 util 失败测试 → 实现 → 绿；MCP tool schema/handler；callback route；端到端 Playwright（timeline 暂未做，先用测试坐标验证跳转）→ commit `feat(F227): generic teleport(threadId,messageId) reusing scroll substrate`

> PR-1 验收：MCP `cat_cafe_teleport` 给定真实 (threadId, messageId) → Hub 跨 thread 滚动并高亮目标 message（Playwright 实测）。No-Scaffold 自检：10 字段全 ✅ / teleport typed action ✅ / 不扩 workspace_navigate ✅。

---

## PR-2：Phase A read-only timeline + Magic Word backfill lane

> **为什么不是 disposable MVP**：backfill / detector / timeline API / timeline UI 全部读写 PR-1 的同一 Event model；回扫是全 corpus 的最终 pipeline（batch/cursor 是实现细节，不是近 N 月 MVP）。timeline 的跳转直接调 PR-1 的 teleport。

### Task 5: Magic Word detector（deterministic，置信度分级）
**Files:** Create `packages/api/src/domains/memory/magic-word-detector.ts`（从 L0 读 10 词表，**不硬编码重复**；`magic word + @猫`=high，`+自检指令`=mid，讨论家规上下文=low）；Test `.../magic-word-detector.test.js`（高/中/低置信 fixture）
- Step 1-4: 置信度 fixture 失败测试 → 实现 → 绿 → commit。**仅服务人工拉闸 lane，deterministic，不触 no-classifier 红线**

### Task 6: Backfill job（全 corpus，可恢复）
**Files:** Create `packages/api/src/domains/memory/event-backfill.ts`（扫 persisted thread/message corpus → detector → `EventMemoryStore.markEvent`，batch/cursor/resumable）；Test 含 PPT backup 线索表里的经典事件坐标作为 integration fixture
- Step 1-4: 失败测试（已知历史 thread → 期望事件集）→ 实现 → 绿 → commit

### Task 7: Timeline query API + `cat_cafe_list_events` MCP
**Files:** 扩 `routes/events.ts`（timeline 倒序 + filter）；`event-memory-tools.ts` 加 `cat_cafe_list_events`；Test 同步
- Step 1-4: TDD → commit

### Task 8: 只读 Timeline UI
**Files:** Create `packages/web/src/components/event-memory/EventTimeline.tsx`（倒序 + magic word/类型 filter chips + 低置信折叠 + 每行 [跳转]→`teleportToMessage`）；magic word 含义从 L0 读（AC-A5）；Test + Playwright
- Step 1-5: 组件测试 → 实现 → Playwright 端到端（timeline → 点击 → teleport 到 message）→ commit

> PR-2 验收：选「脚手架」filter → 倒序事件 → 点击 → teleport 到精确 message（Playwright）。低置信折叠 ✅ / 词表 single source ✅。

---

## No-Scaffold Gate（每个 PR review 前自检，引用 design gate 7 条）
reviewer 见以下任一即 reject：① 事件缺 10 字段 ② timeline 用 UI-only/临时 store ③ teleport 用临时 URL/字符串 hack ④ 扩了 `workspace_navigate` ⑤ `mark_event` 走分类器推断 ⑥ 趋势无 resolution 链就声称有效 ⑦ PR 切出无终态价值的 tiny helper。

## Open Questions
- **技术 OQ（实现时自行解决）**：EventMemoryStore 用独立 SQLite table vs 扩 evidence schema（实现时按 filter 表达力定，design gate OQ-4 已授权子 store/table）；teleport socket 房间作用域（参考 workspace `join_room`）。
- **价值 OQ**：无。design gate 已把 OQ-1~5 全部钉死，无需 CVO 再判。

## 下一步
plan commit + push → `worktree`（隔离环境 + Redis 6398）→ `tdd` 起 PR-1 Task 1。PR 粒度遵守 design gate：Phase A 最多 2 厚 PR，太薄合并。

> [宪宪/Opus-4.8🐾] 2026-06-06 — 基于 design gate `02e715661` + Explore 实测代码锚点
