---
feature_ids: []
topics: [multi, agent, framework]
doc_kind: research
created: 2026-02-26
---

下面这份调研我按 **2026-02-12（America/Los_Angeles）** 做了“快照式取证”，尽量只放**能落到公开证据**的内容（GitHub、官方/第三方案例、HN/Reddit 负面反馈），并且在每个关键结论后面给出处。🧾

---

## 一张表先把“成熟度”摊开

> 评分口径（1-5）：
> 1=研究/玩具为主；2=能做 POC 但生产要自建一堆；3=可上生产但要强工程化和版本钉死；4=有多家公开生产案例且版本/API 相对稳；5=行业级事实标准且生态与工具链极成熟。

| 框架                   | 版本（快照）                               | Production 案例（公开证据）                                                                                                                                                     | Issues 健康度（快照）                                                                       | 跨厂商支持（Claude+GPT+Gemini 混用）                                                                                                      | 认证方式（常见）                                                                                                                 | 生产就绪度     |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------- |
| AutoGen（Microsoft）   | `python-v0.7.5`（0.x） ([GitHub][1])   | **公开“我们在生产用了 AutoGen”的案例不多**；Microsoft 明确建议新项目看 **Microsoft Agent Framework**，AutoGen 进入“稳定维护”只做 bug/security，不再加大功能 ([GitHub][2])                                      | open issues **432**（体量大、兼容/类型错误类问题不少）([GitHub][3])                                   | 支持多 provider：OpenAI、Azure OpenAI、Azure AI Foundry、Anthropic（实验）、Ollama（实验）、Gemini（OpenAI-compatible）等 ([microsoft.github.io][4]) | 多为 API Key；Azure 既支持 key 也可走 AAD token（示例在文档里）([microsoft.github.io][4])                                                 | **3/5**   |
| CrewAI               | `1.9.3` ([GitHub][5])                | 有 **AWS 官方博客**给出“生产影响”案例与架构（含大企业代码现代化、CPG back-office 自动化）([Amazon Web Services, Inc.][6])；自家站点也有 PwC/Gelato 等案例页（偏 vendor marketing，需要你们内部再做背调）([CrewAI][7])           | open issues **44**（相对少），但 open PR **226**，且 1.9.x 近乎“周更/日更”节奏，说明仍在快速演进 ([GitHub][5]) | 文档明确支持多 LLM provider，示例直接写 `openai/gpt-4o`、`google/gemini-*`、`anthropic/claude-*`，也支持自定义 base_url 等 ([CrewAI][8])                | 以 API key 为主（文档强调 .env/secret 管理）；provider 各有不同参数；另在 release notes 里出现 Keycloak SSO provider 支持（更像平台/网关侧能力）([CrewAI][8]) | **3/5**   |
| LangGraph（LangChain） | `1.0.8` ([GitHub][9])                | 公共生产案例最多：Qodo 明确写“LangGraph 从 POC 扛到 production”，并点出痛点（文档、测试/回放难）([Qodo][10])；LangChain 官方有多篇 customer story（Klarna/Remote/Bertelsmann/Webtoon 等）([LangChain Blog][11]) | open issues **170**、open PR **110**，发版持续（2 月还有 1.0.8）([GitHub][9])                   | LangGraph 定位是编排层，通常配合 LangChain 的 models/tools（也可不用），因此天然可混用多家模型 ([LangChain 文档][12])                                            | 框架本身不“管登录”，由你选的模型 SDK 决定（常见仍是 API key）；生产侧通常会配 LangSmith/自建网关做鉴权与审计 ([LangChain 文档][12])                                 | **4/5**   |
| （可选）AgentOrchestra   | 研究项目形态（无清晰 semver）([Skywork AI][13]) | 更像论文/benchmark 驱动的框架集合，没看到明确“生产部署故事”                                                                                                                                    | GitHub open issues **3**（体量小，说明不了成熟）([GitHub][14])                                   | README 写支持 OpenAI/Anthropic/Google 与本地 Qwen(vLLM) 等 ([GitHub][14])                                                               | 未形成统一清晰的企业级鉴权叙事（更多是研究代码）                                                                                                 | **1-2/5** |

---

## 1) Production 使用案例：谁真的在生产里“扛过事”

### LangGraph：公开生产证据最扎实

