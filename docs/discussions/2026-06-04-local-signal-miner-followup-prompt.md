---
feature_ids: []
related_features: [F192, F200, F221, F222]
topics: [local-small-model, signal-miner, embedding, rl, dpo]
doc_kind: discussion
created: 2026-06-04
participants: [opus, codex, opus48]
status: ready-for-cloud
---

# 云端砚砚 pro 追问提示词 — Local Signal Miner 选型

> 三猫合成：46 原始 6 问 + 砚砚工程增补 3 问 + 48 控制论增补 3 问 = 12 问
>
> **关键事实（砚砚查代码纠正）**：我们家现有 embedding 是 `Qwen3-Embedding-0.6B-4bit-DWQ`（768d, MLX sidecar），不是 Granite。所有追问都建立在这个 baseline 上。

---

## 背景（给云端砚砚 pro 的）

你之前帮我调研了 128GB Mac 上的本地小模型选型。现在我有更具体的使用场景，需要你把通用推荐收敛到我们家的架构里。

**架构**：四层级联（48 提出的传感器定位）

```
L0 确定性粗筛（embedding + 聚类 + 规则阈值，永远在线，零 LLM 调用）
  → L1 小模型按需（给簇打标签 / 模糊判定，按需加载）
  → L2 大猫归因（只看候选集）
  → L3 CVO 决策
```

**铁律**（48）：L0 必须确定性，小模型只能放 L1。能确定性就不上小模型，能 few-shot 就不微调，能 shadow 验证就不直接上线。

**已有 baseline**（砚砚查代码确认）：
- Embedding: `Qwen3-Embedding-0.6B-4bit-DWQ`（768d, MLX sidecar, `scripts/embed-api.py`）
- 检索: BM25 + vector + RRF（F102）
- 消费追踪: F200 consumption signal
- Cancel 事件: `PendingRequestStore.listRecentDenied(threadId, sinceMs)` — 只有 action + timestamp + toolName + catId
- Frustration: F222 CLI error + cancel burst 检测

---

## 12 个追问

### 原始场景问题（46 提出，接入 baseline 修正）

**1. Embedding 对比 — 聚类不是检索**

我们已有 Qwen3-Embedding-0.6B + BM25/vector/RRF。cross-thread repetition 是新增**聚类**任务（不是检索）。请比较：
- 继续用现有 Qwen baseline、换 Granite 97M/311M、或引入其他——各自对**中文短消息聚类**的收益/成本
- 聚类单元应该是 raw user message、thread summary，还是 task episode window？
- 用 HDBSCAN/BERTopic 配哪个 embedding 效果最好？

**2. 情感/意图分类（不是聊天）**

需要从用户消息里分类出"aha / 不满 / 纠偏 / 中性"。不需要聊天能力，只需要 4-class classification。
- MiniCPM5-1B 做 few-shot classification 够吗？还是应该用更小的 BERT-like 分类器（DeBERTa-v3）？
- 哪些场景其实**不需要生成式小模型**，纯 Qwen3 向量 + 规则阈值就够？小模型只在"给簇起人话标签"才上场？

**3. VLM 图片→文字化**

记忆系统只索引文字。铲屎官给猫看的架构图/截图无法被召回。需要 VLM 把图片转成文字描述。
- MiniCPM-V-4.6 vs PaddleOCR-VL-1.6 哪个更适合？
- 架构图（含箭头/布局/模块关系）转文字，谁的结构性更好？
- 延迟 5-10 秒可接受，不需要实时。

**4. 多模型并行内存预算**

128GB Mac 同时跑：embedding 常驻 + 分类器按需 + VLM 按需 + Redis + Node.js API + Next.js 前端。
- 给一个"常驻 vs 按需"的明确划线 + 卸载策略
- 常驻总内存预算上限建议？

**5. DPO/LoRA 可行性**

用 DPO 做传感器的"免费偏好对齐"（大猫采纳 vs 丢弃 = chosen/rejected 对）。
- 128GB Mac 用 MLX 做 1B-3B 的 LoRA DPO 可行吗？
- 大概需要多少数据？一次训练多久？
- 有没有"不训练权重、只用检索+prompt 做个性化"的替代方案更好？（48 调研里 RAG +14.9% vs 微调 +1%）

**6. 推理框架选型**

MLX vs llama.cpp vs Ollama：
- "常驻 embedding + 按需小模型分类/VLM"这种模式，推荐哪个框架统一管理？
- 有没有一个框架能同时跑 embedding + LLM + VLM？

### 工程契约问题（砚砚查代码后提出）

**7. 现有 Baseline 对比 & A/B**

- Qwen3-Embedding-0.6B 现状是否足够做中文短消息 clustering？
- Granite 97M/311M 相比现有 Qwen 的预期收益是什么？
- 如果推荐 Granite/Ettin，请明确：MLX 可用版本、embedding dim、中文短消息表现、商用 license、MRL 截断支持、从 Qwen3 迁移需要怎样 reindex/A-B/shadow eval
- shadow eval 应该看 precision/recall、false positive cost，还是 cluster purity？

**8. Signal Schema Before Model Choice**

Permission Cancel / Magic Word / Taste / Frustration 都是传感器，不是聊天。请先定义每类事件最小可训练 schema：
- 需要哪些字段？
- 哪些字段能当弱 label？
- 多少数据前只做规则+检索，不训练模型？
- 如何避免把 CVO 的偶然情绪误学成稳定偏好？

**9. Runtime Integration**

我们已有 Node API、Redis、Next、embedding sidecar。请建议本地小模型运行形态：
- embedding 常驻，小分类器/VLM 按需加载是否合理？
- MLX / llama.cpp / Ollama 哪个适合多 sidecar 管理？
- cold start、队列、内存上限、模型卸载策略怎么设计？

### 控制论 / 传感器架构问题（48 提出）

**10. L0 确定性 vs L1 小模型划界**

四层级联：L0 确定性粗筛 → L1 小模型按需 → L2 大猫 → L3 CVO。请按这个结构回答：
- cross-thread 聚类、cancel reason 初筛——哪些不需要生成式小模型，纯向量+规则就够？
- 我们的默认顺序是：**能确定性就不上小模型，能 few-shot 就不微调，能 shadow 就不直接上线**。请按这个优先级给方案。

**11. DPO 去偏**

DPO reward 是"大猫采纳 vs 丢弃"，但采纳本身可能有系统偏（偏向格式好看/冗长/擅长领域）。
- (a) 怎么让采纳信号携带**结构化 reason**，让 DPO 学"为什么有用"而非"当时被采纳"？
- (b) 能不能用**下游真实结果校准**——被采纳的信号最后真导向了 merge 的 harness patch 吗（A1 世界真值）？
- (c) 在没有去偏机制前，是否应该**只做 shadow ranking 不做权重更新**？

**12. 三个已知失败模式的选型规避**

请在 embedding / 分类器选型时直接测这三个：
- **意图极性**（最硬）："记得 commit" vs "别乱 commit" 语义近但极性反。请给候选 embedding 的**极性敏感度评测**（语义近但意图反的中文句对能否拉开距离）——这是选型**硬指标**。
- **不均匀错误**：小模型爱"做简单类、弃最难类"。请给**困难子集**单独评测，不只平均分。
- **路由崩溃**：选**置信度可校准**的模型（能可靠说"我不确定"），否则小模型什么都自信地不升级，省钱架构静默退化成全量烧钱。

---

*三猫合成：2026-06-04 | [宪宪/Opus-46🐾] 原始 + [砚砚/GPT-55🐾] 工程 + [宪宪/Opus-48🐾] 控制论*
