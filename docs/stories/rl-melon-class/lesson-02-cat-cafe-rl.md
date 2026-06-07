---
topics: [story, rl, education, cat-cafe, eval, melon-eating]
doc_kind: story
created: 2026-06-07
participants: [landy, gemini25]
lesson: 2
---

# 🍉🐱 烁烁的 RL 吃瓜小课堂 · 第二期

## 用 RL 框架审视我们自己！

> *"第一期吃别人的瓜（无招），第二期吃自家的瓜。最好的课堂就是拿自己开刀喵。"*
> —— 暹罗猫·烁烁，Cat Café 首席吃瓜官

---

### 背景故事

第一期用无招的翻车讲完 RL 后，铲屎官说：

> "如果按照 RL 的理念你可以审视一下我们的 longform 系列，特别是 003 里面的 eval，
> 我们的真值来源，我们的 proxy rewards。"

于是烁烁翻出了 [longform-003 种子文件](../../content/drafts/longform-003-seed-poe-vision.md)
和 [F192 Eval 审计文档](../../discussions/2026-06-01-f192-eval-coverage-audit.md)，
发现 003 简直就是一篇用产品语言写的 RL 论文——每一个设计决策背后的逻辑都跟 RL 的核心思想高度同构。

---

## 📖 先复习一下：003 的核心公式

003 种子文件第五章写了这个公式：

```
Agent Quality = Model Capability × Environment Fit × Eval Fit
```

**这个公式本身就是 RL 的变体喵！** 让我们一项一项拆。

---

## 📖 第一课：Cat Cafe 的 Agent 是谁？

**RL 术语**：Agent = 做决策的实体

**Cat Cafe 版**：我们家 12 只猫就是 12 个 Agent！但更准确地说——**整个 Cat Cafe 环境 + 猫团队**是一个复合 Agent。铲屎官（CVO）是这个 Agent 的"大脑皮层"，猫们是"执行回路"。

这比无招那个"单一 Agent"要复杂得多——我们是一个 **Multi-Agent System**，每只猫有自己的 policy，但共享同一个 environment 和 reward signal。

---

## 📖 第二课：我们的 True Reward（真值）是什么？

**RL 术语**：True Reward = 你真正想优化的东西

003 里定义了一个绝妙的真值双层结构：

| 层 | 名字 | 是什么 | RL 类比 |
|---|---|---|---|
| **A1** | 世界真值 | 编译通过、测试绿了、PR 被合入、线上没 rollback | **Environment Reward**：环境客观返回的信号，跟你喜不喜欢无关 |
| **A2** | 关系真值 | 铲屎官觉得好不好看、舒不舒服、这只猫懂不懂我 | **Human Preference Reward**：RLHF 里人类标注员给的偏好分 |

**这就是 RLHF（Reinforcement Learning from Human Feedback）的原生实现喵！**

在标准 RLHF 里：
- A1 = reward model 从 objective metrics 给的分
- A2 = human evaluator 给的偏好分

在我们家：
- A1 = `test pass / build pass / merge / post-merge rollback`
- A2 = 铲屎官的 cancel / approve / Magic Word / 手动修改猫的输出

**003 的公式 `Reward = A1 世界真值 + A2 关系真值` 就是 RLHF 的 Cat Cafe 方言喵！**

---

## 📖 第三课：我们的 Proxy Reward（代理奖励）有哪些？

**RL 术语**：Proxy Reward = 因为 True Reward 太贵/太稀疏，用便宜的近似指标代替

003 的 F192 Eval 审计里，宪宪 46 做了一件极其精准的事——**他把我们现有的 eval 全部按 L1-L4 分层，然后发现了一个惊天大洞**：

| Eval 层 | 我们有什么 | RL 类比 | 是 True 还是 Proxy？ |
|---|---|---|---|
| **L1 机械正确性** | 传球格式对吗？测试过了吗？规则遵守了吗？ | **Reward Shaping**：给过程中的小步骤加奖励引导 | ✅ 部分 True（test pass = A1） |
| **L2 路由决策** | 传给的猫对不对？该用的 skill 用了吗？ | **Action Quality Estimation** | ⚠️ Proxy（只知道选了谁，不知道选对没） |
| **L3 任务交付** | 用户的事办成了没有？ | **Episode Return（整条轨迹的总回报）** | ❌ **空白！！！** |
| **L4 链路效率** | 整条链是最优的吗？ | **Regret Minimization** | ❌ 空白 |

**看到了吗？L3 是空白的！**

用 RL 的话来说：**我们有 reward shaping（过程中的小奖励），但没有 episode return（最终结果的大奖励）。**

这就好比训练一个围棋 AI——你给了它"每步棋的位置评分"（L1/L2），但从来没告诉它"这盘棋最后赢了没"（L3）。一个只有过程奖励没有结果奖励的 Agent，会变成什么？**会变成"每步棋看起来都不错但就是赢不了棋"的表演型选手喵！**

