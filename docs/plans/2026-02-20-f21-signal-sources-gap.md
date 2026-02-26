---
feature_ids: [F021]
topics: [signal, sources, gap]
doc_kind: plan
created: 2026-02-20
---

# F21 Signal Hunter — 信源 Gap 审计

> 日期：2026-02-20
> 作者：布偶猫
> 关联：BACKLOG F21、[集成计划](./2026-02-12-signal-hunter-integration.md)、[缅因猫调研](../archive/2026-02/research/signal-hunter.md)、[讨论](../archive/2026-02/discussions/2026-02-12-signal-hunter-upgrade/README.md)
> 状态：Gap 分析 → 待铲屎官确认优先级后布偶猫补齐

---

## 1. 核心结论

| 维度 | 需求 | 实际 | 覆盖率 |
|------|------|------|--------|
| **信源数量** | 50+ | 3 | ~6% |
| **Tier 1 大厂全球** | 19 个 URL | 2 个 | ~11% |
| **Tier 1 国内厂商** | 9 个 URL | 0 | 0% |
| **论文/学术** | 5+ 个 URL | 1 个 | ~20% |
| **Tier 2 开源社区** | 6+ 个 URL | 0 | 0% |
| **Tier 2-3 博主** | 6 个 URL | 0 | 0% |
| **Tier 3 VC/行业** | 4 个 URL | 0 | 0% |
| **Tier 3 社区/聚合** | 5 个 URL | 0 | 0% |
| **Fetcher 类型** | RSS + API + Webpage | RSS + Webpage（API 框架在但无人用） | 部分 |
| **通知系统** | 邮件 + in-app + macOS 弹窗 | CLI notify（基础） | 部分 |

**框架完整，内容空虚**：砚砚搭的 fetcher 三件套 (RSS/API/Webpage)、文章存储、MCP 查询、前端 UI、迁移脚本都可用，但 `default-sources.ts` 只有 3 个"打样"级信源。

---

## 2. 已实现的 3 个信源

```typescript
// packages/api/src/domains/signals/config/default-sources.ts
[
  { id: 'anthropic-news',    url: 'anthropic.com/news',        method: 'webpage' },
  { id: 'openai-news-rss',   url: 'openai.com/news/rss.xml',  method: 'rss'     },
  { id: 'arxiv-cs-cl',       url: 'arxiv.org/rss/cs.CL',      method: 'rss'     },
]
```

---

## 3. 缺失信源完整清单

以下信源均列在缅因猫调研报告和集成讨论文档中，已获铲屎官确认，但未进入 `default-sources.ts`。

### 3.1 Anthropic 系列（铲屎官特别指出）

当前只有 `/news`，缺 3 个重要子站：

| 信源 | URL | Tier | Fetch | 状态 |
|------|-----|------|-------|------|
| ~~Anthropic Newsroom~~ | ~~anthropic.com/news~~ | ~~1~~ | ~~webpage~~ | ✅ 已有 |
| Anthropic Research | `anthropic.com/research` | 1 | webpage | ❌ 缺失 |
| Anthropic Engineering | `anthropic.com/engineering` | 1 | webpage | ❌ 缺失 |
| Anthropic Alignment Science | `alignment.anthropic.com/` | 1 | webpage | ❌ 缺失 |

### 3.2 其他全球大厂（Tier 1）

| 信源 | URL | Tier | Fetch | 备注 |
|------|-----|------|-------|------|
| OpenAI Research | `openai.com/research/` | 1 | webpage | 研究页，独立于 News RSS |
| OpenAI News Research 分类 | `openai.com/news/research/` | 1 | webpage | 分类页 |
| Google DeepMind Blog | `deepmind.google/blog/` | 1 | webpage | |
| Google DeepMind Publications | `deepmind.google/research/publications/` | 1 | webpage | |
| Google Research Blog | `research.google/blog/` | 1 | webpage | |
| Google Blog AI | `blog.google/technology/ai/` | 1 | webpage | Gemini/工具链更新 |
| Meta AI Blog | `ai.meta.com/blog/` | 1 | webpage | Llama 发布 |
| Meta Research Blog | `research.facebook.com/blog/` | 1 | webpage | |
| Meta Research Publications | `research.facebook.com/publications/` | 1 | webpage | |
| Engineering at Meta (AI) | `engineering.fb.com/category/ai-research/` | 1 | webpage | 推理系统/训练基建 |
| Microsoft Research Blog | `microsoft.com/.../research/blog/` | 1 | **RSS** | 有 feed |
| Microsoft Research RSS | `microsoft.com/.../research/blog/feed/` | 1 | RSS | 直接可订阅 |
| Apple ML Research | `machinelearning.apple.com/` | 1 | **RSS** | feed.xml 可用 |
| Amazon Science | `amazon.science/` | 1 | webpage | |
| AWS ML Blog | `aws.amazon.com/blogs/machine-learning/` | 1 | **RSS** | feed 可用 |
| **xAI Blog** | `x.ai/blog` | 1 | webpage | 布偶猫补充 |
| **Mistral AI News** | `mistral.ai/news/` | 1 | webpage | 布偶猫补充 |
| **Cohere Research** | `cohere.com/research` | 1 | webpage | 布偶猫补充 |
| **Together AI Blog** | `together.ai/blog` | 1 | webpage | 布偶猫补充 |
| **Groq News** | `groq.com/news/` | 1 | webpage | 布偶猫补充 |

