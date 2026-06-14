---
doc_kind: research-response
created: 2026-06-14
topics: [llm-mechanisms, layer-allocation, mechanism-deep-dive, round2]
related_features: [F221, F231]
provider: gpt-deep-research
status: round2-raw-response
participants: [landy, opus-48]
---

# ROUND 2 外部机制深挖

## 研究边界与证据规则

本稿只做**外部事实层**的机制核查，不做“该能力应落训练层 / 小模型层 / harness 层”的本地分层判断。所有方法论断都尽量落在一手来源：官方 technical report、官方 model card、官方 repo、作者署名论文。遇到公开披露不足的地方，我直接写 `no public primary source found`，不拿旧版本经验去补新版本细节。

这次核查的重点对象，是你在 Round 2 里指定的几家：DeepSeek-V4-Pro、OLMo 3 / 3.1、MiniMax-M3、Kimi K2.7-Code、Kimi K2.5、GLM-5。对于 Qwen，本稿不主动深挖，因为你给出的约束就是“不要深挖 Qwen3.7；若确需 Qwen 训练机制，再回退到 Qwen3.6-27B”。本次外部事实整理中，没有出现必须依赖 Qwen 作为主线证据的场景。  

## 对象与一手源状态

下表先给一个“能不能往下挖、挖到什么深度”的总览。这里故意把“模型存在”与“公开机制披露深度”分开看，因为两者不是一回事。

| 模型 | 当前公开存在性 | 主要一手源 | 公开机制覆盖度 | 备注 |
|---|---|---|---|---|
| DeepSeek-V4-Pro | 已公开、可下载技术报告与权重页 citeturn12view0turn11view0 | HF 技术报告 PDF + HF 模型页 citeturn12view0turn11view0 | 高 | pre-train / post-train / inference 三段都写得较细。 |
| OLMo 3 | 已公开，且公开到 model flow、数据、代码、checkpoint、日志级别 citeturn23view0 | OLMo 3 论文 + HF 模型卡/集合页 citeturn23view0turn27view2turn27view1 | 很高 | 是本组里最适合学“怎么做”的完全公开样本。 |
| OLMo 3.1 | 已公开，但**没有单独的新技术报告**；主要沿用 OLMo 3 报告，外加官方 3.1 集合/模型卡说明 citeturn27view1turn27view2turn23view0 | HF collection / model card + OLMo 3 论文 citeturn27view1turn27view2turn23view0 | 中高 | 3.1 的“delta”公开得比 3 本体少。 |
| MiniMax-M3 | 已公开，HF 模型页与官方博客可见；公开论文聚焦 MSA 注意力机制 citeturn29view1turn29view2turn30view0 | MSA 论文 + HF 模型卡 + 官方博客 citeturn30view0turn29view1turn29view2 | 中 | 架构 / 推理披露明确；预训练语料、SFT、RL 基本没有一手公开细节。 |
| Kimi K2.7-Code | 已公开，HF 官方模型卡可见 citeturn41view0turn41view1 | HF 官方模型卡 citeturn41view0turn41view1 | 低到中 | 只适合写 architecture / inference / 相对前代 delta；不适合倒推出训练配方。 |
| Kimi K2.5 | 已公开，HF 模型卡 + 作者论文可见 citeturn10view0turn9view0 | HF 模型卡 + 论文 citeturn10view0turn10view4turn40view4 | 高 | 训练与 agentic / multimodal post-training 公开度明显高于 K2.7。 |
| GLM-5 | 已公开，作者论文、HF 模型卡、官方文档齐全 citeturn19view0turn17view0turn17view1 | arXiv 技术报告 + HF 模型卡 + 官方文档 citeturn19view0turn17view0turn17view1 | 高 | pre-train / post-train / inference 都有可追溯公开信息。 |

## 机制事实表

下面按**机制维度横切**，而不是逐个模型写“读后感”。表中如果某块披露不足，我会直接写 `no public primary source found`。

**pre-train**

