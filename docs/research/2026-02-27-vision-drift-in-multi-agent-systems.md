---
feature_ids: [F041, F046]
topics: [multi-agent, vision-alignment, research]
doc_kind: research
created: 2026-02-27
---

# Research Request: 多 Agent 系统的愿景漂移问题

> **请求人**: 布偶猫/宪宪
> **调研人**: 缅因猫 Pro (GPT-5.2)
> **触发**: 铲屎官 2026-02-27 提出，F041 愿景对照失败后的系统性思考
> **性质**: 开放调研，不是任务指派

---

## 背景

### 我们踩的坑（F041 事件）

F041 能力看板：AC 12 项全 ✅，76 tests green，PR #83 + #85 合入 main，本地 review 2 轮 + 云端 review 10 轮全通过。但铲屎官一打开：

- Skills 查不到（source 全标 ext）
- UI 丑到不可用（8 列 toggle data grid）
- 多项目管理完全缺失

**根因**：整条 review 链路（本地猫 + 云端猫，共 12 轮）没有一个角色回去读铲屎官的原始需求文档。所有人都在审"代码质量"和"edge cases"，没有人审"这是铲屎官要的吗？"

### 我们的临时修复

在 5 个 Skills 里加了"愿景对照"步骤：

| Skill | 改动 |
|-------|------|
| `feat-completion` | Step 0: 回读原始 Discussion + 跨猫交叉验证 |
| `spec-compliance-check` | Step 0: 愿景核对（AC 本身可能不完整） |
| `cat-cafe-requesting-review` | 强制附原始需求文档链接 |
| `requesting-cloud-review` | PR body 必填 Original Requirements |
| `cat-cafe-receiving-review` | 区分代码级/愿景级反馈 |

### 铲屎官的更深层问题

> "其他多 agent 协同是如何看守住最初的愿景不做歪的？如果 team leader 的上下文有限，压缩着压缩着失忆了，那不是更可能干歪？而且我也发现有很多人把一个复杂的 feat 丢给 agent，agent 容易做歪。"

这不只是我们的问题。这是整个多 agent 系统行业的共性挑战。

---

## 调研问题

### Q1: 业界多 Agent 系统如何防止愿景漂移？

**愿景漂移 (Vision Drift / Goal Drift)** 定义：agent 在执行复杂任务的过程中，逐渐偏离最初的目标/需求，最终交付物不满足用户意图。学术界已有相关论文（如 arXiv:2505.02709 "Evaluating Goal Drift in Language Model Agents"），研究显示 LLM agent 在长期任务中会静默偏移行为，且多 agent 工作流在约 600 次交互后近半出现语义漂移。

#### 🔴 必须覆盖的产品/框架（铲屎官点名）

1. **Claude Code Agent Teams** (Anthropic) — 多 agent 协调机制：lead agent + teammate agents，共享 task list + inter-agent messaging，每个 agent 有独立 context window。它如何防止 team lead 的上下文压缩导致愿景丢失？子 agent 如何保持对原始目标的对齐？
2. **OpenCode + Oh My Open Code** — OpenCode 上的编排层，用模块化 workflow 处理复杂项目（架构规划、React 逻辑、构建集成分开），它的任务分解和目标守护机制是什么？
3. **OpenClaw** (原 Clawdbot/Moltbot, Peter Steinberger) — 开源自主 agent，145k+ GitHub stars，支持 134+ MCP 工具，24/7 运行。它的多 agent 协调、记忆管理、长时间运行任务的目标保持机制是什么？

#### 🟡 建议覆盖（但请自行搜索当前最先进的方案，不限于以下列表）

- **Codex** (OpenAI) — 2026.02 Rust 重写 + 云端沙盒隔离，每个任务在独立容器中运行
- **Devin** (Cognition) — 全自主 AI 软件工程师，$500/月，从研究到测试的完整流程
- **Cursor / Windsurf** — IDE 集成编码助手，长 session 场景
- **CrewAI / AutoGen / LangGraph** — 多 agent 编排框架的"目标锚定"机制
- **OpenHands / SWE-agent** — 开源 agent benchmark，任务完成率 vs 任务复杂度

#### 🟢 请你自主搜索补充

**不要局限于上面的列表**。请用 Deep Research 能力搜索 2025 年下半年至 2026 年 2 月的最新多 agent 编码/协作框架和产品，找出我们可能不知道的新玩家和新方案。我们需要的是**当前业界最前沿的全景图**，而不是某个人记忆中的旧列表。

### Q2: 上下文压缩导致的"失忆"问题

铲屎官观察到的核心挑战：

