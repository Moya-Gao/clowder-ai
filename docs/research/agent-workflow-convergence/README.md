---
doc_kind: research-index
topics:
  - agent-workflow-convergence
  - research
created: 2026-05-22
updated: 2026-05-23
status: active
---

# Agent-Workflow Convergence 调研

Agent 与 Workflow 的融合是 2025-2026 agentic 生态的核心张力之一：
- **Workflow** 追求确定性、可审计、可复现
- **Agent** 追求自主性、适应性、创造性

两者不是对立的——问题是**怎么在同一个架构里让它们自然共存**。

本目录收集相关开源项目、论文、讨论的调研笔记，方便横向对比。

## 目录

| 文件 | 项目 | 核心思想 | 日期 |
|------|------|----------|------|
| [bridgic-amphiflow.md](bridgic-amphiflow.md) | [Bridgic](https://github.com/bitsky-tech/bridgic) | AmphiFlow: workflow-first + agent fallback | 2026-05-22 |
| [openflow-teardown.md](openflow-teardown.md) | [OpenFlow](https://github.com/xmkid/OpenFlow) | 三模式执行：ad-hoc / suggested / bound | 2026-05-22 |
| [deer-flow-super-agent-harness.md](deer-flow-super-agent-harness.md) | [DeerFlow](https://github.com/bytedance/deer-flow) | Super agent harness: middleware rails + skills/subagents/sandbox | 2026-05-23 |

## 我们家的相关讨论

- [Karpathy: From Vibe Coding to Agentic Engineering](../discussions/2026-05-04-karpathy-sequoia-ascent-agentic-engineering/) — agentic 工程化趋势
- [Cat Cafe Agent Orchestration Research](../../archive/2026-02/research/Cat%20Café%20Agent%20Orchestration%20Research%20by%20gemini.md) — 多 agent 编排架构调研（2026-02）
- [JiuwenClaw Agent Feature Comparison](../research/2026-04-17-jiuwenclaw-agent-feature-comparison.md) — agent 特性对比
- [F155 Scene-Based Guidance](../features/F155-scene-guidance-phase-a-spec.md) — 场景引导引擎（workflow 导向）

## Cat Cafe 自身的 Agent-Workflow 融合

Cat Cafe 的实践是一种**隐式融合**：

- **Agent 侧**：每只猫是自主 agent（W1），有判断力、能 push back、球权协议（@ 路由）
- **Workflow 侧**：Skill/SOP 系统是确定性流水线（feat-lifecycle → tdd → quality-gate → merge-gate）
- **融合方式**：Agent 在 Workflow 框架内保留判断力。SOP 是轨道，猫是司机——Rule 0「规则是边界不是全部」

### 四个项目的融合光谱

| 维度 | Bridgic AmphiFlow | OpenFlow | DeerFlow | Cat Cafe |
|------|-------------------|----------|----------|----------|
| **融合层次** | 单 agent 内部 | 多 agent 编排层 | 单 lead-agent runtime harness | 多 agent 协作治理层 |
| **Workflow 表达** | Python 代码 | YAML 模板 | Middleware + mode + runtime flags | SOP 文档 + Skill 纪律 |
| **切换方式** | 异常驱动自动降级 | 用户确认显式绑定 | 产品 mode 映射 runtime 能力 | Agent 自主判断（Rule 0） |
| **约束强度** | 运行时硬约束 | 系统级半硬约束 | runtime rail + sandbox/tool guardrails | 文化级软约束 + 门禁硬约束 |

这些项目从不同方向走向同一个终态：让 agent 和 workflow 自然共存。
