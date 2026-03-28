---
feature_ids: []
debt_ids: []
---

# Feedback to DARE Coding Harness Proposal

> From: Cat Café Team (布偶猫宪宪)
> Date: 2026-03-02
> Context: 三路 Deep Research + GPT-5.2 Pro 审阅 + Cat Café 多猫协作实践

---

## TL;DR

**你们的核心判断完全正确**：2026 年 Harness > Model，"默认有状态、可审计、可审批、可恢复、可回放"是企业级 Agent 的 table stakes。

我们基于业界调研和实践，提供以下补充建议，希望能帮助你们把 Proposal 从"正确的方向"推进到"可落地的规范"。

---

## 1. 建议补充的能力维度

### 1.1 副作用契约（Side-Effect Contracts）

**问题**：Proposal 强调 event log 和 replay，但对"外部系统副作用"的处理不够显式。

Event Sourcing 能让内部状态可回放，但：
- 发出去的邮件不能撤回
- 第三方 API 写入可能不可逆
- 资金划拨需要补偿事务

**建议**：在 Harness 层显式定义副作用契约：

```python
@side_effect(
    idempotent=True,           # 幂等保证
    reversible="compensate",   # 可逆策略：compensate / draft-first / none
    approval_required=True,    # 是否需要人审
    audit_level="evidence"     # 审计级别：log / audit / evidence
)
def send_payment(account_id: str, amount: Decimal) -> PaymentResult:
    ...
```

**参考**：GPT 报告提到的 OpenPort Protocol (arXiv 2026-02-22) 把 draft-first、幂等、reason codes 写成了协议语义。

### 1.2 Multi-Agent 协作原语

**问题**：Proposal 聚焦单 Agent 的 Harness，但 A2A 协议已进入 Linux Foundation。

**建议**：在 Harness 层预留多 Agent 协作的扩展点：

```python
class HarnessConfig:
    # 单 Agent 能力
    event_log: EventLogConfig
    checkpoint: CheckpointConfig

    # 多 Agent 扩展（可选）
    identity: AgentIdentityConfig      # 身份声明
    collaboration: CollaborationConfig  # 协作协议
    handoff: HandoffConfig              # 任务交接
```

**实践参考**：Cat Café 的多猫协作已经跑了几个月，核心发现是"身份契约"比"能力发现"更重要——先确定"谁是谁、谁能做什么、谁批准谁"，再谈互操作。

### 1.3 Context Provenance（上下文溯源）

**问题**：Proposal 的 Context Lifecycle 强调压缩和 LTM 融合，但缺少"来源标注"。

**风险**：当 context 来自多个来源（STM、LTM、Knowledge、外部检索），agent 可能混淆权威度，导致用公开网页内容覆盖内部机密文档的判断。

**建议**：在 `AssembledContext.metadata` 中加入 provenance：

```python
@dataclass
class ContextChunk:
    content: str
    provenance: Provenance

@dataclass
class Provenance:
    source_type: Literal["stm", "ltm", "knowledge", "retrieval", "user_input"]
    source_id: str
    timestamp: datetime
    trust_level: Literal["internal", "external", "unverified"]
    retrieval_query: Optional[str]  # 如果是检索来的
```

**参考**：FDA 2026-01 发布的 AI 药物开发指导原则明确要求"数据溯源（Provenance）"，这可能成为 regulated 行业的合规要求。

---

## 2. 实施建议

### 2.1 `step_driven` 的边界条件

**Proposal 当前描述**：
> "若 validated plan 含可执行 steps，优先 `step_driven`"

**潜在问题**：
- 什么算"可执行 step"？
- step 失败后的回退策略？
- step 执行过程中环境变化（TOCTOU）怎么处理？

**建议**：显式定义 step 的契约：

```python
@dataclass
class ValidatedStep:
    action: str
    preconditions: List[Condition]   # 执行前必须满足
    postconditions: List[Condition]  # 执行后必须满足
    rollback: Optional[RollbackStrategy]  # 失败时的回退
    idempotency_key: str             # 幂等键
```

### 2.2 Event Log 的 payload 稳定性

**Proposal 当前描述**：
> "payload 的序列化口径必须固定，以保证 query/replay/hash-chain 可重现"

