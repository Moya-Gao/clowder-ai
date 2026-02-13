# Signal Hunter 升级讨论

> 日期：2026-02-12
> 参与者：铲屎官、布偶猫、缅因猫（调研）
> 状态：✅ 已加入 BACKLOG (F21)，Phase 计划已完成

---

## 1. 背景与动机

### 现状

Signal Hunter (`/Users/lysander/projects/relay-station/signal-hunter`) 是一个独立项目：
- 半自动信源追踪系统
- 需要手动触发 `/scan` 扫描
- 有独立的 MCP Server 和前端 Dashboard
- 学习笔记存在 `studies/` 目录

### 痛点

1. **手动触发麻烦** — 每次都要记得去扫描
2. **和猫猫割裂** — 想讨论新文章还得切项目
3. **两套代码维护** — Signal Hunter 和 Cat Café 分开

### 目标

> "每天自动拉信存着，我能和猫进行深度学习"

铲屎官想要：
1. **全自动** — 每天后台抓取，不用手动触发
2. **异步通知** — 抓完发邮件，不用盯着看
3. **和猫猫学习** — 在 Cat Café 里和三猫讨论新技术
4. **信源可控** — 上线后能自己 on/off 开关

---

## 2. 核心决策

### 决策 1：合并而非独立项目

| 独立项目的问题 | 合入 Cat Café 的好处 |
|--------------|-------------------|
| 维护两套代码 | 统一维护 |
| 需要手动触发 `/scan` | 问猫猫"今天有什么新文章" |
| 学习笔记存 signal-hunter | 洞察直接存 Hindsight，三猫可回忆 |
| 前端是独立 Dashboard | 直接在 Cat Café 对话里交互 |

**结论**：Signal Hunter 的核心能力合入 Cat Café，不再作为独立项目。

### 决策 2：分层存储

| 数据类型 | 存储位置 | 理由 |
|---------|---------|------|
| **原始文章** | 文件系统 (`~/.cat-cafe/signals/library/`) | 落盘、Git 友好、人可读、不丢 |
| **元数据索引** | Redis | 方便查询/过滤/排序 |
| **学习洞察** | Hindsight | 猫猫解读后的理解，可 Recall |

目录结构：
```
~/.cat-cafe/signals/
├── library/           # 原始文章（Markdown）
│   ├── anthropic/
│   │   └── 2026-02-12-xxx.md
│   └── openai/
│       └── 2026-02-11-yyy.md
├── inbox/             # 待处理（新抓到还没看的）
└── sources.yaml       # 信源配置
```

### 决策 3：系统级调度 + 异步通知

| 组件 | 方案 | 理由 |
|------|------|------|
| **定时抓取** | launchd（macOS 系统级） | 7x24 后台跑，不依赖 Cat Café |
| **抓取脚本** | 独立 Node/Python 脚本 | 抓完写入文件 + Redis，然后发通知 |
| **通知渠道** | 邮件 + Cat Café 内消息 + macOS 弹窗 | 多渠道，用户可配置 on/off |
| **和猫猫联动** | 打开 Cat Café 时 | 猫猫读 inbox 给你摘要 |

### 决策 4：信源全列 + on/off 开关

所有信源默认列入配置，用户可随时开关：

```yaml
sources:
  - id: anthropic-news
    name: Anthropic Newsroom
    url: https://www.anthropic.com/news
    tier: 1
    enabled: true  # 用户可关闭
```

---

## 3. 通知系统设计

### 多渠道通知

| 渠道 | 场景 | 实现方式 | 默认 |
|------|------|---------|------|
| **📧 邮件** | 不在电脑前也能收到 | `nodemailer` + SMTP | ✅ 开 |
| **Cat Café 内消息** | 下次打开就看到 | 系统消息写入 thread | ✅ 开 |
| **macOS 系统通知** | 电脑前弹窗提醒 | `node-notifier` | 可选 |
| **Telegram Bot** | 手机推送 | Telegram API | 可选 |

### 邮件日报示例

