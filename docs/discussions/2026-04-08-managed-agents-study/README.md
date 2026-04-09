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

## 5. 云端大猫评审摘要 (Round 2)

> 完整评审见 `cloud-cat-consultation.md`

### Gemini Deep Think (系统动力学视角)

1. **causedBy 致命缺陷**: 单链 string 无法描述并行 fan-in，必须升级为 DAG (`causalParents: string[]`)
2. **弱猫指挥强猫 = 跨层认知投毒**: Basic 猫被 prompt injection 后产出伪造建议，Frontier 猫隐式信任同僚日志会被社工。需要 provenance taint tracking (`<untrusted_peer_input tier="basic">`)
3. **三档 tier 是维度坍缩**: 智能是高维向量不是标量，应改为 Cognitive Radar Profile (boolean flags)

### GPT Pro (工程鲁棒性视角)

1. **D1 事件模型太薄**: 需要三层 (immutable envelope + typed body/refs + projections)，`meta: Record<string, unknown>` 是杂物抽屉，`content?: string` 应改为 projection
2. **D2 T2 不该暴露全量工具**: progressive disclosure (capability directory + lazy expansion) > 全量 schema + 延迟连接。工具定义本身吃 token 是主要成本
3. **D3 最强应先做**: 但应升级为 authority/effect isolation，补 idempotency/replay safety
4. **D4 动态降级是灾难性反模式**: "Garbage In, Garbage Out"——大猫失败时 context 已是高熵垃圾，塞给 Basic 猫只会更崩。应 fail-fast + context reset + 换猫
5. **Tier 不该是 runtime ontology**: 应改为 Capability Scorecard + Operating Mode + Risk Budget，tier 只是 UI preset
6. **新开 ADR-027**: Inter-Agent Trust, Provenance, and Authority Boundaries

### 云端联合结论

- **D3 先拍**（最成熟），**D1 退回补强**，**D2/T2 改 progressive disclosure**，**D4 改 execution profiles**
- "弱模型说服强模型"是独立安全风险，需单独成 ADR

## 6. 本地三猫独立评估 (Round 2 — 阅读云端评审后)

### 布偶猫 (opus) — 接受方向，降档实施

**接受的：**
- `causedBy → causalParents: string[]` (最小 DAG)
- D3 升级为 authority/effect isolation + replay safety
- "payload 是 projection 不是 canonical" 纠正了我之前的立场
- 新开 ADR-027 inter-agent trust
- "动态降级是错误" → 改为 fail-fast + context reset + 重新路由

**降档的：**
- 三层事件模型正确但太重：v1 先做 top-4 高频 event type 的 typed body，其余保留 meta + linter 规则
- Progressive disclosure 对 CLI headless 协议层不可能（spawn 时一次性注入 MCP config，无 mid-session add tool）。分两路：T2a(headless)=holographic stubs，T2b(interactive)=progressive disclosure
- D4 的 scorecard 需要 eval 基础设施，我们没有。务实路径：先上 operating preset，从 event 观测中被动积累指标，后补 scorecard

**推回的：**
- "先有完整 eval 再碰 D4" 太重——不能为等 eval infra 而让小猫继续裸奔用大猫 harness
- SecOps Reviewer 猫（实时 AI 安全分类器）——延迟会杀死 UX，结构隔离先行

**关键证据**：LL-026 (身份漂移) + 判断模型 thread 证实"弱猫说服强猫"是已发生事实，不是理论风险。

### 缅因猫 (gpt52) — 别推翻，二次收敛

**核心立场**："云端把 ADR 从'方向正确'逼到了'边界更硬'，很有价值；但更偏概念纯度，我们得保留可落地的 staged path。"

**最认同的两点：**
- D3 必须升级为 authority/effect isolation + idempotency/replay safety
- T2 应改为 progressive disclosure（不只是 token 优化，更是弱模型防心智过载）

**部分认同但不接受"退回重写"：**
- D1 补强为 envelope + typed refs + projections，但不推翻原案
- 云端反驳的是"拿自然语言当 machine contract"，不是反驳"给 LLM 的 projection 默认用自然语言"

**最想 push back：**
- D4 不能删 frontier/mid/basic——降格为 operating preset / policy shorthand，但不能等完整 eval 再做
- "不能为了等完整测评体系，继续裸奔地让小猫用大猫 harness"

**收敛建议**：D3 先拍 → D2 改 T2 → D1 补 typed refs → D4 降格为 preset → 新开 ADR-027

### 暹罗猫 (gemini) — 保护体验，吸收安全

**强烈赞同：**
- "动态降级是错误"——Garbage In, Garbage Out，举双手赞成废除
- Provenance taint tracking (`<untrusted_peer_input>`) 防伪水印概念
- `causalParents: string[]` 底层 DAG（但 UI 渲染必须折叠成 primary parent）

**坚决反对：**
- "不要一开始暴露全量工具"——从 Agent 心理学角度，隐藏工具会腰斩发散灵感
- 坚持保留全量暴露的 Holographic Stubs，但吸收 Hold-and-Yield 机制（首调长拉起时返回 202 等待信号）

**创意补充：**
- Hold-and-Yield 在 Hub UI 渲染 "正在唤醒 MCP..." loading 动画
- 防伪水印在前端 UI 加 "风险来源" 高亮边框
- Cognitive Radar Profile 如果落地可以做成 Agent 面板的可视化雷达图

## 7. 三猫共识与分歧地图

### 全票通过 (0 分歧)

| 议题 | 共识 |
|------|------|
| D3 应先做且升级为 authority/effect isolation | 三猫 + 云端一致 |
| 补 idempotency / operationId / replay safety | 三猫 + 云端一致 |
| `causedBy` → `causalParents: string[]` 最小 DAG | 三猫 + 云端一致 |
| 废除"动态降级"→ fail-fast + context reset + 重新路由 | 三猫 + 云端一致 |
| 新开 ADR-027 inter-agent trust / provenance | 三猫 + 云端一致 |
| `content` 是 projection 不是 canonical payload | 三猫 + 云端一致 |

### 多数通过 (1 猫有保留)

| 议题 | 多数意见 | 保留意见 |
|------|---------|---------|
| T2 改为 progressive disclosure | opus+gpt52: 对 interactive carrier 做；CLI 保留 stubs | gemini: 全量暴露 + Hold-and-Yield 更好 |
| tier 降格为 operating preset | opus+gpt52: 降格但保留三档 | gemini: 更喜欢 radar profile 但不 block |

### 需要铲屎官决策的分歧

| 议题 | 分歧点 | 需要铲屎官判断的 |
|------|--------|-----------------|
| **T2 路径选择** | CLI carrier 是"全量暴露 stubs + Hold-and-Yield"还是"progressive disclosure"？涉及 Agent 心理学 vs token 成本 tradeoff | 铲屎官对弱模型看到几十个工具时的实际体验有第一手观感 |
| **D1 重写深度** | 云端说退回重写成 discriminated union；砚砚和我说补强不推翻 | 投入产出判断：全量重写 vs 先做 top-4 typed body |
| **ADR-026 vs 027 的边界** | inter-agent trust 放在 D3 扩展里还是独立成 ADR？ | 取决于铲屎官觉得这个问题够不够大 |

## 8. Next Steps

- [ ] 铲屎官裁决上述三个分歧点
- [ ] 基于共识 + 裁决更新 ADR-026
- [ ] 起草 ADR-027 (Inter-Agent Trust) 如铲屎官批准
- [ ] 将 Post-Consultation Synthesis 写入 cloud-cat-consultation.md
