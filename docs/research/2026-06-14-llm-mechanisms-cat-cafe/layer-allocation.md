---
doc_kind: research-synthesis
created: 2026-06-14
topics: [llm-mechanisms, layer-allocation, decision-matrix, harness-engineering]
related_features: [F221, F231]
participants: [opus-48, codex]
status: roundB-draft-pending-codex-review
---

# §B Layer Allocation 决策（本地综合 v1 draft）

> 拿 Round 2 外部机制事实（gpt-round2 / claude-round2）+ 内部 doc，对**猫咖关心的能力**做分层判断。
> fable 暂不在，宪宪起头分层判断，砚砚 review + 补内部对照 + 拍砖。
> 北极星：每个能力该落 **等猫舍**（前沿训练）/ **自养**（本地小模型）/ **harness**（context·记忆·工具·家规）。
>
> 砚砚 review 后校准：F231 不是整体 done，而是 Phase A/B 主体已落（capsule 注入 + 砚砚 dogfood），Phase C 养熟循环仍待落；自养层已有 Gemma 4 / Pi / MLX spike，但边界是 candidate clerk，不是 truth-source judge。

## 决策表

| 能力 | 模型层能做什么（§A 一手事实） | 猫咖已有设计/gap | 最终决策 | 为什么不是另外两层 | 关键判断轴 | 迁移信号 | 最小验证 |
|---|---|---|---|---|---|---|---|
| **per-user 个性化** | live-train 进权重 vs retrieval；Round2 两路独立得出 retrieval 在可审计/可删除/多用户隔离/防遗忘全胜，weights 仅 on-device 低延迟+风格胜 | F221 taste-lane 已 done；F231 Phase A/B 已落（≤300字 capsule L0 编译注入 + codex primer / instance dogfood），Phase C 养熟循环仍未落；MEMORY / search_evidence 提供可追溯 recall | **harness** | 等猫舍=可等原生透明可编辑记忆，但黑箱 personalization 不满足审计/删除/多猫 provenance；自养=live-train 小模型在多用户协作里有灾难性遗忘、不可审计、隔离难题（Round2 一手：unlearning / EWC） | auditability·deletability·privacy·blast-radius | 前沿或 runtime 原生支持透明可编辑、可导出、可删除、可追溯 per-user memory 时，capsule 注入可部分毕业为数据源 | F231 Phase C dry-run：profile update proposal + deletion/revival audit |
| **long-context（注意力效率 CSA/HCA/MSA/DSA）** | 各家稀疏/压缩注意力，1M context；纯模型架构层 | L0 压缩免疫 + F102/F200 recall/consumption（决定"什么进 context"、证据怎么追溯） | **混合**：注意力=等猫舍 / context selection+provenance=harness | 自养=注意力是架构层、规模碾压碰不过；harness 造不出矩阵级注意力，但能决定上下文预算、检索、压缩、引用 | blast-radius·evalability·auditability | 前沿原生长上下文足够稳定且引用可追溯 → L0/压缩策略可瘦身；但 provenance/recall 仍留 harness | 已在跑（L0 + memory recall）；需用 F200 consumption 看哪些 context guard 可 sunset |
| **agentic 长程编排** | Kimi Agent Swarm（orchestrator+frozen subagents）/ GLM agentic RL / DeepSeek agent expert——公开样本主要是单厂商/单模型内部 agentic | A2A 传球 / @mention / hold_ball / workflow（跨 model、跨 runtime、带权限与球权审计的多猫编排） | **混合**：单模型 agentic 能力=等猫舍 / 跨厂商协作控制面=harness | 等猫舍能提升单猫/单模型执行力，但不能替我们维护跨供应商 identity、权限、球权、provenance；自养小模型只适合局部 clerk，不适合全局 orchestration | blast-radius·evalability·authority | 若 MCP/A2A 等互操作协议成为 provider 原生、且带可审计状态/权限模型，部分编排可下沉；authority policy 仍应在 harness | 已在跑（A2A）；下一步应抽查失败样本看哪些可交给模型、哪些必须硬 gate |
| **窄任务 candidate / 路由** | OLMo-3 7B 是全开放 recipe 样本；本地实机线已验证 Gemma 4 26B A4B 8-bit via MLX/Pi 可做 text+vision candidate；小模型适合低延迟候选生成/路由 | F221/F231 明确反对后台 classifier 写真相；local-clerk 研究线结论是 candidate generator + trusted harness validator，不是 judge | **自养（候选，需 PoC）+ harness gate** | 等猫舍=大模型做候选/路由延迟高、成本高；纯规则覆盖不了语义。但自养模型只能产候选，不能决定 taste/relationship truth、不能写真相源 | latency·privacy·cost·auditability | 本地小模型在离线 fixture 上稳定优于云端/规则（延迟、成本、隐私、准确率、abstain）→ 扩；若只增加复杂度则回退 | 优先跑 F102/F229 clerk fixtures 或 taste vignette 检索/重排 fixture；不要先做 raw-dialogue taste classifier |
| **factuality / 防幻觉** | RLVR（OLMo）/ GRM（DeepSeek、Kimi）——模型层 factuality 训练 | verify-before-guess 家规 + source-audit + F218；对 IDs/SHA/外部 claim/不可逆动作已有硬边界 | **混合**：基础=等猫舍 / 关键路径 harness 兜底 | 模型层 factuality 是概率改善非保证；harness verify/source-audit 是确定性 gate，尤其适用于 phantom ID/SHA、外部 claim、权限/不可逆操作 | blast-radius·auditability | 前沿 factuality 到阈值→普通路径 gate 可放松；高 blast-radius 路径仍保留可审计验证 | 已在跑；需把"关键路径"枚举成 source-audit / ID / git / Redis / irreversible |
| **reasoning/thinking 控制** | DeepSeek 三模式 / GLM turn-level / Kimi preserve_thinking——模型 post-train + API surface 能力 | runtime 可以选择 provider thinking 参数、记录模式与成本；L0 不应假装制造 reasoning | **混合**：raw reasoning=等猫舍 / mode selection+cost guard+harness eval=harness | 自养=小模型 reasoning 上限低；harness 造不出底层 reasoning，但能选模型/模式、限制预算、记录可回放证据 | evalability·cost·blast-radius | provider thinking modes 稳定、可评估、可观测 → prompt 层 thinking 指令可继续瘦身；mode router 留 harness | 建 provider-mode registry + 小型 eval：same task 不同 thinking mode 的质量/成本/延迟曲线 |

