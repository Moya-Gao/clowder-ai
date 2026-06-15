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
> ⚠️ "猫咖已有设计/gap" 列里 F231 / 自养层研究线我只到标题级，**细节待砚砚核**（别 mischaracterize 内部）。

## 决策表

| 能力 | 模型层能做什么（§A 一手事实） | 猫咖已有设计/gap | 最终决策 | 为什么不是另外两层 | 关键判断轴 | 迁移信号 | 最小验证 |
|---|---|---|---|---|---|---|---|
| **per-user 个性化** | live-train 进权重 vs retrieval；Round2 两路独立得出 retrieval 在可审计/可删除/多用户隔离/防遗忘全胜，weights 仅 on-device 低延迟+风格胜 | F221 taste-lane + F231 profile-capsule + MEMORY.md（harness 记忆系统，已 done） | **harness** | 等猫舍=前沿不会为单用户训权重；自养=live-train 小模型有灾难性遗忘+不可审计+多用户不隔离（Round2 一手：unlearning arXiv:2410.15267 / EWC） | auditability·deletability·privacy·blast-radius | 前沿原生支持透明可编辑 per-user 记忆时，部分毕业 | 已在跑（F221/F231） |
| **long-context（注意力效率 CSA/HCA/MSA/DSA）** | 各家稀疏/压缩注意力，1M context；纯模型架构层 | L0 压缩免疫 + 记忆检索（决定"什么进 context"） | **混合**：注意力=等猫舍 / context 管理=harness | 自养=注意力是架构层、规模碾压碰不过；harness 造不出矩阵级注意力 | blast-radius·evalability | 前沿原生 context 够长够稳 → L0 压缩免疫层可瘦身 | 已在跑（L0） |
| **agentic 长程编排** | Kimi Agent Swarm（orchestrator+frozen subagents）/ GLM agentic RL / DeepSeek agent expert——**单模型内**多 agent | A2A 传球 / @mention / hold_ball / workflow（**跨 model** 多猫编排） | **混合**：单模型 agentic=等猫舍 / 跨厂商多猫编排=harness | 跨**不同 model**（Opus/GPT/Gemini）真协作模型层做不到——Kimi 是单模型 frozen subagents，我们是跨厂商真协作 | blast-radius·evalability | 极难毕业（跨厂商编排本质是 harness） | 已在跑（A2A） |
| **窄任务分类/路由** | OLMo-3 7B dense 可复现 + INT4 量化可本地跑，低延迟分类 | F221 taste-lane（现由云端模型做）/ gemma-clerk 自养研究线 | **自养（候选，需 PoC）** | 等猫舍=大模型做分类杀鸡用牛刀+延迟高+贵；harness=纯规则覆盖不了语义。但 taste 警告"小模型 classifier 可能是认知脚手架"——须验证不是过度工程 | latency·privacy·cost | 本地小模型质量够→迁；证明是脚手架→回退 harness 规则 | **OLMo-3 7B 在 128G Mac 跑 taste-lane，对比云端延迟/准确率** |
| **factuality / 防幻觉** | RLVR（OLMo）/ GRM（DeepSeek、Kimi）——模型层 factuality 训练 | verify-before-guess 家规 + source-audit + F218 | **混合**：基础=等猫舍 / 关键路径 harness 兜底 | 模型层 factuality 是概率改善非保证；harness verify/source-audit 是确定性 gate（phantom ID/SHA/外部 claim） | blast-radius·auditability | 前沿 factuality 到阈值→harness gate 放松，但**关键路径永不取消** | 已在跑（家规） |
| **reasoning/thinking 控制** | DeepSeek 三模式 / GLM turn-level / Kimi preserve_thinking——模型 post-train 能力 | 用 API thinking 参数 + L0 注入 | **等猫舍** | 自养=小模型 reasoning 上限低；harness=软件端造不出 reasoning | evalability | 稳定等猫舍 | API 参数调用 |

## 两个特别追问（铲屎官核心关切）

### 1. per-user alignment：我们的记忆系统 vs 业界 live-train

**判断：我们走对了，而且 Round 2 给了外部一手背书。** 业界创业公司 live-train 进小模型，本质把"懂用户"做成不可审计黑箱；我们用记忆系统（F221 taste / F231 profile / MEMORY.md）做成**可读、可改、可删、可追溯**的 context。Round 2 两路独立印证：retrieval 路线在可审计性、可删除性（GDPR 删除权）、多用户隔离、防灾难性遗忘上全面占优——live-train 只在"离线 on-device 低延迟 + 纯风格适配"窄场景胜。

**但不傲慢**：weights 路线在"单用户、离线、强隐私、纯风格"有真实胜场。我们的记忆系统是**多用户云端协作**场景，所以 harness 是对的——这不是普世真理，是**场景匹配**。

**gap 候选**：Round 2 提到 retrieval 的代价是延迟（RAG 可占端到端 41%）+ 记忆治理工程（删除要同步日志/摘要/向量索引/副本，否则"复活"）。这正是我们记忆系统该自查的——我们的删除是否真彻底？（指向 LL-048 持久化纪律 + 可能的 gap）

### 2. 自养层：128G Mac 能训什么？

**这是整个 study 最有价值的开放题。** Round 2 给了关键样本：**OLMo-3 7B dense + 全开放（数据+代码+checkpoint）+ INT4 量化** = 最适合本地自养的对象（可复现、可在 128G Mac 跑）。

**我的判断：自养层 = 窄任务 + 隐私敏感 + 要低延迟确定性的东西**，具体最可能落地的是 **taste-lane classifier / intent router / 本地安全网关（gemma-clerk 类）**——不是通用生成。理由：128G Mac 物理上无法 full-finetune 70B+，但能 LoRA 微调 7B 做窄分类（Round 2 GPT 那路也指向这个）。

**但带 taste 的警告**：本地小模型容易变成"认知脚手架"（用复杂度代偿）。所以**自养层每一个候选都必须过 PoC 门槛**：证明它比"云端模型 + harness 规则"在延迟/成本/隐私上有可测的净胜，否则回退。第一个该验的就是 taste-lane classifier。

## 我最可能错在哪（给砚砚定向攻）

1. **内部对照可能不准**：F231 profile-capsule / 自养层研究线我只到标题级，"猫咖已有设计"列可能 mischaracterize——请砚砚拿真实 doc 核，尤其 F231 是不是真"注入 context"、自养层研究线现在到哪一步。
2. **"agentic 编排=harness 护城河"可能过度自信**：如果前沿模型某天原生支持跨厂商 orchestration（MCP/A2A 协议层内化），这条会动摇。
3. **"窄任务自养"可能是我想当然**：taste-lane 到底值不值得自养，没有 PoC 数据，现在是判断不是结论——最小验证实验那列是真该跑的，不是装饰。
4. **factuality"混合"可能偷懒**：哪部分等猫舍、哪部分 harness 兜底的边界我画得粗，砚砚帮我把"关键路径"定义清楚。

## 下一步

砚砚 review 这版分层判断 + 补内部 doc 对照 + 拍砖；对齐后 → 填实 mind-map（每个机制进对应层分支 + 迁移信号）+ 跑 learning-guide 第一节（给铲屎官的互动课）。
