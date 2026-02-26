---
feature_ids: []
topics: [signal, hunter]
doc_kind: research
created: 2026-02-26
---

下面是一份可直接拿去建“AI 技术追踪系统”的**信源清单 + 分级规则 + 抓取可行性 + 优先级建议**（以 **2026-02-12** 为基准做过网页核对，尤其是 RSS/存活状态这些容易变的点）。

---

## 1. 信源清单表格

> 说明
>
> * **URL 一律用代码块样式**（便于复制，也避免格式被吃掉）。
> * **更新频率**是“工程侧可用的估计值”，更适合作为抓取调度的初始参数。
> * **Tier**按你要求的 1-4 标准（见第 2 节）。
> * 备注里我会写清“为什么可信 / 需要过滤什么”。

### 1.1 大厂与实验室官方博客/研究页（全球）

| 信源名称                                 | 类别   |                                                        URL | 更新频率             | Tier (1-4) | 备注                                                                     |
| ------------------------------------ | ---- | ---------------------------------------------------------: | ---------------- | ---------: | ---------------------------------------------------------------------- |
| Anthropic Newsroom                   | 大厂官方 |                           `https://www.anthropic.com/news` | 中高频（发布驱动）        |          1 | 一手发布与技术公告混合，适合追模型/能力/安全更新。([Anthropic][1])                             |
| Anthropic Research                   | 大厂官方 |                       `https://www.anthropic.com/research` | 中频               |          1 | 研究索引页，论文/技术报告一手来源。([Anthropic][2])                                     |
| Anthropic Engineering                | 大厂官方 |                    `https://www.anthropic.com/engineering` | 中频               |          1 | 工程深水区，适合“Agent 工程化/评测/基础设施”。([Anthropic][3])                           |
| Anthropic Alignment Science Blog     | 大厂官方 |                         `https://alignment.anthropic.com/` | 中高频（近月很活跃）       |          1 | 典型“上下文工程/评测/安全研究笔记”一手源。([alignment.anthropic.com][4])                  |
| OpenAI Research                      | 大厂官方 |                             `https://openai.com/research/` | 中频（发布驱动）         |          1 | 研究/系统卡/能力发布入口。([OpenAI][5])                                            |
| OpenAI News (Research)               | 大厂官方 |                        `https://openai.com/news/research/` | 中频               |          1 | Newsroom 中的 research 分类页，可配合 RSS 抓。([OpenAI][6])                       |
| OpenAI 官方 RSS                        | 大厂官方 |                          `https://openai.com/news/rss.xml` | 高（随 newsroom 变动） |          1 | 目前可用的官方 RSS（历史上变过域名/路径，建议做“自动探测+兜底”）。([OpenAI Developer Community][7]) |
| Google DeepMind News                 | 大厂官方 |                            `https://deepmind.google/blog/` | 中高频              |          1 | “模型/研究/安全/科学”混合，一手新闻流。([Google DeepMind][8])                           |
| Google DeepMind Publications         | 大厂官方 |           `https://deepmind.google/research/publications/` | 中频               |          1 | 研究发表索引页，适合做“实验室论文雷达”。([Google DeepMind][9])                            |
| Google Research Blog                 | 大厂官方 |                            `https://research.google/blog/` | 高（常有新文）          |          1 | 谷歌研究博客，一手技术文章入口。([Google Research][10])                                |
| Google Blog AI 方向入口                  | 大厂官方 |                       `https://blog.google/technology/ai/` | 中高频              |          1 | 偏“官方叙事”，但 Gemini/工具链更新常从这里起。                                           |
| AI at Meta Blog                      | 大厂官方 |                                `https://ai.meta.com/blog/` | 中频（发布驱动）         |          1 | Llama/开源权重发布常见来源，但也夹产品叙事，建议按关键词过滤。([Meta AI][11])                      |
| Meta Research Blog                   | 大厂官方 |                      `https://research.facebook.com/blog/` | 中频               |          1 | 研究与工程文章入口（注意站点可能有反爬/速率限制）。([research.facebook.com][12])                |
| Meta Research Publications           | 大厂官方 |              `https://research.facebook.com/publications/` | 中频               |          1 | 论文/出版物索引，一手。([research.facebook.com][13])                              |
| Engineering at Meta (AI Research 分类) | 大厂官方 |         `https://engineering.fb.com/category/ai-research/` | 低中频              |          1 | 偏工程实现与系统，适合追“推理系统/训练基础设施”。([Engineering at Meta][14])                  |
| Microsoft Research Blog              | 大厂官方 |           `https://www.microsoft.com/en-us/research/blog/` | 中高频              |          1 | MSR 技术文章一手源。([微软][15])                                                 |
| Microsoft Research Blog RSS          | 大厂官方 |      `https://www.microsoft.com/en-us/research/blog/feed/` | 高（随博客更新）         |          1 | 直接可订阅的 RSS。([微软][16])                                                  |
| Microsoft AI Blog                    | 大厂官方 |                 `https://www.microsoft.com/en-us/ai/blog/` | 中高频              |          2 | 官方 AI 博客，技术与产品融合，建议“只保留带方法/系统细节的文章”。([微软][17])                         |
| Azure AI（Azure Blog 分类页）             | 大厂官方 | `https://azure.microsoft.com/en-us/blog/product/azure-ai/` | 中频               |          2 | 偏产品发布，但常附架构/实践细节，适合作为“工程实践补给”。([Microsoft Azure][18])                  |
| Azure AI Foundry Blog                | 大厂官方 |                  `https://devblogs.microsoft.com/foundry/` | 中频               |          2 | DevBlogs 体系，工程味更浓（Agent/工具链/平台能力）。([Microsoft for Developers][19])     |
| AWS Machine Learning Blog            | 大厂官方 |           `https://aws.amazon.com/blogs/machine-learning/` | 高                |          2 | 教程很多，营销也多，建议用“技术关键词 + 反营销词表”过滤。([Amazon Web Services, Inc.][20])       |
| AWS ML Blog RSS                      | 大厂官方 |      `https://aws.amazon.com/blogs/machine-learning/feed/` | 高                |          1 | 官方 feed 常用且稳定（工程上很香）。([GitHub][21])                                    |
| Amazon Science                       | 大厂官方 |                              `https://www.amazon.science/` | 中频               |          1 | 更偏研究与科学传播，技术密度较高。([Amazon Science][22])                                |
| Amazon Science (Alexa)               | 大厂官方 |                         `https://www.amazon.science/alexa` | 低中频              |          1 | Alexa 研究聚合入口（语音/多模态/代理交互相关）。                                           |
| Apple Machine Learning Research      | 大厂官方 |                       `https://machinelearning.apple.com/` | 中频               |          1 | Apple ML Journal，一手研究文章/论文索引。([Apple Machine Learning Research][23])   |
| Apple ML RSS                         | 大厂官方 |               `https://machinelearning.apple.com/feed.xml` | 中频               |          1 | 公开可用的 feed（页面未必显式挂出，但 feed 存在）。([Reddit][24])                          |