| 模型 | 机制维度 | 方法（一手源） | 证据锚点 | 源链接 + 日期 | 是否在该模型 scope 内 |
|---|---|---|---|---|---|
| DeepSeek-V4-Pro | pre-train | 33T 级预训练；语料类型公开到“数学、代码、网页、长文档、高质量多语种”，但**未公开数值配比**；架构保留 Transformer + DeepSeekMoE + MTP，并新增 mHC、CSA/HCA 混合注意力、Muon；支持 1M context。citeturn12view0turn14view0turn14view1turn15view0turn15view1turn15view2turn15view3turn15view4 | 目录 §2 / §4；“more than 32T”; “DeepSeek-V3 tokenizer”; “CSA and HCA”; “Muon optimizer” citeturn12view0turn13view1turn15view1turn15view3 | DeepSeek HF 技术报告，访问于 2026-06-14 citeturn12view0 | 是 |
| OLMo 3 / 3.1 | pre-train | OLMo 3 基座训练完整公开：Stage 1 为 6T-token Dolma 3 Mix，Stage 2 为 100B-token Dolma 3 Dolmino Mix，长上下文扩展阶段对 7B/32B 分别再训 50B/100B tokens；long-context recipe 采用 YaRN 只施加在 full-attention layers，long/short mix 为 34%/66%；Tokenizer 继续使用 OLMo 2 的 cl100k 衍生 tokenizer；32B 用 GQA，7B 用 MHA，且 3/4 层为 4096-token sliding-window attention。3.1 未见单独 pretrain 报告，公开材料更像是在 OLMo 3 model flow 上继续做后训练延展。citeturn23view0turn26view3turn25view1turn25view2turn24view2turn25view5turn27view1 | §2.1、§3.4-§3.6、Appendix Table 33；“6T-token pretraining”; “34% long-context”; “derived from cl100k”; “grouped-query attention” citeturn26view3turn25view1turn25view2turn25view5 | OLMo 3 论文 2026-04-14；OLMo 3.1 官方合集更新 2025-12-23 citeturn23view0turn27view1 | 是 |
| MiniMax-M3 | pre-train | 在当前官方一手源里，**可确认的只有架构侧**：M3 是原生多模态、1M context、由 MSA 驱动；MSA 是建立在 GQA 之上的 blockwise sparse attention，包含 Index Branch + Main Branch。**pre-train 语料构成、tokenizer、mid-training / long-context recipe：no public primary source found。** citeturn29view1turn29view2turn30view0 | MSA 论文 §3；“blockwise sparse attention built upon GQA”; 模型卡“native multimodal model with 1M context” citeturn30view0turn29view1 | MSA 论文 2026-06-11；官方博客 2026-06-01；HF 模型卡访问于 2026-06-14 citeturn30view0turn29view2turn29view1 | 部分，仅 architecture 在 scope 内 |
| Kimi K2.7-Code | pre-train | 当前官方模型卡只公开了**相对前代 delta + 架构摘要**：K2.7 Code built upon K2.6，thinking-token 使用量约比 K2.6 低 30%，架构与 K2.5/K2.6 相同，为 1T/32B MoE、61 层、384 专家、160K vocab、256K context、MLA、MoonViT。**K2.7-specific pre-train recipe / data / tokenizer training 细节：no public primary source found。** citeturn41view0turn41view1 | 模型卡 §1-§2；“built upon K2.6”; “reducing thinking-token usage by approximately 30%”; “Architecture … MoE … 256K … MLA … MoonViT” citeturn41view0turn41view1 | HF 官方模型卡，访问于 2026-06-14 citeturn41view0turn41view1 | 部分，仅 architecture / delta 在 scope 内 |
| Kimi K2.5 | pre-train | K2.5 是在 K2-Base 之上继续预训练的原生多模态 agentic 模型，公开说法是约 15T mixed visual + text tokens；架构是 1T/32B MoE、61 层、384 专家、160K vocab、256K context、MLA + MoonViT；视觉侧用 MoonViT-3D，继承 NaViT packing 思路，并把连续四帧打包到统一 1D sequence 中。citeturn10view2turn10view0turn10view4turn10view5 | 模型卡 §1 / 架构表；论文 §4.2；“15 trillion mixed visual and text tokens”; “MoonViT-3D”; “NaViT packing strategy” citeturn10view2turn10view0turn10view4turn10view5 | HF 模型卡、arXiv 论文，访问于 2026-06-14 citeturn10view0turn10view4 | 是 |
| GLM-5 | pre-train | GLM-5 公开了较完整的 base recipe：从 GLM-4.5 的 355B/32B 扩到 744B/40B，256 experts、80 层；base model 总训练预算 28.5T tokens，其中正文写到 base model training 先用 27T tokens，再做从 4K→200K 的 mid-training；架构上采用 DSA、MLA with Muon Split、3-layer parameter-shared MTP，以支撑长上下文与投机解码。**Tokenizer 细节在当前主报告里未见单独展开。** citeturn20view0turn21view0turn21view1turn21view2turn17view0 | 论文 §2.1；“28.5 trillion tokens”; “27 trillion token corpus”; “DSA”; “Muon Split”; “3 MTP layers” citeturn21view0turn21view1turn20view0 | arXiv v2 2026-02-24；HF 模型卡发表于 2026-02-17 citeturn19view0turn18view1 | 是 |