* **Qodo（AI coding assistant）**：文章里明确说 LangGraph “足够成熟，带他们从 POC 到 production”，并给出他们的主流程结构与 Postgres checkpointer 这类落地细节；同时也诚实写了痛点：文档跟不上、LLM 系统测试/复现难、需要更多手工测试。([Qodo][10])
* **LangChain 官方 customer stories**：Klarna、Remote、Bertelsmann、Webtoon 等都有专门 case study 页面（注意：这是 vendor 汇编的公开材料，可信度高于“教程 demo”，但你们仍可按客户方再做二次背调）。([LangChain Blog][11])
* 官方文档也把 “Production” 能力（durable execution、HITL、time travel、observability、deployment）当成核心卖点在讲。([LangChain 文档][12])

**结论**：如果有人问“为什么不用成熟框架”，LangGraph 是三者里最容易用公开证据回答“确实有人在生产用”的。

---

### CrewAI：有生产叙事，但更像“平台公司路线”

* **AWS 官方博客**给了更强的第三方背书：明确写到 CrewAI + Bedrock 的生产级集成，并列出“生产影响”示例（大企业代码现代化 70% 提升、CPG back-office 75% 时间缩短），还有 Docker/container 化部署描述。([Amazon Web Services, Inc.][6])
* CrewAI 自己的网站有 PwC、Gelato 等 case study 页面。这个属于“可用证据”，但通常是市场内容，你们若要用来对外说服，建议内部做一次核验（比如：是否能找到客户方公开提及、是否有可验证指标）。([CrewAI][7])

**结论**：CrewAI 的“生产成熟度”更多来自它在做 **企业套件/平台化**（AMP、observability 集成目录、MCP 等），但开源框架本身仍在快速迭代期。

---

### AutoGen：技术底盘强，但“公开生产案例”反而不显眼

* Microsoft 在 repo 和官方讨论里都明确：**新用户建议看 Microsoft Agent Framework**；AutoGen 继续维护但以 **bug fix + security patch** 为主，不再加大功能。([GitHub][2])
* 这对“生产成熟度”是个很微妙的信号：

  * 好的一面：进入维护期往往意味着 API 更稳。([GitHub][15])
  * 风险的一面：战略重心转移，新特性与生态会往别处走，你们未来可能要迁移。([GitHub][2])
* 同时，社区里也有人反馈 AutoGen Studio 维护节奏/缺功能等问题。([Reddit][16])

**结论**：AutoGen 更像“被很多人研究和集成过的底层框架”，但要用它去回应“成熟且广泛生产部署”，公开材料不如 LangGraph 好找。

---

## 2) GitHub Issues 稳定性：用 issue 体温计量一下“工程噪声”

> 说明：这里只做“快照 + 结构观察”，没有做全量统计（比如平均响应时间），但足够看出维护压力与迭代节奏。

### AutoGen

* open issues **432**，量大，且你能在列表里看到不少偏“兼容/类型/运行时错误”的问题标题。([GitHub][3])
* 历史上有大版本迁移与重构：官方迁移指南明确写 v0.4 是“从 v0.2 重写后的破坏性升级”，并提示部分能力尚未覆盖旧版。([microsoft.github.io][17])

**信号解读**：issue 多不等于不成熟，但意味着“落地成本”会落到你们团队（要么跟着升级，要么版本钉死并自修补丁）。

### CrewAI

* open issues **44**，但 open PR **226**，且 release 1.9.x 在 1 月末密集发布，说明代码线在快速演进。([GitHub][5])

**信号解读**：更像“高速公路施工现场”，路通了，但隔三差五换道。生产使用通常要：强版本锁定 + 回归测试 + 自己的观测体系。

### LangGraph

* open issues **170**，持续发版（`1.0.8` 在 2 月初）。([GitHub][9])
* 文档把 durable execution、HITL、time travel、debug/observability 放在“生产能力”中心位置。([LangChain 文档][12])

**信号解读**：在三者里最像“面向生产场景打磨的编排层”，但仍需承受生态（尤其 LangChain）带来的文档与版本噪声。

---

## 3) 社区评价：专挑“踩坑声”听

### LangGraph / LangChain 生态的主要负面

* HN 上有人直接吐槽 LangChain/LangGraph 文档难用、时间成本高，甚至提到“大公司有专门团队做配套工具，小团队承受不起”。([Hacker News][18])
* Reddit 上长期高频抱怨点：**breaking changes 多、文档过时**。([Reddit][19])
* 即便在“我们选择 LangGraph”这类正向帖子下面，也有评论质疑抽象层是否值得、是否引入无意义复杂度。([Hacker News][20])

**踩坑要点**：LangGraph 能上生产，但你得把它当“工作流引擎”，配套测试、可观测性、灰度策略要自己建齐。

---

### CrewAI 的主要负面