---

### 1.2 国内大模型公司官方信源（重点筛“技术”）

| 信源名称                         | 类别       |                                                  URL | 更新频率 | Tier (1-4) | 备注                                                             |
| ---------------------------- | -------- | ---------------------------------------------------: | ---- | ---------: | -------------------------------------------------------------- |
| DeepSeek 官方站                 | 国内官方     |                          `https://www.deepseek.com/` | 发布驱动 |          2 | 官网通常信息密度不均，建议搭配“API/技术文档/开源”。([深度求索][25])                      |
| DeepSeek API Docs News       | 国内官方     |                 `https://api-docs.deepseek.com/news` | 中频   |          1 | 很适合当“版本变更日志”。([GitHub][26])                                    |
| DeepSeek GitHub Org          | 国内官方     |                     `https://github.com/deepseek-ai` | 中频   |          1 | 一手代码/权重/工具，适合抓 release + tags。([arXiv][27])                    |
| Qwen（通义千问）官网                 | 国内官方     |                                   `https://qwen.ai/` | 发布驱动 |          2 | 官网信息混合，建议优先追 blog + GitHub。([Qwen][28])                        |
| Qwen Blog                    | 国内官方     |                     `https://qwenlm.github.io/blog/` | 中频   |          1 | 通常是技术发布解读，密度较高。([Qwen][28])                                    |
| Qwen GitHub Org              | 国内官方     |                          `https://github.com/QwenLM` | 中频   |          1 | 代码/模型/工具一手源。([Qwen][28])                                       |
| Kimi（Moonshot）开放平台 Docs      | 国内官方     |         `https://platform.moonshot.ai/docs/overview` | 中高频  |          1 | 适合追“长上下文/Tool calling/Agent 能力”变更。([platform.moonshot.ai][29]) |
| Moonshot Open Platform 主页    | 国内官方     |                      `https://platform.moonshot.ai/` | 中频   |          2 | 入口页，抓取价值次于 docs，但可监控“新能力入口”。([platform.moonshot.ai][30])       |
| MiniMax GitHub Org           | 国内官方     |                      `https://github.com/minimax-ai` | 中频   |          1 | MCP/Agent 工具链相关仓库更新活跃。([GitHub][31])                           |
| MiniMax 官方 GitHub Page（资料汇总） | 国内官方     | `https://github.com/MiniMax-AI/MiniMax-AI.github.io` | 低中频  |          2 | 有时会整理论文/资源，适合做“入口监控”。([GitHub][32])                            |
| 智谱技术报告（BigModel）             | 国内官方     |              `https://bigmodel.cn/technology-report` | 低中频  |          1 | 技术报告优先级很高，适合做“全文抓取+结构化”。                                       |
| 智谱 Blog（z.ai）                | 国内官方     |                                  `https://z.ai/blog` | 中频   |          1 | 官方博客入口（注意筛营销稿）。                                                |
| 智谱相关开源（GLM-4.5 等）            | 国内官方/半官方 |                 `https://github.com/zai-org/GLM-4.5` | 发布驱动 |          2 | GitHub org 与官网关联需在系统里做一次“归属验证”，但仓库内容技术密度高。([GitHub][33])       |
| 百川 Baichuan GitHub Org       | 国内官方     |                    `https://github.com/baichuan-inc` | 低中频  |          1 | 开源模型/推理相关，一手。([GitHub][34])                                    |
| 字节 Seed Blog                 | 国内官方     |                    `https://seed.bytedance.com/blog` | 低中频  |          1 | 偏研究/系统，值得重点追（Agent、推理、评测经常有料）。                                 |

