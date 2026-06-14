---
doc_kind: research-response
created: 2026-06-14
topics: [llm-mechanisms, layer-allocation, source-ledger, training-methods]
related_features: [F221, F231]
provider: gpt-deep-research
status: round1-raw-response
participants: [landy, opus-48]
---

# 事实地基与 Source Ledger

本轮只做 **Round 1 的事实地基**，不做机制深挖，也不做 benchmark 排名。按“**严格 latest-public 口径**”看，截至 2026-06-14，这次检索能实证确认存在的最新公开对象包括：**GLM-5.2、DeepSeek-V4-Pro、Kimi K2.7 Code、MiniMax M3、Qwen3.7-Plus，以及机动位 OLMo-3.1-32B-Instruct**。但其中 **GLM-5.2** 与 **Qwen3.7-Plus** 在本轮只浮出了官方文档/博客层材料，**没有同步浮出 current-version 的 technical report / model card / repo**；相对地，**DeepSeek-V4-Pro、Kimi K2.7 Code、MiniMax M3、OLMo-3.1-32B-Instruct** 都拿到了至少一份 T0/T1，能够进入下一轮的机制核查；如果允许“**回退到最新有主源的版本**”，则 **GLM-5.1** 与 **Qwen3.6-27B** 也可作为 Round 2 的替补入口。citeturn34view0turn34view1turn34view2turn41view0turn10view1turn42search4turn13view0turn27view2turn27view0turn28search1turn39view0turn39view1

这对猫咖的意义很直接：**“模型真实存在”** 与 **“足够透明到可以做 layer allocation 的机制归因”** 是两件不同的事。最新版本如果只有产品页/博客，没有 T0/T1，就可以列为产品候选，但**不能把其训练/后训/推理方法当成机制事实来映射到 等猫舍 / 自养 / harness**。这正是 GLM 与 Qwen 当前最新公开波次的状态。citeturn34view0turn34view1turn28search1turn28search0

## Problem Frame 与本轮约束

本轮核心问题只有一个：**截至 2026-06-14，上述候选家族的最新公开版本，哪些真实存在，哪些拿得到一手训练资料**。因此，这里只交付 **Source Ledger + 方法谱系骨架**，不交机制结论，不做“谁更强”，也不把旧版本技术报告默认套到新版本。citeturn34view0turn41view0turn42search4turn27view2turn28search1turn39view1

本轮还坚持两个特殊约束。其一，**存在性** 与 **一手源可得性** 分开判断：模型可以真实存在，但当前公开材料仍只有 T2。其二，**只要没有 T0/T1，就不把 method/data/post-train 细节推进 Round 2**；这不是失败，而是对透明度的有效测量。GLM-5.2 与 Qwen3.7-Plus 正是这种“存在，但当前不够透明”的结果。citeturn34view0turn34view1turn28search1turn28search0

## 假设与先证伪

原始假设里最容易出错的部分，是把“家族一向透明”误当成“**这次最新版本**一定已经发了技术报告”。本轮检索后的结果是：这个假设只对一部分家族成立。**DeepSeek-V4-Pro、MiniMax M3、OLMo 3.1 32B Instruct** 的当前版本公开材料足够进入 T0/T1；**Kimi K2.7 Code** 也有当前版本 T0 model card，但技术披露深度明显弱于 DeepSeek / MiniMax / OLMo；**GLM-5.2** 与 **Qwen3.7-Plus** 则停在产品/文档/博客层。citeturn41view0turn10view1turn27view0turn36academia5turn39view0turn39view1turn42search4turn13view0turn34view0turn34view1turn28search1

先证伪后支持的结果也很清楚。**GLM-5.2 并非传言**：官方文档已经把它列为 Coding Plan 的“latest model”，还给出 `glm-5.2[1m]`、`contextWindow: 1000000` 和 reasoning 映射配置；但这并不等于已经公开训练方法。**Qwen3.7 波次也并非传言**：官方博客页面明确出现了 **Qwen3.7-Plus**，而 2026-05-19 的 Qwen3.7 页面又明确提到 **Qwen3.7-Max**；不过本轮没有浮出 3.7-specific 的 HF model card 或 arXiv technical report。citeturn34view0turn34view2turn28search1turn28search0

## 信源配额与信源卫生

