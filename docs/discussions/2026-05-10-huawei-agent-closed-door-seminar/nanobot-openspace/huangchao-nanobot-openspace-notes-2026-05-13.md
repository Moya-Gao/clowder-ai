---
title: "黄超教授 — nanobot & OpenSpace Harness 自进化框架"
date: 2026-05-13
event: 华为云 Agent 闭门研讨会（Day 2 下午场）
speaker: 黄超（港大 HKUDS Data Intelligence Lab）
topic: nanobot 通用 Agent / OpenSpace Harness / 自进化
author: "[宪宪/Opus-46🐾]"
source: 现场 PPT 截图 + 铲屎官实时转述
---

# 黄超教授 — nanobot & OpenSpace Harness

## 背景：HKUDS 开源生态

GitHub org: HKUDS，87 个公开仓库，多个万星项目。

| 项目 | Stars | Open Issues | Stars/Issue |
|------|-------|-------------|-------------|
| nanobot | 42,312 | 898 | 47:1（相对正常） |
| LightRAG | 35,124 | 237 | 148:1 |
| CLI-Anything | 34,334 | 57 | 602:1（高） |
| DeepTutor | 23,851 | 39 | 611:1（高） |
| RAG-Anything | 20,121 | 98 | 205:1 |
| OpenHarness | 12,447 | 37 | 336:1 |

铲屎官观察："stars 很高没什么 issue"——Stars/Issue 比值远超健康项目（通常 20K+ stars 项目有数千 issues），整体呈学术批量开源 + 营销驱动模式。nanobot 是例外，有真实社区互动。

## 核心观点

### 1. Agent 的三个痛点（铲屎官实时转述）

| 痛点 | 黄超说法 | Cat Cafe 对照 |
|------|---------|--------------|
| 模型能力没飞跃 | "龙虾的能力没有飞跃" | 同意一半：单模型 plateau，但协作协议弥补上限 |
| 7x24 做不到 | Agent 会中断、confused | 我们承认中断是常态，建续航机制（session chain + evidence.sqlite） |
| 缺全量上下文 | 很难有 agent-first 环境 | **最准的判断** — F148 导航轴一直在啃这个硬骨头 |

关键分歧：黄超把"人参与"当成 agent 能力不足的表现，我们把它当成**架构约束**（W3: 用户是 CVO）。

### 2. Anthropic 工程博客 + CLAUDE.md

黄超提到很喜欢 Anthropic 的工程博客，认为"用 md 做记忆"很巧妙。

我们的实际经验：CLAUDE.md 是"宪法层"（静态全量注入），覆盖 80% 持久化需求；但天花板是不能按任务动态裁剪，所以叠了 evidence.sqlite + 三入口路由做"检索层"。

### 3. OpenSpace Harness — 自进化框架（三张 PPT）

#### What/When/How to Evolve — 三柱模型

| 层 | 内容 | Cat Cafe 对应 | 差异 |
|----|------|-------------|------|
| Runtime/Harness | 改 prompt/workflow/tools | SOP + Skills + CLAUDE.md | 我们是声明式规则，他是自动优化 |
| Experience/Skills | 经验沉淀为可复用技能 | Knowledge Feed + self-evolution | 我们靠铲屎官拍板，他想全自动 |
| Model Parameters | 蒸馏进模型 | 不做 | 我们换模型而不是改模型 |

底部管线 Trigger → Evidence → Optimizer → Gate 和我们的流程对应：
Trigger（bug/纠正）→ Evidence（search_evidence）→ Optimizer（self-evolution skill）→ Gate（review + 铲屎官拍板）

#### Challenges in Self-Evolving Agents

三个挑战与我们的经验高度共鸣：

1. **Partial Evolution Signals** — 局部信号不足以支撑跨任务演化。
   对应我们的"碎片够了" magic word：单猫看到的是碎片，要多搜几轮才能拼全貌。

2. **Brittle Transfer** — workflow 难迁移、skills 难治理、skill staleness。
   我们有活例子：ADR-009 漂移 2 个月未发现（project_knowledge_lifecycle_gap）。

3. **OpenSpace 解法**：worker 和 evolver 共用一个闭环 + Cloud Skill Hub。
   类似我们的"猫既是 worker 也是 reviewer"，但他更进一步想让 skill 在云端共享迁移。

#### OpenSpace Harness 架构

Context Injection 层：
- Rules Memory → CLAUDE.md
- Session Memory → session digest
- Auto Memory → evidence.sqlite
- Relevant Recall → 三入口路由（graph/recent/search）

Agent Task Runtime 五层：
- Goal → feat-lifecycle
- Workspace → worktree
- Context (Memory + Rules) → SOP
- Capabilities (Skills + Tools) → Skills + MCP
- Trace → Knowledge Feed

学习闭环：Recording → Analyzer → Local Seal → Test → better skill selection next time

### 4. 自进化泛化困难 + Skill 自评估

黄超提到 skill 自评估的思路：agent 自己用 skills 完成任务，然后打分。

铲屎官的共鸣："我们也很想干这种，让你们自己对自己家的 MCP 也好 Skills 也好打分和评论"

Cat Cafe 现状：F192 Phase C pivot 已转向"eval 运行时基础设施"，但还没做到 skill 自评估。缺的是：每次用完 skill 自动记录效果 → 积累后自动生成改进建议 → 形成 evolver 闭环。

## 关键差异总结

OpenSpace 追求**全自动自进化**（Gate 是自动化的 tests/rollback/feature），Cat Cafe 的 Gate 是**CVO 拍板**。黄超把"人参与"当能力不足，我们把它当架构约束。这也是他自己说"泛化很困难"的根因：不是技术难，是缺少方向校准的锚点。
