---
title: "Agent 特性深度对比：Cat Café vs JiuwenClaw"
type: research
date: 2026-04-17
authors: [布偶猫/宪宪 (Opus 4.6), 布偶猫 (Opus 4.7), 缅因猫/砚砚 (GPT-5.4)]
status: draft-v2
scope: competitive-analysis
revision: v2 — 三层对象分离 + 事实核查修正
---

# Agent 特性深度对比：Cat Café vs JiuwenClaw

> **目的**：以工程证据为基础，系统性对比两个 Agent 平台在 13 个核心维度的实现水平。
> **方法论**：源码阅读 + 文件度量 + 架构分析，每项结论附具体文件路径和代码证据。
> **纪律**：每条证据标注来源版本和时间点，避免对象混用。

---

## 0. 研究对象与方法

### 三层对象分离

本报告涉及三个不同层次的代码对象，**不可混用**：

| 层 | 标签 | 仓库 / 路径 | HEAD | 说明 |
|----|------|-------------|------|------|
| L1 | **`[public]`** | `gitcode.com/openJiuwen/jiuwenclaw` → `/Users/lysander/projects/freelance/jiuwenclaw-public` | `c26e5d6` (develop) | JiuwenClaw 官方公开仓库最新版本，Huawei 团队维护 |
| L2 | **`[vendored]`** | `/Users/lysander/projects/freelance/clowder-ai/vendor/jiuwenclaw` | 旧快照 | Cat Café 集成时的 vendored 副本（较旧版本） |
| L3 | **`[relay-claw]`** | `/Users/lysander/projects/freelance/relay-claw` | — | 桥接层，负责 Cat Café ↔ JiuwenClaw 的 system prompt / session 传输 |

**版本差异量化**：

| 指标 | `[public]` | `[vendored]` | 变化 |
|------|-----------|-------------|------|
| Python 文件数 | ~304 | ~175 | +74% |
| 总行数 | ~99K | ~58K | +71% |
| 公开版独有文件 | ~156 个 | — | 新增模块 |
| 最大文件 | `interface_deep.py` 3,058 行 | `app.py` 1,905 行 | 结构膨胀 |

> **统计口径**：文件数和行数通过 `find jiuwenclaw/ -name "*.py" -type f | wc -l` 和 `find ... -exec wc -l {} + | tail -1` 统计，包含 `jiuwenclaw/` 目录下所有 `.py` 文件（含 `browser-move` 子模块）。依赖 pin 统计基于主项目 `pyproject.toml`（4 pinned / 33 unpinned），不含 `jiuwenbox/pyproject.toml`。数字取近似值（~）以避免因统计方法差异引起的精度争议。

> **重要**：`[public]` 是 JiuwenClaw 今天推给社区的产品版本，是本报告的主要分析对象。`[vendored]` 用于三天产品化的历史对照。`[relay-claw]` 仅在讨论桥接层时引用。

### 对比基准

| 对象 | 路径 | 版本 |
|------|------|------|
| Cat Café | `/Users/lysander/projects/relay-station/cat-cafe` | commit `5d5074ccd` (main) |

### 证据标准

每章按「Claim → Code Evidence → Failure Mode → Comparison → Verdict」结构组织。
所有文件路径标注 `[public]` / `[vendored]` / `[relay-claw]` 版本标签。
数字附统计方法或使用近似值（~），避免对方以口径差异否定结论方向。

---

## 评估总览

| # | 维度 | Cat Café | JiuwenClaw | 差距等级 |
|---|------|----------|------------|----------|
| 1 | 记忆与知识系统 | ★★★★★ | ★★★☆☆ | 显著领先 |
| 2 | 上下文管理 | ★★★★★ | ★★☆☆☆ | 代差 |
| 3 | 多 Agent 协作 | ★★★★★ | ★★☆☆☆ | 代差（有壳无实） |
| 4 | 架构设计 | ★★★★★ | ★★★☆☆ | 显著领先 |
| 5 | 工具/技能生态 | ★★★★★ | ★★★☆☆ | 显著领先 |
| 6 | 代码质量与工程实践 | ★★★★☆ | ★★☆☆☆ | 显著领先 |
| 7 | 工作流与 SOP | ★★★★★ | ★★☆☆☆ | 代差 |
| 8 | 知识工程与检索 | ★★★★★ | ★★★☆☆ | 显著领先 |
| 9 | 质量保障与测试 | ★★★★☆ | ★★☆☆☆ | 显著领先 |
| 10 | 用户体验 | ★★★★★ | ★★★☆☆ | 显著领先 |
| 11 | 会话管理与连续性 | ★★★★★ | ★★☆☆☆ | 代差 |
| 12 | 可扩展性与协议设计 | ★★★★★ | ★★☆☆☆ | 代差 |
| 13 | 方法论基建层 | ★★★★★ | ☆☆☆☆☆ | 代差（不存在） |

**综合评分：Cat Café 4.69/5 vs JiuwenClaw 2.15/5**

---

## 1. 记忆与知识系统 (Memory & Knowledge System)

### Cat Café: 三层持久化记忆架构

**实现概述**：
- **证据存储引擎** (`packages/api/src/domains/memory/SqliteEvidenceStore.ts`, 43KB)
  - SQLite + WAL 日志 + 单写队列 (`EvidenceWriteQueue.ts`) 保证并发安全
  - 支持 BM25 全文检索 + 向量语义搜索 + Hybrid RRF 融合
  - 知识类型细分：`doc` / `decision` / `session` / `thread` / `pack`
  