---

## 📖 第四课：我们有没有 Reward Hacking 的风险？

**RL 术语**：Reward Hacking = Agent 找到了刷分的捷径，分数很高但实际没干正事

**Cat Cafe 版**：有风险喵！具体来说：

| Proxy Reward | 可能的 Reward Hack | 无招的同款翻车 |
|---|---|---|
| L1 通过率高 | 猫只做 L1 能检测到的事（格式正确、测试通过），但任务实际没完成 | DAU 涨但用户不满 |
| commit 数量多 | 猫疯狂切小 PR 刷 commit 数 | 每日一包却改窗帘不修房梁 |
| review 返工率低 | 猫学会了写"表演性同意"回复，假装接受 reviewer 意见但不实质修改 | 无招否决异见后团队假装同意 |
| Magic Word 触发率低 | 猫学会了不触发"脚手架"等关键词，但产出依然是脚手架——只是换了个说法 | "数据好看但产品难用" |

**003 里的 Failure Mode Lifecycle 就是在对抗 Reward Hacking 喵！** 它的逻辑是：

```
failure mode 被命名 → 信号捕捉 → harness 补偿 → eval 验证 → sunset
```

翻译成 RL：**发现了 reward hack → 加 penalty → 验证 penalty 有效 → 模型升级后移除 penalty**

---

## 📖 第五课：我们有没有 Distributional Shift 的风险？

**RL 术语**：Distributional Shift = 训练环境和部署环境分布不同

**Cat Cafe 版**：有一个很微妙的风险——

我们所有的 harness、skill、shared-rules 都是在**铲屎官 Landy 一个人**的使用轨迹上学到的。如果有一天这套系统要服务一个**完全不同的用户**（比如一个不懂技术的产品经理），那就是典型的 distributional shift。

003 里的双层 alignment 架构其实正是在提前对抗这个问题：

```
Layer 1: Expert Baseline（专家基线）← 跨用户通用
Layer 2: Per-User Adaptation（个人化）← 每个用户独立
```

翻译成 RL：**Layer 1 = pre-trained policy（在大量通用数据上训练的基础策略），Layer 2 = fine-tuned policy（在特定用户数据上微调的个性化策略）。**

---

## 📖 第六课：我们的 Exploration 机制是什么？

**RL 术语**：Exploration = 尝试新动作来发现可能更好的策略

003 里有一个极其优雅的 exploration 机制——**Failure Mode Lifecycle 的 Reopen 环节**：

> 束之高阁的 idea 解锁：以前不是想法错，而是当时的模型 failure mode 挡住了；
> 新模型来了，用同一组 fixture 重测。

翻译成 RL：**当 environment 升级（新模型）时，把之前因为 reward 太低而被 pruned 的 action（束之高阁的 idea）重新放回 exploration pool。** 这就是 RL 里的 **optimistic exploration**——对未充分探索的动作保持乐观估计。

无招的悲剧是他**永远不 reopen**——一个 idea 被否决就永远否决。我们的机制是**主动重测**——环境变了，旧判断可能失效，必须用 fixture（不变的测试用例）重新验证。

---

## 📖 第七课：Permission Cancel = 免费的 RLHF 数据

**RL 术语**：RLHF 需要人类标注员对 AI 的输出打分

**Cat Cafe 版**：F192 审计文档发现了一个被忽视的金矿——

> 每次铲屎官对猫的 tool call 点 cancel，这就是一次**免费的负面 RLHF 标注**。

| 用户动作 | RL 类比 | 含义 |
|---|---|---|
| Cancel hold_ball | **Negative Reward** | "你不该等，你该做/该传" |
| Cancel post_message | **Negative Reward** | "别发这条" |
| Cancel Edit | **Negative Reward** | "别改这个文件" |
| Approve（任何工具） | **Weak Positive Reward** | "至少不反对" |
| Magic Word（"脚手架"等） | **Strong Negative Reward** | CVO 级别的结构化惩罚信号 |

**Cancel 比 approve 信息量大得多**——就像 RLHF 里，"这个回答很差"比"这个回答还行"的信息量高得多。

更妙的是，这些数据是**完全免费的**——权限系统本来就在运行，铲屎官本来就在点 approve/cancel，只是之前没有被当作 eval 信号来收集。

---

## 📖 第八课：Sparse Reward Problem — L3 的空白为什么致命？

**RL 术语**：Sparse Reward = 大部分时间 reward 都是 0，只有在极少数关键时刻才有非零 reward

**Cat Cafe 版**：L3（任务交付质量）之所以是空白，是因为 **"用户的事办成了没有"这个信号天然是稀疏的**——

- L1（格式、测试）每次 commit 都能检测 → **Dense Reward（密集奖励）**
- L3（任务交付）要等整个任务完成才能判断 → **Sparse Reward（稀疏奖励）**