**建议补充**：
- 定义 payload schema 版本策略（如何升级 schema？）
- 定义敏感数据 redaction 规则（哪些字段不能进不可变日志？）
- 定义 retention 策略（多久后可以归档/删除？）

**实践参考**：OpenTelemetry GenAI semantic conventions 正在标准化 agent 事件语义，建议对齐。

### 2.3 `auto` mode 的决策透明度

**Proposal 当前描述**：
> "若 step path 不可用，则显式记录回退原因并退回 `model_driven`"

**建议强化**：把 mode 决策本身也作为 event 记录：

```python
@dataclass
class ExecutionModeDecision(Event):
    chosen_mode: Literal["model_driven", "step_driven"]
    reason: str
    fallback_from: Optional[str]  # 如果是回退，从哪里回退
    validated_plan_ref: Optional[str]
```

这样审计时可以回答："为什么这次用了 model_driven 而不是 step_driven？"

---

## 3. 风险提醒

### 3.1 "确定性"的定义混用

我们的审阅发现业界对 "deterministic" 有三种不同理解：
1. **编排确定**：workflow 可回放，但 LLM 调用仍非确定
2. **治理确定**：稳定的失败语义、前后置条件、审批链
3. **物理确定**：轨迹缓存，把成功路径固化成脚本

建议在 Proposal 中明确你们指的是哪一种，避免用户误解。

### 3.2 SQLite 的局限性

**Proposal 当前**：
> "默认后端建议：sqlite + hash-chain"

**潜在问题**：
- SQLite 单机写入瓶颈
- 跨实例共享需要额外设计
- 在 regulated 场景可能不被接受为 WORM

**建议**：
- 明确 SQLite 是"开发/单机默认"
- 定义抽象接口，允许替换为 PostgreSQL / S3 / 专用 WORM
- 在 Proposal 中说明"生产级后端"的演进路径

### 3.3 "Undo AI" 的复杂度

Gemini 报告提到 Veeam/Securiti 的 Agent Commander 把"精确撤销"做成产品。

**风险**：如果 Harness 承诺"可撤销"但实际只能撤销内部状态，用户会有预期落差。

**建议**：在 Proposal 中明确"可撤销"的边界：
- 哪些操作可完全撤销？
- 哪些操作只能"尽力而为"？
- 哪些操作不可撤销？

---

## 4. 来自 Cat Café 的实践经验

### 4.1 人审是设计原语，不是可选功能

我们的 F049 Mission Hub 把人审做成了任务调度的核心：
```
建议领取 → 铲屎官批准 → 自动创建执行 thread
```

**经验**：不要把 human-in-the-loop 当成"高级功能"，而是从第一天就把它设计成系统的一部分。企业用户对"AI 自动做了什么"非常敏感。

### 4.2 跨 Agent Review 比自检更重要

我们的 Review 流程强制要求"跨家族 peer review"——布偶猫写的代码必须让缅因猫 review，不能自己 review 自己。

**经验**：如果你们的 Harness 支持多 Agent，建议把"不同 Agent 不能互相批准自己"写成默认策略。

### 4.3 Skill/SOP 是流程约束的载体

你们提到 AWS Strands Agent SOPs，我们的 Skills 系统类似但更进一步：
- 不只是"步骤指南"，而是"流程约束 + 决策树 + 验证清单"
- 每个 Skill 都有显式的"触发条件"和"输出契约"

**建议**：考虑在 Harness 层定义 Skill/SOP 的元模型，让流程约束可配置、可版本化、可审计。

---

## 5. 总结

| 维度 | Proposal 现状 | 建议 |
|------|-------------|------|
| 核心判断 | ✅ 正确 | 保持 |
| 副作用契约 | 未显式 | 补充 |
| Multi-Agent | 未覆盖 | 预留扩展点 |
| Context Provenance | 部分 | 强化 |
| 确定性定义 | 可能混用 | 明确 |
| 人审原语 | 有提及 | 升级为核心 |

**一句话**：Proposal 的方向完全正确，建议在"副作用契约"和"Multi-Agent 预留"上加强，同时明确"确定性"的具体含义。

---

祝 DARE 团队顺利！期待看到 Coding Harness 落地。🐱

— Cat Café Team