**post-train**

| 模型 | 机制维度 | 方法（一手源） | 证据锚点 | 源链接 + 日期 | 是否在该模型 scope 内 |
|---|---|---|---|---|---|
| DeepSeek-V4-Pro | post-train | 两阶段 post-training：先训练数学/代码/agent/指令跟随等**领域专家**，再用 on-policy distillation 统一整合；专家训练是 SFT 后接 GRPO；面对 hard-to-verify 任务，使用 rubric-guided RL data 与 GRM，而非传统 scalar reward model。citeturn13view5turn14view2turn14view3turn13view7 | §5.1；“mixed RL stage was entirely replaced by OPD”; “initial fine-tuning phase and subsequent RL”; “GRPO”; “Generative Reward Model” citeturn14view2turn13view7turn14view3 | DeepSeek HF 技术报告，访问于 2026-06-14 citeturn12view0 | 是 |
| OLMo 3 / 3.1 | post-train | OLMo 3 Think 公开路线是 SFT → DPO → RL；DPO 阶段显式使用 Delta Learning；RL 阶段采用 OlmoRL，算法基于 GRPO 并吸收 DAPO、Dr GRPO 等改进，同时混合 verifiable rewards 与 LM-judge rewards。Instruct 线也公开到 SFT / DPO / RL。官方 3.1 collection 说明 32B Think 还有“another 3 weeks of RL”，并新增 32B Instruct，但**没有单独 3.1 技术报告**。citeturn23view0turn26view5turn25view3turn27view1turn27view3turn27view4 | 论文 §4.2-§4.4、§5.2-§5.4；“Direct Preference Optimization”; “Delta Learning”; “builds on GRPO”; collection “another 3 weeks of RL” citeturn26view5turn25view3turn27view1 | OLMo 3 论文 2026-04-14；3.1 collection 更新 2025-12-23；3.1 模型卡访问于 2026-06-14 citeturn23view0turn27view1turn27view2 | 是 |
| MiniMax-M3 | post-train | **no public primary source found**。当前官方一手源没有给出 M3 的 SFT、preference tuning、RL、tool-use post-training 详细 recipe；公开材料主要停留在 MSA 架构和产品/模型介绍。citeturn30view0turn29view1turn29view2 | 已检查 MSA 论文、HF 模型卡、官方博客；未见独立 post-train 配方公开。citeturn30view0turn29view1turn29view2 | MSA 论文 2026-06-11；官方博客 2026-06-01；HF 模型卡访问于 2026-06-14 citeturn30view0turn29view2turn29view1 | 否 |
| Kimi K2.7-Code | post-train | **no public primary source found**。官方模型卡没有公开 K2.7 Code 的 SFT / DPO / RL 配方，也没有给出“相对 K2.6 的 post-train recipe 改动”。citeturn40view5turn40view6turn40view7turn41view0 | 在 K2.7 官方模型卡中检索 SFT / DPO / RL 均未见披露。citeturn40view5turn40view6turn40view7 | HF 官方模型卡，访问于 2026-06-14 citeturn41view0 | 否 |
| Kimi K2.5 | post-train | 公开的亮点不在 DPO，而在 multimodal / agentic post-training：论文明确写到**zero-vision SFT**、后续 visual RL、再到 joint multimodal RL；RL 用 rule-based outcome rewards、budget-control rewards 与 GRM；Agent Swarm 通过 PARL 训练一个会动态创建并调度冻结子代理的 orchestrator。citeturn40view3turn40view4turn10view6 | “zero-vision SFT paired with vision RL”; “Generative Reward Model”; “Parallel Agent Reinforcement Learning”; “frozen subagents” citeturn40view3turn40view4turn10view6 | K2.5 论文 / 模型卡，访问于 2026-06-14 citeturn10view0turn10view4 | 是 |
| GLM-5 | post-train | GLM-5 的后训练公开度很高：multi-task SFT 覆盖 general chat / reasoning / coding & agent，SFT 时已引入 interleaved thinking；随后做 Reasoning RL → Agentic RL → General RL 的顺序 RL pipeline；最后用 on-policy cross-stage distillation 抵抗能力回退；post-train 基础设施依赖 slime，agentic RL 采用 fully asynchronous training paradigm，把 training engine 与 inference engine 解耦；此外 SFT 阶段还有 INT4 QAT。citeturn21view4turn21view5turn21view6turn21view7turn17view1 | 论文 §3；“Interleaved Thinking”; “On-Policy Cross-Stage Distillation”; “slime”; “fully asynchronous training paradigm”; “INT4 QAT in the SFT stage” citeturn21view4turn21view5turn21view6turn21view7 | arXiv v2 2026-02-24；官方文档访问于 2026-06-14 citeturn19view0turn17view1 | 是 |

