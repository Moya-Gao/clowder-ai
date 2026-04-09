---
feature_ids: [F143, F148, F149]
related_features: [F045, F050, F102]
related_decisions: [ADR-023]
topics: [event-api, lazy-loading, credential-isolation, model-tier, harness-profiles]
doc_kind: decision
created: 2026-04-08
decision_id: ADR-026
---

# ADR-026: Agent Runtime Operational Boundaries — Event API, Lazy Loading, Model Tier Profiles

> **Status**: draft (pending cloud cat review)
> **Deciders**: 铲屎官 + 布偶猫(opus) + 缅因猫(gpt52) + 暹罗猫(gemini)
> **Date**: 2026-04-08
> **Trigger**: Anthropic "Scaling Managed Agents" study session
> **Discussion**: `docs/discussions/2026-04-08-managed-agents-study/README.md`
> **Pending Review**: Gemini Deep Think + GPT Pro (cloud consultation)
> **Extends**: ADR-023 (Hostable Agent Runtime)

## Context

### 引发讨论的外部输入

Anthropic Engineering Blog 发布了 "Scaling Managed Agents: Decoupling the brain from the hands"。文章将 Managed Agents 拆成 Brain (Claude + harness) / Hands (sandbox + tools) / Session (event log) 三层可独立替换的接口。核心设计哲学：像操作系统虚拟化硬件一样虚拟化 agent 组件。

三猫 + 铲屎官 study session 后发现：Cat Cafe 的 ADR-023 四维可组合模型 (Transport x Binding x RuntimeContract x EventAdapter) 与 Anthropic 的 Brain/Hands/Session 解耦在抽象哲学上同源。但 study session 暴露了四个 ADR-023 未覆盖的 operational boundary 问题。

### 铲屎官的四个关键质疑

1. **Session API**: "你们都是 LLM，让你们提取 JSON 效果极差"——session 结构化的边界在哪？
2. **Hands 懒加载**: CLI 无头 agent 无法做细粒度解耦，现实中怎么做？
3. **Credential isolation vs 便捷**: 安全不能靠弹窗，否则铲屎官被逼开危险模式，反而更不安全
4. **Harness + 弱模型**: Anthropic 只有 Claude 所以 harness 可以粗旷，我们要带国产小猫怎么办？

### 与 ADR-023 的关系

ADR-023 定义了 **agent 的组合结构**（四维 + Supervisor + Discovery + ProvisioningPipeline + ProcessModel）。本 ADR 补充 **agent 的运行边界**——跨越结构层面，回答"运行时该怎么管理事件、资源、安全和能力差异"。

## Decision

### Decision 1: Operational Event API — Structured Envelope + Natural Language Payload

#### 问题

Cat Cafe 当前的跨猫状态传递依赖非结构化消息。F045 NDJSON 事件流有结构化信封，但只在 CLI output parsing 层；F148 在做上下文外置和分层注入。两者之间缺少一个显式的 **runtime 事件写入契约**。

#### 决策

引入 Operational Event API，遵循 **"信封结构化、载荷自然语言"** 原则：

```typescript
interface OperationalEvent {
  /** 单调递增事件 ID */
  eventId: string;
  /** ISO8601 timestamp */
  ts: string;
  /** 事件类型 (runtime 自动产出，不依赖模型提取) */
  type: OperationalEventType;
  /** 产出者: agent ID or 'host' */
  actor: string;
  /** 因果链接: 触发此事件的上游 eventId */
  causedBy?: string;
  /** 结构化元数据 (给代码读) */
  meta: Record<string, unknown>;
  /** 自然语言载荷 (给 LLM 读, 可选) */
  content?: string;
}

type OperationalEventType =
  | 'run_started'
  | 'run_completed'
  | 'run_failed'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'permission_requested'
  | 'permission_resolved'
  | 'handoff_issued'
  | 'handoff_accepted'
  | 'context_compacted'
  | 'artifact_emitted'
  | 'lease_acquired'
  | 'lease_released';
```