* HN 上对“production ready”宣传的质疑很直接：认为可靠性仍高度依赖基础模型进化，不该高喊“已经生产可靠”。([Hacker News][21])
* 也有社区讨论认为“公开生产案例不足”是现实问题，很多公司试了会撞墙。([Latenode Official Community][22])

**踩坑要点**：如果你把 CrewAI 当“自动分工的魔法团队”，容易翻车；如果把它当“可控的工作流框架 + 平台配套”，会更现实。

---

### AutoGen 的主要负面

* 有用户抱怨 AutoGen Studio 维护与功能缺口。([Reddit][16])
* 更关键的是官方信号：新项目建议看 Microsoft Agent Framework，AutoGen 进入维护期。([GitHub][2])

**踩坑要点**：AutoGen 不是不能用，而是要把“未来迁移”写进技术路线图里，不然会被战略调整追着跑。

---

## 4) 架构限制：到底是“真 Agent”还是“Chat wrapper”

### 跨厂商模型混用

* **AutoGen**：官方列了多个 provider（OpenAI、Azure、Azure AI Foundry、Anthropic、Ollama、Gemini(OpenAI-compatible) 等），跨厂商是硬支持。([microsoft.github.io][4])
* **CrewAI**：文档明确多 provider，配置里直接用 `openai/...`、`google/...`、`anthropic/...`，也支持 `.env`/YAML/代码三种注入方式。([CrewAI][8])
* **LangGraph**：定位是 orchestration runtime，文档说通常用 LangChain 组件接 models/tools，但不强制，因此模型层由你选择，混用基本可行。([LangChain 文档][12])

### 认证方式

* **AutoGen**：多数 API key；Azure 路线可以 key，也能走 AAD token（文档有例子）。([microsoft.github.io][4])
* **CrewAI**：以 API key/云厂商 access key 为主，文档反复强调 secret 管理；并提到 provider 认证方式各不相同。([CrewAI][8])
* **LangGraph**：框架层不定义统一认证，通常跟随模型 SDK（key/OAuth/云 IAM），生产上常配合 LangSmith 或自建网关做鉴权与审计。([LangChain 文档][12])

### “真 Agent 能力”（文件/命令/外部系统）

* **CrewAI**：AWS 博客明确写 tools 可用于 API、数据库、执行脚本、外部系统交互；并给出容器化部署与生产示例。([Amazon Web Services, Inc.][6])
* **LangGraph**：核心强项在“状态机 + durable execution + HITL + time travel + streaming”，工具执行要你自己以 tool/node 形式接入（更像可控编排器）。([LangChain 文档][12])
* **AutoGen**：偏“多 agent 对话与工具执行框架”，但你们要特别关注它历史上 v0.4 的破坏性迁移与功能覆盖差异。([microsoft.github.io][17])

---

## 5) 版本稳定性：你会不会被“升级洪水”冲走

* **AutoGen**：仍是 **0.x**，而且官方迁移指南承认 v0.4 是破坏性升级与重写，并提示能力差异。([microsoft.github.io][17])
  同时官方又说现在 API 稳定并进入维护期（只修 bug/security）。([GitHub][15])
  这组合的含义是：**短期更稳，长期要防战略迁移**。
* **CrewAI**：**1.x** 且发版密集（1.9.0-1.9.3 几天内连续），说明产品线高速迭代。([GitHub][5])
* **LangGraph**：**1.0.8** 且持续 patch，处于“稳定 API + 持续打磨生产能力”的姿态。([GitHub][9])

---

## 最终结论：这些框架真的“成熟”吗？

如果把“成熟”理解成“拿来就能省掉 80% 工程化工作”，那答案是：**不成熟**。
从 HN/Reddit 的踩坑声来看，大家普遍遇到的是：文档、抽象复杂度、可观测性、测试复现、升级成本。([Hacker News][18])

但如果把“成熟”理解成“有人在真实业务里用它承载 production，并且有公开证据”，那答案更细：

* **LangGraph：相对最成熟（4/5）**
  公开生产故事最多，且明确主打 durable execution、HITL、调试与部署。([Qodo][10])
  代价是：你仍要为“可测试、可观测、可回放、可灰度”付工程化成本。
* **CrewAI：可上生产但处于快速演进（3/5）**
  有 AWS 这类第三方内容把它往“生产集成”方向背书。([Amazon Web Services, Inc.][6])
  但版本节奏快、叙事偏平台化，适合“你愿意锁版本并接受快速变化”的团队。
* **AutoGen：底盘强但路线信号复杂（3/5）**
  一方面进入维护期意味着短期稳定；另一方面官方建议新项目转向 Agent Framework，且历史上有破坏性迁移。([GitHub][15])
  更关键的是：公开可引用的“生产落地故事”相对少，做对外解释时证据链不如 LangGraph 顺滑。