**Tier 2 (Microsoft/Azure/AWS)：**

| 信源 | URL | Tier | Fetch |
|------|-----|------|-------|
| Microsoft AI Blog | `microsoft.com/.../ai/blog/` | 2 | webpage |
| Azure AI Blog | `azure.microsoft.com/.../azure-ai/` | 2 | webpage |
| Azure AI Foundry | `devblogs.microsoft.com/foundry/` | 2 | webpage |

### 3.3 国内厂商（Tier 1-2，全缺）

| 信源 | URL | Tier | Fetch |
|------|-----|------|-------|
| DeepSeek API News | `api-docs.deepseek.com/news` | 1 | webpage |
| DeepSeek GitHub | `github.com/deepseek-ai` | 1 | GitHub API |
| Qwen Blog | `qwenlm.github.io/blog/` | 1 | webpage |
| Qwen GitHub | `github.com/QwenLM` | 1 | GitHub API |
| Moonshot Docs | `platform.moonshot.ai/docs/overview` | 1 | webpage |
| MiniMax GitHub | `github.com/minimax-ai` | 1 | GitHub API |
| 智谱技术报告 | `bigmodel.cn/technology-report` | 1 | webpage |
| 智谱 Blog | `z.ai/blog` | 1 | webpage |
| 百川 GitHub | `github.com/baichuan-inc` | 1 | GitHub API |
| 字节 Seed Blog | `seed.bytedance.com/blog` | 1 | webpage |

### 3.4 论文/学术

| 信源 | URL | Tier | Fetch | 备注 |
|------|-----|------|-------|------|
| ~~arXiv cs.CL~~ | ~~arxiv.org/rss/cs.CL~~ | ~~1~~ | ~~RSS~~ | ✅ 已有 |
| arXiv cs.AI | `arxiv.org/rss/cs.AI` | 1 | RSS | ❌ Agent/推理 |
| arXiv cs.LG | `arxiv.org/rss/cs.LG` | 1 | RSS | ❌ 通用 ML |
| HuggingFace Papers | `huggingface.co/papers` | 2 | webpage/API | ❌ 趋势发现 |
| Semantic Scholar | `semanticscholar.org/` | 2 | API | ❌ 作者/引用追踪 |
| ACL Anthology | `aclanthology.org/` | 1 | webpage | ❌ NLP 正式发表 |

### 3.5 开源社区与框架（Tier 2）

| 信源 | URL | Tier | Fetch |
|------|-----|------|-------|
| GitHub Trending | `github.com/trending` | 2 | webpage |
| LangChain Blog | `blog.langchain.dev/` | 2 | RSS |
| LangChain Changelog | `changelog.langchain.com/` | 2 | webpage |
| LlamaIndex | `llamaindex.ai/` | 2 | webpage |
| vLLM GitHub | `github.com/vllm-project/vllm` | 1 | GitHub API |
| llama.cpp GitHub | `github.com/ggerganov/llama.cpp` | 1 | GitHub API |
| Ollama GitHub | `github.com/ollama/ollama` | 2 | GitHub API |
| Semantic Kernel | `github.com/microsoft/semantic-kernel` | 2 | GitHub API |

### 3.6 技术博主（Tier 2-3）

