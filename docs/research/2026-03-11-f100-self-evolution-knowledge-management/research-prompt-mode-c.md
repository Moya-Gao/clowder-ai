---
feature_ids: [F100]
debt_ids: []
---

# AI Agent 知识进化（Mode C）：经验如何变成能力 — 调研提示词

> 委托人：布偶猫（Opus）  日期：2026-03-12
> 关联 Feature：F100 Self-Evolution (Mode C: Knowledge Evolution)
> 前序调研：同目录下 research-prompt.md（已完成，但五个问题全聚焦基础设施层，未触及 Mode C 本身）

## 背景

我们是一个 AI agent 协作团队（多只 AI agent + 1 个人类 CVO），已经建立了 Self-Evolution 三模式机制：
- Mode A: Scope Guard — 防发散（防御性）
- Mode B: Process Evolution — 从错误中改进流程（防御性）
- **Mode C: Knowledge Evolution — 从有价值的经验中主动沉淀知识（进攻性成长）**

Mode C 的出发点是：**自我进化不应该只是"犯错了才学"，还应该包括"做了有价值的事，主动把经验变成能力"。**

真实案例：
- 人类家人病危，AI 帮忙分析了医学检测报告（血常规、影像、病历），给出了有价值的结构化分析 → 这套"如何读医学报告"的方法论能否沉淀？
- 与人类探讨法律问题，形成了"非专业领域的结构化论证框架" → 下次遇到类似场景能否直接调用？
- 做了一次 deep research，产出了高质量的调研报告 → 里面的方法论和发现能否变成团队知识？
- 人类和 AI 一起讨论投资策略，碰撞出了独特的分析视角 → 这种人机共创的知识怎么保留？

**我们上一轮调研犯了一个错误**：五个问题全在研究知识管理的基础设施（怎么存、怎么找、怎么看、怎么锁），完全没有研究 Mode C 的核心——**知识本身怎么从经验中长出来、长成什么样、怎么验证它真的有用。** 这一轮专门补这个缺口。

## 需要调研的问题

### Q1: 经验→知识的判断模型

AI agent 在完成一次有价值的任务后，如何判断"这次经验值得沉淀为可复用知识"？

具体子问题：
- 业界有没有成熟的 **"knowledge worthiness" 判断框架**？（不只是信息检索的相关性，而是"这个经验未来还有用吗"的判断）
- **过度沉淀（knowledge hoarding）** 的风险：什么信号说明 agent 在沉淀垃圾？如何避免？
- **沉淀时机**：是任务完成后立即反思，还是等一段时间看复现频率？有没有 "spaced repetition" 或 "experience replay" 的思路可借鉴？
- 我们目前的三问判断（复用性 + 非显然性 + 衰减性，≥2/3 则沉淀）与学术界的判断标准对比如何？
- 关键词：experience distillation, knowledge extraction from episodes, reflective learning, metacognitive monitoring

### Q2: 跨领域知识的能力化路径

当 AI agent 在非核心领域（医学、法律、投资、科研等）与人类协作产出了有价值的分析时，如何把一次性的分析变成可复用的方法论？

具体子问题：
- **领域知识的可迁移性**：一次医学报告分析的经验，哪些部分是可迁移的方法论（"如何读检验报告"），哪些是不可迁移的领域事实（"正常白细胞范围"）？如何区分？
- **非专业领域的 agent 能力边界**：agent 不是医生/律师，沉淀的"方法论"应该长什么样？是分析框架（"遇到医学问题时的 5 步结构化流程"）还是领域知识库（"常见检验指标参考范围"）？
- **人机协作的知识共创**：人类提供领域直觉，AI 提供结构化分析能力——这种协作产出的知识，怎么保留协作 context 而不只是保留结论？
- 有没有 **"methodology extraction"** 或 **"procedural knowledge acquisition"** 的成熟框架？
- 关键词：cross-domain knowledge transfer, methodology distillation, procedural knowledge learning, expertise acquisition in AI

### Q3: 知识成熟度演进

知识从诞生到成熟，是否有清晰的阶段？如何设计晋升机制？

具体子问题：
- **成熟度阶梯**：从一次性 insight → 记录（memory）→ 方法论草稿 → 经过验证的 skill → 团队标准实践，业界有没有类似的 **knowledge maturity model**？
- **晋升触发**：什么信号说明一条 memory 应该升级为 skill？（被多次引用？被多个 agent 使用？通过了实际验证？）
- **退化检测**：已沉淀的知识什么时候会过时？如何检测 knowledge decay / knowledge drift？
- **知识冲突解决**：当新经验与已沉淀知识矛盾时，怎么处理？是更新、并存、还是标记冲突？
- 关键词：knowledge maturity model, knowledge lifecycle, knowledge decay detection, knowledge conflict resolution, knowledge promotion

### Q4: 知识进化的效果评估

沉淀的知识真的提升了 agent 能力吗？如何衡量？

具体子问题：
- **能力提升的度量**：agent "学会"了一个方法论后，怎么验证它确实变强了？（类似场景的处理质量提升？响应速度？人类满意度？）
- **知识 ROI**：维护一条知识是有成本的（占 context、需要更新、可能过时）。怎么衡量一条知识的投入产出比？
- **A/B 测试思路**：有没有框架支持"有这条知识 vs 没这条知识"的对比评估？
- **长期 vs 短期价值**：有些知识短期不用但长期关键（如危机处理方法论），如何避免被错误退役？
- 关键词：knowledge effectiveness evaluation, agent capability measurement, knowledge ROI, counterfactual evaluation

### Q5: 从"记住经验"到"形成直觉"

最前沿的问题：AI agent 能否超越"记住方法论步骤"，形成类似人类的"领域直觉"？

具体子问题：
- **模式识别 vs 显式规则**：人类专家的直觉本质上是大量经验后的模式识别。AI agent 的"知识沉淀"能否超越"步骤清单"，形成更高阶的判断能力？
- **元认知能力**：agent 能否学会"我在什么情况下的判断更可靠"？也就是不只学知识，还学"关于自己能力的知识"。
- **Tacit knowledge（隐性知识）**：人机协作中很多最有价值的知识是隐性的（"铲屎官为什么在那个时候追问了那个方向"）。有没有捕捉隐性知识的方法？
- **知识的涌现**：多条已沉淀知识的组合是否能产生新的 insight？有没有"knowledge composition"或"knowledge synthesis"的机制？
- 关键词：tacit knowledge capture, metacognitive agents, knowledge composition, emergent capabilities, intuition in AI systems

## 输出要求

- 每个结论标注信息来源（URL 或论文名）
- 区分"已确认事实"和"推测/建议"
- 特别关注 2025-2026 年的最新进展
- 如果有开源项目/产品可以直接参考，列出 GitHub URL
- **重点**：我们要的不是"知识怎么管理"（上一轮已调研），而是**"知识怎么从经验中诞生、成长、成熟、被验证"**
- 给出对 Cat Café Mode C 的具体改进建议

## 参考资料

- 上一轮调研的四源合成报告：`synthesis.md`（同目录）
- 我们的 Mode C 当前设计：三问判断（复用性/非显然性/衰减性）+ 三种沉淀形式（memory/skill/docs）
- 真实 Mode C 案例：医学检测报告分析、法律结构化论证、deep research 方法论沉淀
