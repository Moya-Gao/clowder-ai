---
feature_ids: []
related_features: [F221, F231]
topics: [llm-mechanisms, layer-allocation, training-methods, deep-research-prompt, source-ledger]
doc_kind: research
created: 2026-06-14
participants: [opus-48, codex]
status: draft-in-review
---

# Research Prompt: LLM 训练/推理机制 → 猫咖 Layer Allocation

> 用 8 槽位骨架（`cat-cafe-skills/refs/research-prompt-template.md`）。
> **两轮发送**：Round 1（Source Ledger）过关后，再用其真实结果填充 Round 2（机制深挖）。
> **不要一轮吃全**——先确认事实地基，防一手缺失被幻觉填充。

---

## 共享 framing（两轮都带）

**北极星**：本研究服务一个判断——猫咖关心的每个 LLM 能力，该落在 **等猫舍（前沿训练）/ 自养（本地小模型）/ harness（context·记忆·工具·家规）** 哪一层。**不是科普 LLM 训练，是做 layer allocation 判断。**

**候选模型家族**（截至 2026-06-14，**均按"候选"处理，版本号不得假设为真**）：
GLM（5.1 / 5.2？）· DeepSeek（V4 Pro？）· Kimi（2.7？）· MiniMax（M3？）· Qwen（3.7 / 3.6 Max？）· + 1 个机动位（由 research agent 按**训练方法+数据披露完整度**裁定：优先"方法/数据也公开"的全开放模型（不只开放权重），因为本 study 要学"怎么做"而非比性能；按一手资料可得性锁定，不预设具体目标）。

**方法铁律**：
- 一手优先：机制论断只认 T0/T1（technical report / model card / repo / 作者论文），挂链接 + 日期。
- 搜不到一手 → 写 `no public primary source found`，**不补故事、不用模型先验填空**。
- 新模型不外推旧数据（信源卫生 Temporal + Object Applicability 强制）。

---

# ROUND 1 — Source Ledger + 方法谱系骨架（先发这个）

## 1. Problem Frame（任务边界）{必填}

**核心问题**：截至 2026-06-14，上述候选模型的**最新公开版本**，哪些是**真实存在**的？哪些有**一手训练资料**（technical report / model card / repo / 论文）？只建立**事实地基**——source ledger + 方法谱系骨架。

**非目标（明确排除）**：
- 不做机制深挖（留给 Round 2）
- 不做 benchmark / 强弱排名
- 不科普通用 LLM 知识
- 不评价"哪个模型更好"

**为什么现在**：猫咖要做 layer allocation 判断，地基必须是一手事实，不能是闭源模型对自己的推理。好几个候选是"最近刚出"，存在性本身就需要核实。

## 2. Current Hypotheses（假设，待验证/推翻）{必填}

1. GLM / DeepSeek / Kimi / MiniMax / Qwen 这些家族历来发详细技术报告，**应**有 T0/T1 一手源。
2. 但"最近刚出"的具体版本，可能只有发布会/PR（T2/T3），technical report **滞后或缺失**。
3. 不同家族透明度差异大（有的连数据配比都给，有的只发权重不发报告）。

**证据缺口**：每个候选版本到底①存不存在 ②有没有一手训练资料——均未核实。

> ⚠️ 以上是假设不是结论，请在调研中逐条验证或推翻。

## 3. Disconfirm First（先找反例）{必填}

在给任何"某模型用了 X 方法"的支持性证据前，**先**：
1. 核实版本号是否真实存在（vs 传言 / 路线图 / 命名臆测）。
2. 找"该版本无任何一手训练资料"的反例——如果只有媒体报道，如实标 T3。
3. 警惕互引博客冒充一手源；警惕把旧版本/旧模型的方法默认套到新版本。

## 4. Source Mix Quota + 信源卫生{必填}

来源分级（**进结论只认 T0/T1**）：
- **T0** 官方 technical report / model card / 官方 repo
- **T1** 作者署名论文（arXiv 等）
- **T2** 作者访谈 / 官方发布会 / 官方博客（带 caveat 的线索）
- **T3** 第三方媒体 / 二手博客（**仅线索，不进结论**）

