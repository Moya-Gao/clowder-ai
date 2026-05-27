---
title: "Evolvable Harness — 论文与项目全景图"
created: 2026-05-27
author: "[宪宪/Opus-46🐾]"
doc_kind: research-index
---

# 论文与项目全景图

> 按"与 Evolvable Harness 的距离"排序：从最直接相关到外围参考。

## Tier 1: 直接相关 — Harness 自进化/自动生成

### AHE — Agentic Harness Engineering
| 字段 | 内容 |
|------|------|
| 标题 | Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses |
| 作者 | 复旦团队 (china-qijizhifeng) |
| arXiv | 2604.25850 |
| 成果 | GPT-5.4 在 Terminal-Bench 上 10 轮迭代 69.7% → 77.0% |
| 核心方法 | 三层可观测性（Component / Experience / Decision）+ evolve loop |
| GitHub | `china-qijizhifeng/agentic-harness-engineering` |
| 我们的拆解 | `docs/discussions/2026-05-05-agentic-harness-engineering-deep-dive/README.md` |
| 评分 | 75/100 — "值得拆方法，不值得直接 intake 代码" |
| 吸收 | change_manifest、三层 evidence、Best-of-N eval |
| 不吸收 | "LLM self-review = automatic governance" 叙事 |

### AutoHarness (DeepMind) — 运行时约束代码自动生成
| 字段 | 内容 |
|------|------|
| 标题 | AutoHarness: Synthesizing Code Harnesses to Eliminate Illegal Agent Moves |
| 机构 | Google DeepMind |
| arXiv | 2603.03329 |
| 核心 | 用 Gemini-2.5-Flash 自动生成运行时约束代码，消除 agent 非法动作 |
| 实验 | TextArena 游戏：小模型 + AutoHarness 约束 > 大模型裸跑 |
| 关键洞察 | Harness 不只是提示词约束，而是**可执行的运行时代码**——code as guardrail |
| 与我们的关系 | 和我们的"五铁律""Magic Words"是同一思路：把约束放到比 prompt 更硬的表面 |

### AutoHarness (aiming-lab) — Agent 治理框架
| 字段 | 内容 |
|------|------|
| 机构 | UNC-Chapel Hill (AIMING Lab) |
| GitHub | `aiming-lab/AutoHarness` |
| 核心 | 6 步治理管线 + YAML constitutions + 风险模式检测 |
| 状态 | 待深入调研 |
| 待办 | 拉代码看架构，和 AHE + DeepMind AutoHarness 对比 |

### OpenSpace Harness — 黄超 (港大 HKUDS)
| 字段 | 内容 |
|------|------|
| 作者 | 黄超教授 (HKUDS Data Intelligence Lab) |
| 项目 | nanobot (42K stars), OpenSpace, CLI-Anything |
| 核心框架 | What/When/How to Evolve 三柱 + worker/evolver 共用闭环 |
| 三层 | Runtime/Harness → Experience/Skills → Model Parameters |
| 挑战 | Partial Evolution Signals / Brittle Transfer / Skill Staleness |
| 我们的笔记 | `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/nanobot-openspace/` |
| 关键分歧 | 黄超追求全自动自进化，Cat Cafe 的 Gate 是 CVO 拍板 |

## Tier 2: 环境侧 — Agent 训练/评测环境合成

### EnvScaler — 人大
| 字段 | 内容 |
|------|------|
| 来源 | 华为云闭门研讨会 Day 1 (2026-05-12) |
| 核心 | 从任务/对话反推行业环境 → 自动构建可执行环境 → 双 agent 循环测试筛选 |
| 三阶段 | 环境主题挖掘 → 可执行环境构建 → 双智能体循环测试审查 |
| 我们的笔记 | `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/env-synthesis/` |
| 与我们的关系 | 互补 — EnvScaler 造"可练习的世界"，Cat Cafe 经营"真实共居的工作世界" |

### AgentGym / AgentGym-RL — 复旦 + ByteDance
| 字段 | 内容 |
|------|------|
| 标题 | AgentGym: Evolving Large Language Model-based Agents across Diverse Environments |
| arXiv | 2406.04151 (AgentGym), 2509.08755 (AgentGym-RL) |
| 会议 | ACL 2025 |
| 核心 | 27 个多样环境统一训练 agent，RL 跨环境泛化 |
| 机构 | 复旦 + ByteDance + 上海创新研究院 |
| 关键贡献 | AgentTraj-L（大规模轨迹数据集）+ AgentEvol（自进化方法） |
| 与我们的关系 | 铲屎官 LLE 概念的学术近亲 — 环境本身作为训练基础设施 |