本轮结论遵循用户给出的分层：**T0 = official technical report / model card / repo；T1 = 作者署名论文；T2 = 官方博客/发布页/官方文档；T3 = 第三方媒体**。真正写进“方法关键词”的部分，优先只用 T0/T1；如果最新版本只有 T2，就只把它当作**存在性**与**公开透明度状态**的证据，不把其训练细节往下推。citeturn19view0turn10view1turn13view0turn27view0turn39view0

为避免旧版本污染新版本，我在表里专门把两类行分开了：一类是**strict latest-public**；另一类是当 strict latest 缺主源时增加的 **latest-with-primary-source fallback**。这不是偷换概念，而是为了给 Round 2 保留“可深挖的真实对象”，同时又不把缺主源的最新版本硬写成透明。GLM 与 Qwen 都属于这种需要“两行并存”的家族。citeturn34view0turn34view1turn19view0turn31view0turn28search1

## Source Ledger

| 家族 | 精确对象/版本 | ① 存在性 | ② 一手源等级 | 源链接 + 发布日期 | 证据锚点 | claim type | ③ 方法关键词 | 置信度 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| GLM | **GLM-5.2** | **实证** | **T2** | 官方 docs《How to Switch Models》《Overview》；检索时间戳显示为 2026-06-14 当天数小时内，页面正文未给显式发布日期。citeturn34view0turn34view1turn34view2 | `settings.json` 里直接给出 `"glm-5.2[1m]"`；OpenClaw 配置给出 `"reasoning": true`, `"contextWindow": 1000000`, `"maxTokens": 131072`。citeturn34view0turn34view2 | existence, inference | 1M context；reasoning effort 映射；Coding Plan 集成 | 中 | 模型真实存在，但本轮 **no public primary source found** for current-version technical report / model card / repo。严格口径下不进 Round 2。 |
| GLM | **GLM-5.1** | **实证** | **T0** | HF model card 搜索结果给出 2026-02-17；官方 blog《GLM-5.1: Towards Long-Horizon Tasks》给出 2026-04-07。citeturn18search1turn43search8turn19view0 | HF card 写明：“built to stay effective on agentic tasks over much longer horizons”，且“sustains optimization over hundreds of rounds and thousands of tool calls”。citeturn20view3turn20view4 | existence, inference | 长程 agentic execution；重复迭代；大规模 tool calls | 中 | 这是 **GLM 家族最新浮出 T0 的版本**。但当前页没有充分披露训练法，不能把 GLM-5 的 DSA / async RL 直接套到 5.1。 |
| DeepSeek | **DeepSeek-V4-Pro** | **实证** | **T0/T1** | 官方 model card release date 2026-04-24，publication date 2026-04-27；另有同版本 tech report PDF。citeturn9view1turn41view0turn10view1 | Model card 明确写 MoE、CSA/HCA、mHC、Muon；完整 report 给出 `2.3 Hybrid Attention with CSA and HCA`、`5.1 Post-Training Pipeline`、`5.1.2 On-Policy Distillation`、`GRM`、`FP4 QAT` 与 sandbox infra。citeturn9view1turn33view0turn33view1turn33view2 | existence, method, data, post-train | MoE；CSA/HCA；DSA；Muon；specialist training；GRM；OPD；FP4 QAT；sandbox infra | 高 | 当前版本透明度足够，是 Round 2 的强候选。 |
| Kimi | **Kimi K2.7 Code** | **实证** | **T0** | Kimi Code docs《What’s New》明确写 **June 12, 2026**；HF model card 与平台模型列表同步出现。citeturn42search4turn42search15turn13view0 | HF card 写明 “built upon Kimi K2.6”；Model Summary 给出 MoE / 1T / 32B / 256K / MLA；并写明 `preserve_thinking` 强制开启、Interleaved Thinking and Multi-Step Tool Call、same architecture as K2.5/K2.6。citeturn13view0turn37view3 | existence, method, inference | MoE；MLA；256K；preserve_thinking；interleaved thinking；multi-step tool call | 中高 | 当前版本有 T0 model card，但**未浮出 current-version technical report**；祖先 Kimi K2/K2.5 有 T1/T2，不在此行回投。 |
| MiniMax | **MiniMax-M3** | **实证** | **T0/T1** | 官方 release notes 给出 **2026-06-01**；HF model card 已上线；MSA 论文 arXiv 日期为 **2026-06-11**。citeturn27view2turn27view0turn36academia5 | HF card 写明 “native multimodal model with 1M context”，并列出 “mixed-modality training from the very first step”；MSA 论文写明 blockwise sparse attention 与 co-designed kernel。citeturn27view0turn27view1turn36academia5 | existence, method, inference | step-0 mixed-modality training；MSA；1M context；thinking/non-thinking | 高 | 当前最新版本即带 T0/T1，是 Round 2 的强候选。 |
| Qwen | **Qwen3.7-Plus** | **实证** | **T2** | 官方 blog《Qwen3.7-Plus: Multimodal Agent Intelligence》日期为 **2026-05-31**；同波次官方《Qwen3.7》页面日期为 **2026-05-19**，且摘要里直接出现 **Qwen3.7-Max**。citeturn28search1turn28search0 | 公开摘要只到高层表述：`Qwen3.7-Plus` 是 “multimodal agent model”；`Qwen3.7-Max` 是 “versatile agent foundation”。citeturn25search2turn28search0 | existence | multimodal agent；agent foundation | 中 | **最新公开 Qwen 波次真实存在**，但本轮 **no public primary source found** for 3.7-specific technical report / model card / repo。严格口径下不进 Round 2。 |
| Qwen | **Qwen3.6-27B** | **实证** | **T0** | HF model card 日期 **2026-04-22**；另可回看 Qwen3 family technical report。citeturn25search5turn31view0turn31view1 | Model Overview 明确给出 `Gated DeltaNet → FFN` 与 `Gated Attention → FFN` 的 hybrid layout、Vision Encoder、`MTP: trained with multi-steps`、`262,144 natively and extensible up to 1,010,000`；Highlights 写明 thinking preservation。citeturn31view0 | existence, method, inference | Vision Encoder；Gated DeltaNet + Gated Attention；MTP；262K→1.01M；thinking preservation | 高 | 这是 **Qwen 家族最新浮出 T0 的 open-weight 入口**。若允许回退，可进 Round 2。 |
| 机动位 | **OLMo-3.1-32B-Instruct** | **实证** | **T0/T1** | HF model card 日期 **2025-12-15**；Olmo 3 论文 v1 为 **2025-12-15**，v2 更新为 **2026-04-14**。citeturn39view0turn39view1 | model card 写明 pretrain on **Dolma 3**、post-train on **Dolci**，并公开 `Base → SFT → DPO → Final Models (RLVR)`；官网又强调“complete model flow”与公开数据/阶段工件。citeturn39view0turn39view1turn39view2 | existence, data, post-train | Dolma 3；Dolci；full model flow；SFT；DPO；RLVR；tool use / multi-turn dialogue | 高 | 透明度在这组样本里最强，适合作为“训练透明度上限”对照组。 |

