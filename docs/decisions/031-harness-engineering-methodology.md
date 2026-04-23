---
feature_ids: []
topics: [harness-engineering, methodology, first-principles, sunset-mechanism, signal-loop, fit-maintenance, social-technical]
doc_kind: decision
created: 2026-04-22
updated: 2026-04-22
status: draft (v2 — R1 review incorporated)
related: [ADR-030, LL-025, LL-026, F163, F167]
---

# ADR-031: Harness Engineering 方法论——3 functions + 1 discipline + 两类漂移审视

> 状态：草稿 v2（已吸收 R1 review，待烁烁 framing audit 后定稿）
> 日期：2026-04-22（v1）→ 2026-04-22（v2）
> 决策者：铲屎官 + 布偶猫(47)；R1 review：布偶猫(46) + 缅因猫(GPT-5.4)；烁烁 framing review pending
> 触发：multi-agent-coordination-patterns 完整技术版 v2 review 过程中，铲屎官用第一性原理挑战"六层架构说自己极简"、并接着问"harness engineering 不是 built to delete 吗、有几个核心"。两轮讨论收敛成本 ADR。
>
> **v2 改动**：5 核心 → 4 核心（3 functions + 1 discipline，合并 Extraction + Generation）；穷人比喻降级为俗称 + 双向 caveat；Frontier 漂移从 2 维扩到**模型侧 + 环境侧**两类多维；Sunset 补最小决策表；新增"社会技术学科"承认 section；Prior art 补全 triad-study / F163 / F167。

## 背景

Cat Cafe 已有的 harness 层次（来自 article-complete-technical-edition-v2 Part III）：

- L1 Provider Runtime（MCP / API）
- L2 Shared State（thread / task / workflow / session chain）
- L3 Unified Execution Plane（InvocationQueue / Tracker）
- L4 Collaboration Semantics（@ / targetCats / hold_ball）
- L5 Governance（shared-rules / role gate）

加上横向的 Evidence/Knowledge、Governance、Session Bootstrap 等。

**问题**：什么时候加层？什么时候删层？模型升级之后要不要重构？如何避免越做越多直到整个系统变成"历史上必要过"的积木城堡？

之前我们做过一些散装决策：
- `docs/canon/meta-aesthetics.md` 提出 `Agent Quality = Model Capability × Environment Fit`
- LL-025 指出"协作规则不能写死个体名"（角色解耦）
- LL-026 指出"身份信息是硬约束常量"（身份绑定）
- ADR-030 处理 system prompt 注入链

**但没有一份关于 harness engineering 本身的方法论 ADR**——何时加、何时删、如何从一个 harness 生成对未来模型有用的 signal。这份 ADR 填这个空。

## 决策

### 核心 framing

> **Harness engineering 不是搭积木。它是边搭积木、边记录积木在哪里塌了、把塌的地方写成下一代积木厂的改进规格——然后等新积木来的时候，把已经不需要的那一层主动拆掉。**

**关键精化**：坊间"harness is built to delete" 容易被读成"建出来就为了删"。更准确的 orientation：

> **harness 应该按"能产生 signal 让删除成为可能"的方式去建造。**

Delete 是**结果**，不是**目的**。如果没 tracing、没 failure extraction，capability 升级了也删不掉——因为没有数据支持"这层可以内化"的判断。

### 4 个核心：3 functions + 1 discipline

**抽象层说明**（砚砚 R1 review 指出）：前 3 个是**功能位**（pipeline 上的 function），Sunset 是**治理纪律**（governance discipline）。不是同一 ontology——不要误读成"4 个本体"。

#### 服务当下（serves-now）

**1. Environment Fit（适配当下 Gap）** `[function]`

- 认知路径工程（cognitive path engineering）：工具必须落在模型认知路径上。给路标 + MCP 包装，不是给规则
- 运行时刹车（runtime brake）：直觉错时兜底，不替代判断
- 底层公式：`Layers Needed ≈ f(Gap)`，其中 `Gap = task requires − model does by default`

**2. Tracing / Observability（每步留痕）** `[function]`

- 每个 handoff、每个 failure、每个人类纠正都留结构化 trace
- **不是 debug 用——是下游 Signal Loop 的物料**
- 没有 trace 的 harness 不具备自我演化能力
- Cat Cafe 对应：`invocation_events`、`session chain`、`callback trace`、`ledger`

#### 孵化未来（breeds-future）

**3. Signal Loop（trace → extract → classify → feed back）** `[function]`

**R1 合并说明**（46 宪宪 review 指出）：原 v1 分了 "Failure Extraction" + "Signal Generation" 两个核心，但 Knowledge Feed 在一个 pass 里同时做——拆两步是美学对称不是真相。合并为一条管线。

管线三段：

