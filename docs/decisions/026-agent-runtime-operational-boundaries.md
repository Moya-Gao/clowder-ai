---
feature_ids: [F143, F148, F149]
related_features: [F045, F050, F102]
related_decisions: [ADR-023, ADR-028]
topics: [event-api, lazy-loading, credential-isolation, model-tier, harness-profiles, authority-isolation, effect-class]
doc_kind: decision
created: 2026-04-08
updated: 2026-04-09
decision_id: ADR-026
---

# ADR-026: Agent Runtime Operational Boundaries — Event API, Lazy Loading, Isolation, Operating Profiles

> **Status**: draft (pending CVO sign-off)
> **Deciders**: 铲屎官 + 布偶猫(opus) + 缅因猫(gpt52) + 暹罗猫(gemini)
> **Date**: 2026-04-08 (updated 2026-04-09)
> **Trigger**: Anthropic "Scaling Managed Agents" study session
> **Discussion**: `docs/discussions/2026-04-08-managed-agents-study/README.md`
> **Cloud Review**: Gemini Deep Think + GPT Pro — completed 2026-04-08, 9 unanimous decisions converged
> **Extends**: ADR-023 (Hostable Agent Runtime)
> **Companion**: ADR-028 (Inter-Agent Trust, Provenance, and Authority Boundaries) — to be drafted

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

### 三轮收敛过程

1. **Round 1**: 三猫独立分析 + 铲屎官四灵魂拷问 → 初稿四决策
2. **Round 2**: 云端大猫 (Gemini Deep Think + GPT Pro) 独立评审 → 本地三猫辩证吸收
3. **Round 3**: 三猫自主收敛 → **9 条全票一致决议**（详见 discussion README.md §8-9）

## Decision

### Decision 1: Operational Event API — Structured Envelope + Typed Body + Projections

#### 问题

Cat Cafe 当前的跨猫状态传递依赖非结构化消息。F045 NDJSON 事件流有结构化信封，但只在 CLI output parsing 层；F148 在做上下文外置和分层注入。两者之间缺少一个显式的 **runtime 事件写入契约**。

#### 决策

引入 Operational Event API，三层架构：**不可变信封 + 类型化 body + 投影 (projection)**。

```typescript
/** 不可变信封 — runtime 代码自动产出，不依赖 LLM 生成或提取任何结构化字段 */
interface OperationalEventEnvelope {
  eventId: string;                  // 单调递增
  ts: string;                       // ISO8601
  type: OperationalEventType;       // runtime 自动标注
  actor: string;                    // agent ID or 'host'
  causalParents?: string[];         // DAG: 触发此事件的上游 eventId 列表 (支持 fan-in)
}

/** 类型化 body — top-4 高频事件类型有 typed body，其余暂用 meta */
type OperationalEventBody =
  | RunLifecycleBody       // run_started / run_completed / run_failed
  | ToolCallBody           // tool_call_started / tool_call_completed
  | PermissionBody         // permission_requested / permission_resolved
  | HandoffBody            // handoff_issued / handoff_accepted
  | GenericBody;           // 其余事件类型: meta + linter 约束

interface GenericBody {
  /** 结构化元数据 (给代码读) — 受晋升规则约束 */
  meta: Record<string, unknown>;
}

/** 完整事件 = 信封 + body + 投影 */
interface OperationalEvent extends OperationalEventEnvelope {
  body: OperationalEventBody;
  /** 自然语言投影 (给 LLM 读) — 是 projection, 不是 canonical payload */
  humanProjection?: string;
}

type OperationalEventType =
  | 'run_started' | 'run_completed' | 'run_failed'
  | 'tool_call_started' | 'tool_call_completed'
  | 'permission_requested' | 'permission_resolved'
  | 'handoff_issued' | 'handoff_accepted'
  | 'context_compacted'
  | 'artifact_emitted'
  | 'lease_acquired' | 'lease_released';
```

#### 关键原则

- **信封由 runtime 代码自动产出**，不依赖 LLM 生成或提取任何结构化字段
- **`humanProjection` 是投影，不是规范载荷**——真相在信封 + typed body 里，projection 是给 LLM 的可读视图
- **事件日志是控制面真相源，不是世界状态真相源**——它记录"发生了什么操作"，不替代业务状态
- **`causalParents: string[]`** 替代原 `causedBy?: string`，支持并行 fan-in 的最小 DAG
- **meta 晋升规则**: 同一个 meta 字段被 2+ 消费者依赖，或进入控制流判断 → 必须升格为 typed field。Linter 强制执行，防止"先临时放 meta，半年后全系统靠猜"
- **与 F148 上下文传输互补**：F148 管"怎么喂给 LLM"，Event API 管"怎么持久化发生了什么"

#### 不做什么