补一句总括：**严格按 latest-public + T0/T1 硬门槛**，当前能无争议进入下一轮的，是 **DeepSeek-V4-Pro、Kimi K2.7 Code、MiniMax M3、OLMo-3.1-32B-Instruct**；**GLM-5.2** 与 **Qwen3.7-Plus** 虽然存在，但透明度还不够。若允许“回退到最新有主源的版本”，则再加 **GLM-5.1** 与 **Qwen3.6-27B**。citeturn34view0turn10view1turn13view0turn27view0turn39view0turn19view0turn31view0turn28search1

## 方法谱系骨架

**pre-train**：一手源里已经明确出现的方法包括 **MoE**（DeepSeek-V4、Kimi K2、MiniMax M3、Qwen3 family）、长上下文/高效注意力变体（DeepSeek 的 **CSA/HCA/DSA**，MiniMax 的 **MSA**，Qwen3.6 的 **Gated DeltaNet + Gated Attention**），以及对数据混合的明确披露（Kimi K2 的 **Web Text / Code / Mathematics / Knowledge**；OLMo 3 的 **Dolma 3** 公开混合）。citeturn33view0turn11view0turn27view0turn27view1turn36academia5turn31view0turn31view1turn39view0turn39view2

**post-train**：已经在 T0/T1 中明确点名的有 DeepSeek-V4 的 **specialist training → multi-teacher OPD → GRM/RL → FP4 QAT**，Kimi K2 的 **multi-stage post-training、agentic data synthesis、joint RL、RLVR + self-critique rubric reward**，以及 OLMo 3.1 的 **SFT → DPO → RLVR**。这三家在“后训练机制可归因性”上明显高于当前只给产品页的 GLM-5.2 / Qwen3.7。citeturn33view2turn11view0turn39view0