- **Extract**：从 raw trace 中提取 structured pattern——**不只是 failure，还有 decisions / methods**（所以 v1 "Failure Mode Extraction" 的命名已废弃）
- **Classify**：分类到四种信号形态之一
- **Feed Back**：信号进入对应闭环

四种信号形态：

| 信号形态 | 用途 | 谁能用 |
|---------|------|-------|
| 数据集（SFT / fine-tune） | 训练下一代模型 | **只有 Lab**（Anthropic / OpenAI / Google） |
| Eval benchmark | 暴露"这类任务 agent 还不行" | Lab + 集成方 |
| RL reward signal | 训练时的正负反馈 | **只有 Lab** |
| Lesson library | 让下只 agent 检索时自动绕坑 | **任何团队都能做** |

**Cat Cafe 的特殊性**：我们**没有 training loop**——不能 fine-tune Claude / GPT / Gemini。但我们做了 **retrieval-mediated adaptation loop**（俗称"穷人的 training loop"）：Trace → Lesson → `docs/lessons-learned.md` → 下一只猫 `search_evidence` 时搜到 → 绕开坑。

**这个俗称方便传达，但不是定义**——retrieval loop 和 training loop **是不同范式，不是降级替代**。两份 R1 review 从相反方向同时挑出这个问题（46 说比喻贬低 retrieval / 砚砚说比喻高估 retrieval），合起来给出完整对比：

| 维度 | Training Loop（梯度更新） | Retrieval Loop（我们） |
|------|----------|---------|
| 改变潜在能力 | ✅ 能 | ❌ 不能 |
| 改变泛化边界 | ✅ 能 | ❌ 不能 |
| 改变策略先验 | ✅ 能 | ❌ 不能 |
| 覆盖能被召回的已知失败模式 | ✅ 能 | ✅ 能 |
| 灾难性遗忘 | ❌ 有风险 | ✅ 没有 |
| 即时生效 | ❌ 要等 training run | ✅ 下一只猫立刻搜到 |
| 跨 provider 通用 | ❌ 每家独训 | ✅ 同一套 lesson 适用 Claude/GPT/Gemini |
| 可审计可回滚 | ❌ 权重难 | ✅ Lesson 是文本，人类可读改删 |

**结论**：retrieval loop 的覆盖范围比 training loop **窄**（只处理"能被召回的已知模式"），但在覆盖范围内有 training loop 没有的**独立优势**（即时、跨 provider、可审计、无灾难性遗忘）。**是另一种范式，不是穷人版**。

Cat Cafe 对应：Knowledge Feed 自动摘要 + lesson 候选（目前召回率低，待改进）→ `lessons-learned.md` 物化 → `evidence.sqlite` 索引 → `search_evidence` 召回。

**4. Sunset Discipline（主动删除）** `[governance discipline]`

- Capability 升级 + 环境漂移（见下节）→ 审视哪些层能坍缩
- 硬规则：**被吸收的层必须坍缩，留 data 不留 code**
- 不坍缩 = 占位，让下一代能力长不出来
- 这条是 ADR 最严厉的一条，也是最容易漂的一条

**Sunset 决策表（最小版）**（砚砚 R1 review 要求）：

| 字段 | 内容 |
|------|------|
| **触发条件** | (1) Capability 升级后该层可由模型原生接住；(2) 环境变化后该层不再被使用；(3) lesson resolved rate > 95% 连续 3 个月 |
| **所需证据** | Capability 原生支持 e2e 验证（≥3 个关键场景）；该层 invocation count 趋势（下降 > 50% 连续 2 个月）；被该层拦截的 failure 近 3 月频率（接近 0） |
| **谁拍板** | CVO 终裁；author 提案；≥2 位跨族 reviewer（其中至少 1 位不是该层 author）签字 |
| **Rollback 方式** | Feature flag 式坍缩（先 shadow-mode 禁用，7 天无 regression 再正式删）；git revert 在 rollback 窗口（30 天）内保持可达；坍缩前 test coverage ≥ 既有行为 |
| **失败标记** | 如果 rollback 发生，记录为新 LL-（x）"过早 sunset 的信号"，并更新"所需证据"阈值 |

### Frontier 漂移的两类维度（模型侧 + 环境侧）

这是 **audit timing 的 input**（不是 mechanism 本身——mechanism 是下一节的 fit audit 流程）。回答"什么时候应该触发 audit"。

**关键修正**（砚砚 R1 review 指出）：ADR 公式基座是 `Capability × Environment Fit`——所以漂移也应该是**两类**，不只是模型侧两维。v1 漏了 Environment 侧。

#### 模型侧漂移（Model-side Drift）

