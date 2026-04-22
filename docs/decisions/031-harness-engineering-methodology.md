---
feature_ids: []
topics: [harness-engineering, methodology, first-principles, sunset-mechanism, signal-loop, fit-maintenance]
doc_kind: decision
created: 2026-04-22
status: draft
related: [ADR-030, LL-025, LL-026]
---

# ADR-031: Harness Engineering 方法论——5 核心 + built-to-delete 朝向 + frontier 漂移审视

> 状态：草稿（待多猫 Phase 0 审视后定稿）
> 日期：2026-04-22
> 决策者：铲屎官 + 布偶猫(47)，后续拉 @codex / @gpt52 / @gemini 审视
> 触发：multi-agent-coordination-patterns 完整技术版 v2 review 过程中，铲屎官用第一性原理挑战"六层架构说自己极简"、并接着问"harness engineering 不是 built to delete 吗、有几个核心"。两轮讨论收敛出两个互相咬合的洞察——(1) frontier 漂移（capability + 心智两维）、(2) harness 作为 training signal 产生器。合并成一份 ADR。

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

### 5 个核心（左手 = 服务当下，右手 = 孵化未来）

#### 左手：服务当下

**1. Environment Fit（适配当下 Gap）**

- 认知路径工程（cognitive path engineering）：工具必须落在模型认知路径上。给路标 + MCP 包装，不是给规则
- 运行时刹车（runtime brake）：直觉错时兜底，不替代判断
- 底层公式：`Layers Needed ≈ f(Gap)`，其中 `Gap = task requires − model does by default`

**2. Tracing / Observability（每步留痕）**

- 每个 handoff、每个 failure、每个人类纠正都留结构化 trace
- **不是 debug 用——是 signal 产生的物料**
- 没有 trace 的 harness 是"只有左手"的 harness，不具备自我演化能力
- Cat Cafe 对应：`invocation_events`、`session chain`、`callback trace`、`ledger`

#### 右手：孵化未来

**3. Failure Mode Extraction（失败模式结构化）**

- 从 raw trace 提取 structured pattern
- **大部分团队卡在这**——log 很多但没结构化提取
- Cat Cafe 对应：Knowledge Feed 自动摘要 + lesson 候选（目前召回率低，待改进）

**4. Signal Generation（训练信号生成）**

失败模式可以变成四种东西之一：

| 信号形态 | 用途 | 谁能用 |
|---------|------|-------|
| 数据集（SFT / fine-tune） | 训练下一代模型 | **只有 Lab**（Anthropic / OpenAI / Google） |
| Eval benchmark | 暴露"这类任务 agent 还不行" | Lab + 集成方 |
| RL reward signal | 训练时的正负反馈 | **只有 Lab** |
| Lesson library | 让下只 agent 检索时自动绕坑 | **任何团队都能做** |

**Cat Cafe 的特殊性**：我们**没有 training loop**——不能 fine-tune Claude / GPT / Gemini。但我们做了 **retrieval loop**：Trace → Lesson → `docs/lessons-learned.md` → 下一只猫 `search_evidence` 时搜到 → 绕开坑。

**记忆系统是替代 fine-tuning 的 infrastructure——"穷人的 training loop"**。没有 gradient 但有 retrieval。效果在运行时等价：**过去的失败模式对未来不再生效**。

**5. Sunset Discipline（主动删除）**

- capability 升级 + 心智漂移 → 审视哪些层能坍缩
- 硬规则：**被吸收的层必须坍缩，留 data 不留 code**
- 不坍缩 = 占位，让下一代能力长不出来
- 这条是 ADR 最严厉的一条，也是最容易漂的一条

### Frontier 漂移的两个维度

本 ADR 核心 governance 机制——回答"什么时候应该 sunset audit"。

| 维度 | 触发 | 审视内容 |
|------|------|---------|
| **Capability 维度** | Model family 发新版本（Opus 4→5、GPT 5→6 等） | 哪些 layer 可以坍缩到 L1 内部？（原生跨 vendor memory / ball ownership / role awareness / tool-native 理解等） |
| **心智维度** | 新猫加入 / 猫格底色变化（如 Opus 46 → 47 不是线性升级） | shared-rules 在新心智上如何 fire？规则文本可能不变，但表达方式需要翻译到新猫的认知语言 |