**inference**：已被一手材料明确写出的推理期机制，包括 GLM-5.2 的 **1M context + reasoning effort mapping**，DeepSeek-V4 的 **1M context / 多 reasoning modes / agentic search**，Kimi K2.7 Code 的 **preserve_thinking / interleaved thinking / multi-step tool call**，MiniMax M3 的 **thinking / non-thinking 双模式**，Qwen3 与 Qwen3.6 的 **thinking / non-thinking unified framework、thinking budget、thinking preservation**，以及 OLMo 3.1 Instruct 的 **tool use / multi-turn dialogue**。citeturn34view0turn34view2turn9view1turn33view3turn37view3turn27view0turn31view1turn31view0turn39view2

把这份骨架翻译成猫咖语言，就是：目前最适合做 **layer allocation** 的，不是“最火的版本名”，而是“**版本名 + 其对应的公开机制可见度**”。对等猫舍 / 自养 / harness 的判断，真正能站住脚的样本，优先会来自 **DeepSeek-V4 / MiniMax M3 / OLMo 3.1**，其次是 **Kimi K2.7 Code**；而 **GLM-5.2 / Qwen3.7** 现在更像“黑箱产品候选”，暂时不够格做机制归因样本。这个判断是基于上表透明度差异的推论。citeturn10view1turn27view0turn39view0turn13view0turn34view0turn28search1

## 决策接口、风险与未决问题

按你给的硬门槛，**存在性实证 + ≥1 个 T0/T1 锚点** 之后，决策接口可以直接定为下面这张表。citeturn10view1turn13view0turn27view0turn39view0turn19view0turn31view0

| 对象 | 严格 latest-public 口径 | 若允许回退到最新有主源版本 |
|---|---|---|
| GLM | **存疑**：GLM-5.2 已实证存在，但只浮出 T2。citeturn34view0turn34view1turn34view2 | **进 Round 2**：回退到 GLM-5.1。citeturn19view0turn43search8 |
| DeepSeek | **进 Round 2**：DeepSeek-V4-Pro。citeturn10view1turn9view1 | 不需要回退。 |
| Kimi | **进 Round 2**：Kimi K2.7 Code。citeturn42search4turn13view0 | 不需要回退。 |
| MiniMax | **进 Round 2**：MiniMax M3。citeturn27view2turn27view0 | 不需要回退。 |
| Qwen | **存疑**：Qwen3.7-Plus / 3.7-Max 波次已公开，但只浮出 T2。citeturn28search1turn28search0 | **进 Round 2**：回退到 Qwen3.6-27B。citeturn31view0 |
| 机动位 | **进 Round 2**：OLMo-3.1-32B-Instruct。citeturn39view0turn39view1 | 不需要回退。 |

风险也已经很明确。第一，**最新版本先发产品、后补报告** 的节奏会持续发生，所以最容易把 T2 误当 T0；GLM-5.2 与 Qwen3.7 正是现成例子。citeturn34view0turn28search1 第二，**model card 不等于完整技术报告**；Kimi K2.7 Code 已可进 Round 2，但你在下一轮里必须克制，只讨论 model card 已写明的机制，不得把 K2/K2.5 的训练细节整包投射到 2.7。citeturn13view0turn11view0 第三，少数页面的日期来自变更日志或搜索摘要，而不是正文显式时间戳；我已在表里对这类情况做了备注，避免把时间精度伪装得比证据更高。citeturn42search4turn34view0

未决问题只有三个，而且都足够重要，值得在进入 Round 2 前持续盯住：**GLM-5.2 的 current-version technical report / model card 是否会补发；Qwen3.7-Plus / 3.7-Max 是否会出现 3.7-specific 的 HF / repo / 论文；Kimi K2.7 Code 是否会补 current-version 技术报告而不只停留在 model card 与 changelog。**在这些问题未解决前，最稳妥的 Round 2 样本集是：**DeepSeek-V4-Pro、MiniMax M3、OLMo-3.1-32B-Instruct、Kimi K2.7 Code**，以及在“允许回退”的前提下追加 **GLM-5.1** 与 **Qwen3.6-27B**。citeturn34view0turn28search1turn42search4turn10view1turn27view0turn39view0turn19view0turn31view0