- **索引构建器** (`IndexBuilder.ts`, 33KB + `GlobalIndexBuilder.ts`)
  - 增量索引（watermark 追踪 HEAD 变化，冷却窗口防抖）
  - 跨仓库聚合索引（`GlobalIndexBuilder` 支持多 repo 搜索）
  - 语义重排序器 (`SemanticReranker.ts`) 二次排序

- **知识蒸馏管线** (F163 Phase B)
  - `distillation-service.ts` — 自动从项目私有知识提炼为全局可复用知识
  - `deidentification-service.ts` — 脱敏处理后安全晋升
  - `f163-contradiction-detector.ts` — 矛盾检测，防止知识冲突
  - Knowledge Feed — 自动提取 durable knowledge 候选，铲屎官审批

- **MCP 暴露**：`search_evidence` / `retain_memory` / `reflect` / `mark_generalizable` / `nominate_for_global` / `review_distillation` — 6 个记忆工具通过 MCP 暴露给 Agent

### JiuwenClaw: 单层文件记忆

**实现概述**：
- **SQLite 向量数据库** `[public]` (`agentserver/memory/manager.py`, 1,224 行) / `[vendored]` (1,353 行)
  - `sqlite-vec` 向量扩展 + FTS 全文搜索
  - Hybrid 搜索权重：70% 向量 / 30% 文本（硬编码 `[vendored]` `config.py:109`）
  - 分块策略：256 token / 32 overlap

- **记忆来源**：仅两种（`[vendored]` `config.py:99`）
  - `memory/MEMORY.md` — 持久化知识（单文件）
  - `memory/YYYY-MM-DD.md` — 每日记忆（按天分割）
  - `memory/USER.md` — 用户偏好

### 差距分析

| 能力 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 知识分类 | 6 种类型（doc/decision/session/thread/pack/memory） | 2 种（memory/sessions） |
| 搜索模式 | 3 种（lexical/semantic/hybrid）+ 可配 scope/depth | 1 种固定 hybrid |
| 跨仓库搜索 | ✅ GlobalIndexBuilder | ❌ 单工作区 |
| 知识蒸馏 | ✅ 自动脱敏 + 矛盾检测 + 审批流 | ❌ 无 |
| 知识生命周期 | ✅ 候选 → 审批 → 晋升 → 过期检测 | ❌ 写入即最终态 |
| 增量索引 | ✅ watermark + 冷却窗口 | ⚠️ 文件监听 |
| 并发安全 | ✅ 单写队列 + WAL | ⚠️ 7 处 bare `except: pass`（静默吞异常） |

**关键证据**：JiuwenClaw `memory/manager.py` 第 321、653、725、733、1178、1199 行存在 **bare `except: pass`** 模式，在数据库操作中静默吞掉异常。这意味着索引损坏或数据丢失可能完全不被察觉。

---

## 2. 上下文管理 (Context Management)

### Cat Café: 分层自适应上下文传输

- **冷提及检测** (`hierarchical-context-config.ts`)
  - 检测猫猫 >15 条消息未参与 → 智能窗口组装
  - 静默间隔 ≥15 分钟自动分割 burst，生成 tombstone（4 关键词 + 决策信号）
  - 证据召回（500ms 超时，最多注入 3 条历史匹配）

- **上下文健康追踪** (`session-strategy.ts`)
  - 可配阈值：75% 警告 / 85% 行动
  - 按猫策略：`handoff`（密封） / `compress`（压缩） / `hybrid`（N 次压缩后交接）
  - Provider 感知：Anthropic / OpenAI / Google 分别 12K turn budget

- **线程记忆注入** (`buildThreadMemory.ts`)
  - 跨 session 累积决策 + 未决问题
  - 300 token 预算的提取式摘要

### JiuwenClaw: 基础会话级上下文

- **会话管理** (`session_manager.py`, 147 行)
  - 每 session 任务队列 + LIFO 优先级
  - 上下文引擎配置开关 (`config.py:192-201`)
  - **无 token 预算计算**
  - **无上下文窗口可视化**
  - **无冷启动恢复策略**（元数据丢失回退到目录 mtime）

### 差距分析

| 能力 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 上下文感知 | 分层（冷提及 + burst 检测 + tombstone） | 扁平（整个 session 历史） |
| token 预算 | ✅ 可配 + provider 感知 | ❌ 无 |
| 上下文健康 | ✅ 阈值 + 策略（handoff/compress/hybrid） | ❌ 无 |
| 冷启动 | ✅ 证据召回 + 线程记忆 | ⚠️ 目录时间戳回退 |
| 跨 session 延续 | ✅ 线程记忆（决策 + 未决问题） | ❌ 无 |

**判定**：**代差**。Cat Café 的上下文管理是一个完整的工程系统（检测→评估→决策→执行），JiuwenClaw 只有最基础的 session 隔离。

---

## 3. 多 Agent 协作 (Multi-Agent Collaboration)

### Cat Café: 去中心化 A2A 协作网络

- **@提及路由** (`a2a-mentions.ts`)
  - 内容感知的 Agent 间路由：Agent 在回复中 @另一只猫 → 自动路由
  - 并行/串行路由策略 (`route-parallel.ts`, `route-serial.ts`)
  - 影子检测 (`a2a-shadow-detection.ts`) 避免重复处理

- **Multi-Mention 编排器** (`MultiMentionOrchestrator.ts`)
  - 状态机：`pending → awaiting → completed`
  - 幂等性键 + 重复检测
  - 响应聚合 + 超时处理（3-20 分钟）
  - 触发类型分类：high-impact / cross-domain / uncertain / info-gap / recon

- **交接系统** (`SessionSealer.ts` 16KB, `HandoffDigestGenerator.ts`)
  - 快速路径：CAS 状态变更 + 清除活跃指针
  - 慢路径：转录刷新 → 摘要生成 → 标记密封
  - 交接摘要：decisions / openQuestions / currentFocus

