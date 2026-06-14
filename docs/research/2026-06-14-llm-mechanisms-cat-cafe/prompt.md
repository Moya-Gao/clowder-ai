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

# ROUND 2 — 机制深挖 + 猫咖映射（草案，待 Round 1 ledger 过关后用真实版本填充）

## Problem Frame

对 Round 1 确认的版本，按**机制横切**（不按模型写读后感）深挖训练/推理方法，并映射到猫咖的 layer allocation 判断。

**机制横切清单**（每项的具体采用情况由一手源核实，以下仅是横切维度，不是断言任何模型用了它）：
`pre-training data 配比` · `architecture（如 MoE / attention 变体）` · `tokenizer` · `long-context 方法` · `SFT` · `preference tuning` · `RLHF / RLAIF / DPO / GRPO / RLVR 等 RL 变体` · `tool-use / agentic post-training` · `inference-time scaling（如 test-time compute）` · `memory / personalization 方法`

## Output Schema（每个机制一行——这是 study 的核心交付）

> **分工边界**（云端 research vs 本地猫，避免云端 mischaracterize 猫咖内部资产）：
> - 云端 research **只填**：`机制` + `模型层能做什么（一手源+锚点）` + 外部业界做法（如 per-user 的 live-train vs retrieval 各家怎么做）。
> - `猫咖已有设计/gap` / `最终决策` / `为什么不是另外两层` / `判断轴` / `迁移信号` / `最小验证实验` = **本地猫综合时填**（宪宪+砚砚，fable 回来接分层判断），云端不读猫咖内部 doc（它没 codebase 语境）。

**同一张表逼出单一决策，不许用"混合/视情况"回避**：

| 机制 | 模型层能做什么（一手源+锚点） | 猫咖已有设计/gap | 最终决策（单选：等猫舍/自养/harness/混合） | 为什么不是另外两层 | 判断轴（auditability / update-cadence / latency / privacy / evalability / blast-radius） | 迁移信号（什么出现时换层） | 最小验证实验 |
|------|------|------|------|------|------|------|------|

> - 选"混合"**必须拆**出哪部分落哪层（如"基础能力等猫舍 + 关键路径 harness 兜底"），每部分仍走"为什么不是另外两层" + 判断轴——不允许用"混合"当逃生门。
> - "为什么不是另外两层"必须给具体理由，禁止空着或写"视情况"。
> - "最小验证实验" = 若决策是自养/harness，最小可验证 PoC 是什么（接 ADR-031 "有 signal 才能判断该不该换层"）。

**「猫咖已有设计 / gap」列种子**（research 必须对照，别重复造轮子；填不上的标 gap）：
- ADR-031：harness 5 层 + Sunset + Training/Retrieval 二分
- F221 taste-lane / F231 user-profile-capsule：per-user alignment 已在 harness 层做（非 live-train）
- `2026-06-03-local-small-model-rl-survey` 等自养层研究线：本地小模型 RL / 权重演化 / gemma-clerk 已有积累

**特别追问**（Landy 的核心关切）：
- per-user alignment：业界（创业公司）在小模型里 live-train，vs 我们记忆系统在 harness 层做——**各自 tradeoff、各自什么时候更优**？（可审计性 / 可演化性 / 灾难性遗忘 / 延迟 / 隐私）
- 自养层：家用 128G Mac 现实能训/微调到什么程度，哪类窄任务值得，哪类是认知脚手架（呼应 taste 里"小模型 classifier 可能是脚手架"的先例）？

## Decision Interface

决策已在上表"最终决策"列强制给出。此处补：每个"自养/harness"决策如何落到猫咖现有体系（哪个 feature / ADR / skill / 记忆 lane 承接），以及与已有锚点（ADR-031 Sunset / F221 / F231 / 自养层研究线）的衔接。

## Risk Register

1. harness 傲慢（默认 harness 永远赢）→ 缓解：每个机制必须诚实评估训练层是否更优。
2. 把"现在该哪层"当永久结论 → 缓解：强制填迁移信号列。
