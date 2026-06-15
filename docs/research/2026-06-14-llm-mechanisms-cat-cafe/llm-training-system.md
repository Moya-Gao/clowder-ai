---
doc_kind: research
created: 2026-06-15
topics: [llm-training, pretrain, posttrain, sft, rlhf, distillation, lora, system-overview]
related_features: []
participants: [opus-48, landy]
status: knowledge-system
---

# LLM 训练全景体系

> 把一整天零散的问答，按"人家"的思维导图骨架重组成一条主线。配套：术语速查表见 `nano-gpt-handson.md`，各模型一手机制见 `claude-round2.md`/`gpt-round2.md`。

## 一条主线（先记这个）

```
Pre-train（猜词）          →  base model（博览群书的复读机）
  ↓ Post-train
  ├─ SFT       学"格式/对话形状"    →  会按问答格式说话
  ├─ 偏好对齐   学"人类喜欢哪个"      →  说得有用/安全/讨喜
  └─ RL        "推到训练数据之外"    →  能解没见过的新题
= 助手（比如我）

横向两条技巧线（贯穿全程）：
  · 蒸馏 Distillation —— 把大模型能力压进小模型
  · LoRA / 量化 —— 省钱省显存的"怎么训/怎么跑"
```

---

## Part 1 · Pre-train（预训练）—— 学"懂世界"

- **核心任务**：next-token prediction（猜下一个 token）。完形填空做几万亿道。
- **为什么有用**：要猜准下一个词，被迫学会事实/逻辑/情感/代码——"猜词"是个伪装的通用任务。
- **架构**（2017 Transformer 之后的演进）：MoE（稀疏激活，省算力）· 稀疏/压缩注意力（撑长上下文）· RoPE（位置编码）· MTP（一次预测多个）。
- **数据**：配比 + 规模（GLM-5 28.5T / DeepSeek-V4 32T tokens）+ 合成数据（防 data wall）+ 多阶段（4K→200K 逐步拉长）。
- **产物**：**base model**——什么都懂一点，但只会"补全文本"，不会"回答你"（复读机）。

---

## Part 2 · Post-train（后训练）—— 把复读机调成助手 ★体系核心

### 2.1 SFT（监督微调）—— 学"格式 / 对话的形状"
- **作用**：teaches the model the format——怎么 follow 指令、结构化输出、对话风格。
- **数据**：指令-响应对（"问 → 好答案"示范）。
- **本质**：还是"猜下一个词"，只是数据换成高质量问答对。学**模仿**。
- **变体 RFT（Rejection-sampling FT）**：让模型生成多个答案 → 用规则/打分挑出好的 → 再拿这些好的去 SFT（自我提纯）。

### 2.2 偏好对齐（Preference Alignment）—— 学"人类喜欢哪个"
- **作用**：aligns with human values & preferences——SFT 教不了的语气/安全/有用性（没唯一标准答案的）。
- **RLHF**：模型生成多个答案 → 人类（或 reward model）排序 → RL 往"人更喜欢"调。
- **DPO（Direct Preference Optimization）**：直接从"偏好对"学，**跳过搭复杂 RL 流水线**，更简单稳定。现在很常用。

### 2.3 RL（强化学习）—— "推到训练数据之外"
- **作用**：pushes the model beyond its training data——在可验证任务（数学/代码）上自己摸索更优解。
- **PPO**：经典 RL，需要额外的 Critic 网络估价，计算重。
- **GRPO**（DeepSeek 提出）：**去掉 Critic**，靠"组内多个答案相对比较"算优势，更省。
- **DAPO / RLVR 等**：GRPO 的后续改进（解耦裁剪、可验证奖励等）。
- **RLVR**（Verifiable Rewards）：奖励来自"答案对不对"的客观判定（OLMo 3 用）。

---

## Part 3 · 蒸馏（Distillation）—— 把大模型能力传给小模型 ★横向线

- **传统 KD（Off-Policy）**：teacher 先生成 token，student **模仿** teacher 的输出。简单但学的是"teacher 的轨迹"，和 student 自己的分布对不上。
- **OPD（On-Policy Distillation）**：**student 自己生成** rollouts，teacher 在 student 走过的路上给 token 概率/打分——学的是"student 自己会走的地方该怎么走"，对齐更好。
  - 变体：OPSD（自蒸馏）/ OPRD（表征蒸馏）/ Reopold（放松版）。
- **和前面 study 的连接**：DeepSeek-V4 的"10 个专家 → 1 个通才"就是 **on-policy distillation**（内部自蒸馏，≠ 偷师闭源大模型）。

---

## Part 4 · 各模型怎么组合这些（图1 + Round 2 一手）

| 模型 | post-train pipeline（一手源确认的） |
|---|---|
| **DeepSeek-R1** 风 | Cold-Start SFT → Reasoning RL → Rejection-sampling SFT → 全场景 RL |
| **GLM-5** | SFT(interleaved thinking) → Reasoning RL → Agentic RL → General RL(GRPO+IcePop) → On-Policy Cross-Stage Distillation(防能力回退) |
| **DeepSeek-V4** | Specialist Cultivation(各领域专家 SFT+GRPO) → Unified Consolidation(多教师 OPD 合并) |
| **Kimi K2.5** | Zero-vision SFT → Joint Multimodal RL → Agent Swarm(PARL) |
| **OLMo 3** | SFT → DPO → RLVR（最干净的开放范式，全公开） |

> 看出来没——**每家都是"SFT 打底 → 对齐/RL 提升 → 蒸馏收口"的同一套骨架，只是配方不同。** 这就是体系的价值：记住骨架，各家差异就是填空。

---

## Part 5 · 训练技巧（横向，贯穿全程）

| 技巧 | 一句话 | 详见 |
|---|---|---|
| **LoRA** | 冻结原模型只训小补丁，省钱微调（SFT/RLHF 都能套）| 术语表 |
| **优化器 Adam** | 记"动量+波动"两本账决定怎么调权重 | 术语表 |
| **超参** lr/batch/iter | lr 最关键（步子大小）；多靠经验默认 + 调 | hands-on |
| **checkpoint / early-stop / resume** | 存最优档、val 不降就停、存 optimizer 才能干净续训 | hands-on |
| **量化** INT4/FP4 | 压缩权重让本地硬件跑得动 | Round 2 |
| **训练病理** | 不收敛 / 梯度爆炸 / 过拟合 的诊断速查 | hands-on 病理表 |

---

## Part 6 · 我们亲手验证的（hands-on）

`nano-gpt-handson.md`：在 128G Mac 上从零训了个 13.7M 的猫咖 GPT，**只走通了 Part 1（pre-train）**——亲眼看 loss 8.4→1.8、看 base model = 复读机。Part 2（SFT/对齐）还没动手；要让它"能对话"，下一步就是给它（或更现实地，给 Gemma）做 SFT。

---

## 这份体系和猫咖 study 的关系

理解了这套训练体系，才能做 `layer-allocation.md` 里的判断——**哪些能力是 pre-train 烧死的地基（等猫舍）、哪些靠 post-train 调（等猫舍/自养）、哪些根本不进权重而在 harness 做**。训练体系是"地基知识"，layer allocation 是"基于地基的架构决策"。