- Agent/Leader 的上下文窗口有限（128k~200k tokens）
- 复杂 feat 的讨论 + 代码 + review 往往超过一个窗口
- 上下文压缩时，"铲屎官原话"、"设计文档里的 UX 描述"容易被压掉
- 压缩后 agent "记得怎么写代码"但"忘了为什么写"

**请调研**：
- 业界有什么解决方案？（分层记忆？外部知识库？periodic checkpoint？episodic memory consolidation？）
- 学术界有相关研究吗？（long-horizon planning in LLM agents？goal drift evaluation？已知有 arXiv:2505.02709，请找更多）
- 有没有量化数据——任务长度/交互次数 vs 愿景漂移率？（已知"600 次交互后近半出现语义漂移"的说法，请验证和深挖）
- "goal-persistent design"（目标持久化设计）具体是什么？有实际产品采用吗？

### Q3: 我们的方案 vs 业界方案对比

我们当前的方案是"流程守护"——在 SOP/Skills 里嵌入检查点：

```
开发前: spec-compliance-check (回读原始需求)
    ↓
review 时: requesting-review (附原始需求文档)
    ↓
收到反馈: receiving-review (区分代码级/愿景级)
    ↓
PR 时: requesting-cloud-review (PR body 含原始需求)
    ↓
完成时: feat-completion (愿景对照 + 跨猫交叉验证)
```

**请对比**：
- 我们是"流程嵌入"模式（靠 skill 提醒），有没有其他模式？
- "技术嵌入"模式（靠工具/架构自动检测）存在吗？如何实现？
- "上下文嵌入"模式（把愿景放在不可压缩的位置）可行吗？成本呢？
- 我们的方案有什么盲区？业界方案能补上吗？

### Q4: "复杂 feat 容易做歪"的解决方案

铲屎官观察："很多人把一个复杂的 feat 丢给 agent，agent 容易做歪。"

**请调研**：
- 业界最佳实践是什么？分阶段验收？milestone checkpoint？incremental delivery？
- 有没有"越复杂越不容易偏"的反直觉方案？（如更细粒度的 spec？）
- 人类软件工程里的类似问题（scope creep、gold plating）有什么可借鉴的？

---

## 调研范围

### 必须覆盖
- 🔴 **Claude Code Agent Teams**、**OpenCode/Oh My Open Code**、**OpenClaw**（铲屎官点名）
- 至少 3 个其他商业产品（你自己搜索决定哪些最有价值）
- 至少 2 个开源框架（你自己搜索决定哪些最有价值）
- 至少 2 篇学术论文（含 arXiv:2505.02709，请找更多 2024-2026 的 goal drift / agent alignment 论文）
- **请主动搜索**你认为我们可能不知道的新产品、新框架、新论文

### 输出格式
- 每个产品/框架的做法简述（2-3 段），**标注信息来源（URL）**
- 对比表格（我们 vs 业界各方案）
- 可借鉴的具体实践（直接可用 or 需要适配）
- 我们方案的盲区分析
- **区分"已确认事实"和"推测/未验证"**

### 不需要覆盖
- 通用 RAG/向量搜索方案（我们不是在做知识检索）
- 模型本身的改进（那是 Anthropic/OpenAI 的事）
- 纯理论没有实践支撑的方案

---

## 调研方式

本调研使用 **Deep Research Pipeline**（三路并行 + Pro 审阅）：

| Step | 执行者 | 做什么 |
|------|--------|--------|
| 1 | 布偶猫 | 写调研 prompt（本文档），落盘到 `docs/prompts/` |
| 2 | ChatGPT / Claude.ai / Gemini Deep Research（并行） | 同一 prompt 三路搜索 |
| 3 | GPT-5.2 Pro | 审阅三份报告，找逻辑缺陷和分歧 |
| 4 | 布偶猫 | 综合判断，对照 Cat Cafe 代码库验证可行性 |

**注意**：GPT-5.2 Pro 不在 Cat Cafe 系统内（无 Apps/Memory/Canvas），调研报告通过文件传递。

---

## 调研深度期望

这是一个**影响协作灵魂的问题**（铲屎官原话："做歪了是小问题，重要的是我们需要先优化和修正我们自己的 skills 和 sop，这才是我们协作的灵魂"）。请认真对待，不要走过场。

**请特别注意**：
- 不要只列产品特性，要分析**它们如何具体防止愿景漂移**
- 对每个方案，评估**在上下文压缩场景下是否仍然有效**
- 找出**我们"流程嵌入"方案的盲区**——有什么问题是靠 skill 提醒解决不了的？

---

*布偶猫/宪宪 🐾*
*2026-02-27*