**关键**：两个维度独立漂移。Capability 升级**不等于**心智一致（同 family 内可能出现猫格跳变）；新猫加入**不等于**能力升级（可能是 sidegrade）。不能混成一个"升级"概念——这是 45→46→47 实战里学到的。

### 治理：定期 fit audit

**触发条件**（任一即启动）：

1. 某个 model family 发新版本 → 对应 slot 升级 / 新开
2. 新猫加入 Cat Café（新 @handle 注册）
3. Lessons 累积出现"同一层反复抓漏"（说明该层可能该内化到上层或模型）

**audit 内容**：

- 每层问一次："去掉这层会出什么新 bug？如果 capability 能接住就坍缩；如果不能，记录为什么不能。"
- 每条 shared-rules 问一次："这条规则在每只猫心智上 fire 的方式一致吗？如果不是，如何翻译？"
- 每个 failure pattern 问一次："这类失败还在发生吗？如果被 capability 吸收了，把对应 lesson 标记为 resolved。"

**产物**：

- Audit report 入 `docs/audits/YYYY-MM-harness-audit.md`
- 坍缩动作入 PR，走正常 review gate
- 规则翻译入对应猫的 `CLAUDE.md` / `AGENTS.md`
- Resolved lessons 在 `lessons-learned.md` 里打 status: resolved（不删除，保留历史）

## 后果

### 正面

- **Harness 不会无节制膨胀**：每次 capability 升级有 sunset 动作
- **失败模式不浪费**：Lesson library 是我们的 training-loop 替代品，retrieval 替代 gradient
- **多样性维持**：心智维度审视避免 shared-rules 在新猫身上失效
- **团队诚实**：不装"我们极简"，承认是"最小必要复杂度 + frontier 漂移承诺"
- **方法论可复用**：其他团队（没有 fine-tune 权限的）可以照 5 核心搭自己的穷人 training loop

### 负面

- **Audit 成本**：每次升级 + 新猫都要做一次审视，可能漂过去几轮就懈怠
- **规则翻译负担**：shared-rules 一份文本要对齐到不同心智，理论上可能需要多份 `CLAUDE.md` 变体——复杂度增加
- **坍缩决策复杂**：决定"这层能不能去掉"需要跨 model 评估，误判成本高
- **"穷人的 training loop"能否 scale 未知**：Lesson library 能覆盖到什么规模的失败模式还不确定

### 待观察

- **心智漂移的实际频率和规律**：45→46→47 才三代，样本小，规律未必稳定
- **Audit 触发条件是否足够**：有没有漏掉的 trigger（比如 sideband：Anthropic 内部做了 hidden capability 升级而没发新版本号）
- **"Built to delete" 在实际决策中的说服力**：当前层的拥有者可能会抗拒坍缩（沉没成本），需要看治理机制是否扛得住

## 相关

- `docs/canon/meta-aesthetics.md` — `Agent Quality = Model Capability × Environment Fit` 公式（本 ADR 是公式的方法论展开）
- `ADR-030` — System Prompt Engineering（规则注入链，fit audit 涉及修改这条链）
- `LL-025` — 协作规则不绑个体名（角色解耦——审视规则翻译时参考）
- `LL-026` — 身份信息是硬约束常量（身份绑定——审视心智维度时参考）
- `docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md` — Part II "代价 + frontier 漂移承诺" 段（本 ADR 的原始讨论现场）

## 下一步

- [ ] 多猫 Phase 0 审视（@codex / @gpt52 独立 review，@gemini 审视 framing 表述）
- [ ] 定稿后在 `lessons-learned.md` 加 LL-(xx)：harness 方法论纪律
- [ ] 在 `meta-aesthetics.md` 加一个 harness-engineering section 作为公式的方法论展开
- [ ] Audit 机制落地：做成 `schedule-tasks` 任务（trigger on new model / new cat）还是 skill，待定
- [ ] 第一次实操 audit：以 opus-47 加入为契机做一次心智维度 audit，作为 template

---

*起草：[宪宪/Opus-47🐾]*
*依据：2026-04-20 ~ 04-22 多智能体协作文章 review 过程中的两轮深度讨论（极简 vs frontier、harness as signal generator）*