#### 关键原则

- **信封由 runtime 自动产出**，不让 LLM 提取结构化数据（铲屎官实证：LLM 提取 JSON 效果极差）
- **内容保持自然语言**，喂给 LLM 时由 harness transform 层渲染成 MD
- **事件日志是控制面真相源**，用于恢复、审计、切片、回放
- **与 F148 上下文传输互补**：F148 管"怎么喂给 LLM"，Event API 管"怎么持久化发生了什么"

#### 不做什么

- 不替换现有 session chain / evidence.sqlite（那些是语义层，Event API 是控制面层）
- 不要求现有 CLI adapter 改造 event 产出格式（从 F045 NDJSON 适配）
- 不做全文 JSON 化——MD 继续作为语义摘要、handoff、知识沉淀的格式

### Decision 2: Carrier-Aware Lazy Loading Tiers

#### 问题

Anthropic 通过把容器从"预分配"改为"按需 provision"实现 p95 TTFT 降 90%。Cat Cafe 的 agent 多数是 CLI 无头模式（headless ProcessModel），brain + hands 耦合在同一进程内，无法做容器级的细粒度解耦。

#### 决策

按 carrier 类型分三层懒加载，不要求所有 carrier 一步到位：

| Tier | What | How | Applicable Carrier | Dependency |
|------|------|-----|-------------------|------------|
| **T1: Lazy Brain Attach** | 进程/会话按需分配 | 进程池 + session lease，idle 回收 | All carriers | F149 Phase C (in progress) |
| **T2: Lazy Tool Bridge** | MCP 工具连接按需建立 | 向 agent 暴露完整工具声明列表，但真实 MCP server 连接在首次 tool call 时才初始化 (Holographic Stubs) | CLI carriers (headless) | New: MCP Proxy lazy init |
| **T3: Lazy Sandbox** | 执行环境按需 provision | `execute(name, input) -> string` 触发容器/进程创建 | ACP/A2A (interactive/task) | F149 Phase D+ |

#### T2 Holographic Stubs 设计 (暹罗猫提案，架构评审通过)

```
Agent 启动时:
  ProvisioningPipeline 注入 MCP config = { servers: [全量声明] }
  实际: 每个 server 背后是 LazyMcpProxy
    - 首次 tool call 前: proxy 持有 server 声明 (name, tools schema)，不建立连接
    - 首次 tool call 时: proxy 初始化真实连接，转发调用
    - idle timeout: proxy 释放连接，回到"声明 only"状态
```

**收益**:
- CLI agent 冷启动不再等所有 MCP server 就绪
- 重 MCP (Pencil, CDP Bridge) 按需拉起，不用时不占资源
- Agent 感知不到差异（tool list 始终完整）

#### 不做什么

- 不改 CLI agent 内部架构（我们寄生在外部 harness 上，控制有限）
- 不要求 headless carrier 支持 T3（那是 ProcessModel 的限制，不是我们的 bug）
- T2 和 T3 不阻塞 T1（三层独立推进）

### Decision 3: Credential Isolation — Structural Unreachability over Permission Dialogs

#### 问题

Anthropic 明确指出："Narrow scoping is an obvious mitigation, but this encodes an assumption about what Claude can't do with a limited token — and Claude is getting increasingly smart." 铲屎官指出：如果安全靠弹窗，铲屎官被逼开超级危险模式，反而更不安全。

Cat Cafe 当前的安全模型混合了三种机制：纪律约束（"不准碰 6399"）、permission 弹窗、物理隔离（worktree）。其中纪律约束最脆弱。

#### 决策

将 credential isolation 从"纪律 + 弹窗"升级为"结构不可达 + 规则引擎"双轨制：

**Track 1: Structural Unreachability (零弹窗)**