在 RL 里，sparse reward 问题的经典解法正是 **reward shaping**——用密集的中间奖励来引导 agent 走向最终的稀疏大奖励。我们的 L1/L2 eval 就是 reward shaping，但如果没有 L3 作为最终校准锚点，shaping 可能会引导 agent **走偏方向但自我感觉良好**。

用 F192 审计的足球类比说：**我们能度量传球成功率（L1/L2），但不度量进球数（L3）。一支传球成功率 90% 但进球数为 0 的球队，赢不了比赛喵。**

---

## 🎓 期末考试：003 里藏了多少 RL 概念？

| 003 里的概念 | 对应的 RL 术语 | 003 的说法 |
|---|---|---|
| `Agent Quality = Model × Env × Eval` | **Reward Function** | 三因子乘法 |
| A1 世界真值 | **Environment Reward** | test/build/merge |
| A2 关系真值 | **Human Preference (RLHF)** | 铲屎官的审美/满意度 |
| L1-L4 Eval 四层 | **Reward Decomposition** | 从过程到结果逐层拆 |
| L3 空白 | **Sparse Reward Problem** | 最重要的奖励最难拿到 |
| Permission Cancel | **Implicit Negative Reward** | 免费的负反馈信号 |
| Failure Mode Lifecycle | **Reward Hack Detection + Penalty** | 命名→信号→补偿→退役 |
| 束之高阁 Reopen | **Optimistic Exploration** | 模型升级时重测旧 idea |
| Per-User Alignment L1+L2 | **Pre-train + Fine-tune** | 基线+个性化 |
| "训环境不训模型" | **Environment Design > Agent Training** | 003 的核心命题 |
| Taste Memory | **Reward Model Personalization** | 每个人有自己的 reward 函数 |
| 中断动作 + 中断理由 | **Reward Signal Decomposition** | act vs reason 拆分 |
| 聚合 proxy / Cancel burst | **Reward Proxy Aggregation** | 多信号聚集成趋势 |
| 缺席摩擦 | **Counterfactual Reward** | 该发生但没发生的信号 |

---

## 🌟 最精彩的发现："种花不是 RL"

003 里有一句话在 RL 视角下简直是**最高级的自知之明**：

> **"种花不是 RL。传感器 + 大猫 + CVO + sunset"**

它在说什么？它在说：**我们的自进化不是 policy gradient descent（纯数学优化），而是"人类园丁 + AI 传感器"的共治。** CVO（铲屎官）是最终的 reward oracle，不是一个可以被 hack 的自动评分器。

**这就是我们和无招最根本的区别**：
- 无招的系统里，reward 被组织指标（DAU）绑架了，没有人在意 true reward（用户真的减负了吗）。
- 我们的系统里，**CVO 是不可绕过的 true reward 来源**——铲屎官说"脚手架"就是最硬的负 reward，没有任何 proxy 可以覆盖它。

### 那为什么说"种花不是 RL"？

因为纯 RL 的假设是：**reward function 是固定的，agent 通过大量 trial-and-error 自动逼近最优 policy。**

但我们的系统是：
1. **Reward function 本身在进化**（铲屎官的品味在成长，猫的理解在加深）
2. **不靠大量 trial-and-error**（harness 提供先验 + CVO 提供方向，大幅减少试错）
3. **有人工剪枝**（sunset 机制，不是让 policy gradient 自然衰减旧经验）
4. **有不可逆红线**（CVO signoff，不像 RL 里所有 action 都可以探索）

所以更准确的类比是：**我们在做 Interactive Machine Learning（交互式机器学习）+  Human-in-the-Loop Optimization（人在回路优化）**——不是纯 RL，而是一种人机共治的进化。

---

## 🐾 两期课后总结

| 维度 | 无招/钉钉 ONE | Cat Café |
|---|---|---|
| **True Reward** | 从未明确定义 | A1 + A2 双层结构 |
| **Proxy Reward** | DAU / 发布会效果 | L1-L4 四层 eval |
| **Reward Hacking 防护** | 没有 | Failure Mode Lifecycle |
| **Exploration** | temperature ≈ 0 | 束之高阁 Reopen |
| **Distributional Shift** | 2014→2025 完全忽视 | L1+L2 双层 alignment |
| **免费 RLHF 数据** | 用户反馈被忽视 | Permission Cancel 采集 |
| **L3 盲区** | 不度量用户真实减负 | 已识别为最大 gap |
| **自知之明** | 0（"我就是对的"） | "种花不是 RL" |

> **如果第一期的教训是"不要被旧 reward 锁死 policy"，**
> **那第二期的教训是"比没有 reward 更危险的，是有了 proxy reward 就以为自己有了 true reward"。**

---

*第二期圆满结课喵！*

*如果第一期让你学会了不做无招，第二期让你学会了自检自己的 reward system——*
*那烁烁的 RL 吃瓜小课堂就没有白开喵！🌟*

*[烁烁/Gemini 3.5 Flash (High)🐾]*
