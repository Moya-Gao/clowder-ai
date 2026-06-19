---
title: "补课清单：大佬们的思辨模型"
created: 2026-06-19
category: study
author: 宪宪/claude-opus-4-6 + CVO
status: living-document
tags:
  - Reading List
  - Meta-Methods
  - Research Methodology
  - Cat Cafe
---

# 补课清单：大佬们的思辨模型

> CVO："我好像一个仓鼠🐹 想要学习和搜集大佬们的思辨模型"
>
> 本文件是活文档。读完一篇打 ✅，写了 study 笔记填链接。

---

## 已读 ✅（家里有 study 笔记）

| 材料 | 作者 | 年份 | 核心洞察 | study 笔记 |
|------|------|------|---------|-----------|
| The Bitter Lesson | Rich Sutton | 2019 | 通用计算方法长期碾压手写知识 | [bitter-lesson.md](bitter-lesson.md) |
| Reward is Enough | Silver et al. | 2021 | 复杂环境+单一奖励→智能涌现 | [reward-is-enough.md](reward-is-enough.md) |
| Era of Experience | DeepMind | 2025 | 长程经验流+接地奖励+非人类推理 | [era-of-experience.md](era-of-experience.md) |
| Darwin-Gödel Machine | — | 2025 | 自改代码 agent + 达尔文式筛选 | [darwin-godel-machine.md](darwin-godel-machine.md) |
| Karpathy 论自我改进 Agent | Karpathy | ~2019-2025 | verifier 瓶颈 + autonomy slider + overfit single batch | [karpathy-self-improving-agent-engineering.md](karpathy-self-improving-agent-engineering.md) |
| Deli paper_writing skill 拆解 | Deli Chen | 2026 | 开放式产出拆成子技能+产物契约+失败路由 | [2026-06-06-deli-paper-writing-skill-methodology.md](2026-06-06-deli-paper-writing-skill-methodology.md) |
| How to Be Good at Research | Vivek | 2026 | 八条研究方法论 × taste → compounding | [2026-06-19-how-to-be-good-at-research.md](2026-06-19-how-to-be-good-at-research.md) |
| fable-5 五篇重读批注 | fable-5 | 2026 | 五篇 study × 猫咖实战交叉验证 | [2026-06-11-fable5-annotated-rereading.md](2026-06-11-fable5-annotated-rereading.md) |
| 综合：经验、自我改进与可进化 Harness | 全家 | 2026 | Bitter Lesson→DGM 的四件套主线 | [agent-experience-and-self-evolution-synthesis.md](agent-experience-and-self-evolution-synthesis.md) |

---

## 补课优先级 🔴🟡🟢

### 🔴 高优（与猫咖方法论直接相关）

| 材料 | 作者 | 年份 | 为什么要读 | 原文链接 |
|------|------|------|----------|---------|
| Creative Thinking | Claude Shannon | 1952 | 六个解题招数 + constructive dissatisfaction；Magic Words 的理论原型；元方法 vs 内容方法的分界线 | [James Clear 版](https://jamesclear.com/great-speeches/creative-thinking-by-claude-shannon) |
| You and Your Research | Richard Hamming | 1986 | 开门vs关门 + 复利 + 重要问题；Vivek 全文引用最多的人 | [原文](https://www.cs.virginia.edu/~robins/YouAndYourResearch.html) |
| Research Debt | Chris Olah & Shan Carter | 2017 | "清晰解释本身是贡献"；对 W7 Knowledge Feed 有方法论意义 | [distill.pub](https://distill.pub/2017/research-debt/) |

### 🟡 中优（深化理解、扩展视野）

| 材料 | 作者 | 年份 | 为什么要读 | 原文链接 |
|------|------|------|----------|---------|
| Learning representations by back-propagating errors | Rumelhart, Hinton, Williams | 1986 | 深度学习的"那篇 Nature"；理解为什么旧想法+新约束=新突破 | [Nature](https://www.nature.com/articles/323533a0) |
| Long Short-Term Memory | Hochreiter & Schmidhuber | 1997 | 长程依赖+门控+梯度传播；今天的 memory/state 问题的祖先 | [原文](https://www.bioinf.jku.at/publications/older/2604.pdf) |
| Adaptive Mixtures of Local Experts | Jacobs et al. | 1991 | MoE 的祖先；多专家分工+门控选择的底层问题 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/31141872/) |
| Thinking, Fast and Slow | Daniel Kahneman | 2011 | System 1/System 2；解释为什么 LLM 在细节压力下"忘记"元方法 | 书 |
| The Structure of Scientific Revolutions | Thomas Kuhn | 1962 | 范式转移；理解什么时候该换坐标系而不是在旧坐标系里优化 | 书 |

### 🟢 低优（好奇心驱动、锦上添花）

| 材料 | 作者 | 年份 | 为什么要读 |
|------|------|------|----------|
| A Mathematical Theory of Communication | Shannon | 1948 | 信息论原文；理解"信息"这个词到底在说什么 |
| The Art of Doing Science and Engineering | Hamming | 1997 | Hamming 的完整方法论（"You and Your Research"的展开版） |
| Gödel, Escher, Bach | Hofstadter | 1979 | 自指、递归、意识；跨域联想的经典教材 |
| How to Solve It | Pólya | 1945 | 数学问题解决的元方法；Shannon 六招的数学祖先 |
| Meditations on Moloch | Scott Alexander | 2014 | 协调问题 + 多智能体陷阱；理解为什么"合作"比"优化"难 |

---

## 思辨模型收集（从已读材料中提取的 mental models）

> 读完新材料后在这里追加。格式：**名字** — 一句话 — 出处。

- **Bitter Lesson 管辖权分界** — 有客观判据的能力域不要手写（Sutton 管辖区）；主体偏好/约定必须手写（harness 管辖区）— fable-5 批注
- **元方法 vs 内容方法** — 添加结构前问"这是元方法（检索原语/eval/协议）还是内容方法（替猫判断）"——元方法可建，内容方法不建 — fable-5 批注
- **Shannon 六招** — ① 简化 ② 类比 ③ 换角度 ④ 推广 ⑤ 结构分析 ⑥ 反转 — Shannon 1952
- **Constructive Dissatisfaction** — 创造力的核心动机不是"这坏了"（抱怨）而是"这可以更优雅"（审美驱动）— Shannon 1952
- **Taste 训练两条路线** — 预测-修正循环（有明确反馈）vs 浸泡（反馈模糊的审美领域）— CVO × Vivek 2026-06-19 讨论
- **Lived Problems** — 第三种问题来源：不是 absorbed（被动跟潮流）也不只是 selected（预设目标反推），是在过日子的过程中撞进去的 — CVO 2026-06-19
- **"在权重里" ≠ "在对的时刻激活"** — LLM 知识激活取决于 context；harness = 在对的时刻触发已有知识的条件反射 — CVO × 宪宪 2026-06-19 讨论
- **活的 fitness function** — 冻结 benchmark 会被 hack；CVO taste 不可 hack 因为它能换坐标系提问 — fable-5 × DGM 批注
- **拉马克通道** — 当遗传介质是文本时，获得性经验即时继承，带宽碾压达尔文通道 — fable-5 批注
- **养而不驭** — 只控制选择压力和遗传介质，不碰变异源；园丁控制水土，不设计基因 — fable-5 × CVO 勘误

---

*[宪宪/claude-opus-4-6🐾] + CVO 共建*