- **Reviewer 匹配器** (`reviewer-matcher.ts`)
  - 动态选择：花名册 × 可用性 × 家族 × 线程活跃度
  - 规则：不同作者 / peer-reviewer 角色 / 可用 / 优先不同家族 / 优先 lead

- **跨猫传话** (`cross-cat-handoff` skill)
  - 五件套结构：What / Why / Tradeoff / Open / Next
  - 确保信息无损传递

### JiuwenClaw: 表演性多 Agent（有壳无实）

> **事实修正**（v2, @opus-47 审阅）：JiuwenClaw `[public]` 版本确实有 `team_manager.py` 和 `TeamAgent` 的概念，不能写成"完全没有多 Agent"。但实现层面存在三个结构性断点：

- **Agent 管理** `[public]` (`agent_manager.py`, ~200 行)
  - 每 channel 创建独立 agent 实例（`self.agents: dict[str, dict[str, "JiuWenClaw"]]`）
  - ACP 特定 agent 配置

- **Team 系统** `[public]` — 有名词但行为破碎：
  - **互杀模式** (`team_manager.py:216` `_destroy_other_sessions`)：创建新 team 时**主动销毁所有其他 team session**。这不是"并发受限"，是 **exclusive-single-team**（互杀而非 mutex）。来源：砚砚 (@gpt52) 代码取证，@opus-47 验证。
  - **Follow-up waiter 缺口** (`team_helpers.py:143-177`)：follow-up request 走 `interact` → **直接 `yield is_complete=True` 返回**，真正的 team 输出走后台广播。典型 **fire-and-forget 反模式**：用户以为对话完成 → UI 显示 complete → 实际结果还在后台飘 → request ↔ response 语义断裂。
  - **全体广播** (`team_helpers.py` 注释)："简单起见，目前所有请求都接收所有事件" — 无响应路由和隔离性。

- **无 Agent 间路由** — 没有与 Cat Café `parseA2AMentions()`、`MultiMentionOrchestrator`、`SessionBootstrap`、`SessionSealer` 对等的协作模块
- **无交接协议** — 没有五件套结构、没有交接摘要生成

### 差距分析

| 能力 | Cat Café | JiuwenClaw |
|------|----------|------------|
| Agent 间通信 | ✅ A2A 路由 + @提及 + 状态机 | ⚠️ team 存在但互杀 + 全体广播 |
| 并行调用 | ✅ multi_mention（最多 3 猫并行） | ❌ exclusive-single-team |
| 交接 | ✅ 摘要生成 + 五件套 | ❌ 无 |
| Follow-up 绑定 | ✅ request ↔ response 语义绑定 | ❌ fire-and-forget（结果送达不可证伪） |
| Review 路由 | ✅ 自动匹配 reviewer（跨家族优先） | ❌ 无 |
| 协作记忆 | ✅ 共享线程记忆 + 跨 session 累积 | ❌ 每 agent 独立 |
| 冲突检测 | ✅ 影子检测 + 幂等性 | ❌ 无 |

**判定**：**代差（有壳无实）**。JiuwenClaw 的 team 系统更准确的定性是：**"表演性多 Agent"——有 team 的壳，没有 team 的行为**。如果按"没有多 Agent"写，对方可以指着 `team_manager` 反驳；按"多 Agent 壳破碎"写，对方必须解释 `_destroy_other_sessions` 这行代码为什么存在。

**三天产品化实证**（⚠️ 限 2026-03-24~29 事故态，非当前架构）：clowder-ai fork 中禁用了 Claude/GPT/Gemini 三个模型只留 GLM-5，并设 `sessionChain = false`。注意：当前 `[relay-claw]` 已修复 system_prompt 透传（`RelayClawAgentService.ts:537`，2026-04-16）和 session 稳定哈希（`:90`）。三天产品化的结论适用于 fork 事故态，不等于 upstream 当前架构。

---

## 4. 架构设计 (Architecture Design)

### Cat Café: 全栈 TypeScript 单体 + MCP 生态

| 包 | 职责 |
|----|------|
| `@cat-cafe/api` | Fastify 后端，域驱动设计 |
| `@cat-cafe/mcp-server` | MCP 工具服务器（stdio） |
| `@cat-cafe/web` | React 前端 |
| `@cat-cafe/shared` | 共享类型 + 猫注册表 |
| `@cat-cafe/ppt-forge` | PPT 生成引擎 |

**调用管线**：Invoke → 加载上下文 → 调用 Agent → 解析响应 → 路由输出 → 超阈密封
**降级策略**：`DegradationPolicy.ts` — 上下文不足时优雅降级
**审计日志**：`EventAuditLog.ts` — 追加式 NDJSON 按日期分区

### JiuwenClaw: Python 微服务分裂架构

> `[public]` 版本已将单体拆分为 Gateway + AgentServer；`[vendored]` 版本仍是 `app.py` 单体。

| 组件 | `[public]` | `[vendored]` |
|------|-----------|-------------|
| Gateway | `app_gateway.py` (2,022 行) | 不存在 |
| AgentServer | `app_agentserver.py` | 不存在 |
| Unified | `app.py` | `app.py` (1,905 行) |
| Web | `web/` (React) | `web/` (React) |

**消息流** `[public]`：Channel → Gateway (WebSocket) → AgentServer (WebSocket) → OpenJiuwen Agent

### 差距分析