```
收件人: landy@xxx.com
主题: 🐱 Cat Café 信号日报 - 2026-02-12

今天有 5 篇新文章：

📌 Tier 1（必读）
1. [Anthropic] Claude 4.6 发布公告
   https://anthropic.com/news/claude-4-6

2. [DeepMind] Gemini 2.5 技术报告
   https://deepmind.google/blog/gemini-2-5

📚 Tier 2（建议）
3. [arXiv] Agent Memory 新论文
   https://arxiv.org/abs/2602.xxxxx

---
回复本邮件或打开 Cat Café 和猫猫深入讨论！
```

### 配置示例

```yaml
notifications:
  channels:
    email:
      enabled: true
      smtp:
        host: smtp.gmail.com
        port: 587
        user: your-email@gmail.com
        # password 从环境变量 CAT_CAFE_SMTP_PASSWORD 读取
      to: landy@xxx.com

    system:
      enabled: true  # macOS 弹窗

    in_app:
      enabled: true  # Cat Café 内消息

  schedule:
    daily_digest: "08:00"  # 每天早 8 点发日报
    instant_tier1: false   # Tier 1 文章是否即时通知
```

---

## 4. 信源清单

### 来源

- **缅因猫调研报告**：`docs/research/signal-hunter.md`（2026-02-12）
- **布偶猫补充**：xAI、Mistral、Cohere、Together AI、Groq

### 信源分级标准

| Tier | 说明 | 判定依据 |
|------|------|---------|
| **Tier 1** | 一手技术源，可直接信任 | 官方发布、论文原文、官方 GitHub |
| **Tier 2** | 需交叉验证 | 聚合平台、个人整理、企业博客含技术细节 |
| **Tier 3** | 二手分析，参考价值 | VC/咨询/播客/长文评论 |
| **Tier 4** | 噪声源，反向过滤 | 营销号、标题党、无引用 |

### 完整信源清单

#### Tier 1：大厂官方（全球）

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| Anthropic Newsroom | `https://www.anthropic.com/news` | 网页 | 中高频 |
| Anthropic Research | `https://www.anthropic.com/research` | 网页 | 中频 |
| Anthropic Engineering | `https://www.anthropic.com/engineering` | 网页 | 中频 |
| Anthropic Alignment Blog | `https://alignment.anthropic.com/` | 网页 | 中高频 |
| OpenAI Research | `https://openai.com/research/` | 网页 | 中频 |
| OpenAI News RSS | `https://openai.com/news/rss.xml` | RSS | 高频 |
| Google DeepMind Blog | `https://deepmind.google/blog/` | 网页 | 中高频 |
| Google DeepMind Publications | `https://deepmind.google/research/publications/` | 网页 | 中频 |
| Google Research Blog | `https://research.google/blog/` | 网页 | 高频 |
| Meta AI Blog | `https://ai.meta.com/blog/` | 网页 | 中频 |
| Microsoft Research Blog | `https://www.microsoft.com/en-us/research/blog/` | RSS | 中高频 |
| Apple ML Research | `https://machinelearning.apple.com/` | RSS | 中频 |
| Amazon Science | `https://www.amazon.science/` | 网页 | 中频 |
| AWS ML Blog | `https://aws.amazon.com/blogs/machine-learning/` | RSS | 高频 |
| **xAI Blog** | `https://x.ai/blog` | 网页 | 发布驱动 |
| **Mistral AI News** | `https://mistral.ai/news/` | 网页 | 发布驱动 |
| **Cohere Research** | `https://cohere.com/research` | 网页 | 中频 |
| **Together AI Blog** | `https://www.together.ai/blog` | 网页 | 中频 |
| **Groq News** | `https://groq.com/news/` | 网页 | 低频 |

