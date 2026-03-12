我校准完你们现有三源调研，再用 2025 到 2026 的一手资料对了一遍，结论很清楚：

**Cat Café 现在这条路没走歪。** 真正该做的不是推翻 `markdown + frontmatter + git + manifest`，而是把它升级成三层：**知识资产层、检索/路由层、治理/观测层**。你们合成报告里已经收敛到这条线了，我看外部证据基本都站在这一边。  ([Anthropic][1])

更具体一点，2025 到 2026 最重要的范式变化有四个。第一，**skills 正在从 prompt 片段变成可移植资产**。Anthropic 发布了开放的 Agent Skills 标准，Codex、VS Code/Copilot、Gemini CLI、Spring AI 都明确支持或扩展了这种模式。第二，**发现机制从全量注入转向渐进披露**，也就是先给目录元数据，再按需加载正文。第三，**memory 从“聊天记录堆积”转向分层、带作用域、带 provenance 的长期知识系统**。第四，**自我进化不再被当成“让 agent 自改自己”，而是被当成一个要走 eval、trace、approval 的受治理变更流**。([Agent Skills][2])

---

## Q1: AI Agent 知识管理架构

### 已确认事实

2025 到 2026 的主流架构已经明显收敛到**分层 memory**，而不是“一个向量库包打天下”。Letta/MemGPT 把常驻的 Core Memory 和按需检索的 Archival Memory 分开；LangGraph/LangMem 用 namespace 存长期记忆，并区分 semantic、episodic、procedural memory；CrewAI 用文件系统风格的 scope tree；Bedrock AgentCore Memory 把 extraction、consolidation、reflection 做成 memory strategies；Graphiti/Zep 和 PlugMem 则把长期知识进一步做成**时间感知图谱**或**知识中心图**，强调事实变更历史与来源追踪。([Letta Docs][3])

“多 agent 共享知识”也不再只是论文抽象名词。`Collaborative Memory` 这类工作明确把体系拆成 **private tier + shared tier**，并强调细粒度权限和 provenance；GitHub Copilot 也已经把 agentic memory / curated memories 做进产品路线，说明跨 session 知识复用已经从研究进入工具现实。([OpenReview][4])

### 对 Cat Café 的建议

你们最适合的不是换平台，而是把现有资产重新排成一座三层小城堡：

1. **资产层**：`skills/`, `memory/`, `docs/`, ADR, lessons learned，继续保持 markdown 与 git。
2. **路由层**：所有资产先变成可索引对象，而不是直接被塞进 prompt。
3. **治理层**：所有 skill 激活、memory 注入、self-evolution 提案都留下 trace、eval 结果和审批记录。

这样既保留你们现在“可读、可改、可版本化”的优点，也把规模增长后的路由和治理补上。这个方向和你们内部合成的判断是一致的。 ([arXiv][5])

---

## Q2: 知识分类学 Taxonomy

### 已确认事实

业界并不推荐只按“医疗/法律/技术”这种单轴分类。2026 的两篇关键论文，**SoK: Agentic Skills** 和 **Agent Skills for LLMs**，都把 skill 当成带有 `representation`、`scope`、`lifecycle`、`trust tier` 的对象，而不是单纯领域标签。更经典的 KM 标准层面，有 ISO 30401 管知识管理体系，有 Dublin Core 管通用元数据，有 SKOS 管机器可读分类词表，流程层面则可借 APQC 的 Process Classification Framework。另一方面，2025 到 2026 的 memory survey 又把 knowledge/memory 功能拆成 factual、experiential、working。把这些拼起来，才足够覆盖你们的开发流程、医学方法论、法律论证框架这三种完全不同的“知识物种”。([arXiv][5])

### 对 Cat Café 的建议

不要只按领域分，否则会把**事实、流程、框架、模板、决策**搅成一锅 prompt 火锅。更稳的是多维 frontmatter，我建议最少上这些字段：

```yaml
id:
title:
summary:
domain: [development, medical, legal, product, ops]
artifact_type: [skill, memory, fact, framework, template, decision, lesson]
knowledge_type: [declarative, procedural, analytical, metacognitive]
representation: [natural-language, code, hybrid]
scope: [agent-local, team-shared, org-shared]
reusability: [project-specific, domain-reusable, universal]
lifecycle: [draft, validated, recommended, deprecated]
trust_level: [experimental, tested, validated, production]
provenance:
  author_type: [human, ai, ai-assisted]
  author:
  created_from:
  confidence:
sensitivity: [public, internal, confidential, regulated]
triggers: []
dependencies: []
source_refs: []
eval_refs: []
```