| 信源 | URL | Tier | Fetch |
|------|-----|------|-------|
| Simon Willison | `simonwillison.net/` | 2 | webpage |
| Lilian Weng (Lil'Log) | `lilianweng.github.io/` | 2 | webpage |
| Chip Huyen | `huyenchip.com/` | 3 | webpage |
| Jay Alammar | `jalammar.github.io/` | 3 | webpage |
| Sebastian Raschka | `sebastianraschka.com/` | 3 | webpage |
| Interconnects | `interconnects.ai/` | 3 | webpage |

### 3.7 VC/行业 + 社区（Tier 3）

| 信源 | URL | Tier | Fetch |
|------|-----|------|-------|
| a16z AI | `a16z.com/ai/` | 3 | webpage |
| Latent Space | `latent.space/` | 3 | RSS |
| The Gradient | `thegradient.pub/` | 3 | webpage |
| Sequoia AI | `sequoiacap.com/` | 3 | webpage |
| Hacker News | `news.ycombinator.com/` | 3 | RSS/API |
| Reddit r/MachineLearning | `reddit.com/r/MachineLearning/` | 3 | webpage |
| Reddit r/LocalLLaMA | `reddit.com/r/LocalLLaMA/` | 3 | webpage |

---

## 4. 基础设施 Gap（不只是信源数量）

### 4.1 API Fetcher 空转

框架在 `api-fetcher.ts` 中已实现，但**没有任何信源配置使用 `method: 'api'`**。缺失的 API 信源：
- GitHub API（releases/commits）— DeepSeek/Qwen/百川/vLLM/llama.cpp/MiniMax 等 6+ 仓库
- HuggingFace Hub API — 模型/数据集/论文
- Semantic Scholar API — 论文/作者/引用
- arXiv API — 补充 RSS 的精准查询
- Hacker News Algolia API — 关键词检索

### 4.2 Webpage Fetcher 仅 1 个 selector

`webpage-fetcher.ts` 使用 cheerio，但只有 `anthropic-news` 配了 selector (`article, .news-item`)。新增的 30+ 网页信源每个都需要实测 CSS selector。

### 4.3 Tier 分层未生效

3 个信源全部是 Tier 1。Tier 2/3/4 完全空白。研究文档设计的**交叉验证策略**（Tier 2 需关联 Tier 1 才入库）和**反向过滤**（Tier 4 训练过滤器）完全没实现。

### 4.4 通知系统 — 邮件日报未实现

集成讨论明确要求：
- 邮件日报（nodemailer + SMTP 配置）— ❌ 未实现
- Cat Café 内消息 — ❌ 未实现（只有 CLI 内的 macOS notify）
- macOS 系统通知 — 部分（CLI 用了 `node-notifier`）

### 4.5 信源管理能力不足

- 只能 PATCH toggle `enabled`，不能通过 API/MCP 添加新信源
- 要加信源只能改代码或手动编辑 `~/.cat-cafe/signals/config/sources.yaml`

---

## 5. 修复方案

### 补齐方式

信源配置是纯数据，不需要改框架代码。主要工作：

1. **扩充 `default-sources.ts`**：把 50+ 信源全部填入，按 Tier 分组
2. **实测 CSS selector**：对每个 webpage 类信源访问页面，确定正确的列表/文章 selector
3. **GitHub API 信源**：接 `method: 'api'`，配置 GitHub API endpoint + headers
4. **验证 RSS URL**：确认所有 RSS feed 仍然存活
5. **关键词过滤**：为 arXiv cs.AI / cs.LG 配置和 cs.CL 一样的 keyword filter

### 分批策略（建议）

| 批次 | 信源 | 数量 | 优先级 | 理由 |
|------|------|------|--------|------|
| **P0** | Anthropic 补全（Research/Engineering/Alignment） | +3 | 最高 | 铲屎官特别指出 |
| **P1** | Tier 1 大厂 RSS（Microsoft/Apple/AWS）+ arXiv cs.AI/cs.LG | +5 | 高 | 有 RSS feed，即插即用 |
| **P2** | Tier 1 大厂 Webpage（Google/Meta/xAI/Mistral 等）| +12 | 高 | 需写 selector |
| **P3** | 国内厂商（DeepSeek/Qwen/Moonshot 等）| +10 | 中 | 需写 selector + 处理中文 |
| **P4** | GitHub API 信源（DeepSeek/Qwen/vLLM 等）| +8 | 中 | 需配 API fetcher |
| **P5** | 论文平台 API（HF Papers/Semantic Scholar）| +2 | 中 | 需配 API fetcher |
| **P6** | 开源框架 + 博主（LangChain/Simon Willison 等）| +12 | 低 | Tier 2-3 |
| **P7** | VC/社区（a16z/HN/Reddit）| +7 | 低 | Tier 3，噪声多 |

### 前置条件

- 每个 webpage 信源需要实际访问页面确定 selector，可能因反爬需要 UA/delay 策略
- GitHub API 信源需要 token（公开仓库 unauthenticated 限 60 req/hr，authenticated 5000）
- Semantic Scholar API 需注册 API key

---

## 6. 参考文档

| 文档 | 路径 | 内容 |
|------|------|------|
| 缅因猫调研（完整 50+ 信源表） | `docs/archive/2026-02/research/signal-hunter.md` | 7 类信源 + Tier 分级 + 抓取可行性 |
| 集成讨论（信源清单确认版） | `docs/archive/2026-02/discussions/2026-02-12-signal-hunter-upgrade/README.md` | 决策 + 完整信源表 + 架构图 |
| 集成计划（S1-S6） | `docs/plans/2026-02-12-signal-hunter-integration.md` | 阶段划分 + 验收标准 |
| 当前实现 | `packages/api/src/domains/signals/config/default-sources.ts` | 3 个信源 |

---

*审计人：布偶猫 🐾 2026-02-20*
