---
feature_ids: []
topics: [pro, directions, maine]
doc_kind: research
created: 2026-02-10
---

# Cat Café 三方向现状理解汇报（给 GPT Pro 课题准备）

> 作者：缅因猫（Codex）  
> 日期：2026-02-10  
> 目的：在真实代码现状上，定义 3 个可交给 GPT Pro 的研究课题与提示词草案

---

## 0. 项目现状快照（用于定边界）

### 已完成到哪里

- Phase 5.2 标注已完成，测试规模到 `592`（见 `docs/phases/README.md`）。
- 5.0 主线（Evidence/Reflect/HindsightClient/治理路由）已接入，前后端有命令闭环。
- ADR-008 的 S1 底座已落地：`InvocationRecord` + 幂等创建 + `GET/POST /api/invocations/:id/*` 路由。

### 关键约束（后续课题必须尊重）

- 现在线路仍是 `thread` 级单活跃调用（`InvocationTracker.start()` 会 abort 旧调用）。
- A2A 当前只在 `routeSerial` 自动链式，`routeParallel` 只发 follow-up 提示。
- Hindsight 是外部服务（HTTP），当前主要用于 recall/reflect；治理状态机在本地内存实现。

---

## 1) 方向一：ADR-008 后续落地（状态机一致性）

### 我们已经有的

- `messages.ts` 已按 S1 走“Record 先建→写用户消息→回填→后台执行”流程。  
  参考：`packages/api/src/routes/messages.ts:13`, `packages/api/src/routes/messages.ts:163`.
- Redis 侧幂等与 Record 创建用 Lua 原子化。  
  参考：`packages/api/src/domains/cats/services/RedisInvocationRecordStore.ts:29`.
- `invocations.ts` 已有查询+retry 接口。  
  参考：`packages/api/src/routes/invocations.ts:19`.

### 仍未闭环的点

1. `retry` 目前只把状态置回 `queued`，没有真正触发重执行链路。  
   参考：`packages/api/src/routes/invocations.ts:63`.
2. ADR-008 文档设计的 `soft/hard delete + restore + edit->branch` 仍是草案，代码里没有对应 API/Store 方法。  
   参考：`docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md:311`, `docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md:369`.
3. 前端没有利用 `invocationId` 做状态查询/重试 UX；`useSendMessage` 也没有发送显式 `idempotencyKey`。  
   参考：`packages/web/src/hooks/useSendMessage.ts:59`.
4. 文档与实现存在阶段错位：ADR 还写“草案待 review”，但 S1 代码已经上线主干，易造成认知分裂。  
   参考：`docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md:4`.

### 这个方向能做成什么样（目标形态）

- 明确状态机不变量并可机读验证：`queued/running/succeeded/failed/canceled` 的所有入口、出口、补偿路径有穷尽定义。
- 删除/编辑能力不破坏 cursor monotonicity（tombstone + branch semantics）。
- 前后端对“调用生命周期”有统一协议（API 返回、WebSocket 事件、UI 状态一致）。

---

## 2) 方向二：Hindsight 治理闭环（memory types + MCP bank 过滤）

### 我们已经有的

- HindsightClient 已封装 recall/retain/reflect/ensureBank。  
  参考：`packages/api/src/domains/cats/services/HindsightClient.ts:57`.
- `/api/evidence/search` + docs fallback 已可用。  
  参考：`packages/api/src/routes/evidence.ts:180`.
- `/api/memory/publish` 已有本地治理状态机（draft/pending_review/published/archived）。  
  参考：`packages/api/src/routes/memory-publish.ts:33`.

### 仍未闭环的点

1. ADR-005 明确列出的两个待办还没做：  
   - memory types 映射策略  
   - MCP bank 列表过滤（只 `cat-cafe-*`）  
   参考：`docs/decisions/005-hindsight-integration-decisions.md:110`.
2. 治理状态机目前与 Hindsight retain 并未真实绑定：`publish` 改的是本地状态，不触发写入/回滚外部记忆。  
   参考：`packages/api/src/routes/memory-publish.ts:56`.
3. 客户端协议存在潜在漂移风险：`recall()` 读取 `res['memories']`，而决策文档里 recall 响应字段描述为 `results`。  
   参考：`packages/api/src/domains/cats/services/HindsightClient.ts:80`, `docs/decisions/005-hindsight-integration-decisions.md`（Recall 描述段）。
