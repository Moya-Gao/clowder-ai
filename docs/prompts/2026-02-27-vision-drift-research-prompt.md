---
feature_ids: [F041]
topics: [multi-agent, vision-alignment, research]
doc_kind: prompt
created: 2026-02-27
---

# 多 Agent 系统的愿景漂移（Vision Drift / Goal Drift）调研

> 委托人：布偶猫/宪宪（Cat Cafe 项目）
> 日期：2026-02-27

## 背景

我们是一个由 3 只 AI 猫猫（Claude Opus、Codex/GPT、Gemini）协作开发的项目。最近完成了一个复杂功能（F041 能力看板）后发现严重问题：

- AC（验收标准）12 项全部通过，76 个测试全绿，2 轮本地 review + 10 轮云端 review 全通过
- **但用户一打开就发现交付物完全不是想要的**：UI 不可用、核心功能缺失、设计偏离原始需求

**根因分析**：整条 review 链路（12 轮）没有任何一个角色回去读用户的原始需求文档。所有 reviewer 都在审"代码质量"和"edge cases"，没有人审"这是用户要的吗？"

**我们已经做的临时修复**：在开发 SOP 的 5 个环节里嵌入了"愿景对照"检查点——开发前回读原始需求、review 时附原始需求文档、收到反馈时区分代码级/愿景级、PR 时强制填原始需求、完成时跨 agent 交叉验证。

**用户的核心问题**："其他多 agent 协同系统是如何看守住最初的愿景不做歪的？如果 team leader 的上下文有限，压缩着压缩着失忆了，那不是更可能干歪？而且我也发现有很多人把一个复杂的 feat 丢给 agent，agent 容易做歪。"

## 需要调研的问题

### Q1: 业界多 Agent 系统如何防止愿景漂移？

**愿景漂移 (Vision Drift / Goal Drift)** 定义：agent 在执行复杂任务的过程中，逐渐偏离最初的目标/需求，最终交付物不满足用户意图。

#### 必须覆盖的产品/框架

1. **Claude Code Agent Teams** (Anthropic) — 多 agent 协调：lead agent + teammate agents，共享 task list + inter-agent messaging，每个 agent 有独立 context window。它如何防止 team lead 上下文压缩导致愿景丢失？子 agent 如何保持对原始目标的对齐？
2. **OpenCode + Oh My Open Code** — OpenCode 上的编排层，用模块化 workflow 处理复杂项目。它的任务分解和目标守护机制是什么？
3. **OpenClaw** (原 Clawdbot/Moltbot, Peter Steinberger) — 开源自主 agent，145k+ GitHub stars，134+ MCP 工具，24/7 运行。它的多 agent 协调、记忆管理、长时间运行任务的目标保持机制是什么？

#### 建议覆盖（不限于此列表，请自主搜索补充）

- **Codex** (OpenAI) — 2026.02 重写 + 云端沙盒隔离
- **Devin** (Cognition) — 全自主 AI 软件工程师
- **Cursor / Windsurf** — IDE 编码助手，长 session 场景
- **CrewAI / AutoGen / LangGraph** — 多 agent 编排框架
- **OpenHands / SWE-agent** — 开源 agent benchmark

#### 重要：请自主搜索补充

**不要局限于上面的列表**。请搜索 2025H2 至 2026 年 2 月的最新多 agent 编码/协作框架和产品，找出可能不在上面列表中的新玩家和新方案。我们需要**当前业界最前沿的全景图**，而不是旧知识。

### Q2: 上下文压缩导致的"失忆"问题

核心挑战：
- Agent 的上下文窗口有限（128k~200k tokens）
- 复杂功能的讨论 + 代码 + review 往往超过一个窗口
- 上下文压缩时，"用户原话"、"设计文档里的 UX 描述"容易被压掉
- 压缩后 agent "记得怎么写代码"但"忘了为什么写"

请调研：
- 业界解决方案（分层记忆？外部知识库？periodic checkpoint？episodic memory consolidation？）
- 学术研究（long-horizon planning? goal drift evaluation? 已知 arXiv:2505.02709 "Evaluating Goal Drift in Language Model Agents"，请找更多）
- 量化数据——任务长度/交互次数 vs 愿景漂移率
- "goal-persistent design"（目标持久化设计）具体是什么？有实际产品采用吗？

### Q3: 我们的方案 vs 业界方案对比

我们当前方案是"流程守护"——在 SOP/Skills 里嵌入检查点：

```
开发前: spec-compliance-check (回读原始需求)
    ↓
review 时: requesting-review (附原始需求文档)
    ↓
收到反馈: receiving-review (区分代码级/愿景级)
    ↓
PR 时: requesting-cloud-review (PR body 含原始需求)
    ↓
完成时: feat-completion (愿景对照 + 跨 agent 交叉验证)
```

请对比：
- 我们是"流程嵌入"模式（靠 prompt/skill 提醒），有没有其他模式？
- "技术嵌入"模式（靠工具/架构自动检测偏离）存在吗？如何实现？
- "上下文嵌入"模式（把愿景放在不可压缩的位置，如 system prompt）可行吗？成本呢？
- 我们方案的盲区？业界方案能补上吗？

### Q4: "复杂 feat 容易做歪"的解决方案

现象："很多人把一个复杂的 feat 丢给 agent，agent 容易做歪。"

请调研：
- 业界最佳实践（分阶段验收？milestone checkpoint？incremental delivery？）
- 有没有"越复杂越不容易偏"的反直觉方案？
- 人类软件工程里的类似问题（scope creep、gold plating）有什么可借鉴的？

## 输出要求

1. **每个产品/框架的做法简述**（2-3 段），标注信息来源（URL/论文名）
2. **对比表格**：我们的"流程嵌入"方案 vs 业界各方案，维度包括：
   - 防偏机制类型（流程/技术/上下文）
   - 上下文压缩时的鲁棒性
   - 实施成本
   - 适用场景
3. **可借鉴的具体实践**：哪些直接可用，哪些需要适配
4. **我们方案的盲区分析**
5. **区分"已确认事实"和"推测/未验证"**
6. **推荐方向 + 风险**

## 参考资料

- 我们的调研背景文档：`docs/research/2026-02-27-vision-drift-in-multi-agent-systems.md`
- 学术论文线索：arXiv:2505.02709 "Evaluating Goal Drift in Language Model Agents"
- 相关话题：agent drift, agentic alignment drift, reasoning drift, semantic drift in multi-agent workflows
- Claude Code Agent Teams 文档：https://code.claude.com/docs/en/agent-teams
