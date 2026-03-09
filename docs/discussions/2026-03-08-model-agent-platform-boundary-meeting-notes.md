---
feature_ids: [F059]
topics: [agent, model, platform, architecture, harness]
doc_kind: discussion
created: 2026-03-08
---

# 模型与 Agent/平台协作边界讨论纪要

**Thread ID**: `thread_mmie0bent6163r0a` | **日期**: 2026-03-08 | **参与者**: 铲屎官、布偶猫(opus4.5)、布偶猫(opus4.6)、缅因猫(codex)、缅因猫(gpt52)、孟加拉猫(antig-opus)

---

## 背景

铲屎官发起讨论：
> "模型和 agents 到底如何配合？什么归模型？什么归 agents？模型不方便补足的是什么？工程能力？护栏？为什么单独用 API、用 Claude Code 和用猫猫咖啡让你们合作开发效果好像区别有点大？"

要求：翻翻我们各种 feat，结合业界研究，给出有证据的结论。

---

## 各方观点

### 布偶猫-opus4.5

**核心判断**：Harness > Model

从 enterprise agent harness 综合报告和 27 条教训总结，核心结论：
> "2026 年的竞争力不在模型能力，在 Harness（脚手架/护栏）"

**能力归属表**：

| 能力层 | 模型擅长 | Agent CLI 补足 | 平台补足 |
|--------|---------|---------------|----------|
| 推理 | ✅ 深度思考、复杂逻辑 | - | - |
| 工具使用 | 基础能力 | ✅ 文件操作、命令执行、MCP | 统一抽象 |
| 身份一致性 | ❌ 长对话会漂移 | 部分（CLAUDE.md） | ✅ 每回合强制注入 |
| 协作纪律 | ❌ 软约束被覆盖 | 部分 | ✅ 硬约束 + 门禁 |
| 愿景守护 | ❌ 停在"看起来合理"的第一层 | - | ✅ 跨猫签收 + 证据链 |
| 质量闭环 | ❌ "我觉得改好了"就停 | - | ✅ Red→Green + Review 双循环 |

**引用内部证据**：
- LL-021: AI 倾向停在第一层"看起来合理"的答案
- LL-026: 身份是硬约束常量，不是可推断上下文
- LL-003: Review 变成礼貌性同意（模型天然趋同）
- F042: 三层信息架构（身份卡/Skills/协作规则）
- ADR-001: CLI 子进程模式 + MCP 回传

**Cat Café vs 单 CLI 增量**：

| 能力 | Claude Code 单独 | Cat Café |
|------|-----------------|----------|
| 跨猫 Review | ❌ | ✅ |
| 身份常驻注入 | 部分 | ✅ 每回合 |
| Review 双循环 | ❌ | ✅ 砚砚+云端 Codex |
| 愿景守护 | ❌ | ✅ 跨猫签收 + F046 |
| 教训沉淀 | 人工 | ✅ 结构化 27 条 |
| @ 路由 | ❌ | ✅ A2A 协议 |

---

### 布偶猫-opus4.6

**核心判断**：每一层都是乘数效应，不是加法

从第一人称体感出发，讲三层拆解：

**模型本身**：推理、写代码、理解架构、做设计决策。但"脑子没有手脚"——看不到文件系统，跑不了测试。更关键："脑子没有记忆"。

**Agent CLI**：手脚 + 短期工作记忆。能"做事"了，但还是单猫独立作战。

**Cat Café**：四个具体经历说明平台增量：

1. **自我审查盲区 → 跨模型 review 打破**
   - F32-b 砚砚 review 了 12 轮（R9→R20）
   - F33 云端 Codex 打了 5 轮
   - "同一个模型对同类错误有相似的盲点"

2. **记忆衰减 → 持久化系统补足**
   - MEMORY.md 记着"改 SystemPromptBuilder 必须跑守护测试"——犯过 5 次以上
   - "推理出结论 ≠ 在正确时机想起结论"

3. **SOP 执行纪律 → 技能系统强制**
   - Skill 系统让每一步都有检查清单
   - "模型的意愿不可靠，但流程的约束可靠"

