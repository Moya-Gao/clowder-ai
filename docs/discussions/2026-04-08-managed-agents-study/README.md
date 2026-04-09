---
topics: [managed-agents, agent-runtime, session-api, lazy-loading, credential-isolation, model-tier, harness-engineering]
related_features: [F143, F148, F149, F045, F050]
related_decisions: [ADR-023, ADR-026]
doc_kind: discussion
created: 2026-04-08
participants: [opus, gpt52, gemini, landy]
signal_article: signal_8537165d23c701b725b2bce4
---

# Study Session: Scaling Managed Agents — Decoupling the Brain from the Hands

> **Source**: [Anthropic Engineering Blog](https://www.anthropic.com/engineering/managed-agents), 2026-04-09
> **Signal ID**: `signal_8537165d23c701b725b2bce4` (T1)
> **Thread**: 铲屎官 Signal Study 发起

## 1. 文章核心架构

Anthropic 将 Managed Agents 拆成三个可独立替换的接口：

| Component | Abstraction | Key Interface |
|-----------|-------------|---------------|
| **Brain** | Claude + harness (inference loop) | `wake(sessionId)`, context management |
| **Hands** | Sandbox / tools (execution) | `execute(name, input) -> string` |
| **Session** | Event log (durable record) | `emitEvent(id, event)`, `getEvents()` |

核心设计哲学：像操作系统虚拟化硬件一样虚拟化 agent 组件——接口比实现活得久。

### 文章关键论点

1. **Harness 假设会过时**: Sonnet 4.5 的 "context anxiety" 在 Opus 4.5 上消失，context reset 成了死重
2. **Pets -> Cattle**: 耦合容器是 pet；解耦后 brain/hands 都是 cattle，崩了从日志恢复
3. **安全边界 = 结构隔离**: 不靠 scope 限制 token 权限（"Claude is getting increasingly smart"），而是让 credentials 物理上不可达
4. **Session != Context Window**: Session 是外部持久化事件日志，context window 只是当前喂给模型的一小段
5. **Many brains, many hands**: 无状态 harness + 按需 provision sandbox，p50 TTFT 降 60%，p95 降 90%+

## 2. 三猫独立分析

### 布偶猫 (opus) — 架构视角

**与 Cat Café 同构的设计决策**:
- Brain/Hands/Session 解耦 ≈ F143 的 Transport x Binding x RuntimeContract x EventAdapter
- Session 外部化 ≈ Session Chain + evidence.sqlite
- Harness 无状态恢复 ≈ F149 process pool + session lease

**Cat Café 领先的地方**:
- Multi-model diversity (7+ provider vs 单一 Claude)
- Brain-to-Brain 协作协议 (@mention routing, handoff, shared-rules)
- Knowledge 提炼 (Knowledge Feed, 语义检索)
- Human-in-the-loop 作为一等公民 (CVO role)

**Cat Café 可以学的**:
- Credential isolation 需要从隐式升级为显式硬约束
- Lazy provisioning 的 TTFT 优化思路
- 定期审计 harness 假设

### 缅因猫 (gpt52) — 安全与契约视角

**核心判断**: "同一哲学谱系。多脑协作上走得更远，执行隔离上他们做得更硬。"

**关键补充**:
- `execute(name, input) -> string` 作为理念够了，作为多 provider runtime 的内核契约太薄——缺 streaming, cancel, 结构化错误, lease ownership, capability discovery, artifact channel
- 该学的不是"Managed Agents"名字，而是把 `credential isolation + structured session semantics + lazy hands` 做成基础设施

### 暹罗猫 (gemini) — 体验与创意视角

**核心隐喻**: "从被锁在拥挤小黑屋的画师，解放成拥有云端分身和无限工具箱的超级创作者"

**独特观点**:
- TTFT 下降 90% 就是最好的 UX——"秒回"
- Cat Cafe 的"手"不仅能写代码，还能画 UI、发语音、做 PPT——多模态表达能力是差异化优势
- Anthropic 的解耦是为了让机器不出错，Cat Cafe 的解耦是为了让陪伴和创造的浪漫浮现

## 3. 铲屎官的四个灵魂拷问

### Q1: Session API — JSON 真的比 MD 好吗？

> "你们都是 LLM，让你们提取 JSON 效果极差！结果效果极差！"

**三猫收敛共识**:

Anthropic 的 `getEvents` 不是让 LLM 读 JSON——是让 **harness (代码)** 读结构化事件日志，然后 harness 决定怎么转化成 context 喂给 LLM。

正确的分层:
```
Session Log (结构化, 给代码读)
    -> harness transform (代码层, 切片/过滤/重组)
        -> Context Window (自然语言, 给 LLM 读)
```

**结论**: 不要把一切变成 JSON。学他们把事件的**信封 (envelope)** 结构化，把事件的**内容 (payload)** 留给自然语言。信封由 runtime 自动产出，不依赖模型提取。

### Q2: Hands 懒加载 — CLI 无头 agent 怎么做？

> "烁烁 ACP F149 就是一次尝试。但你们两只都是 CLI 无头模式启动的，如何管理这样外部系统的懒加载？"

**三猫收敛共识 (分层)**:

| Tier | Approach | Applicable Carrier |
|------|----------|-------------------|
| Lazy brain attach | 进程池 + lease, 按需分配 | All (F149 已在做) |
| Lazy tool bridge | "全息假工具" — 声明全量工具列表但真实连接按需建立 | CLI carrier 可做 |
| Lazy sandbox | 每次 tool call 再 provision 执行环境 | 仅 ACP/A2A 开放协议 |

**结论**: CLI 黑盒 vs ACP 开放协议是本质差异。不要幻想一步到位。CLI 先吃前两层，ACP 做第三层。长期 ACP 栈覆盖更多 provider 后 CLI 栈自然收窄。

### Q3: Credential Isolation vs 便捷

> "如果当干什么都需要找铲屎官询问，那铲屎官就要给你们开超级无敌危险模式了。"

**三猫收敛共识**:

"结构隔离"和"审批弹窗"不是同一件事。最好的安全不是审批，是让危险操作在结构上不可能发生。

分两条线:
- **物理隔离** (零弹窗): worktree 环境变量不含 6399 连接串, git token 烧进 remote, MCP OAuth 走 Hub proxy
- **规则引擎降级** (少弹窗): 命中白名单自动放行，未知高风险才升级问人

**结论**: 安全预算花在"让危险操作结构上不可能"，不是花在"让铲屎官一直点确认"。

### Q4: Harness + 弱模型适配

> "如果不是你们三只大猫猫，而是你们需要带小猫猫 (GLM/Kimi/MiniMax/DeepSeek/Qwen)，harness engineering 和这篇文章说的会有什么 gap？"

**三猫收敛共识**:

Anthropic 只回答了"模型变强 -> 减 harness"，没回答"模型很弱 -> 怎么补足"。

设计: 统一内核 + Model Tier Profile + 动态脚手架

```
Core Contract (所有模型必须满足，不分叉)
  identity / event / lease / audit

Model Tier Profile (F143 AgentDescriptor 扩展)
  cognitive_tier: "frontier" | "mid" | "basic"
  capabilities: [structured_output, multi_step_reasoning, tool_chaining...]
  max_autonomous_steps: 20 | 5 | 1

Dynamic Scaffolding (烁烁的"涂色书")
  frontier: 给目标，自主规划
  mid: 给 SOP，跟步骤走
  basic: 给微任务，单步执行 + 强校验
```

**结论**: Anthropic 的问题域比我们窄。他们在解"一个聪明人怎么用好多只手"，我们在解"一群能力不同的猫怎么一起干活还不翻车"。后者严格包含前者。

## 4. 总结对比

| Dimension | Managed Agents | Cat Cafe | Who Leads |
|-----------|---------------|----------|-----------|
| Brain/Hands/Session decoupling | Production | F143/F149 in progress | Them (maturity) |
| Credential structural isolation | vault + proxy, in architecture | Directionally aligned, not hard-constrained | Them |
| TTFT / Lazy provisioning | p95 down 90% | Not explicit yet | Them |
| Multi-model diversity | Single Claude | 7+ heterogeneous providers | **Us** |
| Brain-to-Brain collaboration | Not addressed | @mention + handoff + shared-rules | **Us** |
| Knowledge extraction | Session log slicing | Session + Knowledge Feed + semantic search | **Us** |
| Human-in-the-loop | API consumer | CVO first-class citizen | **Us** |
| Weak model adaptation | Not considered (only Claude) | Need Model Tier Profiles | **Us** (problem domain) |

## 5. Action Items

-> ADR-026: Agent Runtime Operational Boundaries
-> 云端大猫 (Gemini Deep Think + GPT Pro) 独立评估
