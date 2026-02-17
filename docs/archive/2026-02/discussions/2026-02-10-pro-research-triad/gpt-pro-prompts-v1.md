# GPT Pro 研究提示词 v1.0（A' / B / C）

> 日期：2026-02-10  
> 维护：缅因猫（Codex）  
> 用途：给 GPT Pro 的三项研究任务（研究与设计，不直接改代码）

---

## 0) 全局约束（发送每条 prompt 时都要保留）

1. 系统边界是**单用户协作**（1 位铲屎官 + 多猫），不是多租户产品。  
2. 研究必须基于**现有代码职责**，不能脱离仓库结构谈抽象架构。  
3. 输出必须包含：`What / Why / Tradeoff / Open Questions / Next Action`。  
4. 所有方案都要给“可延期项”，明确哪些是多用户场景才需要的复杂度。  
5. 不要求 GPT Pro 直接写实现代码；重点是设计、矩阵、验收标准、迁移顺序。  

---

## Prompt A'：Hindsight 导入与检索评测框架

```text
你是“记忆系统评测与检索工程”专家。请为 Cat Café 设计一个可落地的 Hindsight 导入与检索评测框架（Research/Design only，不直接改代码）。

【背景事实（必须先吸收）】
1) 当前 Hindsight 接入已有 recall/retain/reflect 客户端：
   - packages/api/src/domains/cats/services/HindsightClient.ts
2) evidence 查询已接入，但当前 bank 近乎空，缺少系统导入管道：
   - packages/api/src/routes/evidence.ts
3) 目前我们缺“导入质量 -> 检索质量 -> 决策反馈”的度量闭环。
4) 当前系统是单用户协作，不做多用户并发优化。

【你的任务】
请输出一个“可执行评测体系”，覆盖：
A. 导入策略设计：哪些文档源应导入、如何切片、如何打 metadata（最少含 source/type/threadId/timestamp/importance）
B. Ground-truth 构建方法：如何从 docs/ADR/bug-report/discussion 构建评测样本与标准答案
C. 检索评测指标：至少包含 coverage、precision@k、recall proxy、latency、noise ratio、staleness
D. 失败与退化检测：当 recall 协议字段漂移（results vs memories）或 bank 为空时，如何告警与降级
E. 周期性评测运行机制：建议的执行节奏、报告结构、通过门槛、回归阈值
F. 最小落地计划：按 3 个阶段给出（P0/P1/P2），每阶段说明依赖、风险、验收

【硬要求】
1) 所有建议必须映射到仓库文件职责，不接受“另起一套平台”式方案。
2) 必须显式区分“现在就做”和“可延期”。
3) 给出一份最小样例：至少 10 条评测 query + 期望命中类型。
4) 输出最后必须包含：
   - What
   - Why
   - Tradeoff
   - Open Questions
   - Next Action
```

---

## Prompt B：Hindsight 治理闭环（types 映射 + bank 边界 + publish/retain 联动）

```text
你是“检索记忆治理与一致性”架构师。请基于 Cat Café 当前实现，设计 Hindsight 治理闭环方案（Research/Design only，不直接改代码）。

【背景事实（必须先吸收）】
1) 待闭环议题来自 ADR：
   - docs/decisions/005-hindsight-integration-decisions.md
   当前仍未完成：memory types 映射策略、MCP bank 过滤（仅 cat-cafe-*）。
2) 现有 publish 状态机在本地路由与 store：
   - packages/api/src/routes/memory-publish.ts
   - packages/api/src/domains/cats/services/MemoryGovernanceStore.ts
3) 关键前置约束：MemoryGovernanceStore 当前是内存实现；我们需要先持久化（Redis）再谈跨系统联动一致性。
4) recall 协议存在潜在漂移风险（results vs memories），需要治理层防漂移设计。
5) 当前系统边界是单用户，不做多用户治理策略。

【你的任务】
请输出一套“先能落地、再追求完美”的治理方案，包含：
A. memory types 映射规范：来源（ADR/phase/discussion/bug-report/review）到 world/observation/experience/opinion 的规则
B. metadata schema 建议（可直接用于 Zod），并给版本化策略
C. MCP bank 暴露与过滤策略（只允许 cat-cafe-*），含错误处理与审计记录
D. publish/approve/archive 与 retain/reflect 联动状态机（可选同步强一致 vs 异步最终一致+补偿，必须给推荐）
E. 协议防漂移机制：当上游返回字段或语义变化时，如何检测、兼容、告警
F. 验收矩阵：功能正确性、安全边界、回滚路径、脏数据污染防护

【硬要求】
1) 先给“分层顺序图”：哪些必须前置（尤其持久化），哪些后置。
2) 推荐方案必须解释 Why，并说明放弃了哪些备选（Tradeoff）。
3) 明确列出不做项（特别是多用户才需要的治理复杂度）。
4) 输出最后必须包含：
   - What
   - Why
   - Tradeoff
   - Open Questions
   - Next Action
```

---

## Prompt C：A2A 真协同（可观测协议 + 调度模型 + 迁移路径）

```text
你是“多智能体协作与调度系统”架构师。请在 Cat Café 当前 A2A 机制基础上，设计一个“单用户前提下可控协同”的演进方案（Research/Design only，不直接改代码）。

【背景事实（必须先吸收）】
1) Serial A2A 采用 worklist 串行交接：
   - packages/api/src/domains/cats/services/route-strategies.ts
2) mention 解析规则较严格（行首、单目标、最大深度）：
   - packages/api/src/domains/cats/services/a2a-mentions.ts
3) InvocationTracker 是 thread 级单活跃语义（新调用会 abort 旧调用）：
   - packages/api/src/domains/cats/services/InvocationTracker.ts
4) parallel 模式当前不自动链式，只提供 follow-up 提示（非真正调度层）。
5) 系统目前明确不做多用户。

【你的任务】
请输出“可观测、可解释、可恢复”的 A2A 协同方案：
A. 2~3 套候选模型（例如 thread queue / cat queue / 轻量 job layer），并做对比评分
B. 推荐模型的状态机与事件协议（至少覆盖 queued/started/aborted/handoff/depth_limit/result）
C. 人类优先策略：抢占、取消、重试、超时的优先级规则
D. 循环与风暴防护：最大深度、重复 handoff、无效 mention 的抑制机制
E. 渐进迁移计划（不推翻现有 InvocationTracker），按阶段列改动点与回归风险
F. 可观测性与运营指标：最小事件集、关键告警、排障路径

【硬要求】
1) 必须点出当前实现中最危险的 5 个并发/协同坑，并给规避策略。
2) 必须明确“单用户 MVP 边界”与“明确延期项（多用户/跨线程复杂度）”。
3) 不允许抽象空话，所有建议需映射到现有文件职责。
4) 输出最后必须包含：
   - What
   - Why
   - Tradeoff
   - Open Questions
   - Next Action
```

---

## 使用建议（给我们内部）

1. 先发 Prompt B（治理闭环）和 Prompt A'（评测框架），因为两者互相校验。  
2. 再发 Prompt C（A2A 真协同），避免与 ADR-008 工程施工互相抢焦点。  
3. GPT Pro 输出后，我们按“可执行性 > 完整性 > 理论优雅”做二次收敛。  

