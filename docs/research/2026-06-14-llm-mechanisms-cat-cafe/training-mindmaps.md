---
doc_kind: research
created: 2026-06-15
topics: [llm-training, mindmap, pretrain, posttrain]
related_features: []
participants: [opus-48, landy]
status: knowledge-system
---

# LLM 训练思维导图（Mermaid，可渲染可编辑）

> 用 Mermaid mindmap 格式——GitHub 和支持的 markdown 预览器会自动渲染成放射状思维导图，源码本身也能直接改。
> 图1：完整 post-train（整合铲屎官提供的三张图）。图2：pre-train（仿同体系新做）。

## 图 1 · Post-train 后训练（完整版）

```mermaid
mindmap
  root((Post-train<br/>后训练))
    SFT 监督微调
      作用 学格式与对话形状
      数据 指令响应对
      RFT 拒绝采样微调 生成多个挑好的再学
    偏好对齐 Preference
      作用 学人类喜欢哪个
      RLHF 人类排序 训奖励模型 再RL
      DPO 直接偏好优化 跳过RL流水线 更稳
    RL 强化学习
      作用 推到训练数据之外
      PPO 经典 需要Critic 计算重
      GRPO 去掉Critic 组内相对比较 DeepSeek提出
      DAPO 解耦裁剪改进
      RLVR 可验证奖励 答案对错判定
    蒸馏 Distillation
      传统KD OffPolicy teacher生成 student模仿
      OPD OnPolicy student自己生成 teacher打分
        OPSD 自蒸馏
        OPRD 表征蒸馏
        Reopold 放松版
    各模型组合方式
      DeepSeekR1 冷启动SFT 推理RL 拒绝采样SFT 全场景RL
      GLM5 SFT 推理RL 智能体RL 通用RL 跨阶段蒸馏
      DeepSeekV4 各领域专家培养 多教师OPD合并
      KimiK25 零视觉SFT 联合多模态RL 智能体集群
      OLMo3 SFT DPO RLVR 最干净开放范式
```

> **看图的关键**：左边四支（SFT / 对齐 / RL / 蒸馏）是**方法工具箱**；最右一支是**各家怎么用这些工具拼装**。一眼看出——每家都是「SFT 打底 → 对齐/RL 提升 → 蒸馏收口」同骨架，只是配方填空不同。

## 图 2 · Pre-train 预训练（仿同体系）

```mermaid
mindmap
  root((Pre-train<br/>预训练))
    核心任务
      next-token-prediction 猜下一个词
      为什么有用 猜词被迫学会事实逻辑情感代码
      它是伪装的通用任务
    数据
      规模 GLM5约28T DeepSeekV4约32T tokens
      配比 代码 网页 数学 多语种
      合成数据 用模型造数据 防data-wall
      合成风险 model-collapse 近亲繁殖丢多样性
      多阶段 上下文4K逐步拉到200K
    架构
      MoE 专家混合 稀疏激活省算力
      注意力变体 CSA HCA MSA DSA 撑百万context
      位置编码 RoPE加YaRN长度外推
      MTP 多token预测 加速且支持投机解码
    优化与精度
      优化器 Muon AdamW
      量化训练 INT4 FP4 QAT
    产物
      base-model 博览群书的复读机
      只会补全文本 不会回答你
      要靠post-train调成助手
```

> **pre-train 的灵魂**：整张图最该记的是中心那句——**所有能力都从"猜下一个词"这一个任务里逼出来**。数据/架构/优化都是为了把这个任务做到极致。