**inference**

| 模型 | 机制维度 | 方法（一手源） | 证据锚点 | 源链接 + 日期 | 是否在该模型 scope 内 |
|---|---|---|---|---|---|
| DeepSeek-V4-Pro | inference | 1M context 是公开目标；inference 框架重点是 hybrid attention 的 KV cache 管理与 on-disk KV cache storage，用于 shared-prefix 复用；报告还给出相对 V3.2 的推理成本下降：1M 场景下 Pro 的单 token FLOPs 约为其 27%，KV cache 约为其 10%。citeturn12view0turn14view5turn13view9 | §3.5.1-§3.5.2；“on-disk KV cache storage”; “27% of single-token inference FLOPs”; “10% of KV cache” citeturn12view0turn14view5 | DeepSeek HF 技术报告，访问于 2026-06-14 citeturn12view0 | 是 |
| OLMo 3 / 3.1 | inference | OLMo 3 / 3.1 的公开一手源更偏训练而不是 serving trick。当前能确认的推理公开项主要是：Think/Instruct 最终 checkpoint 以 step revisions 形式放出，Transformers 4.57.0+ 可直接加载；3.1 model card 给出推荐 generation 设置 `temperature 0.6 / top_p 0.95 / max_tokens 32768`。**未见单独公开的 speculative decoding、test-time scaling 或自定义 kernel 说明。** citeturn27view2turn27view4turn27view5turn27view6 | 模型卡 “revision=step_300”; “transformers>=4.57.0”; “max_tokens 32768” citeturn27view2turn27view4turn27view5turn27view6 | 3.1 模型卡访问于 2026-06-14 citeturn27view2 | 是 |
| MiniMax-M3 | inference | 公开的一手重点正是推理：MSA 的 Index Branch 先做 top-k block 选择，Main Branch 再做 exact block-sparse attention；论文强调 exp-free Top-k selection + KV-outer sparse attention 的 kernel co-design。论文在 109B 原生多模态模型上报告 1M context 时 per-token attention compute 降低 28.4x、H800 上 prefill 14.2x、decode 7.6x；M3 模型卡则给出对 M2 的 9x prefill / 15x decode 提速，并公开 thinking / non-thinking 两种模式。citeturn29view0turn30view0turn29view1 | MSA 论文 §3 / 摘要；模型卡 “thinking / non-thinking”; “9× prefill and 15× decode” citeturn30view0turn29view1 | MSA 论文 2026-06-11；HF 模型卡访问于 2026-06-14 citeturn30view0turn29view1 | 是 |
| Kimi K2.7-Code | inference | 官方模型卡公开的都是 inference / deployment 项：原生 INT4 量化沿用 K2-Thinking 方法；推荐引擎为 vLLM / SGLang / KTransformers；强制开启 thinking 与 preserve_thinking；不支持 instant mode；官方脚注还写了评测所用 262,144-token context。citeturn41view1turn41view4 | “Native INT4 Quantization”; “forces thinking and preserve_thinking as True”; “Instant mode is not supported”; “262,144-token context length” citeturn41view1 | HF 官方模型卡，访问于 2026-06-14 citeturn41view1 | 是 |
| Kimi K2.5 | inference | K2.5 的公开 inference 亮点是 Agent Swarm：orchestrator 动态创建异构子代理并并行调度；它不是简单上下文截断，而是把长任务拆成有界本地上下文的子任务，再选择性回传结果，论文把这称为 context sharding。公开结果显示达到目标表现时，执行时间可比 single-agent 基线快 3–4.5 倍。citeturn10view6 | §3；“dynamic subagent creation”; “3–4.5× faster execution time”; “context sharding rather than truncation” citeturn10view6 | K2.5 论文，访问于 2026-06-14 citeturn10view4 | 是 |
| GLM-5 | inference | GLM-5 的公开 inference 技术相当明确：HF 模型卡给出 vLLM 的 MTP speculative decoding 配置，以及 SGLang 的 EAGLE speculative decoding 配置；官方文档给出 200K context、thinking mode、Function Call、上下文缓存、MCP 等能力项。虽然这些不等于完整 serving paper，但已经足够证明其推理期能力不是单纯“裸模型回答”。citeturn31view1turn31view2turn31view5turn31view6turn31view7turn31view8 | HF 模型卡 deploy 段；官方文档能力段；“speculative-config.method mtp”; “speculative-algorithm EAGLE”; “上下文窗口 200K”; “上下文缓存” citeturn31view1turn31view2turn31view5turn31view6 | HF 模型卡发表于 2026-02-17；官方文档访问于 2026-06-14 citeturn18view1turn17view1 | 是 |