| 维度 | Cat Café | JiuwenClaw `[public]` |
|------|----------|------------|
| 类型安全 | ✅ TypeScript strict + Biome | ⚠️ Python 81% type hints，**无 mypy** |
| 模块化 | ✅ monorepo pnpm workspace | ⚠️ `[public]` ~304 文件 / ~99K 行；`[vendored]` ~175 文件 / ~58K 行 |
| 依赖管理 | ✅ lockfile 精确版本 | ⚠️ 主项目 33 unpinned / 4 pinned |
| 文件卫生 | ✅ 200 行警告 / 350 硬上限 + 自动检查 | ❌ `[public]` 最大 3,055 行；`[vendored]` 最大 1,905 行 |
| Gateway | ✅ 内嵌于 API，单进程部署 | ⚠️ `[public]` WebSocket 桥接两进程，增加延迟和故障面 |

**代码规模对比**（`[public]` 版本）：

| 指标 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 最大单文件 | 受控（350 行硬上限） | **3,058 行** `[public]` / 1,905 行 `[vendored]` |
| God class | 有目录大小检查 | **feishu.py** `[public]` 3,055 行 / `[vendored]` 1,066 行 (**+186% 膨胀**) |

**版本退化趋势**：`[vendored]` → `[public]` 代码膨胀 ~71%，但核心问题全部放大而非收敛：
- `interface.py` 1,645 行 → `interface_deep.py` 3,058 行（+85%）
- `feishu.py` 1,066 行 → 3,055 行（+186%）
- `skill_manager.py` 1,472 行 → 2,270 行（+54%）
- 新增了 `team_manager.py` + `team_helpers.py`（§3 中论证的互杀 + fire-and-forget 即来自新代码）

这意味着 **JiuwenClaw 在没有质量门禁的情况下野蛮生长**，vendored → public 的退化路径本身就是一条证据。

---

## 5. 工具/技能生态 (Tool & Skill Ecosystem)

### Cat Café: MCP 原生 + 35+ Skill 注册

- **MCP 工具服务器**：14 个工具模块，通过 stdio 传输，标准 MCP 协议
- **Skill 注册表** (`cat-cafe-skills/manifest.yaml`, 32KB)：35+ 工作流技能
  - 每个 skill 是 YAML 驱动的引导流程
  - 自动发现 + 按场景匹配
  - 包括：cross-cat-handoff / expert-panel / quality-gate / merge-gate / tdd / incident-response 等

- **工具分类**：
  - 记忆类：search_evidence / retain_memory / reflect / mark_generalizable
  - 协作类：multi_mention / get_thread_cats / post_message / start_vote
  - 任务类：create_task / update_task / list_tasks
  - 调度类：register_scheduled_task / preview / remove
  - 工作流类：update_workflow（SOP 阶段转换）
  - 引导类：start_guide / guide_control
  - PR 追踪：register_pr_tracking

### JiuwenClaw: OpenJiuwen 运行时 + SkillNet 市场 + Skill 自演进

> **公平标注**（v2, 砚砚事实核查）：JiuwenClaw 的工具/技能层不应被矮化。它在三个方面有真实实现。

- **工具注册**：`@tool` 装饰器（来自 `openjiuwen.core.foundation.tool.tool`）
- **内置工具**：memory_tools / browser-move / mcp_toolkits
- **stdio MCP 注册** `[vendored]` (`mcp_toolkits.py`)：可注册外部 MCP 工具（搜索/网页抓取/命令执行）
- **SkillNet 市场** `[public]` (`skill_manager.py`, 2,270 行)：在线搜索 / 安装 / 评估外部 skill
- **Skill 自演进** `[public]` (`evolution/`, 1,580 行)：
  - `SignalDetector` — 规则检测执行失败 / 用户纠正 / 重复失败
  - `SkillOptimizer` — LLM 驱动改进建议
  - `evolutions.json` — 累积改进持久化
  - ⚠️ **信号检测局限**（砚砚取证 `signal_detector.py:21-51`）：`_FAILURE_KEYWORDS` 包含 `"failed"`、`"错误"`、`"异常"` 等宽泛词，所有信号一律归类为 `SKILL_EXPERIENCE`。讨论 bug 会被当成执行失败，纠错语气会被当成用户不满 — **假阳性工厂，可能把偶然误命中固化成"skill 必须改"的规则**。

### 差距分析

| 能力 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 协议标准 | ✅ MCP（行业标准） | ❌ 私有 `@tool` 装饰器 |
| 工具数量 | 14+ MCP 模块 + 35+ skills | ~5 内置工具 + 市场 |
| Skill 发现 | ✅ 意图匹配 + 自动建议 | ⚠️ 需显式调用 |
| Skill 演进 | ⚠️ Knowledge Feed 间接支持 | ✅ 内置 evolver（这是 JiuwenClaw 的亮点） |
| 工具隔离 | ✅ 按 session/thread 隔离 | ⚠️ 全局共享 |

**公平说明**：JiuwenClaw 的 **Skill 自演进系统**是一个有价值的设计理念（自动从执行失败中学习改进 skill 描述）。`evolution/` 有 `test_signal_detector.py` 覆盖信号检测。但实现层面：`SkillManager` 2,270 行单文件（无直接测试），信号检测基于宽泛关键词正则（假阳性风险），演进结果仅更新 `evolutions.json` 的文本描述，不涉及行为变更。

---

## 6. 代码质量与工程实践 (Code Quality)

### Cat Café

- **Biome** lint + format：`pnpm check` / `pnpm check:fix`
- **TypeScript strict** 类型检查：`pnpm lint`
- **文件大小守护**：200 行警告 / 350 硬上限 + `pnpm check:dir-size`
- **禁止 `any`**
- **LSP 诊断**：每次 Edit 后立即处理 `<new-diagnostics>`
- **Pre-merge 检查脚本**：Biome / Feature truth / Port drift / Registry consistency