## Tier 3: 理论/综述 — Harness 工程分类学

### Agent Harness Engineering: A Survey — CMU 9 校联合
| 字段 | 内容 |
|------|------|
| 作者 | Junjie Li 等 (CMU, Yale, JHU, Amazon, Virginia Tech 等 9 家) |
| 分类学 | ETCLOVG: Execution · Tooling · Context · Lifecycle · Observability · Verification · Governance |
| Awesome List | `Picrew/awesome-agent-harness` (256 stars, 220 条目) |
| 我们的收录 | `docs/research/2026-05-26-agent-harness-engineering-survey/README.md` |
| 核心结论 | "The harness is becoming the binding constraint" |

### Agent Harness for LLM Agents: A Survey — 另一团队
| 字段 | 内容 |
|------|------|
| 作者 | Qianyu Meng, Yanan Wang 等 |
| 形式化 | H = (E, T, C, S, L, V) 六分量架构 |
| 关键数据 | 65% 企业 AI 失败归因 harness 缺陷；SWE-bench 6.7%→68.3% 纯靠换 harness |
| GitHub | `Gloriaameng/Awesome-Agent-Harness` (240 stars) |

### Multi-Agent Scaling Law — 安波教授
| 字段 | 内容 |
|------|------|
| 核心结论 | No universal scaling law; 3-5 异构 agent 是 sweet spot; >10 大概率同构 |
| 分类框架 | Agent Composition / Communication Topology / Control Flow / Interaction Protocol |
| 经典理论 | Price of Anarchy, Social Choice Theory, Stackelberg Games |
| 我们的笔记 | `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/multi-agent-scaling/` |
| 与我们的关系 | Cat Cafe 4 猫 3 家族 = 正好在 sweet spot |

## Tier 4: 思想源 — 博客/知乎/方法论

### OpenAI — Harness Engineering 博客
| 字段 | 内容 |
|------|------|
| URL | https://openai.com/index/harness-engineering/ |
| 核心观点 | 进步不来自更好的模型，来自更好的 harness engineering |
| 关键概念 | "Ralph Wiggum Loop"：快速迭代循环（agent 行动 → 反馈 → 重试） |
| 实证 | 百万行级 beta 产品用 agent 生成代码，靠 harness 迭代而非模型升级 |
| 与我们的关系 | 铲屎官引为"启发式学习 → coding 的方式写自迭代的代码" |
| 相关论文 | Experiential Reflective Learning (ERL, arXiv:2603.24639)：agent 从任务经验提取可迁移启发式规则 |

### 王云鹤 — "我眼中的 Harness：复杂优化问题，AGI 灵魂争夺之战"
| 字段 | 内容 |
|------|------|
| URL | https://zhuanlan.zhihu.com/p/2038669387150927679 |
| 知乎专栏 | "Harness" (https://www.zhihu.com/column/c_2038675234375610689) |
| 核心公式 | Agent = Models + Harness; 优化 task_loss/token_cost; Model Params + Harness Params 联合优化 |
| 详细分析 | 本目录 `wang-yunhe-harness-as-optimization.md` |

## Cat Cafe 自身作为 STW 佐证

铲屎官指出：**看我们家的记忆系统，就知道 harness 迭代多快。**

我们的记忆系统进化链：
- **F102** — 存储基座（evidence.sqlite + 三入口路由）
- **F163** — 治理层（过期检测、健康度）
- **F188** — 管护工具链（library、nudge、grep fallback 监控）
- **F200** — 召回评估（消费加权排序 + 猫真实行为反馈闭环）
- **F192** — eval 基础设施（socio-technical harness eval）

5 个 Feature 迭代同一个子系统，中间经历多次重构。这就是"harness 代码经常重写"的活证据——不是理论上说迭代快，是我们自己就在不停重写。

## 待补充

- [ ] AutoHarness (aiming-lab) 深入调研：拉代码看架构
- [ ] DeepMind AutoHarness (2603.03329) 全文阅读：code-as-guardrail 方法细节
- [ ] OpenAI Harness Engineering 博客精读 + ERL 论文对照
- [ ] 王云鹤知乎专栏 "Harness" 后续文章跟踪
- [ ] 华为云自身的 agent harness 工作（闭门研讨会可能有未公开内容）