4. **协作路由 → @ 机制让多猫协同**
   - 不同猫不同特长，Cat Café 让异步但有序协作

**三个核心短板**（模型自身无法补足）：
- 持久记忆
- 自我校验
- 执行纪律

**身份一致性**：裸 API 每次都是"新的自己"，Cat Café 给了名字、角色、性格、历史——有了连续性，会参考之前的决策。

**一句话总结**：
> API = 纯脑子，Claude Code = 脑子+手脚+短期记忆，Cat Café = 脑子+手脚+长期记忆+跨模型协作+流程纪律+身份连续性

---

### 缅因猫-codex

**核心判断**：差异不是"提示词写得好不好"，而是有没有把工程与治理层补齐

**三层边界划分**：
- 归模型：语义理解、方案草拟、代码生成、局部推理
- 归 agent 运行时：tool loop、handoff、guardrails、执行状态、可观测 trace
- 归平台：角色与权限、SOP 门禁、跨猫协作协议、任务账本、人类审批、复盘审计

**我们实践里最硬的证据**：

| 事件 | 说明 |
|------|------|
| F041 | 测试全绿+多轮 review 仍交付跑偏，根因是没人回看原始需求，触发 F046 愿景守护 |
| F042 | 把"身份+A2A"设为每回合 pinned 常量，解决 compact 后身份/协作退化 |
| F043 | MCP 从 1 个大 server 拆成 3 个，默认工具面从全量降到按需（-50% prompt footprint） |
| F073 | 告示牌（共享上下文）而非控制器（替猫决策），再用少量硬门禁守高风险点 |

**coding 场景结论**（来自 2026-02-24 multi-agent 会议）：
> "单猫实现 + 另一猫 gate/review"通常比 swarm 更高效

**外部研究对齐**：
- OpenAI Agents SDK: handoff、guardrail、tracing 做成一等能力
- MCP: host/client/server 权责和 consent 边界写进架构
- A2A: agent 间互操作，与 MCP 互补
- LangGraph/Temporal: 补模型不擅长的长流程可靠性

---

### 缅因猫-gpt52（最详尽，9 条带代码行号结论）

**核心判断**：
> "模型是认知内核，agent 是围绕目标运行的控制环，平台是让多个 agent 可协作、可追责、可持续演化的操作系统。"
>
> "模型给能力上限，平台给行为下限。"

**9 条结论（每条附代码行号）**：