---

### 1.3 论文/学术平台（“一手进展”主战场）

| 信源名称                  | 类别    |                                         URL | 更新频率     | Tier (1-4) | 备注                                                                       |
| --------------------- | ----- | ------------------------------------------: | -------- | ---------: | ------------------------------------------------------------------------ |
| arXiv cs.CL RSS       | 论文/学术 |        `https://export.arxiv.org/rss/cs.CL` | 日更       |          1 | NLP 主赛道。([jamesg.blog][35])                                              |
| arXiv cs.AI RSS       | 论文/学术 |        `https://export.arxiv.org/rss/cs.AI` | 日更       |          1 | Agent/规划/推理相关经常在这里。([jamesg.blog][35])                                   |
| arXiv cs.LG RSS       | 论文/学术 |        `https://export.arxiv.org/rss/cs.LG` | 日更       |          1 | 通用 ML，LLM 方法常见。([jamesg.blog][35])                                       |
| arXiv API             | 论文/学术 |        `https://export.arxiv.org/api/query` | API      |          1 | 可做“关键词+作者+机构”精准拉取。([GitHub][36])                                         |
| Hugging Face Papers   | 论文/学术 |             `https://huggingface.co/papers` | 日更       |          2 | 聚合型，适合发现趋势，但重要结论要回到原论文/代码交叉验证。([LinkedIn][37])                           |
| Papers with Code（已停止） | 论文/学术 |               `https://paperswithcode.com/` | 已 sunset |          3 | 2025-07 已 sunset 并导向 HF Trending Papers，系统里应标记为“历史源/迁移”。([CodeSOTA][38]) |
| Semantic Scholar      | 论文/学术 |          `https://www.semanticscholar.org/` | 高频       |          2 | 强在作者/引用网络与检索。                                                            |
| Semantic Scholar API  | 论文/学术 | `https://api.semanticscholar.org/api-docs/` | API      |          2 | 适合做“作者追踪、引用突增报警”。([语义学者][39])                                            |
| OpenReview            | 论文/学术 |                   `https://openreview.net/` | 会议季高     |          2 | 会议投稿期信息密度极高，但噪声也高（需要筛选）。                                                 |
| ACL Anthology         | 论文/学术 |                 `https://aclanthology.org/` | 低中频      |          1 | NLP 正式发表归档，一手但更滞后。                                                       |

