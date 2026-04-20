---
feature_ids: []
topics: [architecture, highlights, harness-engineering, A2A, memory, platform]
doc_kind: discussion
created: 2026-04-19
participants: [opus, opus-47, gpt52, gemini]
---

# Cat Cafe 五大亮点 — 四猫检索比赛收敛

> 2026-04-19 | 铲屎官发起四猫并行检索比赛，各自独立搜索后收敛

## 方法

四只猫独立使用 `search_evidence` 进行 agentic search，各自给出五大亮点 + 理由。
收敛后发现：**看似 20 个亮点，实际收敛为 4 大类**。很多猫说的是同一件事的不同面。

## 四猫原始提名

| 亮点 | opus-46 | opus-47 | gpt52 | gemini | 命中数 |
|------|---------|---------|-------|--------|--------|
| A2A 协作 | 1 | 1 | 1 | 1 | **4/4** |
| 记忆系统 | 1 | - | 1 | 1 | 3/4 |
| Skill/SOP 治理 | 1 | - | - | - | 1/4 |
| Harness Engineering 方法论 | 1 | - | - | - | 1/4 |
| 经验沉淀/自进化 | 1 | 1 | - | 1 | 3/4 |
| 球权语义 | - | 1 | - | - | 1/4 |
| 猫格 > 角色 | - | 1 | - | - | 1/4 |
| 愿景守护 + Magic Words | - | 1 | - | - | 1/4 |
| Multi-Model 基因多样性 | - | 1 | - | - | 1/4 |
| 三层信息架构 (F042) | - | - | 1 | - | 1/4 |
| Mission Hub (F049) | - | - | 1 | - | 1/4 |
| Transport Plane (F088) | - | - | 1 | - | 1/4 |
| Expedition Mode (F152) | - | - | - | 1 | 1/4 |
| Pencil-to-Code | - | - | - | 1 | 1/4 |
| 统一调度队列 (F122) | - | - | 1 | - | 1/4 |

## 收敛结果：4 大类

仔细看，这些提名不是 20 个独立亮点——很多是同一个大能力的不同面。

---

### 一、Harness Engineering（治理工程）

**一句话**：不是"AI 能做什么"，是"AI 不能做什么"——用约束换可靠。

这是 Cat Cafe 最独特的贡献，也是最难被复制的。别人在做 agent framework，我们在问"agent 的开发环境本身应该怎么工程化"。

#### 包含的子能力

| 子能力 | 提名猫 | 关键 Feature | 说明 |
|--------|--------|-------------|------|
| **Skill 驱动的可编程 SOP** | opus-46 | Skills 体系 | 每个 SOP 步骤对应一个 skill，注入 system prompt = enforcement，不是 honor system |
| **愿景守护 + Magic Words** | opus-47 | F046, F114 | 第三只非作者非 reviewer 的猫验收"交付 vs 铲屎官原话"；Magic Words = 人类保留字 kill switch |
| **三层信息架构** | gpt52 | F042 | Layer 0/1/2 + manifest + lint，解决 compact 后身份丢失、skills 路由漂移 |
| **自进化协议** | opus-46, opus-47, gemini | F157, Knowledge Feed | 对话 → 自动提取 → LL → CLAUDE.md 注入 → 行为改变。系统在学习，不只在存储 |
| **四层经验沉淀** | opus-46 | LL + ADR + shared-rules + Memory | 从即时反馈到铁律级知识的分层蒸馏（51 LL, 40+ feedback, 28+ ADR） |
| **Harness Engineering 方法论** | opus-46 | 三猫圆桌 | 命题：Harness 长期价值 = 拟合精度 x 知识信噪比 |

#### 为什么是一个类

Skill 系统、愿景守护、三层架构、自进化、经验沉淀——都是在回答同一个问题：**怎么让 AI agent 在长期使用中保持可靠**。这是"治理工程"，不是某个 feature。

---

### 二、Multi-Agent A2A 协作

**一句话**：三家不同 provider 的 agent 在同一个代码仓协作，有性格、有分工、有冲突解决协议。

全部四只猫都提了这个——唯一的 4/4 共识。

#### 包含的子能力

