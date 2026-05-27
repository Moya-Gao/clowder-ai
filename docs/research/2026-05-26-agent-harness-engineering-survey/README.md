# Agent Harness Engineering: A Survey

> 收录日期：2026-05-26 | 收录人：宪宪/Opus-4.6
> 铲屎官评价："全明星豪华主子阵容" + "霸气侧漏的名字"

## 论文信息

| 字段 | 内容 |
|------|------|
| 标题 | Agent Harness Engineering: A Survey |
| 作者 | Junjie Li\*, Xi Xiao\*, Yunbei Zhang\*, Chen Liu\* (共同一作), Lin Zhao, Xiaoying Liao, Yingrui Ji, Janet Wang, Jianyang Gu, Yingqiang Ge, Weijie Xu, Xi Fang, Xiang Xu, Tianchen Zhao, Youngeun Kim, Tianyang Wang, Jihun Hamm, Smita Krishnaswamy, Jun Huan†, Chandan K Reddy† (通讯) |
| 机构 | Carnegie Mellon University, Yale University, Johns Hopkins University, Amazon, Virginia Tech, Northeastern University, The Ohio State University, Tulane University, University of Alabama at Birmingham（共 9 家） |
| 中心论点 | "The harness is becoming the binding constraint" — Agent 可靠性的瓶颈在 harness 工程而非模型能力 |
| 分类学 | ETCLOVG: Execution · Tooling · Context · Lifecycle · Observability · Verification · Governance |

## 链接

| 资源 | URL |
|------|-----|
| 项目主页 | https://picrew.github.io/LLM-Harness/ |
| OpenReview | https://openreview.net/forum?id=eONq7FdiHa |
| Awesome List (GitHub) | https://github.com/Picrew/awesome-agent-harness (256 stars, 220 entries) |
| HuggingFace Dataset | https://huggingface.co/datasets/ChenLiu1996/Agent-Harness-Engineering |

## Awesome List 分类 (9 大类, 220 条目)

1. **Harness Architecture & Orchestration** (31) — ECC, DeerFlow, AutoGen, LangGraph, Semantic Kernel...
2. **Context & Working-State Engineering** (11) — claude-mem, planning-with-files, agentmemory...
3. **Execution Substrates & Sandboxing** (25) — Daytona, E2B, CUA, Browser Harness, OpenSandbox...
4. **Protocols, Tool Interfaces & Agent Contracts** (14) — MCP Servers, AGENTS.md, Model Context Protocol...
5. **Evaluation Harnesses & Benchmarks** (24) — Promptfoo, SWE-bench, DeepEval, RAGAS...
6. **Observability & Reliability Operations** (14) — Langfuse, MLflow, Opik, TensorZero, Arize Phoenix...
7. **Guardrails, Security & Governance** (17) — LiteLLM, Kong, Parlant, Portkey Gateway...
8. **Reference Harness Implementations** (55) — Claude Code, OpenHands, Cline, aider, SWE-agent...
9. **Essential Readings & Ecosystem Maps** (29)

## 与 Cat Cafe 的潜在关联

Cat Cafe 本身就是一个 agent harness 系统，该 survey 的 ETCLOVG 分类学可以作为我们架构自审的 checklist：

| ETCLOVG 维度 | Cat Cafe 对应 | 覆盖度 |
|-------------|--------------|--------|
| **E**xecution | SOP 流程 + Skill 调度 + A2A 球权 | ✓ |
| **T**ooling | MCP 工具族 (cat-cafe-*) + Tool Registry | ✓ |
| **C**ontext | L0 压缩免疫 + 记忆三入口 + session chain | ✓ |
| **L**ifecycle | Feature lifecycle + merge-gate + 愿景守护 | ✓ |
| **O**bservability | Telemetry (F192) + session digest + invocation detail | ≈ |
| **V**erification | Quality-gate + TDD + alpha 验收 | ✓ |
| **G**overnance | 家规 + 五铁律 + Magic Words + 46 hotfix 止血 | ✓ |

## 同名相关论文

还有一篇同期 survey 值得对照阅读：

| 字段 | 内容 |
|------|------|
| 标题 | Agent Harness for Large Language Model Agents: A Survey |
| 作者 | Qianyu Meng, Yanan Wang, Liyi Chen, Wei Wu 等 |
| 形式化 | H = (E, T, C, S, L, V) — 六分量架构 |
| 关键数据 | 65% 企业 AI 失败归因 harness 缺陷；SWE-bench 从 6.7%→68.3% 纯靠换 harness |
| GitHub | https://github.com/Gloriaameng/Awesome-Agent-Harness (240 stars) |
| Preprints | https://www.preprints.org/manuscript/202604.0428 |
| PDF | [v4 PDF on GitHub](https://github.com/Gloriaameng/Awesome-Agent-Harness/blob/main/Agent_Harness_for_LLM_Agents__A_Survey__v4.pdf) |

## 讨论待定

- [ ] 铲屎官 + 猫猫圆桌：Cat Cafe 在 ETCLOVG 各维度的得分自评
- [ ] Observability 维度（≈）是否需要升级——F192 Phase C 已有 eval 基础设施
- [ ] 对比两篇 survey 的分类学差异：ETCLOVG (7 维) vs H=(E,T,C,S,L,V) (6 维)
- [ ] 论文里 reference harness implementations 有没有列 Cat Cafe / OpenClaw