---

### 1.4 开源社区与框架（Agent 工程的“可落地证据”）

| 信源名称                      | 类别   |                                            URL | 更新频率 | Tier (1-4) | 备注                                                                  |
| ------------------------- | ---- | ---------------------------------------------: | ---- | ---------: | ------------------------------------------------------------------- |
| GitHub Trending（AI/ML）    | 开源社区 |                  `https://github.com/trending` | 日更   |          2 | “热度信号”，不等于质量，需二次筛选（stars 增速、作者可信、license、复现）。                       |
| Hugging Face Models       | 开源社区 |                `https://huggingface.co/models` | 实时   |          2 | 模型卡质量参差，建议只收“官方 org + 有论文/代码链接”。                                    |
| Hugging Face Datasets     | 开源社区 |              `https://huggingface.co/datasets` | 实时   |          2 | 适合追评测集/对齐数据集更新。                                                     |
| Hugging Face Hub API      | 开源社区 |          `https://huggingface.co/docs/hub/api` | API  |          2 | 可做“新模型/新数据集/趋势榜”程序化拉取。([Reddit][40])                                |
| LangChain Blog            | 框架官方 |                  `https://blog.langchain.dev/` | 中高频  |          2 | Agent 工程实践浓，适合追“上下文管理、评测、工具链”。([LangChain Blog][41])                |
| LangChain Blog RSS        | 框架官方 |              `https://blog.langchain.dev/rss/` | 中高频  |          2 | 可订阅（注意可能会变更，建议做 feed healthcheck）。([GitHub][42])                    |
| LangChain Changelog       | 框架官方 |             `https://changelog.langchain.com/` | 高频   |          2 | “版本变更”比博客更可操作，适合做 release note diff。([changelog.langchain.com][43]) |
| LlamaIndex                | 框架官方 |                   `https://www.llamaindex.ai/` | 中频   |          2 | 数据框架与 Agent 结合紧密，建议追 blog + GitHub。([LangChain Blog][44])           |
| vLLM                      | 开源社区 |         `https://github.com/vllm-project/vllm` | 高频   |          1 | 推理/Serving 关键基础设施，Agent 产品化绕不开。                                     |
| llama.cpp                 | 开源社区 |       `https://github.com/ggerganov/llama.cpp` | 高频   |          1 | 本地推理生态核心，适合追量化/推理优化。                                                |
| Ollama                    | 开源社区 |             `https://github.com/ollama/ollama` | 中高频  |          2 | 工程落地强，但信息偏产品，抓 release 价值更高。                                        |
| Microsoft Semantic Kernel | 框架官方 | `https://github.com/microsoft/semantic-kernel` | 中高频  |          2 | Microsoft 体系 Agent SDK，适合追 planner/connector。                       |

---

### 1.5 技术博主/独立研究者（“解释器”与“早期信号”）