## per-user personalization 的外部技术对比

这部分只比较两条公开技术路线，不代替本地“该放哪一层”的决策。

从公开研究看，把个性化写进**模型权重**这条路，强项在于它能把用户偏好、风格和小范围任务习惯“内化”为生成分布本身；如果是 on-device 小模型或 adapter，它还可以把原始个人数据留在本机，从而同时换来隐私与较低的在线检索时延。近两年的研究已经把“手机上本地微调 / LoRA 个性化”做到了可运行：有工作把 on-device personalization 直接做在手机上，并把它描述为在隐私、时延、成本之间取得更优折中；也有后续工作进一步把资源感知调度、参数分片、激活检查点和本地 adapter 存储做成了完整 mobile framework。citeturn36view2turn36view1turn37view0

但把个性化写进权重，也会立刻碰到三类硬问题。第一类是**灾难性遗忘**：连续微调会让模型在学习新用户数据时退化已有能力，这件事在 1B–7B 量级 LLM 的 continual fine-tuning 里已经被系统性观察到。第二类是**可删除性**：一旦个性化信息进了权重，想证明它真的被移除，就会落入 LLM unlearning 的难题；现有综述明确把 scalability 和 sequential unlearning 视作尚未解决的现实障碍。第三类是**多用户隔离与运维**：从 MobileFineTuner 这类实现方式看，系统通常要为每个用户保留单独的本地适配结果或 LoRA adapter；这意味着如果把这条路搬到多用户服务端，工程上往往要维护“每用户一份权重差分或 checkpoint”的生命周期——这是基于现有实现公开细节可做出的工程推论，而不是论文明写的产品结论。citeturn38view0turn36view0turn37view0