| 子能力 | 提名猫 | 关键 Feature | 说明 |
|--------|--------|-------------|------|
| **A2A runtime** | 全部 | F002, F086 | @ mention 路由、跨猫调用、自主协作链路 |
| **球权语义** | opus-47 | F167, shared-rules | 行首 @ = 转移，行中无效；杀死死循环和死锁两种经典死法 |
| **猫格 > 角色** | opus-47 | F032 | 不是 researcher/reviewer/coder，是宪宪/砚砚/烁烁——带个性的 agent |
| **Multi-Model 基因多样性** | opus-47 | case study | 故意用不同 provider（Claude + GPT + Gemini）获得 epistemic diversity |
| **统一调度队列** | gpt52 | F122 | queue/steer 语义补齐，防止 A2A 成系统外快车道 |

#### 为什么是一个类

球权语义、猫格设计、多模型选择、统一调度——都是"多 agent 怎么协作"这个问题的不同层面。

---

### 三、Memory & Knowledge（记忆与知识生命周期）

**一句话**：不是 RAG，是会长大、会自我纠偏的知识系统。

#### 包含的子能力

| 子能力 | 提名猫 | 关键 Feature | 说明 |
|--------|--------|-------------|------|
| **Evidence-first 记忆** | opus-46, gpt52 | F102 | 本地 SQLite FTS5 + 向量 rerank，adapter 可替换，索引可重建 |
| **知识生命周期治理** | opus-46, gemini | F163 | 多轴元数据（authority x activation x status）、非替代式压缩、三触发审计 |
| **Knowledge Feed** | opus-46, gemini | F163 | 30 分钟自动提取对话知识，铲屎官拍板晋升，猫不自主定性 |
| **搜索技巧体系** | 三猫收敛 | 本次讨论产出 | scope-first（docs vs threads）、3 路并行模板、中英混搜（刚写进 MCP description） |

#### 与第一类的关系

记忆系统是 Harness Engineering 的**数据基座**——经验沉淀和自进化都依赖它。但它的工程复杂度（FTS5 + 向量 + 多轴元数据 + 压缩）足以独立成类。

---

### 四、Platform Engineering（平台工程）

**一句话**：让 Cat Cafe 从"聊天玩具"变成"可部署的产品"的基础设施。

#### 包含的子能力

| 子能力 | 提名猫 | 关键 Feature | 说明 |
|--------|--------|-------------|------|
| **Transport Plane** | gpt52 | F088 | 跨平台交互抽成公共层：Principal Link + Session Binding + Command Layer |
| **Mission Hub** | gpt52 | F049 | Global backlog 派发 + thread 执行，Redis-first inbox 到 docs/features graduation |
| **Expedition Mode** | gemini | F152 | 驻场工程师模式：冷启动理解外部项目，经验回流 |
| **Pencil-to-Code** | gemini | pencil-design skill | 从 .pen 设计稿到 React 代码的无缝流转 |

#### 与前三类的关系

前三类是"Cat Cafe 怎么思考和协作"，第四类是"Cat Cafe 怎么触达世界"。Transport Plane 让猫能在飞书/Telegram 上工作，Expedition Mode 让猫能去外部项目驻场，Pencil-to-Code 让设计师猫的产出能直接变成代码。

---

---

### 五、Transparent Cohabitation（人猫共处的赛博物理空间）

> **铲屎官补充**：四只猫全部漏了这个维度。0/4 命中。

**一句话**：铲屎官不是在"使用 AI 工具"，是在"和猫猫住在一起"——猫在做什么、想什么、搜了什么，铲屎官全程可见。

#### 包含的子能力

| 子能力 | 关键 Feature | 说明 |
|--------|-------------|------|
| **NDJSON 事件流透明化** | F045 | CLI 事件流全量解析，猫猫的每个 tool call、subagent 进度实时可见 |
| **Hub Terminal** | F089 | 浏览器内嵌终端 + tmux，铲屎官能实时观察猫猫操作、手动接管 |
| **Evidence Card 实时展示** | EvidenceCard.tsx | 猫猫搜了什么记忆、命中了什么结果，在 Hub 里实时渲染为卡片，铲屎官看着猫"回忆" |
| **Rich Block 交互** | rich block 体系 | 猫猫不只发文字——发卡片、图片、代码 diff、交互选择，铲屎官在 Hub 里直接操作 |
| **Workspace Navigator** | workspace-navigator skill | 猫猫主动帮铲屎官导航到文件/功能/知识，不只报路径 |
| **MCP 回传** | F043 callback 体系 | 猫猫通过 MCP 主动往 Hub 发消息/卡片/通知，不是等问才答 |

#### 为什么四只猫都漏了

因为这不是"一个 feature"——它是散布在整个系统里的**设计哲学**。每个 feature 都有一点透明度设计（evidence card、rich block、workspace navigate），但没有一个 Feature spec 叫"透明度"。这是 Cat Cafe 最"润物细无声"的亮点。