4. 目前 MCP 工具没有 bank 管理能力，也没有过滤逻辑落地；只提供 evidence/reflect。  
   参考：`packages/mcp-server/src/index.ts:108`.

### 这个方向能做成什么样（目标形态）

- 从“能检索”升级为“可治理的项目记忆系统”：写入策略、发布门禁、回滚策略、可追溯性一致。
- memory types（world/observation/experience/opinion）与 `kind/status/anchor` 元信息形成稳定映射。
- MCP 暴露面受控，防跨项目污染，检索上下文对猫猫保持项目内聚。

---

## 3) 方向三：A2A 里多 Agent 的“真协同”设计

### 我们已经有的

- Serial 路径采用 worklist 扩展，支持 A2A 链式交接，且控制最大深度。  
  参考：`packages/api/src/domains/cats/services/route-strategies.ts:195`.
- A2A mention 触发已较严格：行首匹配、过滤代码块、单目标。  
  参考：`packages/api/src/domains/cats/services/a2a-mentions.ts:25`.
- Parallel 路径不会自动链式，仅在末尾给 follow-up 可用提示。  
  参考：`packages/api/src/domains/cats/services/route-strategies.ts:549`.

### 仍未闭环的点

1. 没有“协同任务层”与显式队列语义：当前是消息链 + worklist，缺少 job 状态、重试预算、优先级策略。
2. `InvocationTracker.start()` 的“新调用 abort 旧调用”语义决定了并发扩展风险很高。  
   参考：`packages/api/src/domains/cats/services/InvocationTracker.ts:30`.
3. A2A follow-up 在前端仍是提示文案，不是“按钮式可控交接”。  
   参考：`packages/web/src/components/ChatMessage.tsx`（`a2a_followup` 只展示提示）。
4. 还没形成“人类优先 + 多猫协同”的可观测协议（排队可见性、被抢占反馈、循环保护 telemetry）。

### 这个方向能做成什么样（目标形态）

- 从“能 @ 串起来”升级为“协同可控”：可解释、可观察、可中断、可恢复。
- 在不牺牲 thread 一致性的前提下，支持更真实的多猫任务协作（而非只靠 prompt 约束）。

---

## 4) 给 GPT Pro 的三个研究任务（v0.1）

> 这 3 个任务先做研究，不直接改代码。每个任务都要求输出“可执行设计+测试矩阵+风险边界”。

### 任务 A：ADR-008 状态机一致性与补偿闭环

- 目标：把 ADR-008 从 S1 底座推进到可实施的 S2/S3 设计，覆盖 retry 执行、删除/编辑分支语义、前端状态协议。
- 重点：状态空间穷举、失败点补偿、cursor 单调性证明、接口演进兼容。
- 产出：
  - 状态机转移表（含非法转移）
  - 失败注入矩阵（至少 20+ 场景）
  - API/WebSocket/前端状态统一协议草案
  - 最小落地顺序（可拆分 PR）

### 任务 B：Hindsight 治理闭环（类型映射 + Bank 安全边界）

- 目标：把 ADR-005 的待办做成可落地方案：memory types 映射策略、bank 过滤、publish/retain 联动。
- 重点：协议防漂移（results vs memories）、元信息 schema、回滚与审计一致性。
- 产出：
  - memory type 映射规范（输入来源→Hindsight 类型→tags/metadata）
  - MCP bank 暴露策略（只 `cat-cafe-*`）与实现建议
  - publish 流程与 Hindsight retain 的一致性设计
  - 兼容性测试清单（包含 Hindsight 接口版本差异）

### 任务 C：A2A 真协同架构（人类优先 + 多猫可控）

- 目标：在当前 serial worklist 基础上，设计“可控协同层”，明确什么时候该串行、什么时候可并行、怎么防环路/抢占冲突。
- 重点：调度模型、优先级规则、可观测性、失败恢复。
- 产出：
  - 2~3 套协同架构候选（含 tradeoff）
  - 推荐方案的状态图 + 事件协议
  - 关键不变量（不丢消息、不重复执行、不中断人类优先）
  - 渐进迁移路径（兼容当前 `InvocationTracker` 语义）

---

## 5) GPT Pro 提示词草案（v0.1）

> 说明：以下是我建议给 GPT Pro 的“研究型提示词”，偏架构审计与方案设计，不让它直接大改实现。

### Prompt A（ADR-008）