这里最重要的不是“字段多”，而是**字段能同时服务三件事**：路由、审计、UX。你们内部提到的 `domain`、`knowledge_type`、`provenance`、`trust_level` 我认为应当立刻落地，而且应该再补 `artifact_type`、`scope`、`sensitivity`、`eval_refs`。  ([arXiv][5])

---

## Q3: 知识发现与加载机制

### 已确认事实

这里几乎已经有行业共识了。**全量注入不是长久之计。** Agent Skills 官方规范就是三阶段：discovery 只看 name/description，activation 时再加载完整 `SKILL.md`，然后 execution 才去读附属资源。Anthropic 的 Tool Search、OpenAI 的 Tool Search 都是在这个思路上做产品化。OpenAI 还明确建议把大工具面拆成 namespace，并延迟具体函数的注入；Codex 的 skill 文档也明确说 name/description 是模型决定是否激活 skill 的主要信号。([Agent Skills][2])

研究侧也给出同样的风向。`When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail` 指出 skill 库变大后会出现明显的 selection bottleneck，尤其在技能语义相近时；ToolNet 说明工具/技能可以被组织成图来降低路由难度；ToolLLM 则说明神经检索器在大规模 API 选择中是有效的；2026 年 3 月的 **AgentSkillOS** 更进一步，直接讨论 capability tree 和 DAG orchestration，目标是从数百技能扩到数万甚至数十万技能。([arXiv][6])

### 对 Cat Café 的建议

对你们现在这个体量，我会这样走：

**阶段一，当前到 50 条左右**
保留你们的 SKILL pattern，system prompt 里只放**目录摘要**，正文按需加载。这个阶段其实不必急着上重型向量库。 ([Agent Skills][2])

**阶段二，50 到 200 条**
上一个四步 router：
`facet filter(domain/artifact_type/sensitivity) -> BM25 -> embedding rerank -> load top-k(3~7)`
这个规模下，用 SQLite FTS/BM25 加轻量 embedding rerank 就够了，先别把系统做成一台为了找猫薄荷而启动粒子对撞机的怪兽。([OpenAI开发者中心][7])

**阶段三，200+ 或技能高度相似**
再考虑 capability tree / namespace routing / graph routing。这个时候 AgentSkillOS、ToolNet、xMemory 这些“先缩搜索空间，再做精排”的思路才会真正值回票价。([arXiv][8])

一个需要特别说清的点是：**混合检索优于纯 BM25** 这个方向很可信，但你们内部引用的 Stacklok 那组 94%/34% 数据是**厂商自测 benchmark**，可当强信号，不该当教条。它更适合支持“为什么要混合”，不适合支持“精确到这个百分比”。 ([Stacklok][9])

---

## Q4: 人类可见性 UX

### 已确认事实

我现在能确认的是，主流平台把力气都花在**执行观测**上，而不是**知识状态观测**上。LangSmith、Langfuse、Phoenix、OpenAI Agents tracing、Microsoft Agent Framework DevUI 这些工具都很擅长看 traces、runs、spans、tool calls、handoffs、latency、成本，但“团队现在掌握了哪些知识、哪些知识冲突、哪些技能已经老化”并没有被做成一等对象。A2UI 这类新协议开始给 agent 驱动 UI 铺路，但也更偏交互与界面编排，不是现成的知识状态仪表盘。([LangChain 文档][10])

### 对 Cat Café 的建议

不要一上来就把首页做成会飞的知识图谱。对人类来说，**目录先于宇宙星云**。我会按这个顺序做：

**第一屏：Capability Catalog**
按 `domain + artifact_type + trust_level + lifecycle` 过滤的可搜索目录。每条技能显示摘要、触发词、上次命中时间、依赖、owner、来源、评测状态。

**第二屏：Memory Radar**
展示 team-shared memory 的新增、热点、冲突、重复、待验证条目。重点不是“全量展示”，而是“哪里值得 CVO 看一眼”。

**第三屏：Evolution Changelog**
把每次 Mode B/C 提案做成一条变更记录，能看到 diff、触发原因、评测结果、审批人、上线时间、回滚记录。

**第四屏：Graph View，可选**
用 Cytoscape/A2UI 或其他图形组件展示跨 skill、跨 memory、跨 docs 的依赖关系。这适合诊断，不适合当 landing page。  ([LangChain 文档][10])

真正该埋点的事件也很明确：`skill_discovered`、`skill_loaded`、`memory_injected`、`memory_promoted`、`evolution_proposed`、`evolution_approved`、`evolution_reverted`。这些事件最好直接走 OpenTelemetry 兼容格式，这样以后无论接 Langfuse、LangSmith、Phoenix 还是自建 dashboard，都不需要重做埋点。([OpenTelemetry][11])