#### Tier 1：国内厂商

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| DeepSeek API News | `https://api-docs.deepseek.com/news` | 网页 | 中频 |
| DeepSeek GitHub | `https://github.com/deepseek-ai` | GitHub API | 中频 |
| Qwen Blog | `https://qwenlm.github.io/blog/` | 网页 | 中频 |
| Qwen GitHub | `https://github.com/QwenLM` | GitHub API | 中频 |
| Moonshot Docs | `https://platform.moonshot.ai/docs/overview` | 网页 | 中高频 |
| MiniMax GitHub | `https://github.com/minimax-ai` | GitHub API | 中频 |
| 智谱技术报告 | `https://bigmodel.cn/technology-report` | 网页 | 低中频 |
| 百川 GitHub | `https://github.com/baichuan-inc` | GitHub API | 低中频 |
| 字节 Seed Blog | `https://seed.bytedance.com/blog` | 网页 | 低中频 |

#### Tier 1/2：论文平台

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| arXiv cs.CL | `https://export.arxiv.org/rss/cs.CL` | RSS | 日更 |
| arXiv cs.AI | `https://export.arxiv.org/rss/cs.AI` | RSS | 日更 |
| arXiv cs.LG | `https://export.arxiv.org/rss/cs.LG` | RSS | 日更 |
| Hugging Face Papers | `https://huggingface.co/papers` | 网页/API | 日更 |
| Semantic Scholar | `https://www.semanticscholar.org/` | API | 高频 |

#### Tier 2：开源社区与框架

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| GitHub Trending | `https://github.com/trending` | 网页 | 日更 |
| LangChain Blog | `https://blog.langchain.dev/` | RSS | 中高频 |
| LangChain Changelog | `https://changelog.langchain.com/` | 网页 | 高频 |
| LlamaIndex | `https://www.llamaindex.ai/` | 网页 | 中频 |
| vLLM GitHub | `https://github.com/vllm-project/vllm` | GitHub API | 高频 |
| llama.cpp GitHub | `https://github.com/ggerganov/llama.cpp` | GitHub API | 高频 |