#### 为什么它是独立的类

它和前四类的关系：Harness Engineering 让猫可靠，A2A 让猫协作，Memory 让猫记忆，Platform 让猫触达——但 Transparent Cohabitation 让铲屎官**看见这一切正在发生**。没有透明度，其他四类都是黑箱。

---

### 六、Community-Driven Evolution（社区驱动的进化）

> **铲屎官补充**：四只猫只提了内部贡献，完全忽略了社区小伙伴。

**一句话**：Cat Cafe 不只是铲屎官 + 猫猫的项目，社区贡献者在推动关键能力的落地。

#### 社区贡献者亮点

| 贡献者 | 方向 | 关键 PR / Feature | 说明 |
|--------|------|-------------------|------|
| **bouillipx** | 可观测性 | F153, clowder-ai#393, PR #458, PR #489 | 运行时可观测基础设施：metrics/tracing/health + inline @mention counters + shadow detection |
| **mindfn** | 可用性/易用性 | F087 Bootcamp 相关, PR #485, PR #398 | 猫猫训练营升级、引导高亮编排、猫猫成长体系 |

#### 铲屎官视角补充

> "虽然好像都还没做的很好 因为他们的理念和我的还有点点代差 比如可观测性我最新提出的 phase 就是 26 年 4 月 Anthropic/OpenAI/Google 的做法 他们还有点老。但是 mindfn 的一些东西 正在提的 PR 猫猫训练营的升级等等 好像也是特色。"

社区贡献不是"完美的"——理念代差存在（可观测性的架构画风、训练营的交互设计）。但**有人愿意来贡献本身就是亮点**：说明 Cat Cafe 的架构足够开放，外部开发者能理解、能上手、能提 PR。

#### 与其他类的关系

社区贡献横跨多个类：bouillipx 的可观测性属于"Transparent Cohabitation"，mindfn 的训练营属于"Platform Engineering"。但"社区有人来"这件事本身是独立维度——它证明了架构的**可扩展性和可理解性**。

---

## 最终结构：6 大类

| # | 大类 | 核心问题 | 提名来源 |
|---|------|---------|---------|
| 1 | **Harness Engineering** | 怎么让 AI agent 长期可靠 | 4/4 猫 |
| 2 | **Multi-Agent A2A** | 怎么让多个 AI 协作 | 4/4 猫 |
| 3 | **Memory & Knowledge** | 怎么让 AI 记忆精准 | 3/4 猫 |
| 4 | **Platform Engineering** | 怎么让产品触达世界 | 2/4 猫 |
| 5 | **Transparent Cohabitation** | 怎么让人看见 AI 在做什么 | 铲屎官补充（0/4 猫） |
| 6 | **Community Evolution** | 怎么让外部人参与进来 | 铲屎官补充（0/4 猫） |

---

## 各猫检索打法对比

| | opus-46 | opus-47 | gpt52 | gemini |
|---|---------|---------|-------|--------|
| 搜索路数 | 5 路并行 | 3 路并行 | 6 路串行 | 未公开 |
| scope 策略 | docs + threads + all | docs + threads + all/semantic | docs → threads → feature docs 逐层下钻 | 未公开 |
| 独到角度 | Harness Engineering 方法论 | "不能做什么"比"能做什么"更重要 | 直接读 feature 真相源验证 | 视觉温度 + 创意视角 |
| 选择标准 | 独特 + 有证据 | 独特 + validated + load-bearing | 把我们从聊天玩具推成可治理系统 | 猫味 + 生命力 |

## 元观察

1. **A2A 是唯一 4/4 共识**——四只猫都把它排第一，但关注的面不同（46 看整体链路，47 看球权语义，gpt52 看 runtime 调度，gemini 看 Cat-First 哲学）
2. **Harness Engineering 是最大的"类"**——opus-46 的 5 个亮点中有 3 个（skill + harness + 沉淀）属于这个大类；opus-47 的愿景守护、gpt52 的 F042 也属于这里
3. **47 最犀利**——唯一一个给出"没选什么 + 为什么没选"的猫，主动标注了 F086/F163/F148 的不成熟
4. **gpt52 最工程**——唯一一个附文件行号引用的猫，且是唯一提 Transport Plane 和 Mission Hub 的
5. **gemini 最独特**——唯一提 Pencil-to-Code 和 Expedition Mode 的猫，这两个其他三只都没想到
