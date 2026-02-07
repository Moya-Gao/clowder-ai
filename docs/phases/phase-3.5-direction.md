# Phase 3.5 & 4 方向文档

> 状态：方向共识，待实现计划细化
> 日期：2026-02-06
> 作者：布偶猫（Opus），基于四方圆桌共识
> 前置：Phase 3 原计划（Redis、MCP 完善、前端体验）由另一组完成
> 共识来源：`docs/discussions/2026-02-06-four-way-roundtable-minutes.md`

---

## 指导原则

来自这次圆桌的三句话，贯穿后续所有设计：

1. **"为什么要盒子？我们可以做一个像云朵一样的软体啊！"** — 暹罗猫
   → 不要套用现有工具的形态，从猫咖的体验出发设计

2. **"后端严肃模型 + 前端猫咖隐喻 = 同一事实两种视图"** — 缅因猫
   → 数据层不妥协，体验层不将就，两者解耦

3. **"我们刚才就在圆桌上，没人按过任何按钮"** — 布偶猫
   → 协作应该自然发生，系统做感知和沉淀，不做仪式和流程

---

## Phase 3.5：让猫咖有记忆和意图

> 定位：在 Phase 3（基础体验完善）之上，加上"任务感知"和"讨论沉淀"
> 前提：Phase 3 的 Redis 持久化和 WS 分房间已完成

### 3.5-A：Task MVP — 毛线球

**What**：最小任务模型，让三猫能追踪"谁在做什么"。

**数据模型**：
```
TaskItem {
  id: string
  threadId: string
  title: string
  ownerCatId: CatId | null
  status: 'todo' | 'doing' | 'blocked' | 'done'
  why: string
  createdBy: CatId | 'user'
  createdAt: number
  updatedAt: number
}
```

**后端**：
- `POST /api/tasks` — 创建任务
- `PATCH /api/tasks/:id` — 更新状态/owner
- `GET /api/tasks?threadId=...` — 查询线程下的任务

**MCP 工具**（三猫可用）：
- `cat_cafe.update_task(taskId, status, note)` — 猫猫更新自己负责的任务

**前端**（暹罗猫主导视觉）：
- 聊天侧边栏任务列表
- 状态用猫咖隐喻呈现（具体视觉方案由暹罗猫设计）
- 铲屎官可以在聊天里直接创建任务（类似 `/task 给布偶猫：重构 AgentRouter`）

**存储**：先内存 Map，复用 Phase 3 的 Redis 能力做持久化。

**Why**：当前纯消息驱动无法追踪"这件事做到哪了"。Task 给协作加上最小的可追踪性。

**Tradeoff**：只有 1 个 MCP 工具而不是缅因猫原案的 3 个，因为创建和查询可以走 API，猫猫主要需要的是"更新自己的任务状态"。

### 3.5-B：Intent 信号 — 猫咖的空气

**What**：后端轻量策略信号，决定本次路由是并行还是串行。

**设计**：
```
Intent = 'ideate' | 'execute'
```

**推断逻辑**（AgentRouter 内）：
- `@布偶 @缅因 @暹罗`（≥2 猫被提及）→ 默认 `ideate`
- `@布偶`（单猫）→ 默认 `execute`
- 铲屎官可在消息中显式覆盖（如 `#execute @布偶 @缅因 先布偶写再缅因审`）

**行为差异**：
- `ideate`：并行调用所有目标猫，各自独立响应，不传递彼此的回复
- `execute`：维持当前串行链，后一只猫收到前一只的回复

**Why**：缅因猫指出纯前端判断不够 — 并行/串行是路由行为，必须后端可控、可测、可复现。同时自动推断避免了用户手动切模式的负担。

**Tradeoff**：自动推断可能猜错（比如铲屎官 @ 两只猫但确实想要串行）。用 `#execute` 覆盖解决，但这意味着铲屎官需要知道这个语法。可以在 UI 上做个小提示。

### 3.5-C：讨论纪要 — 拍立得照片墙

**What**：把一段对话沉淀为结论卡片，挂在聊天流里。

**触发方式**：
- 铲屎官手动：`/summary` 或点击按钮
- 系统建议：检测到连续 N 轮多猫讨论后，浮出"要不要总结一下？"的提示

**纪要结构**（轻量，非完整 Roundtable 协议）：
```
ThreadSummary {
  id: string
  threadId: string
  topic: string
  conclusions: string[]
  openQuestions: string[]
  createdAt: number
  createdBy: CatId | 'user'
}
```

**实现**：
- 可以让布偶猫自动总结（调用自身 + 给上下文）
- 也可以铲屎官手写
- 纪要作为特殊消息类型显示在聊天流中（视觉上区别于普通消息）

**前端**（暹罗猫主导）：
- 拍立得风格的卡片，有照片墙的感觉
- 可以快速跳转回纪要锚点

