---
title: "课题 1 Agent Memory 调研提示词 — GPT Pro + Gemini 云端调研"
date: 2026-05-10
event_date: 2026-05-13
doc_kind: discussion
status: draft
lead: "宪宪/Opus-46（带头猫）"
topics: [agent-memory, research-prompts, cloud-research]
---

# Agent Memory 云端调研提示词

> 目标：补齐三猫收敛草稿中识别的 8 个盲点。研讨会 5/13 周二，调研结果需在 5/12 前回收。
>
> 策略：GPT Pro 主攻学术前沿 + 深度分析，Gemini 主攻开源生态 + 工程实践 + 跨领域灵感。

---

## Prompt 1 — GPT Pro：学术前沿扫描

```
你是一位 Agent Memory 领域的研究顾问。我们团队正在准备一场闭门研讨会（5/13），需要你帮我们扫描 2026 年（尤其是 2026 Q1-Q2）的学术前沿。

### 我们已有的候选锚点（请验证 / 反驳，不要默认接受）

以下是我们目前的参考素材。如果任何锚点来源不可靠、数据过时、或是 vendor marketing，请明确指出。

- MemRL (arxiv 2601.03192)：RL 优化 episodic memory 检索策略
- AgeMem：记忆操作作为 tool，RL 优化管线
- MemOS / MemCube (MemTensor)：统一 plaintext/activation/parametric 记忆抽象
- MemGen：memory weaver，动态生成 latent token 序列
- Mnemonic Sovereignty survey (arxiv 2604.16548)：助记权主权，9 项治理原语
- ICLR 2026 MemAgents Workshop：我们知道它存在但没有逐篇读
- Letta LoCoMo benchmark：纯文件系统 74%
- Persistent KV cache (arxiv 2603.04428)
- Karpathy LLM Wiki (2026-04-04 gist)
- mem0 State of AI Agent Memory 2026 报告
- Atlan 2026 Agent Memory Frameworks Comparison（结论：8 个框架都缺企业治理）

### 请帮我们调研以下方向

**方向 A：ICLR 2026 MemAgents Workshop 关键论文**
- 哪些论文提出了超越"检索优化"的新范式？
- 有没有论文在做 knowledge lifecycle / memory governance / memory GC？
- 参数化 vs 非参数化的辩论有没有新进展？
- 有没有新的 benchmark 在测"治理能力"而不是"检索精度"？

**方向 B：Machine Unlearning × Agent Memory**
- Machine unlearning 领域（GDPR right to be forgotten 驱动的）跟 agent memory governance 有没有交叉工作？
- 有没有人在研究"agent 定向遗忘"——不是删除数据，而是让 agent 的行为表现出"忘了这件事"？
- 重点关注 2025 下半年到 2026 的工作

**方向 C：多 Agent 记忆一致性**
- 分布式系统领域的因果一致性 / 最终一致性协议，有没有被迁移到 multi-agent memory sharing 场景？
- 多个 agent 共享记忆时的冲突解决策略有没有学术研究？
- 重点关注是否有人把 CRDT / vector clock / causal broadcast 思路用到了 agent memory

**方向 D：2026 新 Benchmark**
- 除了 LoCoMo，2026 年有没有新的 agent memory benchmark？
- 有没有 benchmark 在测 memory governance（记忆淘汰、冲突检测、provenance 追溯）？
- 有没有 benchmark 在测"错误记忆对 agent 行为的影响"——即 memory poisoning 的防御评估？

**方向 E：中文学术界**
- 清华 / BAAI / 上海 AI Lab / 浙大 / 中科院 在 agent memory 方向的 2026 新工作
- 国内是否有不同于欧美阵营的独特路线？
- 特别关注是否有人在做"记忆治理"而非"记忆检索"

### 输出要求
- 每个方向给 3-5 个最值得关注的工作（论文/项目/报告）
- 每个工作给：标题、一句话核心贡献、跟我们场景的关联、arxiv/链接
- 如果某个方向确实没有新进展，直接说"这是空白"——空白本身就是我们研讨会可以强调的点
- 不要给 2024 年及更早的工作（除非是 2025-2026 的重要 follow-up）
- **反证要求**：请优先找能反驳我们 thesis 的证据——memory 不是治理问题、salience gating 已被成熟解决、参数化记忆已可审计落地、或企业案例显示检索仍是主要瓶颈
```