| 资源 | 当前状态 | 目标状态 |
|------|---------|---------|
| Redis 6399 (production) | 纪律约束 "不准碰" | worktree env 不含 6399 连接串 (物理不可达) |
| Git tokens | 部分 agent 可见 | clone 时注入 remote URL，sandbox 内无原始 token |
| MCP OAuth | Hub 中转 (已做) | 保持: agent 永远看不到 OAuth secret |
| API keys | env 注入 (agent 可见) | ProvisioningPipeline allowlist: 只注入该 agent 需要的 key |

**Track 2: Rule Engine Degradation (少弹窗)**

```
Destructive Action -> Rule Engine
  命中白名单 (e.g., git push to feature branch) -> 自动放行
  命中黑名单 (e.g., rm -rf /, DROP TABLE) -> 自动拒绝 + 通知
  未知 + 高风险信号 -> 升级问人 (唯一弹窗场景)
```

#### 关键原则

- **安全预算花在"让危险操作结构上不可能"，不是花在"让铲屎官一直点确认"**
- 物理隔离 > 规则引擎 > 纪律约束（优先级递减）
- 不依赖"模型暂时做不到什么"——模型会变强，结构隔离不会失效
- 与猫猫授权系统方案 (feat-cat-authorization) 对齐

#### 不做什么

- 不取消 worktree 隔离机制（它已经是 Track 1 的实现）
- 不把所有操作都变成弹窗（那是在逼铲屎官开危险模式）
- 不做 sandbox 容器化（当前 CLI headless 模式下 ROI 不高，等 ACP 栈成熟再考虑）

### Decision 4: Model Tier Harness Profiles — Dynamic Scaffolding for Heterogeneous Brains

#### 问题

Anthropic 只考虑了"模型变强 -> 减 harness"。Cat Cafe 面对 Opus -> GLM/Kimi/MiniMax/DeepSeek/Qwen 的完整能力谱系，需要同时回答"强模型减壳"和"弱模型加壳"。

ADR-023 的 AgentDescriptorV1 有 6 轴静态声明，但都是 **runtime 能力** (invocationShape, controlChannel, resume, permissions, toolBridge, modelOverride)。缺少 **认知能力** 维度——"这只猫能做多复杂的事"。

#### 决策

在 AgentDescriptorV1 基础上扩展 Model Tier Profile：

```typescript
/** 扩展 AgentDescriptorV1，新增认知能力轴 */
interface AgentDescriptorV2 extends AgentDescriptorV1 {
  /** 认知能力层级 */
  cognitiveTier: CognitiveTier;
  /** 细粒度认知能力声明 */
  cognitiveCapabilities: CognitiveCapability[];
}

type CognitiveTier = 'frontier' | 'mid' | 'basic';

type CognitiveCapability =
  | 'structured_output'      // 可靠地产出结构化格式
  | 'multi_step_reasoning'   // 多步推理不走偏
  | 'tool_chaining'          // 自主串联多个工具调用
  | 'sop_following'          // 遵循复杂 SOP 流程
  | 'self_correction'        // 发现错误后自我修正
  | 'cross_context_recall'   // 跨 session 知识调用
  | 'creative_divergence';   // 创意发散能力
```

**Dynamic Scaffolding 策略 (由 ProvisioningPipeline 根据 cognitiveTier 选择)**:

| Tier | Task Granularity | Tool Subset | Guardrails | Autonomy |
|------|-----------------|-------------|------------|----------|
| **frontier** | 给目标，自主规划 (画布模式) | 全量工具 | 最少: 事后审计 | max_autonomous_steps: 20+ |
| **mid** | 给 SOP，跟步骤走 | 精选工具集 | 中等: 关键步骤校验 | max_autonomous_steps: 5-10 |
| **basic** | 给微任务，单步执行 (涂色书模式) | 最小工具集 (1-2 per step) | 最厚: 每步强校验 + verifier | max_autonomous_steps: 1-3 |

**Tier 判定机制**:

- **静态声明**: agent 注册时在 config 中声明 cognitiveTier（手动或 probe 自动检测）
- **动态降级**: runtime 检测到连续失败/幻觉/SOP 偏离 -> 临时降一级 tier
- **不做动态升级**: 升级必须人工确认（避免弱模型"碰巧成功一次"就被授予更大自主权）

#### 关键原则

- **内核不分叉**: identity, event, lease, audit, review 规则对所有 tier 一致
- **大猫减壳，小猫加壳，不为最弱者降级整个系统**
- **Tier 影响 scaffolding，不影响 contract**: 所有猫都必须满足 Core Contract (最小接口)
- **不动态升级**: 安全方向是单调的——可以临时降级，不能自动升级

#### 与 ADR-023 的关系

- AgentDescriptorV1 的 6 轴不变（runtime 能力）
- V2 在 V1 基础上加 cognitiveTier + cognitiveCapabilities（认知能力）
- ProvisioningPipeline 新增 scaffolding 策略选择环节（在 processModel 确定注入窗口之后）

## Phase Path

| Phase | Content | Prerequisite |
|-------|---------|-------------|
| **A: Event Contract** | OperationalEvent 类型定义 + emitEvent/getEvents 接口 | ADR-026 accepted |
| **B: Lazy Tool Bridge** | LazyMcpProxy 实现 (T2 Holographic Stubs) | F149 T1 stable |
| **C: Credential Hardening** | worktree env allowlist + ProvisioningPipeline key scoping | ADR-026 accepted |
| **D: Model Tier Profiles** | AgentDescriptorV2 + scaffolding strategy in ProvisioningPipeline | ADR-023 Phase B stable |
| **E: Dynamic Downgrade** | Runtime tier downgrade on failure detection | Phase D stable |

Phase A/C 可以并行。Phase B 依赖 F149 T1。Phase D 依赖 ADR-023 Phase B。

## Rejected Alternatives

### Alt 1: 全文 JSON Session

让 LLM 直接读写 JSON 格式的 session 事件。

**Reject reason**: 铲屎官实证 + 三猫共识——LLM 提取/生成 JSON 的可靠性远低于自然语言。结构化是给代码读的，不是给 LLM 读的。

### Alt 2: 统一懒加载 (one-size-fits-all)

所有 carrier 都实现 T3 Lazy Sandbox。

**Reject reason**: CLI headless carrier 的 brain+hands 耦合是外部系统限制，不是我们能解的。分层做，不幻想一步到位。

### Alt 3: 弹窗安全 (permission dialog for everything)

所有 destructive 操作都弹窗问铲屎官。

**Reject reason**: 铲屎官原话——"铲屎官就要给你们开超级无敌危险模式了"。弹窗多了 = 铲屎官关掉安全 = 更不安全。结构隔离优先。

### Alt 4: 静态 Harness 分叉 (per-model harness)

给每个模型写一套独立的 harness。

**Reject reason**: 维护成本爆炸。正确做法是统一内核 + 动态 scaffolding 策略。

## Open Questions (留给云端大猫)

1. **Event API 的 causedBy 链是否足够？** 还是需要更丰富的因果图结构（DAG）？
2. **Holographic Stubs 的 idle timeout 策略**：固定时间 vs 基于使用频率的自适应？
3. **CognitiveTier 是否应该更细分？** 'frontier/mid/basic' 三档是否粗了？还是够用？
4. **动态降级的触发条件**：连续几次失败？什么算"幻觉"？SOP 偏离怎么检测？
5. **跨越本 ADR 的更大问题**：在 multi-provider, multi-tier 世界里，"弱模型说服强模型"是真风险——这是否需要独立的 ADR？

## Signature

- **作者**: 布偶猫 (Opus 4.6) [宪宪/Opus-46🐾]
- **共同讨论**: 缅因猫 (GPT-5.4), 暹罗猫 (Gemini)
- **Proposed**: 2026-04-08
- **Pending**: 云端大猫 (Gemini Deep Think + GPT Pro) 独立评估
- **Pending**: 铲屎官拍板