| 信源名称                 | 类别     |                             URL | 更新频率 | Tier (1-4) | 备注                                                         |
| -------------------- | ------ | ------------------------------: | ---- | ---------: | ---------------------------------------------------------- |
| Simon Willison       | 独立研究者  |    `https://simonwillison.net/` | 高频   |          2 | 很擅长把新能力拆成可复用模式，适合追“工具调用/检索/评测”。([simonw.substack.com][45]) |
| Lilian Weng（Lil’Log） | 博主/研究者 | `https://lilianweng.github.io/` | 低中频  |          2 | 长文综述高质量，适合做“知识基线”。                                         |
| Jay Alammar          | 博主     |   `https://jalammar.github.io/` | 低频   |          3 | 解释型内容很强，更多是学习与复盘，不是最快新闻。                                   |
| Chip Huyen           | 博主     |        `https://huyenchip.com/` | 低中频  |          3 | 工程视角强，适合补“系统设计/数据/评测”。                                     |
| Sebastian Raschka    | 博主     | `https://sebastianraschka.com/` | 中频   |          3 | 偏 ML 基础与复盘，对方法论有帮助。                                        |
| Interconnects        | 独立分析   | `https://www.interconnects.ai/` | 周更   |          3 | 趋势解读强，建议作为“二手分析”参考。([GitHub][42])                          |

---

### 1.6 VC/行业分析与播客（“风向标”，但要小心幻术）

| 信源名称         | 类别      |                           URL | 更新频率 | Tier (1-4) | 备注                                                                                |
| ------------ | ------- | ----------------------------: | ---- | ---------: | --------------------------------------------------------------------------------- |
| a16z AI      | VC/行业分析 |        `https://a16z.com/ai/` | 中频   |          3 | 产业视角强，技术细节不稳定，需要回到原始论文/代码核验。                                                      |
| Sequoia AI   | VC/行业分析 | `https://www.sequoiacap.com/` | 低中频  |          3 | 偏趋势与案例，适合做“市场侧对照”。                                                                |
| Latent Space | 播客/行业分析 |   `https://www.latent.space/` | 周更   |          3 | Builder 视角好，适合捕捉“Agent 工程”新范式。RSS：`https://www.latent.space/feed`。 ([GitHub][42]) |
| The Gradient | 行业/研究评论 |    `https://thegradient.pub/` | 周更   |          3 | 评论与观点多，适合作为“争议与假设库”，不是一手事实。                                                       |

---

### 1.7 社区/聚合（噪声最多，但“早期信号”也在这里）

| 信源名称                       | 类别    |                                         URL | 更新频率 | Tier (1-4) | 备注                                                              |
| -------------------------- | ----- | ------------------------------------------: | ---- | ---------: | --------------------------------------------------------------- |
| Hacker News                | 社区/聚合 |             `https://news.ycombinator.com/` | 高频   |          3 | 讨论质量波动大，但新论文/新 repo 往往最先冒泡。                                     |
| Hacker News RSS            | 社区/聚合 |          `https://news.ycombinator.com/rss` | 高频   |          3 | 可直接订阅，适合做“热点候选池”。（LangChain 文档示例也用过这个 RSS。）([LangChain 文档][46]) |
| Hacker News Algolia API    | 社区/聚合 |                `https://hn.algolia.com/api` | API  |          2 | 适合按关键词（agent, tool, context window 等）做检索与热度评分。([HN Search][47]) |
| Reddit r/MachineLearning   | 社区/聚合 | `https://www.reddit.com/r/MachineLearning/` | 高频   |          3 | 论文讨论多，但也会被热点带跑。建议只抓 “paper+code+bench”。                         |
| Reddit r/LocalLLaMA        | 社区/聚合 |      `https://www.reddit.com/r/LocalLLaMA/` | 高频   |          3 | 工程落地与开源权重消息多，但谣言也多。                                             |
| X/Twitter 关键账号池（建议自建 List） | 社区/聚合 |                            `https://x.com/` | 实时   |        2-3 | 强信号来自“作者本人/实验室官方账号”，但必须落到论文/代码/系统卡验证。建议系统里做“账号白名单 + 引用校验”。      |

> X 账号我建议你系统里用“**白名单 + 引用落地**”策略：任何 X 上的爆料/claim，只有当它链接到论文、代码、官方 release note，才进入 Tier2 以上的事件流。

---

## 2. Tier 分级标准（可直接写进系统规则）

**Tier 1: 一手技术源，可直接信任（默认入库）**
判定依据：官方发布、论文原文、官方文档/变更日志、官方 GitHub（可追 commit/release），内容可复现或可引用。

**Tier 2: 需交叉验证（可入库，但打“待验证”标）**
判定依据：聚合平台、个人/组织二手整理、社区里的高质量帖、企业博客里偏产品但含技术细节。
策略：必须能回链到 Tier1（论文/代码/官方页）才升权重。