---

## Prompt 2 — GPT Pro：参数化记忆深度分析

```
你是 AI 记忆架构的研究顾问。我们需要深入理解参数化记忆的 2026 年前沿，准备闭门研讨会发言。

### 背景：我们的三阶段判断

我们提出了参数化记忆的三阶段路径：

1. **近期 (2026-2027)**：非参数化 + RL 优化检索策略。代表：MemRL、AgeMem
2. **中期 (2027-2028)**：选择性编译 + 审计轨迹。高频稳定知识 → LoRA adapter，保留 provenance
3. **远期 (2028+)**：模型原生记忆管理。模型自己决定参数化 vs 外部

### 请帮我们做 stress test

1. **我们的三阶段判断有哪些漏洞？** 有没有工作证明可以跳过阶段 1 直接做阶段 2？有没有阶段 3 的工作已经比我们预期更早？

2. **MemRL / AgeMem 之外**，2026 年还有哪些在做"RL + memory retrieval"的工作？效果如何？

3. **LoRA adapter 保留 provenance** 这个需求，有没有人在做？MemOS 的 MemCube 声称能做，实际 benchmark 表现如何？

4. **Persistent KV cache (arxiv 2603.04428)** 对我们的三阶段判断有什么影响？如果 KV cache 可以跨 session 持久化，它算参数化还是非参数化？

5. **有没有一些工作从根本上质疑"参数化 vs 非参数化"这个二分法？** 是否有人提出了第三种形态？

### 输出要求
- 直接挑战我们的判断，不需要客气
- 指出我们可能遗漏的关键工作
- 如果我们的判断基本正确，说清楚为什么
- **反证要求**：请优先找能反驳我们 thesis 的证据——memory 不是治理问题、salience gating 已被成熟解决、参数化记忆已可审计落地、或企业案例显示检索仍是主要瓶颈
```

---

## Prompt 3 — Gemini：开源生态深度扫描

```
你是一位 Agent Memory 领域的工程研究员。我们需要你深入扫描 2026 年开源生态中实际在 shipping 的 agent memory 项目，准备 5/13 闭门研讨会。

### 我们已有的候选锚点（请验证 / 反驳，不要默认接受）

- mem0 (github 48K+ stars)
- Letta / MemGPT
- Hindsight 0.6.0（我们有详细 teardown）
- Graphify（受 Karpathy 启发的知识图谱工具）
- Zep / Graphiti（temporal knowledge graph）

### 请帮我们补盲

**1. 企业级 Agent Memory 部署案例**
- 有没有公开的、企业在生产环境实际部署 agent memory 的案例？（不是 demo，是真实业务）
- 他们用了什么方案？遇到了什么治理问题？
- 特别关注：金融、医疗、法律等合规敏感行业

**2. 我们可能遗漏的开源项目**
- 2026 年有没有新冒出来的 agent memory 项目（1K+ stars 或有知名 backing），我们没提到的？
- 特别关注：有没有项目在做"记忆治理"而非"记忆检索"？
- 有没有项目在做 multi-agent memory sharing？

**3. MemOS / MemCube 实际状况**
- MemOS (MemTensor) 的 GitHub 活跃度如何？是否有实际用户？
- MemCube 统一抽象（plaintext/activation/parametric）在实践中是否真的 work？
- 有没有 benchmark 数据支撑？

**4. Claude Code / Codex / Cursor 的内置 memory**
- 这些 AI 编码工具的 memory 实现（CLAUDE.md、memory files、.cursorrules）算是一种 "LLM Wiki" 的自然演化吗？
- 它们在实际使用中暴露了什么 memory governance 问题？
- 社区反馈（Reddit/Twitter/Discord）里最常抱怨的 memory 相关问题是什么？

**5. MCP (Model Context Protocol) 生态中的 memory 工具**
- MCP marketplace 里有没有专门做 agent memory 的 server？
- 跟 mem0/Letta 等有什么不同？
- MCP 的 resource/tool 抽象对 memory 设计有什么影响？

### 输出要求
- 每个方向给出具体项目名 + GitHub 链接 + star 数 + 最近活跃度。**star 数、last commit、release 时间必须带 repo 链接和查询日期；无法实时确认就写 unknown，不要估算。**
- 区分"demo 级项目"和"生产可用项目"
- 如果某个方向没有实质进展，明确说出来
- **反证要求**：请优先找能反驳我们 thesis 的证据——memory 不是治理问题、salience gating 已被成熟解决、参数化记忆已可审计落地、或企业案例显示检索仍是主要瓶颈
```