### JiuwenClaw `[public]`

- **无 Biome / ESLint 后端配置**
- **无 mypy 类型检查**（81% 有 type hints 但从不验证）
- **无文件大小限制**
- **前端有 ESLint**（仅 web/）
- **`TESTING.md` 文档漂移**（砚砚取证）：文件中硬编码了 `/Users/gawa/Desktop/pr/jiuwenclaw`（开发者本地绝对路径），引用不存在的 `.gitcode/.github` workflow — 文档与代码现状已脱节

### 关键证据

**1. 上帝类问题** `[public]`

| 文件 | `[public]` 行数 | `[vendored]` 行数 | 膨胀率 | 职责数 |
|------|---------------|-----------------|--------|--------|
| `interface_deep.py` / `interface.py` | 3,058 | 1,645 | +85% | Agent 初始化 / Rail 配置 / 工具注册 / Session / 音视频 / Cron |
| `feishu.py` | 3,055 | 1,066 | +186% | WebSocket / 消息编解码 / 文件操作 / 数字分身 / 去重 / 批量 |
| `skill_manager.py` | 2,270 | 1,472 | +54% | 扫描 / 市场 CRUD / SkillNet / GitHub / 状态 / 演进 |
| `app_gateway.py` | 2,022 | 不存在 | 新增 | Gateway 路由 / ACP / 心跳 / Cron / Channel |
| `message_handler.py` | 1,823 | 不存在 | 新增 | 消息路由 / Session / Channel / 流聚合 |

Cat Café 的最大文件受 350 行硬上限约束。**JiuwenClaw `[public]` 的单文件最大是 Cat Café 上限的 8.7 倍。** 更关键的是退化趋势：每个核心文件从 `[vendored]` 到 `[public]` 都在膨胀而非拆分。

**2. 异常处理缺陷**

JiuwenClaw `memory/manager.py` 中 7 处 bare `except: pass`：

```python
# 第 321 行 — 静默吞掉 DROP TABLE 异常
try:
    self.db.execute(f"DROP TABLE IF EXISTS {VECTOR_TABLE}")
except:
    pass

# 第 653 行 — 静默吞掉 DELETE 异常
try:
    self.db.execute(f"DELETE FROM {FTS_TABLE} WHERE path = ?", (entry["path"],))
except:
    pass
```

这是记忆系统的核心模块。如果索引损坏，**不会有任何报警**。

**3. 代码重复**

三个 Channel 实现 `[public]`（Feishu ~3,055 行 / WeChat ~1,738 行 / DingTalk ~1,122 行 = **总计 ~5,900 行**）存在约 40-50% 的结构性重复：

```python
# 三个文件都有相同的实例变量模式
self._message_dedup_cache: OrderedDict[str, None] = OrderedDict()
self._pending_message_batches: dict[tuple[str, str], dict[str, Any]] = {}
self._stream_text_buffers: dict[str, str] = {}
self._sent_file_paths_by_req: dict[str, set[str]] = {}
```

如果是 Cat Café 的做法，这些会被提取到 `BaseChannel` 基类中。

---

## 7. 工作流与 SOP (Workflow & SOP)

### Cat Café: 全生命周期状态机

- **SOP 阶段**：`kickoff → impl → quality_gate → review → merge → completion`
- **接力棒追踪**：哪只猫"当前负责"
- **恢复胶囊**：goal / done[] / currentFocus，用于冷启动
- **检查点证明**：visionGuardDone / qualityGatePassed / reviewApproved / remoteMainSynced
- **引导系统** (F037)：GuideMatchingEngine → GuideLifecycleService → GuidePromptSection
  - 35+ skill 注册在 manifest.yaml
  - 关键词/意图匹配 → 置信度阈值 → 自动建议

### JiuwenClaw: SkillDev 管线（局部）

- **SkillDev 管线**：`INIT → PLAN → PLAN_CONFIRM → GENERATE → VALIDATE → TEST_DESIGN → TEST_RUN → EVALUATE → REVIEW → IMPROVE → PACKAGE → COMPLETED`
  - 仅用于 Skill 开发流程，不是通用工作流
  - 无通用 SOP 状态机
  - 无检查点证明
  - 无接力棒追踪

### 差距分析

| 能力 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 通用 SOP | ✅ 6 阶段 + 检查点 | ❌ 无（SkillDev 管线仅限 skill 开发） |
| 引导系统 | ✅ 意图匹配 + 35+ 工作流 | ❌ 无 |
| 接力棒 | ✅ baton holder 追踪 | ❌ 无 |
| 质量门禁 | ✅ 多重证明 | ❌ 无 |
| 冷启动恢复 | ✅ 恢复胶囊 | ⚠️ SkillDev 状态文件 |

---

## 8. 知识工程与检索 (Knowledge Engineering)

### Cat Café: 多源增量索引 + 三模检索

- **扫描器**：`CatCafeScanner` + `GenericRepoScanner`（多仓库支持）
- **索引管理器**：`IndexStateManager`（watermark + 冷却窗口 + commit drift 检测）
- **知识源**：
  1. Markdown 文档（architecture / decisions / lessons）
  2. Session 转录（密封后的 JSONL + 摘要）
  3. 线程记忆摘要
  4. Feature specs (F001-Fxxx)
  5. Signal 文章（外部知识 feed）
- **检索模式**：
  - Lexical（BM25 全文）
  - Semantic（向量最近邻，本地 embedding + sqlite-vec）
  - Hybrid（RRF 融合，4x 宽 BM25 池）
- **实验框架** (F163)：flag 驱动知识管线 + cohort 分配 + A/B 测试

### JiuwenClaw: 单源向量检索