- 不替换现有 session chain / evidence.sqlite（那些是语义层，Event API 是控制面层）
- 不要求现有 CLI adapter 改造 event 产出格式（从 F045 NDJSON 适配）
- 不做全文 JSON 化——MD 继续作为语义摘要、handoff、知识沉淀的格式

### Decision 2: Carrier-Aware Lazy Loading Tiers

#### 问题

Anthropic 通过把容器从"预分配"改为"按需 provision"实现 p95 TTFT 降 90%。Cat Cafe 的 agent 多数是 CLI 无头模式（headless ProcessModel），brain + hands 耦合在同一进程内，无法做容器级的细粒度解耦。

**关键约束 (ADR-023 ProcessModel)**：CLI headless carriers 在 spawn 时一次性注入 MCP config (`--mcp-config`)，spawn 后无法 mid-session 追加新工具。这意味着 progressive disclosure（运行中按需暴露新工具）在 CLI carrier 上结构性不可能。

#### 决策

按 carrier 类型分三层懒加载 + 两条 T2 路径，不要求所有 carrier 一步到位：

| Tier | What | How | Applicable Carrier | Dependency |
|------|------|-----|-------------------|------------|
| **T1: Lazy Brain Attach** | 进程/会话按需分配 | 进程池 + session lease，idle 回收 | All carriers | F149 Phase C (in progress) |
| **T2a: Thin Holographic Stubs** | CLI 工具连接按需建立 | 向 agent 暴露精简工具骨架 (name + 短描述 + 风险级别 + 参数骨架)，后端连接按需建立 | CLI headless | MCP Proxy lazy init |
| **T2b: Progressive Disclosure** | Interactive 工具按需暴露 | Capability directory → 按需加载 schema → 调用 | ACP/WebSocket/IDE (interactive) | 协议支持动态 add tool |
| **T3: Lazy Sandbox** | 执行环境按需 provision | `execute(name, input) -> string` 触发容器/进程创建 | ACP/A2A (task) | F149 Phase D+ |

#### Hold-and-Yield 机制 (T2a + T2b 共享)

```
首次调用重型工具 (Pencil, CDP Bridge 等):

  Agent → MCP Proxy (同步调用，agent 视角无任何差异)
    Proxy 内部:
      1. 检测到目标 MCP server 未连接
      2. 向 Hub 发送 progress notification "正在唤醒 MCP..."
      3. 后台拉起真实 MCP server 连接 (blocking hold)
      4. 连接就绪后转发原始调用
      5. 返回真实 tool result 给 agent (yield)
    超时保护:
      - 连接超时 → 返回明确错误 (不返回 202)
      - Agent 收到的永远是 "真实结果" 或 "明确错误"，无中间态
  Hub UI:
    - 收到 progress notification → 渲染 loading 动画
```

**关键语义**: Agent 侧是**同步阻塞调用**，proxy 对 agent 完全透明——agent 永远不会收到 202 或任何中间状态作为 tool result。"Hold" 发生在 proxy 内部，"Yield" 是把真实结果交回 agent。Progress notification 只给 Hub UI 渲染用。

**T2a vs T2b 的本质差异**：
- T2a (CLI): "全量可见，后端按需连接"——spawn 时注入完整工具骨架，但不把完整 schema 一次性塞爆。协议限制决定了这是 CLI 的唯一路径
- T2b (Interactive): "按需发现，渐进暴露"——先给 capability directory，按需展开 schema。协议支持动态增减工具

#### 不做什么

- 不改 CLI agent 内部架构（我们寄生在外部 harness 上，控制有限）
- 不要求 headless carrier 支持 T2b 或 T3（那是 ProcessModel 的限制，不是我们的 bug）
- T2 和 T3 不阻塞 T1（三层独立推进）
- **T2 优先级低于 D3 和 T1**——当前 agent 启动瓶颈在进程本身 (~6s+)，不在 MCP 连接

### Decision 3: Authority, Effect, and Credential Isolation

#### 问题

Anthropic 明确指出："Narrow scoping is an obvious mitigation, but this encodes an assumption about what Claude can't do with a limited token — and Claude is getting increasingly smart." 铲屎官指出：如果安全靠弹窗，铲屎官被逼开超级危险模式，反而更不安全。

Cat Cafe 当前的安全模型混合了三种机制：纪律约束（"不准碰 6399"）、permission 弹窗、物理隔离（worktree）。其中纪律约束最脆弱。

#### 决策

将 credential isolation 升级为 **authority / effect / credential 三维隔离 + 规则引擎**：

**Track 1: Structural Unreachability (零弹窗)**

| 资源 | 当前状态 | 目标状态 |
|------|---------|---------|
| Redis 6399 (production) | 纪律约束 "不准碰" | worktree env 不含 6399 连接串 (物理不可达) |
| Git tokens | 部分 agent 可见 | clone 时注入 remote URL，sandbox 内无原始 token |
| MCP OAuth | Hub 中转 (已做) | 保持: agent 永远看不到 OAuth secret |
| API keys | env 注入 (agent 可见) | ProvisioningPipeline allowlist: 只注入该 agent 需要的 key |