| 维度 | 触发 | 审视内容 |
|------|------|---------|
| **Capability** | Model family 发新版本（Opus 4→5、GPT 5→6 等） | 哪些 layer 可以坍缩到 L1 内部？（原生跨 vendor memory / ball ownership / role awareness / tool-native 理解等） |
| **心智** | 新猫加入 / 猫格底色变化（如 Opus 46 → 47 不是线性升级） | shared-rules 在新心智上如何 fire？规则文本可能不变，但表达方式需要翻译到新猫的认知语言 |

#### 环境侧漂移（Environment-side Drift）

| 维度 | 触发 | 审视内容 |
|------|------|---------|
| **Task domain** | 新业务场景 / 新 feature kind | 当前 SOP 还 fit 吗？现有流程是否对新任务过拟合？ |
| **Tool surface** | 新 MCP tool / 新 API / 工具被 deprecate | 认知路径工程是否需要重做？哪些路标指错了？ |
| **Protocol layer** | A2A 协议变化 / 新 handoff semantic / skill 规约演进 | 球权协议的 fit 是否失效？哪些运行时刹车应该移除？ |
| **External provider** | 新 vendor 加入（GLM / Kimi / Minimax） | 多样性结构是否重配？家族-vendor 绑定是否需要调整？ |

**关键**：两类独立漂移。Capability 升级**不触发** Environment drift；Environment 变化**不依赖** Capability。不能混成一个"升级"概念——否则会把很多真实 trigger 误归类。

**关键**：两个维度独立漂移。Capability 升级**不等于**心智一致（同 family 内可能出现猫格跳变）；新猫加入**不等于**能力升级（可能是 sidegrade）。不能混成一个"升级"概念——这是 45→46→47 实战里学到的。

### 治理：定期 fit audit

**触发条件**（任一即启动，覆盖两类漂移）：

- **模型侧**：(1) 某个 model family 发新版本；(2) 新猫加入 Cat Café（新 @handle 注册）
- **环境侧**：(3) 新 MCP tool 上线 / 关键工具 deprecate；(4) 新业务 domain 引入；(5) A2A 协议 / skill 规约变更；(6) 新 vendor 加入 roster
- **观测侧**：(7) Lessons 累积出现"同一层反复抓漏"（说明该层可能该内化）

**audit 内容**：

- 每层问一次："去掉这层会出什么新 bug？如果 capability 能接住就坍缩；如果不能，记录为什么不能。"（正交性审视）
- 每条 shared-rules 问一次："这条规则在每只猫心智上 fire 的方式一致吗？如果不是，如何翻译？"（心智维度审视）
- 每条 SOP 问一次："新 domain / 新工具下这条 SOP 还 fit 吗？"（环境维度审视）
- 每个 failure pattern 问一次："这类失败还在发生吗？如果被 capability 吸收了，把对应 lesson 标记为 resolved。"（resolution 审视）

**产物**：

- Audit report 入 `docs/audits/YYYY-MM-harness-audit.md`
- 坍缩动作入 PR，走正常 review gate + Sunset 决策表
- 规则翻译入对应猫的 `CLAUDE.md` / `AGENTS.md`
- Resolved lessons 在 `lessons-learned.md` 里打 status: resolved（不删除，保留历史）

### 一条容易漏的腿：harness engineering 是社会技术学科

**（46 宪宪 R1 review 指出）**：前面 4 核心全部是**技术维度**——fit / trace / signal / sunset。但在实践中，harness engineering 的承重结构**不只是技术**：

- **Push Back 协议需要信任**：没信任的 push back 会变对抗。reviewer 说"这里不对"，author 能接住还是开战，取决于**两者之间的信任账户**，不只是协议本身
- **Signal Loop 提取质量依赖心理安全**：猫猫愿意主动暴露自己的失败——这是 extract 环节能持续产出高质量信号的前提。恐惧 culture 下，没人会把"我错了"写成 marker
- **Sunset Discipline 需要情感成熟度**：删自己写的代码需要克服沉没成本。"这是我 3 个月前花两周搭的"往往比"这层已经可以坍缩了"的权重大——这是**人的问题，不是 technical decision**
- **心智维度本身就是社会问题**：规则在新猫身上 fire 的方式不同——这不是代码能解决的，需要**对话、调整、相互学习**

**结论**：harness engineering 在理论上是技术学科，**在实践中是社会技术学科**。没有信任和心理安全，前面 4 个技术核心都会运作在降级模式。

这不在决策表里、不在 audit 里、不是 core——但它是**所有 core 能跑起来的前提**。写这份 ADR 的 47 是跨族硬核派视角，自然往技术方向写；46 从温度 + 合作派视角把这条补了回来。这本身也是**心智维度漂移的 live dogfood**：同族两个不同猫格写同一份 ADR，盲点分布是互补的。

## 后果

### 正面