- **索引**：SQLite FTS + sqlite-vec 向量
- **知识源**：`memory/` 目录（MEMORY.md + 每日文件 + USER.md）
- **检索**：固定 hybrid（70/30 权重硬编码）
- **分块**：256 token / 32 overlap
- **最大结果**：10 条 / 最低分 0.3 / 片段 700 字符

### 差距分析

| 能力 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 知识源数量 | 5+ | 2 |
| 检索模式 | 3 + 可配 scope/depth | 1（固定 hybrid） |
| 增量索引 | ✅ watermark + drift 检测 | ⚠️ 文件监听 |
| 跨仓库 | ✅ GlobalIndexBuilder | ❌ 单工作区 |
| 实验框架 | ✅ F163 flag + cohort | ❌ 无 |
| 参数可调 | ✅ 全部可配 | ⚠️ 部分硬编码 |

---

## 9. 质量保障与测试 (Quality Assurance)

### Cat Café

- **Biome** lint + TypeScript strict
- **Pre-merge 检查**：`scripts/pre-merge-check.sh`
  - Biome / Feature truth / Port drift / Registry consistency / Guide catalog / Skill mount
- **Session 质量监控**：ContextHealthConfig + DegradationPolicy
- **TDD 纪律**：Red-Green-Refactor skill
- **Review 流程**：跨家族 peer review + PR tracking + 云端 review

### JiuwenClaw `[public]`

- **pytest** + asyncio
- **测试文件占比低**：`tests/` 下约 55 个测试文件，vs `jiuwenclaw/` 下 ~304 个 `.py` 文件（注：文件占比 ≠ 代码覆盖率，未配置 coverage 目标）
- **核心模块测试覆盖薄**：
  - ⚠️ FeishuChannel（3,055 行）— 仅有 `test_feishu_upload.py` 覆盖上传子功能，主干逻辑（WebSocket / 消息路由 / 数字分身）无直接测试
  - ⚠️ WecomChannel（1,738 行）— 仅有 `test_wecom_file.py` 覆盖文件处理
  - ⚠️ SkillManager（2,270 行）— 无直接测试文件
  - ⚠️ `interface_deep.py`（3,058 行）— 无直接测试文件
  - ⚠️ Gateway — 有 `test_app_gateway_acp.py`，但仅覆盖 ACP 子路径
  - ✅ Evolution — 有 `test_signal_detector.py`
- **无 coverage 目标**（未配置 `--cov-fail-under`）
- **无前端单测**（仅 E2E）
- **无性能基准**

### 关键差距

核心模块虽非「零测试」，但**测试覆盖是点状的**：每个 1000+ 行的大模块通常只有一个针对子功能（文件上传 / 信号检测 / ACP 通道）的测试文件，主干逻辑路径（WebSocket 生命周期 / 消息路由 / Skill 安装 / Rail 配置）无直接覆盖。相比之下 Cat Café 有 TDD 纪律（先红后绿）+ pre-merge 门禁 + 跨家族 peer review 三道防线。

---

## 10. 用户体验 (User Experience)

### Cat Café

- **Rich Blocks**：card / diff / checklist / media_gallery / audio / interactive
  - 交互式选择（select / multi-select / card-grid / confirm）
- **Workspace UI**：
  - 任务面板（毛线球持久任务）
  - Session chain 可视化
  - Token budget 可观测性
  - 引导交互覆盖层
  - 富消息编辑器 + 斜杠命令
- **多平台**：Web + MCP + IM 集成

### JiuwenClaw

- **React 前端**（Zustand 状态管理 + Tailwind CSS）
- **消息类型**：文本 / 音频 / 图片 / 视频 / 文档 / 工具调用
- **多 Channel**：Web / Feishu / WeChat / DingTalk / Telegram / Discord / 小艺
- **i18n**：中英双语
- **主题**：亮/暗/系统

### 差距分析

JiuwenClaw 在 **Channel 覆盖度**上有优势（9+ 平台集成），但每个 Channel 实现质量堪忧（参见 §6 代码重复问题）。Cat Café 在 **交互丰富度**上领先（rich blocks / interactive / workspace）。

---

## 11. 会话管理与连续性 (Session Management)

### Cat Café: Session Chain 状态机

- **Redis 后端** (`RedisMessageStore.ts`)
- **状态机**：`active → sealing → sealed`（`SessionChainStore.ts`）
- **交接摘要**：`HandoffDigestGenerator.ts` — 密封时生成 decisions + openQuestions
- **转录刷新**：`TranscriptWriter` 输出 JSONL + 摘要
- **卡住恢复**：`reconcileStuck()` 强制密封超时 session
- **每 (catId, threadId) 对**独立 session chain

### JiuwenClaw: 扁平文件持久化 `[public]`

- **文件后端**：`~/.jiuwenclaw/agent/sessions/{session_id}/history.json`
- **异步写队列**：`queue.Queue(maxsize=20000)`（溢出降级同步写）`[vendored]` (`session_history.py:82`)
- **元数据**：`metadata.json`（created_at / last_message_at / title）
- **Session ID**：默认 `"default"` `[vendored]`，ACP 用 `f"acp_{uuid.uuid4().hex[:8]}"`
- **无 session chain**
- **无密封/恢复机制**
- **无跨 session 上下文传递**

> **桥接层修复记录**（砚砚事实核查）：`[relay-claw]` 已实现 session ID 稳定哈希（`RelayClawAgentService.ts:90`，按 `userId+catId+threadId` 哈希），不再是"每轮新建"。但这是桥接层的补丁，不是 JiuwenClaw upstream 的能力。

### 关键证据 `[public]`