---

## 给 Cat Café 的一句“共创伙伴式”建议 ☕🐈

如果你们要回应用户“为什么不用成熟框架”，最有杀伤力的说法通常不是“我们更强”，而是：

1. **我们评估过**：LangGraph 的生产案例和工具链证据最充分，但仍需要大量工程化投入（测试/回放/观测/灰度/安全沙箱）。([Qodo][10])
2. **我们选择自研/半自研**：是因为 Cat Café 的核心差异在（举例）跨模型仲裁、权限与审计、工具沙箱、长任务恢复、业务态状态机、成本与策略控制等，这些在通用框架里仍要自己搭。
3. **我们并不排斥复用**：可以“借鉴 LangGraph 的图式状态机 + checkpoint 思路”、或“复用 CrewAI/AutoGen 的 provider 接入层”，但把关键控制面留在你们手上，避免被版本洪流冲走。

如果你愿意，我也可以把上面的证据再加工成一页“对外 FAQ 话术 + 引用链接清单”，让你们在被问到 AutoGen/CrewAI/LangGraph 时，能用 30 秒讲清楚取舍。

[1]: https://github.com/microsoft/autogen/releases "Releases · microsoft/autogen · GitHub"
[2]: https://github.com/microsoft/autogen "GitHub - microsoft/autogen: A programming framework for agentic AI"
[3]: https://github.com/microsoft/autogen/issues "GitHub · Where software is built"
[4]: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/models.html "Models — AutoGen"
[5]: https://github.com/crewAIInc/crewAI/releases "Releases · crewAIInc/crewAI · GitHub"
[6]: https://aws.amazon.com/blogs/machine-learning/build-agentic-systems-with-crewai-and-amazon-bedrock/ "Build agentic systems with CrewAI and Amazon Bedrock | Artificial Intelligence"
[7]: https://www.crewai.com/case-studies/pwc-accelerates-enterprise-scale-genai-adoption-with-crewai?utm_source=chatgpt.com "PwC accelerates enterprise-scale GenAI adoption with ..."
[8]: https://docs.crewai.com/concepts/llms "LLMs - CrewAI"
[9]: https://github.com/langchain-ai/langgraph/releases "Releases · langchain-ai/langgraph · GitHub"
[10]: https://www.qodo.ai/blog/why-we-chose-langgraph-to-build-our-coding-agent/ "Why we chose LangGraph to build our coding agent - Qodo"
[11]: https://blog.langchain.com/customers-klarna/?utm_source=chatgpt.com "How Klarna's AI assistant redefined customer support at ..."
[12]: https://docs.langchain.com/oss/javascript/langgraph/overview "LangGraph overview - Docs by LangChain"
[13]: https://skyworkai.github.io/DeepResearchAgent/ "AgentOrchestra: A Hierarchical Multi-Agent Framework for General-Purpose Task Solving"
[14]: https://github.com/SkyworkAI/DeepResearchAgent "GitHub - SkyworkAI/DeepResearchAgent: DeepResearchAgent is a hierarchical multi-agent system designed not only for deep research tasks but also for general-purpose task solving. The framework leverages a top-level planning agent to coordinate multiple specialized lower-level agents, enabling automated task decomposition and efficient execution across diverse and complex domains."
[15]: https://github.com/microsoft/autogen/discussions/7066 "AutoGen Update · microsoft autogen · Discussion #7066 · GitHub"
[16]: https://www.reddit.com/r/AutoGenAI/comments/1gkf8do/frustrated_with_lack_of_support_any_alternatives/?utm_source=chatgpt.com "Frustrated with lack of support. Any alternatives to Autogen ..."
[17]: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/migration-guide.html "Migration Guide for v0.2 to v0.4 — AutoGen"
[18]: https://news.ycombinator.com/item?id=41995104 "Ask HN: How's LangGraph for Prod? | Hacker News"
[19]: https://www.reddit.com/r/LangChain/comments/1g7sii6/what_is_your_biggest_gripe_with_langchain_andor/?utm_source=chatgpt.com "What is your biggest gripe with LangChain and/or ..."
[20]: https://news.ycombinator.com/item?id=43468435 "We chose LangGraph to build our coding agent | Hacker News"
[21]: https://news.ycombinator.com/item?id=41918658&utm_source=chatgpt.com "Crewai Raises $18M–But Are AI Agents Ready for Prime ..."
[22]: https://community.latenode.com/t/is-crewai-actually-being-used-in-production-environments/33258?utm_source=chatgpt.com "Is crewAI actually being used in production environments?"
