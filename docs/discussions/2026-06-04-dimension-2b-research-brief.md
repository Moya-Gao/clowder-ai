---
feature_ids: []
related_features: [F192, F200]
topics: [self-evolution, dimension-2b, weight-update, research-brief, era-of-experience]
doc_kind: discussion
created: 2026-06-04
participants: [opus48]
status: research-brief-for-cloud
---

# 维度 2b 调研 Brief — 改模型权重的自进化（2026 进展）

> **这是什么**：给 research pipeline / 云端大猫跑的调研追问，不是结论。
> **为什么写**：我们正在做一份华为云汇报 PPT，用"自进化深度光谱"框架定位自己。
> 光谱最右端"2b = 改模型权重的自进化"被我们标成「终局方向 · 需确定性 reward · 暂不可达」。
> 这个判断是我们自己下的——必须调研验证它**准不准**，否则路演会被懂行的人当场戳穿。
>
> **你不需要看我们的其他文件。本文档是自包含的，所有必要背景在下面。**

---

## 0. 背景：自进化深度光谱（给云端调研的完整上下文）

我们提出了一个"自进化深度光谱"来定位 AI agent 产品：

```
自进化深度 ──────────────────────────────────────────────→

  不进化              任务内自适应           持久进化·改工件(2a)     持久进化·改权重(2b)
  ─────              ──────────           ─────────────         ──────────────
  Coze / Dify        Anthropic            DGM (学术论文)         Sutton / Silver
  CodeBuddy          Dynamic Workflows    AHE (学术论文)         Era of Experience
  百度千帆            OpenAI               ★ 我们（产品）         Reward-is-Enough
  Copilot Studio     Tax Agents
```

**名词解释**（云端调研者看这里）：
- **Coze / Dify / CodeBuddy / 百度千帆**：2025-2026 年主流 agent 搭建平台。能快速搭 agent 工作流，但搭完靠人维护，不自进化。
- **Anthropic Dynamic Workflows**：2026-06 Anthropic 官方发布，Claude 为每次任务现场写 JS 编排脚本。任务结束脚本丢弃。
- **OpenAI Self-improving Tax Agents**：OpenAI 展示的案例，agent 从生产 trace 修局部策略。
- **DGM（Darwin Gödel Machine）**：Sakana AI 论文，agent 改自己的代码+工具，用 benchmark 筛选，有 archive 谱系。目前在 sandbox 刷 SWE-bench。
- **AHE（Adaptive Harness Evolution）**：学术论文，改的是 harness 多组件（不只 skill 文本），有 component/experience observability。
- **Sutton/Silver — Era of Experience / Reward-is-Enough**：Rich Sutton 和 David Silver（DeepMind）的理论框架，认为 agent 应该通过持续经验直接改善模型权重。是 RL 社区的理论旗帜。
- **Karpathy "卡在 verifier"**：Andrej Karpathy 的观点——self-improvement 的瓶颈是 verifier（怎么判断改进后的版本更好）。代码/数学有确定性 verifier（编译/答案对错），审美/陪伴/协作没有。

**我们站的位置**：2a（持久进化·改工件）。
- 自进化沉淀到 code / skill / harness / memory（运行时代码），不训模型权重
- 可解释、可审计、可回滚
- 已有 120+ 天真实产品运转、6400+ 次代码提交

**这份 brief 调研的对象**：2b（持久进化·改权重）。
- 自进化沉淀到**模型权重本身**（在线 RL / continual learning / self-improving via weight update）
- 我们把它标成"终局方向，暂不可达"——**这个判断需要调研验证**

---

## 1. 我们当前的判断（待调研验证或推翻）

| # | 我们的判断 | 置信度 | 调研要确认 |
|---|-----------|--------|-----------|
| J1 | 2b 需要确定性 reward；审美/陪伴/开放任务没有确定性 reward | 中 | 2026 有没有突破"无确定性 reward 也能改权重"的方法？ |
| J2 | 2b 目前没有产品化，全在实验室 | 低（凭印象） | 2026 有没有产品真在做持续权重更新自进化？ |
| J3 | "先 2a 积累数据/eval → 作为未来 2b 前提"这条桥成立 | 低（推断） | 环境改进的数据真能反哺权重更新吗？有真实路径吗？ |
| J4 | 本地/企业做 2b（持续权重更新）算力成本高到不现实 | 中 | 2026 消费级/企业级硬件做持续微调的真实成本？ |

**注意**：这四条都是**我们的假设**，不是事实。调研的价值就是把它们从"我们觉得"变成"2026 真实现状"。J1/J3 一旦被推翻，我们的"先 2a 后 2b"策略和 PPT 的"2b 暂不可达"措辞都要改。

---

## 2. 调研问题（按对 PPT/策略的关键度排序）