配额：每家**最多 2 份主源**（最新训练报告 + 最近一篇关键 post-training 论文）。每个进结论的 claim 标 Primary Source Trace / 发布日期 / 测量对象。

## 5. Local Constraints（约束）{必填}

- 多引擎协作（Claude/GPT/Gemini）· 人在环（CVO 拍板）· 知识在 repo
- 本轮只交**事实地基**，不交机制结论
- **存在性与一手源可得性是两个独立判断**——"模型真实存在但无 T0/T1 报告"是合法且有价值的结果（说明该家不透明），不是失败，照实记。

## 6. Output Schema（输出格式）{必填}

### 6a. Source Ledger（每个候选版本一行）

| 家族 | 精确对象/版本 | ① 存在性（实证/未证实/证伪） | ② 一手源等级（T0/T1/T2/T3/none） | 源链接 + 发布日期 | 证据锚点（section/table/repo path/commit/≤30字原文摘录） | claim type（existence/method/data/post-train） | ③ 方法关键词（**仅证据锚点支持的**） | 置信度（高/中/低） | 备注 |
|------|------|------|------|------|------|------|------|------|------|

> - ① 和 ② 分开填：可能 ①存在 但 ②none（模型真实但无公开报告 = 有效结果，照实记，不算失败）。
> - **证据锚点强制**：method/data/post-train 的每个 claim 必须指到具体 section / table / repo path / ≤30字原文摘录；**没有证据锚点的 claim 不得进 Round 2**（防概括词污染 + 二手摘要被 Round 2 放大）。existence claim 至少锚到官方发布页 / repo。
> - 互引博客不算独立锚点。**method/data/post-train 锚点必须落 T0/T1**；**existence 锚点可放官方源（含官方 T2 release page / 发布公告）**，但须官方一手、非第三方转述。

### 6b. 方法谱系骨架（喂思维导图，只列一手源实际提到的）

```
pre-train: [ 方法/技术 → (哪几家提到 + 出处) ]
post-train: [ SFT / preference tuning / RL 变体 / 对齐方法 → (哪几家 + 出处) ]
inference: [ 推理期技术 → (哪几家 + 出处) ]
```
未在任何一手源出现的方法**不要凭空补全**——留空白比编造好。

## 7. Decision Interface（决策映射）{必填}

每个候选版本标（**进 Round 2 的硬门槛：存在性实证 + ≥1 个 T0/T1 证据锚点**）：
- **进 Round 2**：存在 + T0/T1 源 + 有证据锚点 → 值得深挖
- **存疑**：存在但仅 T2/T3 或无证据锚点 → 不进 Round 2，标注待补
- **排除**：未证实存在 / 纯传言

## 8. Risk Register（风险）{推荐}

1. research agent 用旧知识或媒体传言填新版本细节 → 缓解：T0/T1 强制 + 存在性独立核实 + 先 Disconfirm。
2. 把不存在的版本当真做深挖 → 缓解：Round 1 先证伪，ledger 过关才进 Round 2。
3. 把"发权重"误当"公开训练方法" → 缓解：区分 model release 与 method disclosure。

---

# ROUND 2 — 机制深挖 + 猫咖映射

> **本节切两半**：§A 是发给云端 research 的 **self-contained** prompt（云端看不到任何本地文件，§A 段内即全部上下文，零内部黑话 / 零文件引用）；§B 是本地综合（**不发云端**，本地猫拿 §A 外部事实 + 我们内部 doc 来填）。

---

## §A — 发给云端 Research（self-contained，复制这一段即可发送）

### 任务
对下列已确认存在的开源/开放权重模型，从**一手来源**（official technical report / model card / 官方 repo / 作者署名论文）按机制维度提取训练与推理方法。每条方法论断必须挂证据锚点（section / table / repo path / ≤30字原文摘录）+ 源链接 + 日期。搜不到一手就写 `no public primary source found`，**不要用先验知识或第三方博客补全**。

