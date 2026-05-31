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

## 同名相关论文（信源质量存疑 ⚠️）

还有一篇同期 survey，分类学框架有参考价值，但关键量化论据的可靠性需要打折：

| 字段 | 内容 |
|------|------|
| 标题 | Agent Harness for Large Language Model Agents: A Survey |
| 作者 | Qianyu Meng, Yanan Wang, Liyi Chen, Wei Wu 等 |
| 形式化 | H = (E, T, C, S, L, V) — 六分量架构（结构性贡献，仍有参考价值） |
| GitHub | https://github.com/Gloriaameng/Awesome-Agent-Harness (240 stars) |
| Preprints | https://www.preprints.org/manuscript/202604.0428 |
| PDF | [v4 PDF on GitHub](https://github.com/Gloriaameng/Awesome-Agent-Harness/blob/main/Agent_Harness_for_LLM_Agents__A_Survey__v4.pdf) |

### ⚠️ 信源质量审查（2026-05-31 铲屎官 + 宪宪四轮追问后修正）

| 原始声称 | 溯源结果 | 评价 |
|---------|---------|------|
| "65% 企业 AI 失败归因 harness 缺陷" | 追溯到 MemU（一家卖 AI 持久记忆产品的公司）博客。无 peer-reviewed 来源、无公开方法论、无数据集。多篇博文互相引用形成"洗稿"回声室。 | **营销数据，不可作为学术论据** |
| "每步 2% 上下文衰减" | 同一引用链条，同样无原始论文支撑 | **无一手来源，不可引用** |
| "SWE-bench 从 6.7%→68.3% 纯靠换 harness" | 来自 Grok Code Fast 1 的实测数据（edit-tool format 变更），有据可查 | **可信，有工程实证** |

**结论**：该 survey 的六分量形式化 H=(E,T,C,S,L,V) 作为结构性分类学仍有参考价值。但其引用的关键量化数据（65%、2%/步）来源不可靠，一篇学术 survey 引用营销博客作为核心论据，**整体学术严谨性要打问号**。

### 真正有 peer-review 的相关数据

| 来源 | 发现 | 适用性注意 |
|------|------|----------|
| ICLR 2026 杰出论文 "LLMs Get Lost In Multi-Turn Conversation"（Laban et al., arXiv:2505.06120） | 多轮对话平均准确率下降 39%（15 个模型、20 万次对话）；可靠性崩塌 112%（远超准确率下降） | **测试的模型是 GPT-4.1 / Claude 3.7 Sonnet / Gemini 2.5 Pro——在 2026 年 5 月已是"上一代"模型**。Claude Opus 4.6+ 上下文窗口 1M（vs 3.7 的 200k），GPT-5.5 长上下文理解翻倍。当代模型上无 peer-reviewed 复现数据。 |
| arXiv:2510.07777 "Drift No More?" | 上下文漂移不是单调衰减，是有界随机过程 | 挑战了"线性衰减"叙事 |
| arXiv:2603.03258 "Inherited Goal Drift" | 目标漂移在代理式场景中可复现 | 2026 年研究，但针对特定场景（模拟股票交易） |

## 铲屎官讨论中的关键洞察（2026-05-31）

1. **"你不能用过去你有的问题论证你今天有问题"**——模型代际跃迁太大，AI 领域一年就是上古。Claude 3.7→Opus 4.6 编码能力翻 3 倍、上下文窗口翻 5 倍
2. **Tool call ≠ 对话轮次**——ICLR 论文测的是纯文本多轮对话，Agent 的 tool call 每次返回真实世界新鲜数据（"接地"），部分对冲上下文漂移
3. **猫猫缺少信源批判性思维**——搜到信息后默认"找到了=可信"，不追溯一手来源、不检查利益冲突、不做时效性校验。这是系统性认知缺陷，需要工程化解决方案（圆桌讨论 TODO）

## 讨论待定

- [x] ~~对比两篇 survey 的分类学差异~~ → 已在铲屎官讨论中展开（2026-05-31）
- [ ] 铲屎官 + 猫猫圆桌：Cat Cafe 在 ETCLOVG 各维度的得分自评
- [ ] Observability 维度（≈）是否需要升级——F192 已落地 eval 基础设施
- [ ] 论文里 reference harness implementations 有没有列 Cat Cafe / OpenClaw
- [ ] **圆桌：如何避免外部不可信信息源污染猫猫认知**（@codex 必选 + @opus47，铲屎官指示 2026-05-31）