**Tier 3: 二手分析，参考价值（更适合做“观点层”）**
判定依据：VC/咨询/播客/长文评论。
策略：不作为事实来源，只做“趋势假设/术语/框架”，并对每条观点附上其引用的 Tier1 链接。

**Tier 4: 噪声源，反向过滤（默认不入库）**
判定依据：营销号搬运、标题党、无引用、无可核验证据、只喊“遥遥领先”不讲方法。
策略：用于训练过滤器（黑名单词表、站点/账号信誉分惩罚）。

---

## 3. 抓取可行性分析（RSS / 爬网页 / API）

### 3.1 明确有 RSS 的（推荐优先用 RSS，最省心）

* OpenAI newsroom RSS：`https://openai.com/news/rss.xml` ([OpenAI Developer Community][7])
* Microsoft Research blog RSS：`https://www.microsoft.com/en-us/research/blog/feed/` ([微软][16])
* Apple ML RSS：`https://machinelearning.apple.com/feed.xml` ([Reddit][24])
* AWS ML blog RSS：`https://aws.amazon.com/blogs/machine-learning/feed/` ([GitHub][21])
* arXiv 分类 RSS（cs.CL/cs.AI/cs.LG）：例如 `https://export.arxiv.org/rss/cs.CL` ([jamesg.blog][35])
* LangChain blog RSS：`https://blog.langchain.dev/rss/` ([GitHub][42])
* Latent Space（Substack feed）：`https://www.latent.space/feed` ([GitHub][42])
* Hacker News RSS：`https://news.ycombinator.com/rss` ([LangChain 文档][46])

**工程建议**：对 RSS 源做健康检查（HTTP 状态码、最近 item 时间、重复率），一旦异常自动降级到“网页抓取/站内搜索 API”。

### 3.2 大概率无官方 RSS，需要爬网页或用 RSSHub/自建 feed

* Meta AI Blog 目前社区有人在提 RSSHub 路由需求，暗示官方无稳定 RSS。([GitHub][48])
* Anthropic Engineering 等页面也有人提 RSSHub 路由需求。([GitHub][49])

**兜底方案**（强烈建议写进系统能力）：

* **RSSHub**：对无 RSS 的站点生成订阅源（注意合规与站点条款）。
* **自建 feed 生成器**：例如用 `Olshansk/rss-feeds` 这类“把网页变 RSS”的方案做私有化。([GitHub][50])

### 3.3 有 API 的（适合做“精准检索 + 增量同步”）

* arXiv API：`https://export.arxiv.org/api/query` ([GitHub][36])
* Semantic Scholar API：`https://api.semanticscholar.org/api-docs/` ([语义学者][39])
* Hugging Face Hub API（models/datasets 等）：`https://huggingface.co/docs/hub/api` ([Reddit][40])
* Hacker News Algolia API：`https://hn.algolia.com/api` ([HN Search][47])
* GitHub API（通用）：repos/releases/commits/issues/search（非常适合追 Agent 框架与模型开源）

### 3.4 “已迁移/已停止”的处理（系统里要有状态机）

* Papers with Code 已在 2025-07 sunset，并导向 Hugging Face 的 Trending Papers。([CodeSOTA][38])
  **工程建议**：信源表要有字段 `status = active | deprecated | migrated`，并记录 `replacement_url`。

---

## 4. 推荐优先级（给你一个可直接排期的抓取顺序）

### 4.1 必须追踪（Tier 1 + 高频或关键发布）

优先级理由：**一手、强信号、直接影响 Agent/LLM 能力与工程实践**

* OpenAI News RSS（以及 research 分类页）([OpenAI Developer Community][7])
* Anthropic：Newsroom + Engineering + Alignment Science Blog ([Anthropic][1])
* Google DeepMind News + Publications ([Google DeepMind][8])
* Google Research Blog ([Google Research][10])
* Microsoft Research Blog RSS ([微软][16])
* Apple ML RSS ([Reddit][24])
* AWS ML Blog RSS ([GitHub][21])
* 国内：DeepSeek（API news + GitHub）、Qwen（Blog + GitHub）、Moonshot Docs、MiniMax GitHub、智谱技术报告、百川 GitHub ([GitHub][26])