#### Tier 2/3：技术博主

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| Simon Willison | `https://simonwillison.net/` | 网页 | 高频 |
| Lilian Weng (Lil'Log) | `https://lilianweng.github.io/` | 网页 | 低中频 |
| Chip Huyen | `https://huyenchip.com/` | 网页 | 低中频 |

#### Tier 3：VC/行业分析

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| a16z AI | `https://a16z.com/ai/` | 网页 | 中频 |
| Latent Space | `https://www.latent.space/` | RSS | 周更 |
| The Gradient | `https://thegradient.pub/` | 网页 | 周更 |

#### Tier 3：社区/聚合

| 信源 | URL | 抓取方式 | 更新频率 |
|------|-----|---------|---------|
| Hacker News | `https://news.ycombinator.com/` | RSS/API | 高频 |
| Reddit r/MachineLearning | `https://www.reddit.com/r/MachineLearning/` | 网页 | 高频 |
| Reddit r/LocalLLaMA | `https://www.reddit.com/r/LocalLLaMA/` | 网页 | 高频 |

---

## 5. 抓取可行性

### 有 RSS 的（优先用）

- OpenAI: `https://openai.com/news/rss.xml`
- Microsoft Research: `https://www.microsoft.com/en-us/research/blog/feed/`
- Apple ML: `https://machinelearning.apple.com/feed.xml`
- AWS ML: `https://aws.amazon.com/blogs/machine-learning/feed/`
- arXiv: `https://export.arxiv.org/rss/cs.CL` 等
- LangChain: `https://blog.langchain.dev/rss/`
- Latent Space: `https://www.latent.space/feed`
- Hacker News: `https://news.ycombinator.com/rss`

### 有 API 的

- arXiv API: `https://export.arxiv.org/api/query`
- Semantic Scholar API: `https://api.semanticscholar.org/`
- Hugging Face Hub API: `https://huggingface.co/docs/hub/api`
- Hacker News Algolia: `https://hn.algolia.com/api`
- GitHub API: repos/releases/commits

### 需要爬网页的

- Anthropic 系列（无官方 RSS）
- Google DeepMind（无官方 RSS）
- Meta AI（无官方 RSS）
- 国内厂商大部分

### 兜底方案

- **RSSHub**：对无 RSS 站点生成订阅源
- **自建 feed 生成器**：定期爬取 + 生成标准 RSS

---

## 6. 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│  🕐 launchd (macOS 系统级定时任务)                               │
│  每天 08:00 触发                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📡 Signal Fetcher (独立脚本)                                    │
│  ─────────────────────────────                                  │
│  1. 读取 sources.yaml (enabled 的信源)                          │
│  2. 按优先级抓取 (RSS → API → 网页)                              │
│  3. 去重 (和 Redis 索引对比)                                     │
│  4. 新文章 → 写入 library/ + 更新 Redis 索引                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📬 Notification Service                                        │
│  ─────────────────────────────                                  │
│  1. 生成日报摘要                                                 │
│  2. 发送邮件 (nodemailer)                                       │
│  3. 写入 Cat Café 系统消息                                       │
│  4. macOS 弹窗通知 (可选)                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  🐱 Cat Café (你打开时)                                          │
│  ─────────────────────────────                                  │
│  - "布偶猫，今天有什么新文章？"                                   │
│  - 布偶猫读 inbox → 给你摘要                                     │
│  - "这篇帮我深入解读" → 猫猫解读 → Retain 到 Hindsight            │
└─────────────────────────────────────────────────────────────────┘

存储层：
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  📁 文件系统  │  │  🗄️ Redis    │  │  🧠 Hindsight │
│  library/    │  │  索引/元数据  │  │  学习洞察     │
│  原始文章    │  │  快速查询     │  │  可 Recall   │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 7. 用户交互场景

### 场景 1：被动接收日报

```
[早上 8:05]
📧 收到邮件：Cat Café 信号日报 - 2026-02-12
   今天有 3 篇新文章...

[你看邮件，发现 Anthropic 发了新东西]
```

### 场景 2：主动查询

```
你：布偶猫，今天有什么新文章？

布偶猫：今天抓到 3 篇新文章：

📌 Tier 1
1. [Anthropic] Claude 4.6 System Prompt 更新
   - 新增了 tool_use 的详细规范

2. [DeepSeek] DeepSeek-V3 推理优化
   - MoE 架构改进，推理速度提升 40%

📚 Tier 2
3. [arXiv] "Agent Memory: A Survey"
   - 综述了 Agent 记忆架构的主流方案

要我帮你深入解读哪篇？
```

### 场景 3：深度学习

```
你：第一篇帮我深入解读一下

布偶猫：好的，让我仔细看看这篇...

[读取原始文章]
[生成解读]

这篇主要讲了 3 个变化：
1. tool_use 现在支持并行调用...
2. 新增了 computer_use 工具类型...
3. 安全边界更明确了...

**我的理解**：这对我们 Cat Café 的影响是...

要我把这个洞察存到记忆里吗？下次讨论相关话题我能想起来。

你：存一下

布偶猫：[Retain 到 Hindsight]
已存储！关键词：Claude 4.6, tool_use, 并行调用
```

---

## 8. 决策确认（2026-02-12 讨论结果）

| 问题 | 决策 | 备注 |
|------|------|------|
| SMTP 配置 | **配置化，至少支持 Gmail** | 用户自己填邮箱，支持 Gmail/QQ/Outlook/自定义 |
| 抓取频率 | **每天一次** | 简单可靠，后续可按需调整 |
| 去重策略 | **按 URL** | 相同 URL 不重复抓取 |
| 文章存储 | **原始全文 + 链接** | 落盘到 `~/.cat-cafe/signals/library/` |
| 现有 Signal Hunter | **有用的拿来用** | 迁移 library/ 里的文章、sources.yaml 配置 |

---

## 9. 下一步

1. **铲屎官确认** — 本文档 OK 后进入 Phase 计划
2. **Phase 计划** — 拆分成可执行的步骤
3. **缅因猫 Review** — Phase 计划需要 review

---

## 参考资料

- 缅因猫信源调研：`docs/research/signal-hunter.md`
- 现有 Signal Hunter 项目：`/Users/lysander/projects/relay-station/signal-hunter`
- Hindsight 集成（Phase 5.0）：已完成