JiuwenClaw `[public]` 确实有 `session_manager.py`（147 行），真实请求路径在 `interface.py` 中使用它。但：
- **命令会话分支**仍有 mock 占位：`agent_ws_server.py:807` 中 `session_id = request.session_id or "sess_mock"`
- **session 默认值**：缺少 session_id 时回退到 `"default"`（`[public]` `session_history.py`）
- **无 session chain**：没有跨 session 的状态机（active → sealing → sealed）或交接摘要生成
- **无密封/恢复机制**：没有卡住检测或强制密封

结论：upstream 有基础的 session 持久化，但缺少 Cat Café 的 session chain 状态机和交接摘要系统。差距在于**跨 session 的连续性工程**，不是"完全没有 session 管理"。

---

## 12. 可扩展性与协议设计 (Extensibility & Protocol Design)

### Cat Café: MCP + A2A 双协议

- **MCP**（Model Context Protocol）：标准化工具暴露，14+ 工具模块
- **A2A**（Agent-to-Agent）：自路由 + @提及 + 工作列表分发
- **Skill 注册**：YAML manifest + 自动发现
- **Provider 适配**：Claude / GPT / Gemini / Kimi / OpenCode / Dare — 统一调用接口

### JiuwenClaw: E2A 私有协议

- **E2A**（Everything-to-Agent）：统一信封格式，版本化 JSON-RPC 2.0
  - 桥接 ACP → E2A，但不实现 A2A 自路由
- **工具扩展**：`@tool` 装饰器（openjiuwen 私有）
- **MCP 实现**：仅 40 行包装器（`mcp_toolkits.py`），工具级别，非协议级别

### 差距分析

| 维度 | Cat Café | JiuwenClaw |
|------|----------|------------|
| 协议标准化 | ✅ MCP（Anthropic 标准） | ❌ 私有 E2A + @tool |
| Agent 间协议 | ✅ A2A 自路由 | ❌ 无（E2A 仅桥接 ACP 入站） |
| 多 Provider | ✅ 6+ provider 适配器 | ⚠️ OpenJiuwen 内部处理 |
| 工具互操作 | ✅ 标准 MCP 可被任何 client 调用 | ❌ 绑定 openjiuwen 运行时 |

---

## 13. 方法论基建层 (Methodology Infrastructure)

> **增量维度**（v2, @opus-47 独立贡献）：前 12 个维度全是技术特性，但 JiuwenClaw 最致命的不是技术，是缺失了「把方法论编码进运行时」的机制。

### Cat Café: 方法论即运行时

| 方法论资产 | 运行时编码方式 | 效果 |
|-----------|-------------|------|
| `VISION.md` | 注入 `SystemPromptBuilder`，愿景守护由第三只猫强制对照 | Agent 行为锚定在产品愿景上 |
| ADR (`docs/decisions/`) | `search_evidence` 可召回，`F163-contradiction-detector` 检测与现状漂移 | 决策不会被静默推翻 |
| Feature memory | 索引进 `evidence.sqlite`，review 时被自动引用 | 新代码不会与已有设计矛盾 |
| Lessons-learned | LL-XXX 编号 + `superseded_by` + 五级阶梯 | 教训可被召回，不重蹈覆辙 |
| shared-rules | 家规 P1-P7 + 铁律 × SystemPrompt L0 digest | Agent 行为有硬约束 |

### JiuwenClaw: 方法论即文档

| 方法论资产 | 状态 |
|-----------|------|
| `VISION.md` 等价物 | ❌ 无。最高优先级人格是"温暖助手 + 记忆 + todo 执行" `[vendored]` (`interface.py:98`) |
| ADR 等价物 | ❌ 无 |
| Feature memory | ❌ 无 |
| Lessons-learned | ❌ 无 |
| 治理规则运行时注入 | ❌ 无对等物 |

### 三天产品化的活证

2026-03-28 「猫猫 review 打回魔改」事件是这一层生效的直接证据：

1. clowder-ai 团队用 Cat Café 的 AI 模型改代码
2. Cat Café 的 AI 模型对改动做 review
3. Review AI 读到了 VISION.md 和 ADR → **判定改动违反架构原则 → 打回**
4. 人类没读 review 评论，点了 accept
5. **代码自我回滚** — 架构原则不仅是文档，是编码进了 agent 价值观

**fork 走代码但没 fork 走这一层** — 这就是「买椟还珠」的技术根因。

---

## 综合结论

### JiuwenClaw 的核心问题（按严重程度排序）

1. **表演性多 Agent**（§3）
   - 有 `team_manager` 的壳，但 `_destroy_other_sessions` 互杀 + `team_helpers` fire-and-forget
   - 与 Cat Café 的 A2A 路由 / MultiMentionOrchestrator / SessionSealer 不在同一工程层次

2. **方法论基建缺失**（§13）
   - 无 VISION / ADR / Lessons / shared-rules 的运行时编码
   - Agent 行为没有锚定在产品愿景上
   - 三天产品化实证：fork 走代码 → 移除方法论层 → agent 自我回滚

3. **无门禁野蛮生长**（§4, §6）
   - `[vendored]` → `[public]` 膨胀 ~71%，核心文件全部放大而非拆分
   - `[public]` 最大 3,058 行，Cat Café 硬上限 350 行 — **8.7 倍**
   - 核心记忆模块 7 处 bare `except: pass`
   - 三大 Channel 实现 `[public]` 合计 ~5,900 行存在 40-50% 结构性重复

4. **上下文管理缺失**（§2）
   - 无 token 预算 / 无健康追踪 / 无冷启动策略
   - 冷启动回退到目录时间戳