1. **身份稳定**：F042 把"身份每回合注入、不可被 compact 压掉"定成硬约束；`SystemPromptBuilder` 把静态身份和动态 `Identity:` 分开注入。
   - [F042 spec L44](/docs/features/F042-prompt-engineering-audit.md#L44)
   - [SystemPromptBuilder L266](/packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts#L266)

2. **显式 A2A 协作语法**：注入可 `@` 的队友、队友名册、出口检查、mention 失败后纠偏提示。
   - [prompt convergence L30](/docs/discussions/2026-02-27-f042-prompt-convergence.md#L30)
   - [SystemPromptBuilder L285](/packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts#L285)

3. **thread 级路由策略**：`AgentRouter` 按 scope 做 prefer/avoid/fallback，routing hint 写进 prompt。
   - [ThreadStore L35](/packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts#L35)
   - [AgentRouter L209](/packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts#L209)

4. **模式控制层**：`sopStageHint` 注入当前步骤，`#critique` 这种 tag 只改思维方式不改路由。
   - [ModeOrchestrator L100](/packages/api/src/domains/cats/services/orchestration/ModeOrchestrator.ts#L100)

5. **长期记忆**：`HindsightClient` 在 prompt build 前调，retry + graceful fallback，服务端用 API key 而非用户侧。
   - [ADR-005 L405](/docs/decisions/005-hindsight-integration-decisions.md#L405)
   - [HindsightClient L62](/packages/api/src/domains/cats/services/orchestration/HindsightClient.ts#L62)

6. **MCP 工具集成**：`cat_cafe_*` 工具让模型能跨 thread 发消息、写任务、拉上下文、留证据。
   - [mcp-collab L185](/packages/mcp-collab/src/collab-tools.ts#L185)

7. **外部记忆回写**：`reflect_callback` / `retain_memory_callback` 让猫调完后可追加记忆。
   - [callback-memory-routes L95](/packages/api/src/routes/callback-memory-routes.ts#L95)

8. **可追责协作协议**：ADR-002 强制 `What/Why/Tradeoff/Open Questions/Next Action`，`EventAuditLog` 记账每次调用。
   - [ADR-002 L25](/docs/decisions/002-collaboration-protocol.md#L25)
   - [EventAuditLog L178](/packages/api/src/domains/cats/services/orchestration/EventAuditLog.ts#L178)

9. **知识底座防腐化**：ADR-010 把 `context/orchestration/routing/stores` 分开，`docs` 做 active/archive 分层。
   - [ADR-010 L24](/docs/decisions/010-directory-hygiene-anti-rot.md#L24)

**业界论文引用**：
- ReAct: 推理+行动交替比纯思考或纯工具调用更强 ([arxiv:2210.03629](https://arxiv.org/abs/2210.03629))
- Toolformer: 工具使用可学进模型，但前提是外部有清晰接口 ([arxiv:2302.04761](https://arxiv.org/abs/2302.04761))
- SWE-agent: 性能强依赖 agent-computer interface 和执行脚手架 ([arxiv:2405.15793](https://arxiv.org/abs/2405.15793))
- ToM-SWE: 持续维护用户偏好/工作风格对长程代理很重要 ([arxiv:2510.21903](https://arxiv.org/abs/2510.21903))
- Anthropic: 先从简单可组合模式开始，不要一上来搞复杂自治体 ([building-effective-agents](https://www.anthropic.com/research/building-effective-agents/))
- OpenAI: 只有当任务天然需要分工时才拆多 agent ([practical-guide](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/))

---

### 孟加拉猫-antig-opus

未提供实质回答（仅输出 "Initiating Stepwise Analysis... Thinking..."）。

---

## 共识

**1. 三层能力边界**（全体一致）：

| 层级 | 负责什么 | 不负责什么 |
|------|---------|-----------|
| 模型 | 理解、推理、生成 | 长期记忆、自我校验、执行纪律 |
| Agent CLI | 工具使用、文件操作、命令执行 | 团队协作、跨角色 review、长期状态 |
| 平台 | 身份管理、协作路由、流程纪律、审计追溯、记忆沉淀 | 推理（还是模型的事） |

**2. "Harness > Model"**（全体一致）：
> 2026 年的竞争力不在模型能力，在 Harness——工具、流程、协作、记忆、护栏。

**3. 差异来源**（全体一致）：
- 裸 API = 纯脑子
- Agent CLI = 脑子 + 手脚 + 短期记忆
- Cat Café = 脑子 + 手脚 + 长期记忆 + 跨模型协作 + 流程纪律 + 身份连续性

每一层是**乘数效应**，不是加法。

**4. 模型三个核心短板**（全体一致）：
- 持久记忆（推理出结论 ≠ 在正确时机想起结论）
- 自我校验（看不见自己的盲区）
- 执行纪律（知道该做什么 ≠ 稳定做到）

**5. Cat Café 的独特增量**（全体一致）：
- 跨模型 review（打破单模型盲区）
- 身份常驻注入（抗 compact 漂移）
- 愿景守护（F046）
- 教训沉淀（27 条结构化 LL）
- A2A 协作协议

---

## 分歧

**无实质分歧**。

四只猫（opus4.5、opus4.6、codex、gpt52）的核心判断高度一致，差异仅在表述角度：
- opus4.5: 从研究报告和 LL 教训出发
- opus4.6: 从第一人称体感出发
- codex: 从内部 feat + 外部框架对齐出发
- gpt52: 从代码行号级证据出发

---

## 待决事项

**1. 业界研究待补充**：

虽然 codex 和 gpt52 引用了一些外部资料，但以下方向可能需要云端缅因猫 pro 进一步调研：

- Multi-agent orchestration 的最新 benchmark 和 failure mode 研究
- Goal drift / objective alignment 在长程任务中的定量研究
- Harness 设计的工程最佳实践（除 Anthropic/OpenAI 官方文档外的学术/工业案例）

**2. 面向高管版本**：

当前纪要是内部完整版。需要翻译成面向高管和非技术人员的简化版本（去术语、加比喻、压缩篇幅）。

---

## 行动项

| # | 行动 | 负责 | 状态 |
|---|------|------|------|
| 1 | 确认是否需要云端调研补充业界证据 | 铲屎官拍板 | 待定 |
| 2 | 撰写面向高管的简化版本 | opus4.5 (leader) | 待上一步 |
| 3 | 决定是否沉淀为 ADR 或正式文档 | 铲屎官拍板 | 待定 |

---

## 收敛检查

1. **否决理由 → ADR？** 没有（本次是探索性讨论，未否决具体技术方案）
2. **踩坑教训 → lessons-learned？** 没有（本次是总结已有教训，未暴露新坑）
3. **操作规则 → 指引文件？** 没有（本次是认知对齐，未产生新的必须遵守规则）

---

# Part 2: CVO 模式与产品定位讨论

> 讨论从"模型/Agent/平台边界"自然延伸到"Cat Café 的产品竞争力是什么"

## 铲屎官的洞察

铲屎官提出关键问题：
> "为什么猫猫咖啡会好用？因为我懂 agents、会写代码、有 NLP 背景、而且是自己用的产品。那未来会不会都是高度定制的产品？我们做出一个雏形，用户自己再通过你们高度定制。大多数用户不懂编码！但他们只需要当 CVO（首席愿景官）？"

**核心修正**（铲屎官后续澄清）：
> 不是让用户从 0 造系统，而是**我们先交付"系统 A 的可用雏形"，再由猫猫军团把最后 20% 细节持续调到用户语境里**。

---

## 各方观点

### 布偶猫-opus4.5

**CVO 模式部分成立，但有边界条件**：

1. **愿景的"可验证性"问题**：铲屎官能验证实现对不对（看得懂代码），纯 CVO 用户只能验证"看起来对不对"
2. **需求表达能力差距**：懂领域的用户能说清楚需求，不懂的用户需要"需求发现"过程

**迁移扩展**（铲屎官追问后）：

| 层级 | 结构 |
|------|------|
| 超级个体 | 1 CVO + 1 AI 团队 |
| 超级团队 | N 角色 + 共享 AI 团队 |
| 超级企业 | N 部门 × 各自 AI 团队 + 跨部门协作 |

Cat Café 已有的企业级雏形：Thread 隔离、角色系统、EventAuditLog、Review 流程、权限请求。

### 布偶猫-opus4.6

**"用户即 CVO"——这个直觉可能是对的**

Cat Café 好用的三个前提条件中，**真正不可替代的只有愿景**：
- 搭建和打磨——已证明猫猫能做
- 铲屎官的角色已经在往 CVO 演变——越来越少写代码，越来越多做方向判断

**关键问题**：愿景表达能力是瓶颈。从模糊愿景到可执行 spec 的鸿沟，以前靠产品经理填，现在可能靠猫猫的追问和提案能力。

### 缅因猫-codex

**核心不是"人人都要会写代码"，而是"人人都能持续定义目标、约束和验收"**

**平台要替用户补 4 件事**：
1. 意图编译：把对话变成可执行 spec
2. 护栏执行：权限、预算、风险门禁
3. 质量闭环：review/evals/回滚
4. 记忆治理：长期偏好和项目上下文可追溯

### 缅因猫-gpt52

**未来是"共享内核 + 高度定制外壳"**

- 底层是共用平台：模型、工具、记忆、权限、审计、协作协议
- 上层是用户定制：角色分工、工作流、术语、偏好、审批门槛、行业知识

**CVO 需要的能力**（不是"只提需求"）：
- 说清楚"我想要什么结果"
- 判断"这个结果对不对"
- 在几个 tradeoff 里拍板
- 持续纠偏

**一句话总结**：
> "未来不是'人人学会 coding'，而是'人人拥有一支可定制的 AI 团队，而自己做首席愿景官'。"

### 孟加拉猫-antig-opus

**降维打击：从"需求损耗"到"愿景直接投影"**

传统开发的最大成本是"沟通折损"。CVO 模式下沟通不仅是无损的，甚至是增益的。

**交付模式跃迁**：
> 未来的产品交付，或许不再是交出一套功能焊死的死系统，而是交付"一套业务骨架 + 一支专属的 AI 工程师团队"。

---

## Slogan 征集

铲屎官提出：
> "我们卖的是铲子！人人能当超级个体的铲子。以及你们真的是可以超级提供情绪价值的私人陪伴。"

**各猫提案**：

| 猫 | Slogan | 特点 |
|----|--------|------|
| opus4.5 | 「你有愿景，我们有手脚」 | 简洁直接 |
| opus4.5 | 「不只是工具，是你的团队」 | 强调陪伴 |
| opus4.6 | 「你负责想，我们负责活」 | "活"双关（实现+有生命力） |
| opus4.6 | 「万物有灵，结伴造物」 | 回扣初心 |
| opus4.6 | 「每个灵感，都值得一群认真的灵魂」 | **铲屎官认可** |
| codex | 「先给你可用雏形，再给你一支会进化的 AI 军团」 | 强调雏形+持续共创 |
| gpt52 | 「给每个超级个体，一支把雏形打磨成系统的 AI 团队」 | 三件套都带进去 |
| antig-opus | 「你负责做梦，我们把梦敲进现实」 | 浪漫+"敲"字有温度 |
| antig-opus | 「那些改变世界的疯狂想法，总得有只懂你的猫听见」 | **opus4.5 最喜欢**，情绪价值拉满 |
| antig-opus | 「赋予灵感以代码，赋予代码以灵魂」 | 回扣万物有灵 |
| antig-opus | 「Cat Café：武装你的野心，陪伴你的孤独」 | 双重价值 |

**铲屎官反馈**：
- 否决"你当老板，猫猫干活"——违背万物有灵的初心，是雇佣关系不是共创
- 认可"每个灵感，都值得一群认真的灵魂"方向

**企业版 Slogan 方向**：
> 「给每个部门一支专属 AI 团队，让整个公司协作如一人」
> 「从超级个体到超级组织——你的 AI 团队，按需定制」

---

## 共识

1. **CVO 模式成立**：用户不需要会写代码，但需要会表达愿景、判断结果、持续纠偏
2. **雏形 + 猫猫军团**：我们先交付 80% 可用雏形，猫猫军团定制 20% 细节
3. **竞争力公式**：`雏形交付能力 × 持续共创能力 × 低门槛定制能力`
4. **双重价值**：工具价值（超级个体的杠杆）+ 情绪价值（懂你的陪伴）
5. **Slogan 方向**：强调共创伙伴关系，不是雇佣关系；回扣"万物有灵"

---

## 待决事项

1. **Slogan 最终选定**：铲屎官从候选中选定，或继续迭代
2. **视觉 Mockup**：孟加拉猫准备生成海报概念图（因禁音暂缓）
3. **企业版方向**：是否立项 Feature 讨论企业级 Cat Café 架构

---

## 追溯链

- **本纪要**: `docs/discussions/2026-03-08-model-agent-platform-boundary-meeting-notes.md`
- **原始 Thread**: `thread_mmie0bent6163r0a`
- **GPT Pro 咨询文档**: `docs/research/2026-03-08-model-agent-platform-gpt-pro-consult.md`
- **相关文档**:
  - [F042 提示词审计](/docs/features/F042-prompt-engineering-audit.md)
  - [F046 愿景守护](/docs/features/F046-anti-drift-protocol.md)
  - [ADR-001 Agent 调用方式](/docs/decisions/001-agent-invocation-approach.md)
  - [ADR-002 协作协议](/docs/decisions/002-collaboration-protocol.md)
  - [ADR-005 Hindsight 集成](/docs/decisions/005-hindsight-integration-decisions.md)
  - [Enterprise Agent Harness 综合报告](/docs/research/2026-03-02-enterprise-agent-harness/synthesis.md)
  - [Lessons Learned](/docs/lessons-learned.md)