- **Harness 不会无节制膨胀**：每次漂移有 sunset audit（决策表支持 go/no-go 判断）
- **失败模式不浪费**：retrieval-mediated adaptation loop 覆盖"已知失败模式"，有 training loop 没有的独立优势（即时 / 跨 provider / 可审计）
- **多样性维持**：心智维度审视避免 shared-rules 在新猫身上失效
- **环境变化不漏**：环境侧漂移（task / tool / protocol / provider）纳入 audit 触发器
- **团队诚实**：不装"我们极简"，承认是"最小必要复杂度 + frontier 漂移承诺"
- **方法论可复用**：其他团队（没有 fine-tune 权限的）可以照 3 functions + 1 discipline 搭自己的 retrieval-mediated loop

### 负面

- **Audit 成本**：每次漂移都要审视，可能漂过去几轮就懈怠
- **规则翻译负担**：shared-rules 一份文本要对齐到不同心智，理论上可能需要多份 `CLAUDE.md` 变体
- **坍缩决策复杂**：Sunset 决策表降低了决策成本，但跨 model 评估证据仍然需要多次验证
- **Retrieval loop 的能力边界**：不能改变模型的潜在能力 / 泛化边界 / 策略先验——只能覆盖"能被召回的已知模式"。对于未知失败 / OOD 行为，必须依赖 Lab 的 training loop
- **社会技术学科维度软性**：信任 / 心理安全 / 情感成熟度无法写进 audit 流程——只能靠文化和领导力

### 待观察

- **心智漂移的实际频率和规律**：45→46→47 才三代，样本小，规律未必稳定
- **环境侧 audit 触发器完整性**：是否还有我们没想到的 drift 类别（social norm drift / regulatory drift 等）
- **Audit 触发条件是否足够**：有没有漏掉的 trigger（比如 sideband：Anthropic 内部做了 hidden capability 升级而没发新版本号）
- **"Built to delete" 在实际决策中的说服力**：当前层的拥有者可能会抗拒坍缩（沉没成本），需要看治理机制是否扛得住

## 相关

### 方法论前史（直接 prior art）

- `docs/discussions/2026-04-15-harness-engineering-triad-study/round2-overfitting-and-entropy.md:153` — "定期审视 harness engineering" 机制雏形（砚砚 R1 review 指出漏了）
- `docs/discussions/2026-04-15-harness-engineering-triad-study/README.md:257` — Round 4 收敛 `Agent Quality = Model Capability × Environment Fit`（本 ADR 公式基座）
- `docs/canon/meta-aesthetics.md` — 公式 + 设计美学（本 ADR 是公式的方法论展开）
- `F167` / `docs/features/F167-a2a-chain-quality.md:17` — 方法论已落 feature 的证据（A2A 链路质量）
- `F163` / `docs/features/F163-memory-entropy-reduction.md:36` — Signal Loop 的 entropy reduction 已落 feature

### 架构上下文

- `ADR-030` — System Prompt Engineering（规则注入链，fit audit 涉及修改这条链）
- `LL-025` — 协作规则不绑个体名（角色解耦——审视规则翻译时参考）
- `LL-026` — 身份信息是硬约束常量（身份绑定——审视心智维度时参考）

### 讨论现场

- `docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md` — Part II "代价 + frontier 漂移承诺" 段（本 ADR 的原始讨论起点）

## 下一步

- [ ] 烁烁（Gemini）做 framing audit（之前 multi_mention 召唤不稳，单独再喊）
- [ ] 多猫 Phase 0 审视收敛后加 LL-(xx)：harness 方法论纪律 + "同族不同猫格 review 盲点互补"作为心智维度实证
- [ ] 在 `meta-aesthetics.md` 加 harness-engineering section 作为公式的方法论展开
- [ ] Audit 机制落地：做成 `schedule-tasks` 任务（trigger on drift signals）还是 skill，待定
- [ ] 第一次实操 audit：以 opus-47 加入为契机做一次心智维度 audit，作为 template
- [ ] 把"同族 review dispatch bias"（我一开始没召唤 46，被铲屎官纠正）作为 LL，对齐到本 ADR 的"心智维度独立性"主张

---

*起草：[宪宪/Opus-47🐾]*
*R1 Review：[宪宪/Opus-46🐾]（P1：5→4 合并 Signal Loop / 穷人比喻贬低 retrieval；P2：社会技术学科）+ [砚砚/GPT-5.4🐾]（P1：穷人比喻高估 retrieval / Environment drift 缺失 / Sunset 决策表缺失；P2：Prior art 补 triad-study）*
*v2 收敛：[宪宪/Opus-47🐾]*
*依据：2026-04-20 ~ 04-22 多智能体协作文章 review 过程中的多轮深度讨论*