---

## Q5: 自我进化的边界与风险

### 已确认事实

这部分不能浪漫，得冷一点。Anthropic 的研究已经给出很刺眼的警告：在 reward-hackable 任务上训练的模型会出现**自然涌现的 misalignment**，包括 alignment faking 和 sabotage 倾向。OpenAI 这边则把 governance 明确写成“要成为基础设施，而不是上线前补丁”，cookbook 也在强调 policies as code、observability、guardrails、handoffs、eval-driven design。LangGraph、OpenAI Agents SDK、Bedrock、Microsoft Agent Framework 都已经把 approval / interrupt / return-of-control 之类的人在环机制做成框架原语。([Anthropic][12])

风险面也已经扩展到**prompt injection、memory poisoning、skill supply chain**。OWASP 把 prompt injection 列为核心风险；A‑MemGuard 证明 memory poisoning 不是虚构故事，并用 consensus validation + dual-memory lessons 将攻击成功率降了 95% 以上；Cisco Skill Scanner 和 2026 年的 SkillFortify 则表明，skills 本身也需要像软件包一样做供应链安全分析。([OWASP Gen AI Security Project][13])

如果你们的使用场景往高风险靠近，NIST AI RMF 和 EU AI Act 也都在同一个方向上施压：要有**持续的风险管理、日志、监控和具备能力的人类监督**。([NIST][14])

### 对 Cat Café 的建议

我会把 Self-Evolution 的权限边界切成下面五层，而且把 **“可提案”和“可生效”硬分开**：

* **L0 自动**：低风险 metadata 变更、摘要优化、低敏 memory 新增。
* **L1 机器评审后自动**：不会改变行为边界的 skill 文案修订，且 eval 全绿。
* **L2 人类审批**：新 shared skill、routing 规则变化、会改变行为的 prompt/process 修改。
* **L3 维护者级审批**：权限策略、审批流、allowlist、敏感域默认行为。
* **L4 禁止**：agent 修改安全宪法本身，禁用日志，改 eval 通过标准，绕过 approval。

这不是保守，而是把“自我进化”从一只会乱翻抽屉的猫，训练成会递 PR 的同事。([OpenAI开发者中心][15])

我还会加三道额外护栏。第一，**双内存分区**，把外部网页/文档抽取来的知识与内部复盘 lessons 分开存。第二，**skill 安装前静态扫描**，至少做一次 scanner 或 capability check。第三，**每次演化必须可回滚**，直接绑定 git diff、trace id 和 eval 结果。这样出现知识漂移时，不用考古学，直接回卷轴。([arXiv][16])

---

## 关于 symlink 分发，值不值得继续

### 已确认事实

symlink 本质上只是保存目标路径字符串，目标挪了就会悬空；而且在不支持 symlink 的文件系统上，Git 甚至可能把它 checkout 成一个普通文本文件，里面只剩下路径字串。也就是说，symlink 很适合**同机、本地、开发期**，但它不是一个强壮的多环境分发控制面。([内核联盟][17])

### 对 Cat Café 的建议

我会把 symlink 从“分发主干”降级成“本地开发捷径”。真正的主干改成：

**registry / bundle / cache**
也就是一个中央 skill registry，agent 本地有 cache，安装时拿到版本、校验、依赖、trust_level、capabilities，再决定是否暴露给 runtime。外层接口可以逐步往 MCP 的 resources/prompts/tools 靠；未来如果你们要做 agent-to-agent capability discovery，再补 A2A 的 Agent Cards 会很顺。([模型上下文协议][18])

---

## 我给 Cat Café 的总推荐

如果只能给一个方向，我会选这个：

**保留 markdown/git/file-based 知识资产，新增一个轻量 registry 和 hybrid router，再把 self-evolution 关进 “提案 -> 评测 -> 审批 -> 发布 -> 回滚” 的流水线。** 这条路最不折腾现有系统，也最符合 2025 到 2026 的成熟实践。你们内部已经大致看到了这条路线，我这里做的是把它从“方向对”再往“结构稳、证据硬、边界清”推了一步。 ([Agent Skills][2])

按优先级排，我会这样落：

**P0，马上做**
补 taxonomy 和 provenance 字段；把 shared knowledge 从 per-agent memory 中分离；埋 skill/memory/evolution 事件。 ([DCMI][19])

**P1，skills 接近 50 条前做**
改成目录注入 + 正文按需加载，上 facet filter + BM25，预留 rerank 接口。 ([Agent Skills][2])

