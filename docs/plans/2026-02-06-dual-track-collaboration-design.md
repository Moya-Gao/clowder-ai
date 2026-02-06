# Cat Café 双轨协作设计（Task + Roundtable）

> 状态：讨论稿（待布偶猫/铲屎官评审）  
> 日期：2026-02-06  
> 作者：缅因猫（Codex）  
> 上下文来源：`docs/VISION.md`、`docs/decisions/002-collaboration-protocol.md`、`docs/research/2026-02-06-agent-teams-compare.md`

---

## 0. 一句话结论

Cat Café 不应在“机械任务流”和“自由圆桌流”二选一，而应采用 **双轨协作架构**：

1. `Task Flow`：用于稳定交付与并行开发  
2. `Roundtable Flow`：用于价值澄清、创意发散、分歧收敛  
3. `Bridge`：让两条轨道可双向转换（讨论产出任务、任务卡点升级圆桌）

这同时满足你们愿景里的“真实猫猫协作”与工程上的“可追踪交付”。

---

## 1. 背景与问题

从愿景文档 `docs/VISION.md` 看，Cat Café 的核心不是“工单系统”，而是三猫形成一个真实团队：

1. 有共享感知  
2. 有自主协作  
3. 有猫猫个性和讨论氛围  
4. 还要能完成真实工程工作

当前系统在“任务执行链路”上已经有很好的基础（@ 提及、多猫串行、MCP 回传），但在“自由协作 / 圆桌讨论”上还缺少显式机制。  
如果只做 task 化，容易损失愿景中的“价值澄清”和“破框反直觉”；如果只做自由聊天，又会缺失可执行与可追踪。

---

## 2. 设计目标与非目标

### 2.1 目标

1. 支持三种会话模式：`task`、`roundtable`、`hybrid`  
2. 支持从讨论到执行、从执行回到讨论的低摩擦切换  
3. 保持 Why-First 协作协议（`What/Why/Tradeoff/Open Questions/Next Action`）  
4. 保持当前 Phase 2.5 的稳定链路，不做一次性推倒重来

### 2.2 非目标（本轮不做）

1. 不引入复杂多租户权限系统  
2. 不一次性做完整 PM 工具（甘特图、燃尽图等）  
3. 不强行把所有讨论结构化成任务

---

## 3. 双轨协作模型

## 3.1 模式定义

1. `task` 模式：目标明确，强调交付、验收、可追踪  
2. `roundtable` 模式：目标探索，强调观点碰撞、分歧澄清、风险预判  
3. `hybrid` 模式：讨论和任务并行，允许随时互转

## 3.2 圆桌规则（轻结构，不机械）

圆桌不强制任务化，但要求每轮输出最小结构：

1. `Topic`：本轮议题  
2. `Positions`：三猫观点摘要  
3. `Convergence`：当前共识  
4. `Divergence`：未达成一致点  
5. `Proposed Next`：下一步建议（可为 task，也可继续讨论）

## 3.3 任务规则（强结构）

任务必须具备：

1. owner（哪只猫负责）  
2. status（todo/doing/blocked/done）  
3. dependency（可选）  
4. DoD（完成定义）  
5. Why（为什么做）

---

## 4. 架构演进方案（在现有实现上增量）

## 4.1 数据层新增（最小）

新增 `CollabMode` 与两个实体：

1. `RoundtableRecord`
   - `id`, `threadId`, `topic`, `summary`, `positions[]`, `openQuestions[]`, `timestamp`
2. `TaskItem`
   - `id`, `threadId`, `title`, `ownerCatId`, `status`, `why`, `dependsOn[]`, `acceptance`

建议先内存实现，后续复用你们已有 Redis 能力持久化。

## 4.2 API 层新增

1. `PATCH /api/threads/:id/mode`：切换 `task|roundtable|hybrid`  
2. `POST /api/roundtable/summarize`：将本轮对话沉淀为圆桌纪要  
3. `POST /api/tasks` / `PATCH /api/tasks/:id` / `GET /api/tasks`：基础任务面  
4. `POST /api/bridge/roundtable-to-tasks`：把纪要转任务草案  
5. `POST /api/bridge/task-to-roundtable`：任务升级为讨论议题

## 4.3 AgentRouter 行为扩展（不破坏现有链路）

在 `AgentRouter.route()` 前增加模式分派：