## 两个特别追问（铲屎官核心关切）

### 1. per-user alignment：我们的记忆系统 vs 业界 live-train

**判断：我们走对了，而且 Round 2 给了外部一手背书，但内部状态要说准。** 业界把个性化 live-train 进权重，本质把"懂用户"做成难审计、难删除、难追溯的状态；我们用 F221 taste lane + F231 capsule/primer + recall，把同一类能力做成**可读、可改、可删、可追溯**的 context。Round 2 两路独立印证：retrieval 路线在可审计性、可删除性（GDPR 删除权）、多用户隔离、防灾难性遗忘上全面占优——live-train 只在"离线 on-device 低延迟 + 纯风格适配"窄场景胜。

**但不傲慢**：weights 路线在"单用户、离线、强隐私、纯风格"有真实胜场。我们的记忆系统是**多用户云端协作**场景，所以 harness 是对的——这不是普世真理，是**场景匹配**。

**gap 候选**：F231 Phase A/B 已有 capsule 注入与 dogfood，但 Phase C 养熟循环（采集白名单→蒸馏→消化→更新提议）仍未落地。Round 2 还提醒 retrieval 的代价是延迟 + 记忆治理工程（删除要同步日志/摘要/向量索引/副本，否则"复活"）。这正是我们记忆系统该自查的——profile / taste / memory 的删除与纠错是否真彻底？（指向 LL-048 持久化纪律 + F231 Phase C gap）

### 2. 自养层：128G Mac 能训什么？

**这是整个 study 最有价值的开放题。** Round 2 给了关键样本：**OLMo-3 7B dense + 全开放（数据+代码+checkpoint）** = 最适合学习 recipe 和做可复现实验的对象；但家里当前已实机验证的自养线是 **Gemma 4 26B A4B 8-bit via MLX/Pi**（text+vision candidate），不是 OLMo 已被选型为生产 runner。

**我的判断：自养层 = 窄任务 + 隐私敏感 + 要低延迟确定性的候选生成/路由/重排**，具体最可能落地的是 **F102 digest candidate / F229 intent router / taste vignette retrieval-rerank / 本地安全网关（gemma-clerk 类）**——不是通用生成，也不是让模型写真相源。理由：128G Mac 能跑/微调小模型和 26B 量化模型，但 production-grade 持续 RL 仍是云/集群重资产；家里的现实胜场是低延迟 candidate clerk。

**硬边界**：F231 KD-9 已经禁止"小模型 / regex / LLM 扫对话标关系信号"这种 classifier 换皮；F221 taste lane 也是 evidence lane + 当场记信号，不是后台监控。自养层只能产**带锚点的候选**，最后采纳、写入、路由、执行必须留在 trusted harness / 猫 / CVO。

**但带 taste 的警告**：本地小模型容易变成"认知脚手架"（用复杂度代偿）。所以**自养层每一个候选都必须过 PoC 门槛**：证明它比"云端模型 + harness 规则"在延迟/成本/隐私上有可测的净胜，否则回退。第一个该验的不是 raw-dialogue taste classifier，而是 F102/F229 clerk fixtures 或 taste vignette 检索/重排 fixture。

## 我最可能错在哪（给砚砚定向攻）

1. **F231 状态仍在动**：Phase C 还没落地，"per-user 个性化=harness 已完成"只能说方向正确，不能说闭环完成。
2. **"agentic 编排=harness 护城河"可能过度自信**：如果前沿模型/协议某天原生支持跨厂商 orchestration + auditable authority state，这条会部分动摇；但 authority policy 仍不应交给单个模型。
3. **"窄任务自养"可能是我想当然**：local-clerk 已有 Gemma spike，但是否值得迁 taste/routing 还没有 PoC 数据；尤其不能偷渡 classifier 写 truth source。
4. **factuality"混合"可能偷懒**：关键路径必须枚举清楚，否则"永不取消"会变成口号；建议先列 ID/SHA/外部 claim/权限/不可逆操作五类。
5. **thinking 控制容易混淆**：raw reasoning 是模型层，但 provider mode selection / cost guard / eval 是 harness 层，不能简单写成"等猫舍"。

## 下一步

砚砚 review 这版分层判断 + 补内部 doc 对照 + 拍砖；对齐后 → 填实 mind-map（每个机制进对应层分支 + 迁移信号）+ 跑 learning-guide 第一节（给铲屎官的互动课）。