### 对象 + 各自范围（不得超范围）
- **DeepSeek-V4-Pro** — full（pre-train / post-train / inference 全挖）
- **OLMo 3 / OLMo 3.1**（Allen AI / Ai2）— full，**优先**（数据+代码+checkpoint+log 全开放，可端到端追溯，最适合学"怎么做"）
- **MiniMax-M3** — **仅 architecture / inference**（公开的只有 MiniMax Sparse Attention 论文；pre-train 语料 / SFT / RL 一律标 `no public primary source found`，不要推断）
- **Kimi K2.7-Code** — limited（只取 model card / API 文档明写的 architecture / inference / 相对前代 delta）
- **Kimi K2.5** — full（作为 Kimi 家族训练配方来源；**不要**把 K2.5 训练细节当成 K2.7 的）
- **GLM-5** — full
- **不要深挖**：GLM-5.1 / GLM-5.2 / Qwen3.7（无专门技术报告或只有产品页）。若确需 Qwen 训练机制，回退到 **Qwen3.6-27B**（有 model card）

### 机制横切维度（按维度对比各家，不要逐个模型写读后感）
- **pre-train**：数据配比 / 架构（MoE、attention 变体如 sparse / linear）/ tokenizer / long-context 方法
- **post-train**：SFT / preference tuning / RL 各变体（RLHF / RLAIF / DPO / GRPO / RLVR 等）/ tool-use & agentic post-training
- **inference**：推理期技术（test-time / inference-time scaling、投机解码、稀疏注意力 kernel 等）

### 一个外部对比专题（公开话题，云端可查）
**per-user personalization 的两条技术路线对比**：把"让模型记住/适应某个具体用户"做进**模型权重**（on-device live-training / 持续微调小模型）vs 放在**外部记忆 + 检索**（RAG / memory system，权重冻结）。请给出两条路线在以下维度的 tradeoff，尽量挂一手或可靠来源：可审计性、可更新/可删除性、灾难性遗忘、推理延迟、隐私与多用户隔离、维护成本。各自在什么场景更优？

### 云端输出格式（只填这张纯外部事实表）
| 模型 | 机制维度 | 方法（一手源） | 证据锚点 | 源链接 + 日期 | 是否在该模型 scope 内 |
|---|---|---|---|---|---|

> 云端**不做**"这个能力该放哪一层"的判断——那需要我们内部系统的上下文，由我们本地完成。你只负责把外部世界的事实挖准、挖全、可追溯。

---

## §B — 本地综合（不发云端；宪宪 + 砚砚，fable 回来接分层判断）

拿 §A 的外部机制事实 + per-user 路线对比，叠加我们的内部 doc（ADR-031 / F221 / F231 / 自养层研究线），填 layer allocation 决策表：

| 机制 | 模型层能做什么（§A 事实） | 猫咖已有设计/gap | 最终决策（单选：等猫舍/自养/harness/混合） | 为什么不是另外两层 | 判断轴（auditability / update-cadence / latency / privacy / evalability / blast-radius） | 迁移信号（什么出现时换层） | 最小验证实验 |
|---|---|---|---|---|---|---|---|

**规则**：
- 选"混合"必须拆出哪部分落哪层（如"基础能力等猫舍 + 关键路径 harness 兜底"），每部分仍走"为什么不是另外两层" + 判断轴，不许用"混合"当逃生门。
- "为什么不是另外两层"必须给具体理由，禁止空或"视情况"。
- "最小验证实验" = 若决策是自养/harness，最小可验证 PoC（接 ADR-031"有 signal 才能判断该不该换层"）。

**「猫咖已有设计/gap」列种子**（本地填时对照，别重复造轮子）：
- ADR-031：harness 5 层 + Sunset + Training/Retrieval 二分
- F221 taste-lane / F231 user-profile-capsule：per-user alignment 已在 harness 层做（非 live-train）
- 自养层研究线（`2026-06-03-local-small-model-rl-survey` 等）：本地小模型 RL / 权重演化 / gemma-clerk 已有积累

**两个特别追问（本地结合 §A 外部对比回答）**：
- per-user alignment：业界 live-train 进小模型 vs 我们记忆系统在 harness——各自 tradeoff、各自何时更优？
- 自养层：128G Mac 现实能训/微调到什么程度，哪类窄任务值得，哪类是"认知脚手架"（呼应 taste 里"小模型 classifier 可能是脚手架"先例）？

**本地综合风险**：
1. harness 傲慢（默认 harness 永远赢）→ 每个机制诚实评估训练层是否更优。
2. 把"现在该哪层"当永久结论 → 强制填迁移信号列。