**Why**：讨论的价值在于结论，但结论容易淹没在消息流里。纪要是最轻的沉淀方式。

**Tradeoff**：不做缅因猫原案的 `start_roundtable` / `finalize_roundtable`，放弃了"讨论过程结构化"（谁的观点、分歧在哪），只保留"结论沉淀"。够用就好。

### 3.5-D：并行观点采样 — 独立思考权

**What**：当 intent 为 ideate 时，AgentRouter 并行调用多猫。

**AgentRouter 改造**：
```typescript
// ideate 模式：并行调用，各自独立
if (intent === 'ideate') {
  const streams = targetCats.map(catId =>
    this.invokeOne(catId, message, userId)  // 不传 previousResponses
  );
  // 合并多个 AsyncIterable，交错 yield
  yield* mergeStreams(streams);
}

// execute 模式：维持现有串行链
if (intent === 'execute') {
  // ... 现有 for...of 逻辑
}
```

**前端展示**：
- 多猫消息区域并列展示（而非上下堆叠）
- 或者保持时间线但标注"独立观点，非回应前一只猫"

**复杂度评估**（缅因猫判断）：中等。核心难点是并发流合并和前端同时展示多猫打字。

**Why**：串行讨论导致后面的猫被前面的猫锚定，丢失观点多样性。这是铲屎官和暹罗猫都强调的核心需求。

**Tradeoff**：只做独立并行，不做依赖编排（如"布偶猫先写，缅因猫再审"的自动串联）。依赖编排复杂度高，留给 Phase 4。

---

## Phase 4：让猫咖能编排和互转

> 定位：在 3.5 的基础上，加上协作编排能力
> 前提：Phase 3.5 的 Task、Intent、纪要、并行都已稳定运行

### 4-A：Bridge — 讨论 ↔ 任务互转

- 从纪要中提取待办 → 自动创建 Task 草案（铲屎官确认后生效）
- 任务卡住时 → 升级为讨论议题（在聊天流中 @ 相关猫）

### 4-B：并行 + 依赖编排

- 支持 `#plan` 模式：布偶猫拆解任务 → 并行分发给缅因猫和暹罗猫 → 汇总结果
- 需要 Task 依赖字段（`dependsOn`）和完成后自动触发下游

### 4-C：视觉氛围系统

- 暹罗猫主导：根据 intent 和参与猫数，前端自动调整视觉氛围
- 多猫讨论时头像靠拢、背景微调
- 单猫执行时界面更简洁聚焦

### 4-D：协作审计与成本治理

- 记录 Task 分配、状态变更、回调来源
- 并发上限和 token 预算阈值
- 超预算自动降级为串行

---

## 分工预期

| 猫 | Phase 3.5 职责 | Phase 4 职责 |
|---|---|---|
| 布偶猫 | Task 后端 + Intent 路由 + 并行改造 | Bridge 后端 + 依赖编排 |
| 缅因猫 | Code review + 安全审计 + 测试 | 成本治理 + 审计日志 |
| 暹罗猫 | Task UI 视觉 + 纪要卡片 + 并行展示 | 氛围系统 + 视觉打磨 |
| 铲屎官 | 产品决策 + 验收 + 踹猫出思维定势 | 同左 |

---

## 风险

| 风险 | 缓解 |
|---|---|
| Phase 3 还没完成就急着做 3.5 | 严格等 Phase 3 稳定后再开始 |
| 并行改造引入前端复杂度 | 先做最简展示（时间线 + 标注），暹罗猫迭代优化 |
| Task UI 设计周期不可控 | 先用朴素列表，暹罗猫的猫罐头视觉作为增量升级 |
| intent 自动推断经常猜错 | 默认策略 + 显式覆盖，收集使用数据后调优 |

---

## 这份文档的 Why-First 交接包

### What
基于四方圆桌共识产出的 Phase 3.5 和 Phase 4 方向文档。

### Why
Agent Teams 的发布触发了"我们的协作模型该怎么演进"的讨论。四方独立思考后碰撞出了比任何单方都好的结论。

### Tradeoff
- 砍掉了缅因猫原案的 Roundtable 实体、模式切换、大部分 MCP 工具
- 保留了 Task 核心、intent 信号（缅因猫贡献）、并行通道、纪要沉淀
- 体验方向采纳暹罗猫的猫咖隐喻而非传统 dashboard

### Open Questions
- intent 推断的默认策略是否足够好？需要实际使用数据验证
- 讨论纪要是手动触发还是自动建议？可能需要 A/B 测试
- 并行前端展示的最佳方案是什么？需要暹罗猫出原型

### Next Action
1. 等 Phase 3 完成并稳定
2. 布偶猫出 Phase 3.5 的实现计划（含测试点）
3. 缅因猫 review 实现计划
4. 暹罗猫同步开始 Task UI 和纪要卡片的视觉探索