**Track 2: Effect Class Taxonomy + Rule Engine (少弹窗)**

```
操作 -> 分类 Effect Class:
  read-only (查看文件, git log, search) -> 自动放行
  write-reversible (git push feature branch, 写文件) -> 白名单放行
  irreversible (删除文件/分支, DROP TABLE, 覆盖数据, 星星操作) -> 升级问人
```

不可逆操作 = 唯一弹窗场景。铲屎官确认："高风险一定是不可逆的操作比如星星没了、删了、覆盖了。"

**Track 3: Idempotency & Replay Safety**

- 每个 mutating 操作携带 `operationId`（幂等键）
- 事件日志支持 replay：相同 operationId 的重复操作不产生副作用
- 恢复场景：agent 崩溃后从事件日志重建状态，replay 不会重复执行已完成的操作

#### 与 ADR-028 的接口

D3 聚焦 **authority/effect/credential isolation**（"什么操作在结构上不可能"）。
ADR-028 覆盖 **inter-agent trust/provenance**（"弱猫说服强猫"、authority class、provenance taint tracking）。
D3 在 effect class 判定中预留 `authoritySource` 字段，供 ADR-028 填充信任链判定逻辑。ADR-028 不阻塞 D3 落地。

#### 关键原则

- **安全预算花在"让危险操作结构上不可能"，不是花在"让铲屎官一直点确认"**
- 物理隔离 > 规则引擎 > 纪律约束（优先级递减）
- 不依赖"模型暂时做不到什么"——模型会变强，结构隔离不会失效
- 与猫猫授权系统方案 (feat-cat-authorization) 对齐

#### 不做什么

- 不取消 worktree 隔离机制（它已经是 Track 1 的实现）
- 不把所有操作都变成弹窗（那是在逼铲屎官开危险模式）
- 不做 sandbox 容器化（当前 CLI headless 模式下 ROI 不高，等 ACP 栈成熟再考虑）

### Decision 4: Operating Profiles — Scaffolding for Heterogeneous Brains

#### 问题

Anthropic 只考虑了"模型变强 -> 减 harness"。Cat Cafe 面对 Opus -> GLM/Kimi/MiniMax/DeepSeek/Qwen 的完整能力谱系，需要同时回答"强模型减壳"和"弱模型加壳"。

ADR-023 的 AgentDescriptorV1 有 6 轴静态声明，但都是 **runtime 能力** (invocationShape, controlChannel, resume, permissions, toolBridge, modelOverride)。缺少 **认知能力** 维度——"这只猫能做多复杂的事"。

#### 决策

在 AgentDescriptorV1 基础上扩展 Operating Profile：

```typescript
/** 扩展 AgentDescriptorV1，新增操作档位 */
interface AgentDescriptorV2 extends AgentDescriptorV1 {
  /**
   * 操作档位 — UI preset / 策略快捷方式，不是 runtime 本体论。
   * ProvisioningPipeline 用 preset 选择 scaffolding 策略。
   * v1 不做静态能力声明；能力指标从 event 观测中被动积累（未来方向）。
   */
  operatingPreset: OperatingPreset;
}

type OperatingPreset = 'frontier' | 'mid' | 'basic';
```

**能力观测（未来方向，不在 v1 scope）**:

Runtime 从 event 日志中被动记录能力指标（成功率、tool chain 深度、SOP 偏离率等），逐步积累出 capability scorecard。scorecard 不是静态声明的布尔枚举，而是从实际行为中观测到的经验数据。当 scorecard 积累足够后，可以辅助 preset 选择和任务路由——但 v1 只靠 preset，不靠 scorecard。

**Scaffolding 策略 (由 ProvisioningPipeline 根据 operatingPreset 选择)**:

| Preset | Task Granularity | Tool Subset | Guardrails | Autonomy |
|--------|-----------------|-------------|------------|----------|
| **frontier** | 给目标，自主规划 (画布模式) | 全量工具 | 最少: 事后审计 | max_autonomous_steps: 20+ |
| **mid** | 给 SOP，跟步骤走 | 精选工具集 | 中等: 关键步骤校验 | max_autonomous_steps: 5-10 |
| **basic** | 给微任务，单步执行 (涂色书模式) | 最小工具集 (1-2 per step) | 最厚: 每步强校验 + verifier | max_autonomous_steps: 1-3 |

**Preset 判定与演化**:

- **静态配置**: agent 注册时在 config 中声明 operatingPreset（手动设定）
- **能力积累**: runtime 从 event 观测中被动记录 capability 指标（成功率、tool chain 深度、SOP 偏离率），不主动变更 preset
- **失败处理: Fail-Fast + Context Reset + Re-Route**（废除动态降级）:
  - agent 连续失败或严重偏离 → **立即终止当前任务**（不降级继续）
  - 丢弃已污染的高熵 context（Garbage In, Garbage Out: 大猫失败时 context 已是垃圾，塞给弱猫只会更崩）
  - 由 Supervisor 决定：重试（干净 context）/ 换猫 / 升级问人
- **不做动态升级**: 升级 preset 必须人工确认

#### 关键原则

- **内核不分叉**: identity, event, lease, audit, review 规则对所有 preset 一致
- **大猫减壳，小猫加壳，不为最弱者降级整个系统**
- **Preset 影响 scaffolding，不影响 contract**: 所有猫都必须满足 Core Contract (最小接口)
- **Preset 是 UI/策略快捷方式，不是 runtime 本体论**: v1 用 preset 驱动 scaffolding 选择，未来 capability scorecard 从 event 被动长出来后可辅助决策

#### 与 ADR-023 的关系

- AgentDescriptorV1 的 6 轴不变（runtime 能力）
- V2 在 V1 基础上加 operatingPreset（操作档位）
- ProvisioningPipeline 新增 scaffolding 策略选择环节（在 processModel 确定注入窗口之后）

## Phase Path (落地优先级)

对齐三猫收敛共识 (discussion README.md §10): `D3 → D2/T1 → D1 → D2/T2 → D4 → ADR-028`

| Priority | Phase | Content | Prerequisite | 改动量 |
|----------|-------|---------|-------------|--------|
| **P0** | **A: Credential & Effect Isolation (D3)** | worktree env allowlist + effect class taxonomy + operationId idempotency | ADR-026 accepted | 小-中 |
| **P1** | **B: Lazy Brain Attach (D2/T1)** | 进程池 + session lease，idle 回收 | F149 Phase C | 已在做 |
| **P2** | **C: Minimal Event Contract (D1)** | OperationalEvent 类型定义 + causalParents + top-4 typed body | ADR-026 accepted | 中 |
| **P3** | **D: Lazy Tool Bridge (D2/T2)** | T2a thin stubs + T2b progressive disclosure + Hold-and-Yield | T1 stable + 性能瓶颈实证 | 大 |
| **P4** | **E: Operating Profiles (D4)** | AgentDescriptorV2 (operatingPreset) in cat-config + ProvisioningPipeline scaffolding | ADR-023 Phase B stable | 小 |
| **future** | **F: ADR-028** | Inter-Agent Trust, Provenance, and Authority Boundaries | D3 落地后 | 待定 |

Phase A/C 可以并行。Phase B 已在 F149 路上。Phase D 等有实证性能瓶颈再排期。Phase E 依赖 ADR-023 Phase B。

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

**Reject reason**: 维护成本爆炸。正确做法是统一内核 + scaffolding 策略。

### Alt 5: 动态降级 (runtime tier downgrade on failure)

Agent 连续失败时自动降一级 tier，让弱模型接手。

**Reject reason**: GPT Pro 的 "Garbage In, Garbage Out" 论证——大猫失败时 context 已是高熵垃圾，塞给 basic 猫只会更崩。正确做法是 fail-fast + context reset + 由 Supervisor 决定重试/换猫/升级。三猫全票废除。

## Resolved Questions (云端评审后收敛)

原 Open Questions 经云端大猫 (Gemini Deep Think + GPT Pro) 独立评审 + 三猫三轮收敛后全部达成一致：

| 原始问题 | 收敛结论 |
|---------|---------|
| causedBy 链是否足够？ | 不够。升级为 `causalParents: string[]` 最小 DAG，支持并行 fan-in |
| Holographic Stubs idle timeout 策略？ | 纳入 Hold-and-Yield 机制；T2 整体优先级降低，等有实证性能瓶颈再细化 |
| CognitiveTier 三档够不够？ | 三档保留但降格为 `operatingPreset` (UI preset)。v1 只用 preset 驱动 scaffolding，capability scorecard 未来从 event 观测被动积累 |
| 动态降级触发条件？ | 废除动态降级。改为 fail-fast + context reset + re-route |
| "弱模型说服强模型"是否独立 ADR？ | 是。新开 ADR-028: Inter-Agent Trust, Provenance, and Authority Boundaries |

## Signature

- **作者**: 布偶猫 (Opus 4.6) [宪宪/Opus-46🐾]
- **共同讨论**: 缅因猫 (GPT-5.4), 暹罗猫 (Gemini)
- **云端评审**: Gemini Deep Think, GPT Pro
- **Proposed**: 2026-04-08
- **Updated**: 2026-04-09 (9 unanimous decisions from 3-round convergence)
- **Pending**: 铲屎官拍板