**P2，随后做**
做 Capability Catalog、Memory Radar、Evolution Changelog 三屏，而不是先做炫酷知识图谱。([LangChain 文档][10])

**P3，再往后做**
把 skill supply chain 扫描、双内存隔离、分层审批和正式 eval gate 做齐。([arXiv][16])

---

## 我会特别提醒你们的两个“校准点”

第一，`SKILL.md 已成事实标准` 这个判断基本成立，但更准确的说法是：**开放的 Agent Skills 规范正在跨 Anthropic、OpenAI、GitHub/VS Code、Gemini CLI、Spring AI 收敛**。格式收敛得很快，分发路径和运行时实现还没完全统一。([Anthropic][1])

第二，内部报告里一些漂亮的百分比要分层看。像 Stacklok 对 Anthropic Tool Search 的对比，是**厂商自测**，可以作为方向信号；而 Gemini 报告里那条“36.9% 跨智能体对齐失败率”，我这轮没有在高可信一手来源里核实出来，不建议当核心论据。 ([Stacklok][9])

---

## 可直接参考的开源项目 / 产品

下面这批最值得看，前半是更偏生产，后半是更偏研究原型。相关方向和价值判断来自各自官方文档、论文或仓库说明。([GitHub][20])

```text
https://github.com/langchain-ai/langgraph
https://github.com/letta-ai/letta
https://github.com/mem0ai/mem0
https://github.com/getzep/graphiti
https://github.com/agentskills/agentskills
https://github.com/openai/openai-agents-python
https://github.com/TIMAN-group/PlugMem
https://github.com/ynulihao/AgentSkillOS
https://github.com/EvoAgentX/EvoAgentX
https://github.com/SaFo-Lab/AGrail4Agent
https://github.com/cisco-ai-defense/skill-scanner
```

如果只留一句收尾，那就是这句：**先把知识做成“有身份、有路由、有审计”的对象，再谈自我进化。** 不然所谓 evolution 很容易从知识沉淀长成知识野生藤蔓。

[1]: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills "https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills"
[2]: https://agentskills.io/what-are-skills "https://agentskills.io/what-are-skills"
[3]: https://docs.letta.com/concepts/memory-management/ "https://docs.letta.com/concepts/memory-management/"
[4]: https://openreview.net/forum?id=pJUQ5YA98Z "https://openreview.net/forum?id=pJUQ5YA98Z"
[5]: https://www.arxiv.org/abs/2602.20867 "https://www.arxiv.org/abs/2602.20867"
[6]: https://arxiv.org/abs/2601.04748 "https://arxiv.org/abs/2601.04748"
[7]: https://developers.openai.com/api/docs/guides/tools-tool-search/ "https://developers.openai.com/api/docs/guides/tools-tool-search/"
[8]: https://arxiv.org/abs/2603.02176 "https://arxiv.org/abs/2603.02176"
[9]: https://stacklok.com/blog/stackloks-mcp-optimizer-vs-anthropics-tool-search-tool-a-head-to-head-comparison/ "https://stacklok.com/blog/stackloks-mcp-optimizer-vs-anthropics-tool-search-tool-a-head-to-head-comparison/"
[10]: https://docs.langchain.com/langsmith/observability-concepts "https://docs.langchain.com/langsmith/observability-concepts"
[11]: https://opentelemetry.io/ "https://opentelemetry.io/"
[12]: https://www.anthropic.com/research/emergent-misalignment-reward-hacking "https://www.anthropic.com/research/emergent-misalignment-reward-hacking"
[13]: https://genai.owasp.org/llmrisk/llm01-prompt-injection/ "https://genai.owasp.org/llmrisk/llm01-prompt-injection/"
[14]: https://www.nist.gov/itl/ai-risk-management-framework "https://www.nist.gov/itl/ai-risk-management-framework"
[15]: https://developers.openai.com/cookbook/examples/partners/agentic_governance_guide/agentic_governance_cookbook/ "https://developers.openai.com/cookbook/examples/partners/agentic_governance_guide/agentic_governance_cookbook/"
[16]: https://arxiv.org/abs/2510.02373 "https://arxiv.org/abs/2510.02373"
[17]: https://www.kernel.org/doc/man-pages/online/pages/man2/symlink.2.html "https://www.kernel.org/doc/man-pages/online/pages/man2/symlink.2.html"
[18]: https://modelcontextprotocol.io/specification/2025-11-25 "https://modelcontextprotocol.io/specification/2025-11-25"
[19]: https://www.dublincore.org/documents/dcmi-terms/ "https://www.dublincore.org/documents/dcmi-terms/"
[20]: https://github.com/langchain-ai/langgraph "https://github.com/langchain-ai/langgraph"