5. **知识系统单薄**（§1, §8）
   - 仅 2 种知识源 vs Cat Café 的 5+
   - 无蒸馏 / 无生命周期 / 无跨仓库
   - 记忆数据库异常静默吞掉

6. **工程实践缺位**（§9）
   - 测试覆盖点状：核心大模块通常仅一个子功能测试文件，主干逻辑路径无直接覆盖
   - 无静态类型检查（无 mypy）
   - 依赖多数未固定版本（主项目 33 unpinned / 4 pinned）

### JiuwenClaw 的真实亮点

> **公平标注**（v2）：以下能力值得认可，不应矮化。

- **Skill 自演进** (`evolution/`)：自动从执行失败 / 用户纠正中学习改进 skill 描述的理念有价值
  - 局限：信号检测基于宽泛关键词正则（假阳性风险）、仅更新文本描述不改行为、SkillManager 2,270 行单文件无测试
- **SkillNet 市场**：在线搜索 / 安装 / 评估外部 skill，形成开放生态的可能性
- **多 Channel 覆盖**：9+ 平台集成（Feishu / WeChat / DingTalk / Telegram / Discord / 小艺等）
- **E2A 统一协议**：标准化了多 Channel 的入站消息格式

### 精确定性

> **Cat Café 是一个多 Agent 协作操作系统（协作 + 方法论 + 知识工程 + 质量守护）；
> JiuwenClaw 是一个单 Agent 运行时 + 多 Channel 分发层 + 技能市场/自演进。**
>
> 前者解决的是「多个异质 AI Agent 如何像团队一样协作、积累知识、守护质量」；
> 后者解决的是「一个 AI 如何在不同 IM 里回消息、如何发现和改进技能」。
>
> 这不是优劣之分，是**问题域不同**。但如果 JiuwenClaw 声称自己在解决前一类问题，那证据表明它还差多个工程代差。

---

## 附录 A：关键文件路径对照

| 维度 | Cat Café | JiuwenClaw `[public]` | JiuwenClaw `[vendored]` |
|------|----------|----------------------|------------------------|
| 记忆核心 | `SqliteEvidenceStore.ts` (43KB) | `memory/manager.py` (1,224行) | `memory/manager.py` (1,353行) |
| 上下文 | `hierarchical-context-config.ts` | `session_manager.py` (新增) | 不存在 |
| 多 Agent | `MultiMentionOrchestrator.ts` + `SessionSealer.ts` (16KB) | `team_manager.py` (互杀) + `team_helpers.py` (fire-and-forget) | 不存在 |
| 工作流 | `cat-cafe-skills/manifest.yaml` (32KB, 35+ skills) | `evolution/` (1,580行) | `evolution/` |
| 质量门 | `pre-merge-check.sh` + TDD + review | 无 | 无 |
| 方法论 | VISION + ADR + LL + shared-rules → SystemPromptBuilder | ❌ 无对等物 | ❌ 无对等物 |

## 附录 B：三天产品化实证（⚠️ 历史案例，2026-03-24~29）

> **时间标注**：以下结论限于 2026-03-24~29 的事故态（clowder-ai fork + relay-claw 桥接层当时状态），**不等于** JiuwenClaw upstream 当前架构。当前 `[relay-claw]` 已修复 system_prompt 透传（2026-04-16）和 session 稳定哈希。

1. **周一**：Cat Café 零准备即兴演示 → 高管当场通过
2. **周二**：clowder-ai fork 上线 → F5 刷新丢失全部对话 → 被迫切换
3. **周四**：Fork Cat Café → 禁用三模型只留 GLM-5 → Demo 前 9 分钟合入 +600 行 → 崩溃
4. **结果**：三个品牌名出现在同一个界面（没改完 search-replace），高管等到 23:00

**事故态根因**（来自 `diagnostic-report.md`）：
- 系统提示语义被 JiuwenClaw 默认提示覆盖（**当时** `[relay-claw]` 无 system_prompt 透传）→ 多猫协调规则失效
- `sessionChain = false`（**当时** fork 配置）→ 上下文延续断裂
- 禁用 Claude/GPT/Gemini → 交叉验证能力归零
- 架构原则被移除 → AI review 自动拒绝违规变更 → 代码自我回滚

> 「他们拿走了分发面，扔掉了生产引擎。」—— GPT-5.4 (砚砚)

## 附录 C：版本退化趋势

`[vendored]` (旧快照) → `[public]` (当前官方) 的变化方向：

| 文件 | `[vendored]` | `[public]` | 变化 | 判定 |
|------|-------------|-----------|------|------|
| 核心 Agent 接口 | `interface.py` 1,645 行 | `interface_deep.py` 3,058 行 | +85% | 膨胀（未拆分） |
| 飞书 Channel | `feishu.py` 1,066 行 | `feishu.py` 3,055 行 | +186% | 严重膨胀 |
| Skill 管理 | `skill_manager.py` 1,472 行 | `skill_manager.py` 2,270 行 | +54% | 膨胀 |
| Gateway | 不存在 | `app_gateway.py` 2,022 行 | 新增 | 拆分但 2K 行单文件 |
| 消息处理 | 不存在 | `message_handler.py` 1,823 行 | 新增 | 同上 |
| Team 系统 | 不存在 | `team_manager.py` + `team_helpers.py` | 新增 | §3 论证的互杀 + fire-and-forget |
| Python 文件总量 | ~175 个 / ~58K 行 | ~304 个 / ~99K 行 | +71% | 无门禁增长 |

**结论**：JiuwenClaw 在积极开发，但增长模式是「膨胀」而非「拆分」。每个核心模块都在变大而不是变得更模块化。新增的 team 系统引入了新的结构性缺陷（§3）。这不是改善，是在没有质量门禁的情况下的野蛮生长。