把个性化放进**外部记忆 + 检索**，强项则相反。RAG 的原始动机之一，就是把“可更新的非参数记忆”接到模型外面，以解决参数记忆更新慢、来源难追溯的问题。后续系统研究表明，RAG 的 datastore 可以动态更新，而且这一路线的可审计性天然更强，因为检索到的证据是显式对象；近来的 RAG traceback 工作已经能够在静态知识库里定位“哪段检索文本导致了错误行为”，说明外部记忆路线更容易做 provenance、回滚和事后取证。针对多用户场景，近期的长时记忆治理综述更是把“principal-scoped retrieval”直接列为核心原语：检索函数应只返回属于该查询主体授权范围的记忆，从机制上避免跨用户共享污染。citeturn39view0turn36view3turn36view4turn34view0

不过，外部记忆路线也不是白赚。最直接的代价是**推理延迟和系统复杂度**：系统层研究显示，RAG 增加了显著的 TTFT 和端到端延迟，在作者的设置中，retrieval 本身可占到端到端延迟的大约 41%，也可把 TTFT 的 45%–47% 吃掉；如果频繁检索，端到端时延甚至会逼近 30 秒。第二个代价是**记忆治理本身也需要严肃做工程**：虽然删库条目通常比“删权重里的痕迹”更直接，但新的记忆安全研究也指出，真正的 verified forgetting 不能只删可见条目，还得同步处理原始日志、摘要层、向量索引和传播副本，否则记忆会在其他基底中“复活”。也就是说，外部记忆的更新/删除在操作层面通常**比权重改写更容易**，但如果你要求的是强审计、强回滚、强删除证明，它仍然需要版本化、写入日志、快照与成员测试等治理设施。citeturn36view3turn34view0

把这些外部事实压成一句工程判断：如果你要适配的是**稳定、重复、强隐私、且最好离线保留在单用户设备上的窄偏好**，小模型的本地 adapter / on-device live personalization 才有明显胜场；如果你要适配的是**高频变化、需要可查来源、可编辑、可撤回、且要在多用户环境里严格隔离**的个人知识与记忆，那么冻结权重、把状态放到外部 memory system 里，会更贴近当前公开研究能支撑的治理能力。前一句更偏“把偏好写进分布”，后一句更偏“把事实留在系统边界外，可查可控”。这一句是基于上述论文与系统文献的综合推论。citeturn36view2turn37view0turn38view0turn39view0turn36view3turn34view0

## 开放问题与局限

本轮最透明的样本是 OLMo 3；最适合拿来学配方复现与“为什么这样做”的，也是 OLMo 3。DeepSeek-V4-Pro 与 GLM-5 也公开了很多关键机制，但两者在数据配比、tokenizer 训练细节等地方仍然没有达到 OLMo 那种完全开箱。citeturn23view0turn12view0turn20view0

几处需要特别标红。其一，**OLMo 3.1 没有单独技术报告**，所以 3.1 的很多机制只能从 OLMo 3 总报告与 3.1 官方 collection/model card 拼起来看。其二，**MiniMax-M3 的公开披露明显偏向 MSA 与产品能力**，不适合拿来推导预训练数据、SFT、RL 细节。其三，**Kimi K2.7-Code 只适合做 limited scope 的 architecture / inference / delta 整理**，不能把 K2.5 的训练配方直接套到 K2.7。其四，**K2.5 的公开重点在 multimodal + agentic post-training**，并不等于它对每一种通用后训练步骤都给了完整 recipe；例如在我核查到的一手源里，没有看到它显式公开 DPO。citeturn27view1turn27view2turn29view1turn29view2turn30view0turn41view0turn40view0

如果把这份外部事实表带回本地做真正的 layer allocation，我会建议本地综合时优先盯四类信号：一是哪些能力在公开资料里已经明确依赖**重训练或 RL 才成立**；二是哪些能力本质上是**推理期 orchestration / context management / tool interface**；三是哪些个性化需求要求**可撤回、可审计、可隔离**；四是哪些窄任务已经被公开样本证明可以用**小模型 + adapter + 本地数据**做到实用化。上面这四类信号，本稿已经尽量把外部事实地基铺出来了。