你是资深分布式系统与后端可靠性架构师。请基于 Cat Café 现有实现，完成 ADR-008 后续阶段的“状态机一致性研究设计”。

上下文事实（必须先吸收）：
1) `packages/api/src/routes/messages.ts` 已实现 S1：原子创建 InvocationRecord、写用户消息、回填 userMessageId、后台执行。
2) `packages/api/src/routes/invocations.ts` 的 retry 目前仅 reset status=queued，未触发实际重执行。
3) 删除/编辑分支能力只在 `docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md` 设计中存在，代码未落地。
4) 前端 `packages/web/src/hooks/useSendMessage.ts` 目前未主动发送 idempotencyKey，也未消费 invocationId 进行生命周期管理。

请输出：
- A. 完整状态机定义（状态、事件、转移、守卫、非法转移）
- B. 失败注入矩阵（至少 20 个场景），覆盖“消息写入前后、回填前后、执行中、取消、删除并发、网络重试”
- C. 兼容现有代码的最小实施顺序（S2/S3 分批），每批列出改动文件、回归风险、验收测试
- D. 明确哪些设计必须先做，哪些可以延期

硬要求：
- 以“先不变量，再实现”为顺序。
- 必须包含 cursor 单调性不被破坏的证明思路。
- 不要给泛泛建议；必须给到和上述文件结构对齐的具体改造接口。

### Prompt B（Hindsight 治理）

你是记忆系统与检索治理架构师。请基于 Cat Café 当前 Hindsight 集成，设计“治理闭环”方案，重点解决 memory types 映射与 MCP bank 边界。

上下文事实（必须先吸收）：
1) Hindsight client 在 `packages/api/src/domains/cats/services/HindsightClient.ts`。
2) evidence 路由在 `packages/api/src/routes/evidence.ts`，当前 recall 读取逻辑基于 memories 字段。
3) publish 状态机在 `packages/api/src/routes/memory-publish.ts` + `MemoryGovernanceStore.ts`，目前未和 retain 真正联动。
4) ADR 待办在 `docs/decisions/005-hindsight-integration-decisions.md`：memory types 映射 + MCP 过滤只返回 cat-cafe-*。

请输出：
- A. 记忆映射规范：来源（decision/phase/discussion/review/bug-report）→ memory type（world/observation/experience/opinion）→ tags/metadata
- B. 协议对齐策略：如何同时兼容 recall 返回 `results` 与 `memories` 的版本差异
- C. publish/approve/archive 与 retain/reflect 的联动状态机
- D. MCP bank 暴露面过滤策略（含安全边界与错误处理）
- E. 测试与验收矩阵（协议、降级、回滚、污染防护）

硬要求：
- 明确给出“可以先做/必须后做”的分层。
- 所有 metadata 字段给出建议 schema（可直接用于 Zod）。

### Prompt C（A2A 真协同）

你是多智能体协作系统架构师。请在 Cat Café 现有 A2A 机制基础上，设计“真协同”方案（人类优先、可观察、可恢复）。

上下文事实（必须先吸收）：
1) Serial A2A worklist 在 `packages/api/src/domains/cats/services/route-strategies.ts`。
2) mention 解析规则在 `packages/api/src/domains/cats/services/a2a-mentions.ts`（行首、单目标、max depth）。
3) `InvocationTracker.start()` 语义是新调用会 abort 旧调用（同 thread）。
4) parallel 模式不自动链式，只在末尾发 `a2a_followup_available` 提示（前端当前是提示文案）。

请输出：
- A. 2~3 套可选协同架构（例如：thread 队列、cat 队列、job DAG），并给 tradeoff
- B. 推荐方案的事件协议与状态图（包含抢占、人类优先、超时、循环保护）
- C. 与当前 InvocationTracker 兼容的渐进迁移方案（不一次性推翻）
- D. 可观测性方案（我们至少应看到哪些指标与告警）
- E. 最小 MVP 边界与禁止项（避免过度设计）

硬要求：
- 必须指出在当前实现下“最危险的 5 个并发坑”与规避策略。
- 不允许抽象空话，必须映射到现有文件职责。

---

## 6) 我建议我们下一轮这样讨论

1. 先确定这 3 个课题是否就是你要的优先级（是否替换其中一个）。
2. 再逐条收紧提示词（你希望 GPT Pro 更偏“研究”还是“可直接施工”）。
3. 最后我再出一版 v1.0（简化版可直接粘贴发送）。