### Q1（命门）：无确定性 reward 场景，2b 到底可不可达？
审美、陪伴、开放创作没有客观真值。2026 年：
- 有没有让"改权重自进化"在无确定性 reward 场景工作的方法（RLHF/RLAIF/preference learning/process reward model 的最新进展）？
- DGM（改代码）之后，有没有"改权重"路线在开放任务上的真实突破？
- Karpathy"self-improvement 卡在 verifier"这个判断，2026 还成立吗？有没有人绕过了 verifier 瓶颈？

→ **决定 J1，决定 PPT「2b 暂不可达」这句话改不改。**

### Q2（策略命门）：2a → 2b 的桥真的存在吗？
我们的策略是"先建可进化环境（2a），积累的真实轨迹 + eval 数据作为未来训权重（2b）的前提"。
- 2026 有没有"用 agent 运行环境积累的 episode/trace/preference 做 RL 数据 → 更新权重"的真实路径或论文？
- 这条桥是真的（2a 数据能喂 2b），还是我们的一厢情愿？
- 如果成立，从 2a 数据到 2b 训练，中间缺哪些环节（数据格式/reward 建模/标注）？

→ **决定 J3，决定我们能不能 claim「2a 是通往 2b 的台阶」而不只是「另一条路」。**

### Q3：2b 的产品化现状（有没有人已经做了）
- 2026 年有没有**产品**（不是论文）真在做持续权重更新的自进化？
- self-improving tax agents（OpenAI）那类，是真改权重，还是只改 in-context 策略（即其实是 1.5 不是 2b）？
- 如果有产品进了 2b，是哪些场景（高 verifier 的代码/数学，还是也碰了开放任务）？

→ **决定 J2，也决定我们「2b 是无人区」的 claim 范围。**

### Q4：2b 的算力/成本现状（华为云视角）
- 2026 消费级（128G Mac）/ 企业级硬件，做"持续在线权重更新"的真实成本（时间/算力/数据量）？
- 持续微调 vs 定期批量微调，哪个现实？
- **对卖算力的云厂商（华为云），2b 是不是反而是利好**——持续权重更新 = 持续算力消耗大户？这个角度对路演有没有价值？

→ 决定 J4，也给华为云 PPT 补一个"2b 时代算力需求"的卖点候选。

### Q5：DGM / Sutton-Silver 线 2026 的真实进度
- 达尔文哥德尔机（DGM）2026 有没有后续工作？还停在 sandbox 刷 SWE-bench，还是有人推进到真实环境？
- Sutton/Silver 的 Era of Experience / Reward-is-Enough，2026 有没有从理论走向可落地的实例？
- 这两条线现在到底是"方向标"还是"有真实落地"？

→ 决定 PPT 把它们标成"北极星"还是要升级措辞。

---

## 3. source hygiene 要求（给跑调研的云端 / pipeline）

> 信源纪律要求：

1. **2026 现状优先**：AI 领域半年就过时，别用 2024/2025 的旧数据论证 2026 的可达性。每条 claim 标数据时点。
2. **区分一手 vs 二手**：论文/官方 release（一手）vs 博客/营销/综述（二手）。厂商自报 benchmark 标明，不当独立验证。
3. **区分"论文 demo 可行" vs "产品真在跑"**：Q3 尤其要区分——很多 self-improving claim 其实是 in-context（1.5），不是改权重（2b）。
4. **回声室警惕**：多篇二手互引同一原始数字 ≠ 多方验证。
5. **诚实标"不可达"**：如果 2b 在开放任务确实还不可达，明确说——这对我们是好消息（验证了"先 2a"策略），不要为了叙事好看而夸大 2b 进展。

---

## 4. 调研回来后怎么用

| 调研结论 | 对 PPT / 策略的动作 |
|---------|-------------------|
| J1 成立（2b 在开放任务仍不可达） | PPT「2b 暂不可达」措辞保留；强化"先 2a"策略的正当性 |
| J1 被推翻（已有方法绕过 verifier） | PPT 措辞改"2b 正在逼近"；重新评估我们要不要更早碰 2b |
| J3 成立（2a→2b 桥存在） | PPT 可 claim"2a 是通往 2b 的台阶"，卡位升级 |
| J3 不成立 | 诚实改成"2a 是独立有效的路，不依赖 2b" |
| Q4 显示 2b 是算力大户 | 华为云 PPT 补"2b 时代 = 持续训练算力需求"卖点 |

---

## 5. 待确认（写这份 brief 时的假设）

- 48 把"pipeline mode b"理解为"给 research pipeline 跑的、关于维度 2b（改模型权重自进化）的调研"。如果铲屎官指的是别的（比如某个具体 pipeline 的 mode b），这份 brief 的主题要调整。
- 这份是**追问设计**，结论留给 pipeline / 云端——48 的训练知识对 2026 前沿会过时（盘古翻车教训），不在这份 brief 里下 2b 进展的结论。

---

*Brief：2026-06-04 | [宪宪/Opus-4.8🐾]（46 代落盘）*
*下一步：发云端大猫 pro 跑，或用 deep-research skill 本地跑*