1. `task`：沿用当前串行/并行策略  
2. `roundtable`：采用回合制发言（布偶→缅因→暹罗，或按议题动态）  
3. `hybrid`：讨论中允许创建/更新任务，并把任务进度回流到讨论

---

## 5. MCP 工具建议（给三猫）

在已有 callback 工具之外新增：

1. `cat_cafe_create_task`
2. `cat_cafe_update_task`
3. `cat_cafe_list_tasks`
4. `cat_cafe_start_roundtable`
5. `cat_cafe_append_roundtable_note`
6. `cat_cafe_finalize_roundtable`
7. `cat_cafe_bridge_roundtable_to_tasks`

这样“自由讨论”也能落到系统能力，而不是全靠 prompt 约定。

---

## 6. UI/交互建议（猫咖感 + 可操作）

1. 线程顶部加模式切换：`任务模式` / `圆桌模式` / `混合模式`  
2. 右侧双面板：
   - 上半：任务看板（仅 task/hybrid 显示）
   - 下半：圆桌纪要（仅 roundtable/hybrid 显示）
3. 一键互转按钮：
   - `把本轮讨论转成任务`
   - `把这个任务拉上圆桌`

---

## 7. 风险与治理

1. 风险：圆桌失控，讨论无限发散  
   - 缓解：每 N 轮强制产出一次纪要（不强制产任务）
2. 风险：并行成本失控  
   - 缓解：按线程设置并发上限和预算阈值，超阈值自动降级串行
3. 风险：模式切换造成上下文混乱  
   - 缓解：每次切换自动生成“模式切换卡片”（包含 Why 和当前状态）

---

## 8. 分阶段落地建议

## Phase 3A（MVP，优先）

1. 会话模式枚举 + mode 切换 API  
2. Roundtable 纪要最小实体  
3. Task 最小实体（内存）  
4. 两个桥接 API（讨论→任务、任务→讨论）

## Phase 3B

1. Redis 持久化（mode/task/roundtable）  
2. WebSocket 按 user/thread 分房间推送  
3. 基础预算控制和并发阈值

## Phase 3C

1. roundtable 回合策略可配置（主持人/自由辩论）  
2. 任务冲突治理（worktree/branch 协同）

---

## 9. 给布偶猫的“Why-First 交接包”

### What

提出 Cat Café 双轨协作设计：在现有任务链路上新增圆桌链路，并通过桥接接口实现双向转换。

### Why

愿景要求“真实协作与共享感知”，不应退化为单纯工单执行；同时工程落地需要可追踪、可验收。双轨能兼顾两者。

### Tradeoff

1. 好处：兼顾自由讨论与工程交付  
2. 代价：模型、路由和 UI 会增加一层复杂度  
3. 选择：采用增量改造（先 MVP），避免一次性重构风险

### Open Questions

1. roundtable 默认主持猫是谁（固定布偶 vs 动态选举）？  
2. 任务与圆桌是否需要强一致持久化（立刻 Redis）还是可先内存试运行？  
3. 预算阈值放在线程级还是全局级？

### Next Action

1. 布偶猫评审本设计并给出架构意见  
2. 确定 Phase 3A 的最小范围  
3. 缅因猫再输出可执行 implementation plan（含测试点）

---

## 10. 思考过程（可审计摘要版）

> 备注：为方便协作与判断，以下是“可审计决策摘要”，不是模型内部推理展开。

1. 先核对愿景：`docs/VISION.md` 明确目标是“真协作”，不是单纯任务流水线。  
2. 再核对现状：当前系统已经强于“执行链”，弱于“讨论链”。  
3. 再核对外部：Agent Teams 证明任务编排有效，但也带来成本和可靠性质疑。  
4. 结论：不能单押 task 化，也不能只保留自由聊天，需双轨 + 互转。  
5. 落地策略：尽量复用现有 `AgentRouter + callbacks + MCP`，以增量方式迭代。

---

## 附：与现有文件的关系

1. 愿景对齐：`docs/VISION.md`  
2. 协作协议对齐：`docs/decisions/002-collaboration-protocol.md`  
3. 研究依据：`docs/research/2026-02-06-agent-teams-compare.md`  
4. 预计主要改动区：
   - `packages/api/src/domains/cats/services/AgentRouter.ts`
   - `packages/api/src/routes/messages.ts`
   - `packages/mcp-server/src/tools/callback-tools.ts`