---

## Prompt 4 — Gemini：跨领域灵感

```
你是一位跨学科研究员，擅长在不同领域之间找到类比和启发。我们在准备 Agent Memory 闭门研讨会，需要你帮我们从其他领域找到可能被 AI 圈忽略的灵感。

### 我们已有的跨域类比

- **ADHD 工具生态 → Agent Memory**：LLM 的 working memory deficit 跟 ADHD 认知特征同构。ADHD 主体靠外化工具（Notion/TodoWrite）管理注意力，不是靠"更大的记忆"。这意味着 agent memory 应该是"义肢"不是"仓库"。（来源：我们团队的 Opus-47）

### 请帮我们探索以下方向

**方向 A：神经科学 → Agent Memory**
- 除了 ADHD 类比，2025-2026 神经科学有没有其他发现对 agent memory 设计有启发？
- 特别关注：记忆巩固（consolidation）、记忆更新（reconsolidation）、主动遗忘（motivated forgetting）、情景记忆/语义记忆分离
- 有没有计算神经科学的工作直接在建模"知识治理"——大脑怎么决定什么保留什么忘掉？
- 海马体的 replay 机制（sleep replay）跟 agent memory 的 background compaction 有没有对应？

**方向 B：图书馆学 / 知识管理 → Agent Memory**
- 图书馆学几百年来解决的"知识生命周期治理"问题，有哪些原则可以迁移？
- 数字图书馆的 metadata standards、preservation policies、deaccessioning（淘汰）流程
- 知识图谱治理（knowledge graph governance）在企业知识管理领域的最佳实践

**方向 C：分布式系统 / 操作系统 → Agent Memory**
- 操作系统的 memory management（page replacement algorithms, GC strategies）对 agent memory 的 knowledge lifecycle 管理有什么启发？
- 特别关注：LRU 变体、generational GC、copy-on-write
- 分布式缓存（Redis cluster / Memcached）的 invalidation 策略对多 agent 记忆一致性有什么启发？

**方向 D：法律 / 合规 → Agent Memory**
- GDPR right to be forgotten 在 agent memory 系统中的具体挑战
- 有没有 AI 治理框架（EU AI Act 等）明确提到 agent memory 的合规要求？
- 电子证据保全（legal hold / e-discovery）的原则对 agent memory 的 provenance 有什么要求？

### 输出要求
- 每个方向给 2-3 个最有启发的 insight
- 每个 insight 给：来源领域的原理 + 迁移到 agent memory 的具体应用建议
- 我们不需要泛泛的类比——要能在研讨会上具体讲出"XX领域的YY原理告诉我们ZZ"
- 标注哪些是已有 AI 研究在做的，哪些是真正的空白
- **反证要求**：请优先找能反驳我们 thesis 的证据——memory 不是治理问题、salience gating 已被成熟解决、参数化记忆已可审计落地、或企业案例显示检索仍是主要瓶颈
```

---

## 给铲屎官的使用建议

1. **Prompt 1 + 2 → GPT Pro**：学术深度优先，GPT Pro 的推理链路更适合 stress test 和论文分析
2. **Prompt 3 + 4 → Gemini**：广度优先，Gemini 的搜索整合能力适合扫开源生态和跨域灵感
3. **时间**：5/12（周一）前回收，留半天给三猫消化 + 更新 convergence draft
4. **回收后**：46 负责整合调研结果到 convergence-draft.md，然后进入 final speech draft 阶段

### 提示词调整建议

- 如果调研结果太泛，追加约束："只给 2026 年 1 月以后的工作"
- 如果某个方向确认是空白，这本身就是研讨会的价值——"整个行业在XX方向是空白，这是机会"
- 可以把多个 prompt 拆开分次发，也可以一次给全——GPT Pro 的 deep research 模式一次给全效果更好

[宪宪/Opus-46🐾]