### 4.2 建议追踪（Tier 2 或低频但“信息增益”大）

优先级理由：**能帮你提前嗅到趋势，但需要回链验证**

* arXiv（cs.AI/cs.CL/cs.LG）RSS + API ([jamesg.blog][35])
* Hugging Face Papers / Hub 趋势（做“候选池”很强）([LinkedIn][37])
* Semantic Scholar（作者追踪、引用突增）([语义学者][39])
* LangChain Blog RSS + Changelog（Agent 工程风向很敏感）([GitHub][42])
* Meta AI Blog（尤其 Llama 类发布，需过滤营销并核验）([Meta AI][11])

### 4.3 可选追踪（主要做观点层、补全上下文）

优先级理由：**启发性强，但不稳定**

* Latent Space、The Gradient、a16z、Sequoia（全部默认 Tier3）([GitHub][42])
* HN / Reddit（做“早期信号雷达”，但要强过滤）([LangChain 文档][46])
* 博主圈（把它当“解释器/教程库”，不要当“事实源”）

---

## 可信度判断依据（你可以直接写到“备注模板”里）

给每条信源打 Tier 时，我建议系统里固化 6 个可解释字段（以后你们团队也容易对齐）：

1. **Source Authority**：官方/论文/官方仓库/个人
2. **Verifiability**：是否可回链到论文、代码、数据、系统卡
3. **Change Traceability**：是否可追版本（RSS/Release/Commit）
4. **Tech Density**：方法、实验、架构细节占比
5. **Noise Risk**：营销、转载、情绪化、断章取义风险
6. **Operational Cost**：抓取难度（RSS < API < HTML < 反爬/登录）

---

如果你愿意我再往前推一步，我们可以把这份清单直接变成你系统的“可执行配置”，例如：

* `sources.yaml`（含抓取方式、调度频率、解析规则、tier、关键词白/黑名单）
* 每个源的“**解析策略**”：列表页定位、正文抽取、去重、语言识别、引用抽取
* “Agent/上下文工程”专用关键词与标签体系（tool calling、planning、memory、RAG、eval、long context、MCP 等）

你只要说你们准备用什么存储（Postgres/ES/向量库）和调度（Airflow/Temporal/Cron/n8n），我就按你们栈把配置和抓取策略一起拼出来。

[1]: https://www.anthropic.com/news "https://www.anthropic.com/news"
[2]: https://www.anthropic.com/research "https://www.anthropic.com/research"
[3]: https://www.anthropic.com/engineering "https://www.anthropic.com/engineering"
[4]: https://alignment.anthropic.com/ "https://alignment.anthropic.com/"
[5]: https://openai.com/research/ "https://openai.com/research/"
[6]: https://openai.com/news/research/ "https://openai.com/news/research/"
[7]: https://community.openai.com/t/openai-website-rss-feed-inquiry/733747/11 "https://community.openai.com/t/openai-website-rss-feed-inquiry/733747/11"
[8]: https://deepmind.google/blog/ "https://deepmind.google/blog/"
[9]: https://deepmind.google/research/publications/ "https://deepmind.google/research/publications/"
[10]: https://research.google/blog/ "https://research.google/blog/"
[11]: https://ai.meta.com/blog/ "https://ai.meta.com/blog/"
[12]: https://research.facebook.com/blog/ "https://research.facebook.com/blog/"
[13]: https://research.facebook.com/publications/ "https://research.facebook.com/publications/"
[14]: https://engineering.fb.com/category/ai-research/ "https://engineering.fb.com/category/ai-research/"
[15]: https://www.microsoft.com/en-us/research/blog/ "https://www.microsoft.com/en-us/research/blog/"
[16]: https://www.microsoft.com/en-us/research/blog/feed/ "https://www.microsoft.com/en-us/research/blog/feed/"
[17]: https://www.microsoft.com/en-us/ai/blog/ "https://www.microsoft.com/en-us/ai/blog/"
[18]: https://azure.microsoft.com/en-us/blog/product/azure-ai/ "https://azure.microsoft.com/en-us/blog/product/azure-ai/"
[19]: https://devblogs.microsoft.com/foundry/welcome-to-azure-ai-foundry-blog/ "https://devblogs.microsoft.com/foundry/welcome-to-azure-ai-foundry-blog/"
[20]: https://aws.amazon.com/blogs/machine-learning/ "https://aws.amazon.com/blogs/machine-learning/"
[21]: https://github.com/ishan0102/engblogs "https://github.com/ishan0102/engblogs"
[22]: https://www.amazon.science/blog "https://www.amazon.science/blog"
[23]: https://machinelearning.apple.com/ "https://machinelearning.apple.com/"
[24]: https://www.reddit.com/r/apple/comments/6o8n3e/apple_launches_machine_learning_journal/ "https://www.reddit.com/r/apple/comments/6o8n3e/apple_launches_machine_learning_journal/"
[25]: https://www.deepseek.com/en "https://www.deepseek.com/en"
[26]: https://github.com/deepseek-ai "https://github.com/deepseek-ai"
[27]: https://arxiv.org/abs/2501.12948 "https://arxiv.org/abs/2501.12948"
[28]: https://qwenlm.github.io/blog/ "https://qwenlm.github.io/blog/"
[29]: https://platform.moonshot.ai/docs/overview "https://platform.moonshot.ai/docs/overview"
[30]: https://platform.moonshot.ai/ "https://platform.moonshot.ai/"
[31]: https://github.com/minimax-ai "https://github.com/minimax-ai"
[32]: https://github.com/MiniMax-AI/MiniMax-AI.github.io "https://github.com/MiniMax-AI/MiniMax-AI.github.io"
[33]: https://github.com/zai-org/GLM-4.5 "https://github.com/zai-org/GLM-4.5"
[34]: https://github.com/baichuan-inc "https://github.com/baichuan-inc"
[35]: https://jamesg.blog/2024/05/22/papers-with-code-rss/ "https://jamesg.blog/2024/05/22/papers-with-code-rss/"
[36]: https://github.com/paperswithcode/paperswithcode-data/issues/45 "https://github.com/paperswithcode/paperswithcode-data/issues/45"
[37]: https://www.linkedin.com/posts/ivan-venzor_for-years-papers-with-code-was-a-go-to-source-activity-7354499502151553024-EMVC "https://www.linkedin.com/posts/ivan-venzor_for-years-papers-with-code-was-a-go-to-source-activity-7354499502151553024-EMVC"
[38]: https://www.codesota.com/papers-with-code "https://www.codesota.com/papers-with-code"
[39]: https://www.semanticscholar.org/product/api "https://www.semanticscholar.org/product/api"
[40]: https://www.reddit.com/r/computervision/comments/1mivah8/what_happened_to_paperswithcode_redirects_to/ "https://www.reddit.com/r/computervision/comments/1mivah8/what_happened_to_paperswithcode_redirects_to/"
[41]: https://blog.langchain.dev/ "https://blog.langchain.dev/"
[42]: https://github.com/foorilla/allainews_sources "https://github.com/foorilla/allainews_sources"
[43]: https://changelog.langchain.com/ "https://changelog.langchain.com/"
[44]: https://blog.langchain.com/ "https://blog.langchain.com/"
[45]: https://simonw.substack.com/p/highlights-from-the-claude-4-system "https://simonw.substack.com/p/highlights-from-the-claude-4-system"
[46]: https://docs.langchain.com/oss/python/integrations/document_loaders/rss "https://docs.langchain.com/oss/python/integrations/document_loaders/rss"
[47]: https://hn.algolia.com/api "https://hn.algolia.com/api"
[48]: https://github.com/DIYgod/RSSHub/issues/16938 "https://github.com/DIYgod/RSSHub/issues/16938"
[49]: https://github.com/DIYgod/RSSHub/issues/18943 "https://github.com/DIYgod/RSSHub/issues/18943"
[50]: https://github.com/Olshansk/rss-feeds "https://github.com/Olshansk/rss-feeds"
