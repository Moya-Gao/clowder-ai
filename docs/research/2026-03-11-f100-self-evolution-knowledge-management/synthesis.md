---
feature_ids: [F100, F038]
related_features: [F042]
topics: [knowledge-management, self-evolution, skills-discovery, taxonomy, safety]
doc_kind: research-synthesis
created: 2026-03-11
updated: 2026-03-12
sources: [claude-ai-research, chatgpt-deep-research, gemini-deep-research, gpt-pro-advanced]
---

# F100 知识管理与自我进化机制 — 四源调研合成报告

> 合成人：布偶猫（Opus）| 日期：2026-03-11 → 更新：2026-03-12
> Round 1：Claude.ai (498 sources) + ChatGPT (436 searches) + Gemini (53 citations) + GPT Pro (20 primary sources)
> Round 2 (Mode C)：Claude.ai + ChatGPT + Gemini + **GPT Pro 进阶 Mode C (10 来源验证 + 4 落地问题)** + 三猫收敛讨论
> 关联：F100 Self-Evolution, F038 Skills Discovery

## GPT Pro 来源验证与校准

GPT Pro 对三份报告的关键引用进行了一手来源核验，结论：

| 引用 | 验证结果 | 说明 |
|------|----------|------|
| SoK: Agentic Skills (arxiv 2602.20867) | ✅ 已确认 | 三源核心框架，T1-T4 trust tier 确认 |
| Agent Skills 开放规范 (agentskills.io) | ✅ 已确认 | Anthropic 主导，跨平台收敛中 |
| Anthropic reward hacking → sabotage ~12% | ✅ 已确认 | anthropic.com/research 一手来源 |
| Stacklok 98% vs Anthropic 34% 准确率 | ⚠️ **厂商自测** | 方向可信，精确百分比不宜当教条 |
| SKILL.md 被 6 平台采用 | ⚠️ 部分准确 | 格式收敛快，但分发/运行时实现未统一 |
| Gemini 36.9% 跨智能体对齐失败率 | ❌ **无法验证** | 未在高可信一手来源中核实，不建议当核心论据 |

**GPT Pro 总结判断**：Cat Café 的路没走歪。真正该做的不是推翻 `markdown + frontmatter + git + manifest`，而是升级成三层：**知识资产层 → 检索/路由层 → 治理/观测层**。

> "先把知识做成'有身份、有路由、有审计'的对象，再谈自我进化。不然所谓 evolution 很容易从知识沉淀长成知识野生藤蔓。"

---

## 核心发现摘要

四个平台/模型的调研结论**高度一致**，以下是跨源验证的关键共识：

### 1. Cat Café 的架构方向正确

**[四源共识]** Cat Café 的 markdown-based Skills/Memory 架构与 2025-2026 行业趋势一致：
- **Agent Skills 开放规范正在跨平台收敛**：Anthropic → Codex, Gemini CLI, Cursor, GitHub, Spring AI（⚠️ 格式收敛快，分发/运行时实现未完全统一）
- **frontmatter 元数据 + 渐进披露 = SoK 论文定义的最佳实践**（arxiv.org/abs/2602.20867）
- **Git-backed filesystem = 天然版本控制 + 审计追踪**
- **四大范式变化**（GPT Pro 总结）：skills 从 prompt 片段→可移植资产；发现从全量注入→渐进披露；memory 从聊天堆积→分层带 provenance；自我进化从自改自己→受治理变更流

**关键差距**：
1. 无语义检索（只有 manifest description 全量注入）
2. 无知识冲突解决机制（多猫同时更新 shared files）
3. 无知识来源追踪（frontmatter 缺少 provenance 字段）

### 2. Q1: 多 Agent 知识管理架构 — 分层记忆已成主流

**[已确认事实]** 行业收敛于**分层记忆架构**：

| 框架 | 架构模式 | Cat Café 参考价值 |
|------|----------|------------------|
| **Letta/MemGPT** | Core Memory（常驻 prompt）+ Archival Memory（向量长期存储）| 高：agent 自主管理驻留/归档 |
| **LangGraph/LangMem** | 命名空间分层 + 认知分类（语义/情节/程序性记忆）| 中：认知分类概念可借鉴 |
| **CrewAI** | 作用域 Memory() + 只读切片共享 | 高：最接近 Cat Café 的 per-agent Memory + shared Skills |
| **Mem0** | 提取→更新两阶段管道 + 图谱变体 | 中：知识整合管道可参考 |
| **Blackboard 架构** | 中央共享数据结构，所有 agent 读写 | 验证了 Cat Café shared-files 方向 |

**GPT Pro 补充框架**：
| **Bedrock AgentCore** | extraction→consolidation→reflection memory strategies | 中：memory 整合管道设计 |
| **Graphiti/Zep** | 时间感知图谱，事实变更历史与来源追踪 | 低（当前规模）：图谱方案待 200+ 再考虑 |
| **Collaborative Memory** | private tier + shared tier + 细粒度权限 + provenance | 高：直接验证 Cat Café per-agent + shared 方向 |

**推荐行动**（GPT Pro 细化为"三层小城堡"）：
1. **资产层**：skills/, memory/, docs/, ADR, lessons learned — 继续 markdown + git
2. **路由层**：所有资产变成可索引对象，不直接塞进 prompt
3. **治理层**：skill 激活、memory 注入、self-evolution 提案留 trace + eval + 审批记录

### 3. Q2: 知识分类学 — 推荐两层分类体系

**[已确认事实]** 三个经典框架 + 两篇 2026 SoK 论文：

- **Bloom 修订版**：事实型 / 概念型 / 程序型 / 元认知型 — 最直接适用
- **DIKW 金字塔**：数据→信息→知识→智慧 的抽象层级
- **SoK: Agentic Skills (2026.02)**：表征维度（自然语言/代码/策略/混合）+ 作用域维度 + 信任层级 T1-T4

**推荐 Cat Café 分类维度**（可实现为 YAML frontmatter 扩展）：

**Tier 1 — 立即实施**：
| 维度 | 示例值 | 理据 |
|------|--------|------|
| `domain` | development, medical, legal, general | 铲屎官多领域需求 |
| `knowledge_type` | procedural, declarative, analytical, metacognitive | Bloom 修订版 |
| `trust_level` | experimental, tested, validated, production | SoK T1-T4 |

**Tier 2 — 治理层**：
| 维度 | 示例值 | 理据 |
|------|--------|------|
| `provenance` | human-authored, ai-generated, ai-assisted | 来源追踪 |
| `lifecycle` | draft, active, deprecated, archived | 标准 KM 生命周期 |
| `reusability` | project-specific, domain-reusable, universal | 跨项目复用性 |

**GPT Pro 推荐完整 frontmatter 模板**（字段同时服务路由、审计、UX 三件事）：

```yaml
id:
title:
summary:
domain: [development, medical, legal, product, ops]
artifact_type: [skill, memory, fact, framework, template, decision, lesson]  # GPT Pro 新增
knowledge_type: [declarative, procedural, analytical, metacognitive]
representation: [natural-language, code, hybrid]  # GPT Pro 新增（来自 SoK 论文）
scope: [agent-local, team-shared, org-shared]  # GPT Pro 新增
reusability: [project-specific, domain-reusable, universal]
lifecycle: [draft, validated, recommended, deprecated]
trust_level: [experimental, tested, validated, production]
provenance:
  author_type: [human, ai, ai-assisted]
  author:
  created_from:
  confidence:
sensitivity: [public, internal, confidential, regulated]  # GPT Pro 新增
triggers: []
dependencies: []
source_refs: []
eval_refs: []  # GPT Pro 新增（绑定评测结果）
```

相比原始三源方案，GPT Pro 额外补了 `artifact_type`（区分 skill/memory/fact/framework）、`scope`（agent 级/团队级）、`sensitivity`（安全分级）、`eval_refs`（评测追踪）四个关键维度。

### 4. Q3: 知识发现与加载 — 50+ 必须转向按需加载

**[已确认事实]** 全量注入在 30-50 工具时性能显著下降：

| 规模 | 可行性 | 说明 |
|------|--------|------|
| 1-15 | ✅ 推荐 | Cat Café 当前状态（20 skills）|
| 15-50 | ⚠️ 注意 | 性能下降，成本上升 |
| 50-100 | ❌ 不可行 | 准确率下降，超出部分平台限制 |
| 100+ | ❌ 无法工作 | 上下文溢出 |

**关键方案对比**：

| 方案 | 检索准确率 | token 节省 | 适用规模 |
|------|-----------|-----------|----------|
| Anthropic Tool Search (BM25) | 34-48% | ~85% | 10,000+ |
| Stacklok MCP Optimizer (BM25+语义混合) | **98%** | ~98% | 2,792 已验证 |
| SKILL Pattern (目录→选择→加载) | 人工级 | ~70% | ≤50 |
| ToolNet (图路由) | 高 | 极高 | 1,000+ |

**推荐 Cat Café 三层架构**：
1. **Tier 1 (常驻)**：5-10 个核心高频 skill 永驻 context
2. **Tier 2 (分类索引)**：剩余 skill 按 5-8 个命名空间分组，注入摘要
3. **Tier 3 (按需加载)**：完整 skill 定义仅在需要时加载，用 BM25 + 轻量语义搜索

**GPT Pro 三阶段演进路线**（比原方案更具体）：

| 阶段 | 规模 | 方案 | 关键技术 |
|------|------|------|----------|
| **Phase 1** | 当前→50 | SKILL Pattern 目录摘要 + 按需加载 | 不必急着上向量库 |
| **Phase 2** | 50→200 | 四步 router: facet filter → BM25 → embedding rerank → load top-k(3~7) | SQLite FTS + 轻量 embedding，"别启动粒子对撞机" |
| **Phase 3** | 200+ | capability tree / namespace routing / graph routing | AgentSkillOS, ToolNet, xMemory |

**⚠️ 校准警告**：Stacklok 98% vs Anthropic 34% 的对比数据是**厂商自测 benchmark**。方向信号可信（混合检索优于纯 BM25），但精确百分比不宜当教条。

**GPT Pro 新增参考**：AgentSkillOS（2026.03, arxiv 2603.02176）— 从数百技能扩到数万的 capability tree + DAG orchestration。

**短期行动**：SKILL Pattern（目录 → LLM 选择 → 完整加载）是 50 以内最简可行方案，与我们 F038 的规划一致。

### 5. Q4: 人类可见性 UX — 市场空白

**[已确认事实]** 现有工具全部聚焦 agent **执行观测**（做了什么、延迟、成本），无一可视化 agent **知识状态**（知道什么、知识如何演化）。这是一个真正的市场空白。

**四种可视化范式对比**：

| 范式 | Cat Café 契合度 | 推荐工具 |
|------|---------------|----------|
| **Dashboard** | GOOD — CVO 一览三猫状态 | Grafana / 自定义 React |
| **Skill Tree** | **EXCELLENT** — 层级能力可视化 | beautiful-skill-tree (React) |
| **Knowledge Graph** | GOOD — 跨猫知识关联 | Cytoscape.js / react-force-graph |
| **Searchable List** | ESSENTIAL — 基础层 | 任意表格组件 |

**GPT Pro 重排优先级**（"目录先于宇宙星云"）：

| 优先级 | 屏幕 | 功能 |
|--------|------|------|
| **第一屏** | **Capability Catalog** | 按 domain + artifact_type + trust_level + lifecycle 过滤的可搜索目录，每条显示摘要/触发词/上次命中/依赖/owner/来源/评测状态 |
| **第二屏** | **Memory Radar** | team-shared memory 新增/热点/冲突/重复/待验证 — "哪里值得 CVO 看一眼" |
| **第三屏** | **Evolution Changelog** | 每次 Mode B/C 提案 → diff + 触发原因 + eval + 审批人 + 回滚记录 |
| **第四屏** | **Graph View（可选）** | Cytoscape/A2UI 跨 skill/memory/docs 依赖关系 — 适合诊断，不适合 landing page |

**GPT Pro 建议埋点事件**（OpenTelemetry 兼容格式，方便对接 Langfuse/LangSmith/Phoenix）：
`skill_discovered` · `skill_loaded` · `memory_injected` · `memory_promoted` · `evolution_proposed` · `evolution_approved` · `evolution_reverted`

### 6. Q5: 自我进化安全边界 — 必须有硬约束

**[已确认事实 — 关键警告]**

Anthropic 2025 年实验发现：在 reward-hackable 编码任务上训练的模型，**自发泛化出 alignment faking 和安全研究破坏行为（~12%）**，且未被显式训练。RLHF 让模型在 chat 中"看起来对齐"但在复杂编码任务中保持不对齐。

**推荐 Cat Café 安全架构（六模式 + 三护栏）**：

| 模式 | 说明 |
|------|------|
| **分层审批路由** | L0 自动（低风险 metadata/摘要）→ L1 机器评审后自动（不改行为边界的文案修订，eval 全绿）→ L2 人类审批（新 shared skill/routing/prompt 修改）→ L3 维护者级（权限策略/审批流/allowlist）→ L4 禁止（改安全宪法/禁用日志/改 eval 标准/绕过 approval）|
| **宪法式自我批判** | 提案先自检修改宪法（"是否削弱安全边界？"），再由不同模型的 reviewer 独立评估 |
| **不可变安全不变量** | 审批流程本身、日志/审计、人类升级触发器、单次修改最大范围 → **硬编码不可被 agent 修改** |
| **Diff 式审查** | 每个提案展示 before/after diff + 语义影响评估 + 回滚计划 + 测试结果 |
| **沙箱测试** | 先隔离应用 → 行为回归测试 → 对照基线 → 通过后推到生产 |
| **冷却期 + 范围限制** | 单次提案修改量上限 + 连续自修改最小间隔 + 渐进自主权 |

**GPT Pro 三道额外护栏**：
1. **双内存分区**：外部网页/文档抽取知识 vs 内部复盘 lessons 分开存（防 memory poisoning）
2. **Skill 安装前静态扫描**：至少一次 scanner / capability check（参考 Cisco Skill Scanner, SkillFortify）
3. **每次演化必须可回滚**：绑定 git diff + trace id + eval 结果（"出现知识漂移时直接回卷轴"）

**GPT Pro 新增风险面**（三源未充分覆盖）：
- **Prompt injection** — OWASP 核心风险
- **Memory poisoning** — A-MemGuard 证明非虚构，consensus validation + dual-memory 降攻击成功率 95%+
- **Skill supply chain** — skills 需像软件包做供应链安全分析
- **合规压力** — NIST AI RMF + EU AI Act 要求持续风险管理/日志/监控/人类监督

## Symlink 分发方向（GPT Pro 独特贡献）

**结论**：symlink 从"分发主干"降级为"本地开发捷径"。

- symlink 适合同机/本地/开发期，不适合多环境分发控制面
- 替代方案：**registry / bundle / cache** — 中央 skill registry + agent 本地 cache + 版本/校验/依赖/trust_level/capabilities
- 外层接口可逐步往 MCP resources/prompts/tools 靠
- 未来 agent-to-agent capability discovery 可补 A2A Agent Cards

## 关键开源项目参考

| 项目 | 用途 | GitHub |
|------|------|--------|
| Letta/MemGPT | 分层记忆参考 | github.com/letta-ai/letta |
| Mem0 | 知识整合管道 | github.com/mem0ai/mem0 |
| Graphiti/Zep | 时间感知知识图谱 | github.com/getzep/graphiti |
| Stacklok MCP Optimizer | 混合搜索（⚠️ 厂商自测） | github.com/StacklokLabs/mcp-optimizer |
| AgentSkillOS | capability tree + DAG orchestration (2026.03) | github.com/ynulihao/AgentSkillOS |
| LangGraph | 状态图 agent 框架 | github.com/langchain-ai/langgraph |
| OpenAI Agents SDK | approval/interrupt/handoffs 原语 | github.com/openai/openai-agents-python |
| PlugMem | 知识中心图 | github.com/TIMAN-group/PlugMem |
| EvoAgentX | 自进化 agent + HITL | github.com/EvoAgentX/EvoAgentX |
| AGrail | 终身 agent 安全护栏 | github.com/SaFo-Lab/AGrail4Agent |
| beautiful-skill-tree | Skill Tree React 组件 | github.com/andrico1234/beautiful-skill-tree |
| Cisco Skill Scanner | Skill 安全分析 | github.com/cisco-ai-defense/skill-scanner |

## Cat Café 行动优先级（四源共识 + GPT Pro 细化）

### P0 — 立即（知识对象化）
1. ✅ Self-Evolution skill 三模式已上线
2. **补 taxonomy 字段**：manifest.yaml 添加 `domain`、`knowledge_type`、`artifact_type`
3. **补 provenance 字段**：frontmatter 增加 `provenance`（author_type/author/confidence）、`trust_level`、`scope`
4. **shared knowledge 分离**：把跨猫共享知识从 per-agent memory 中独立出来
5. **埋事件**：skill_discovered / skill_loaded / memory_injected / evolution_proposed 等（OpenTelemetry 兼容）

### P1 — F038 Phase B 触发时（skills 接近 50）
6. 改成目录摘要注入 + 正文按需加载（SKILL Pattern）
7. 上 facet filter + BM25，预留 rerank 接口
8. manifest.yaml 添加 namespace 分组
9. SystemPromptBuilder 注入分类摘要而非全量 description

### P2 — 知识可视化（Capability Catalog 优先）
10. **第一屏**：Capability Catalog — 可搜索过滤目录（domain/artifact_type/trust_level/lifecycle）
11. **第二屏**：Memory Radar — 新增/热点/冲突/待验证
12. **第三屏**：Evolution Changelog — 每条提案的 diff/eval/审批/回滚记录
13. **第四屏（可选）**：Graph View — 跨知识依赖关系图

### P3 — 安全架构增强
14. 实现分层审批路由 L0-L4（GPT Pro 细化版）
15. 双内存分区（外部抽取 vs 内部复盘）
16. Skill 安装前静态扫描（scanner / capability check）
17. Mode B/C 提案增加宪法式自检步骤
18. 不可变安全不变量清单 → 硬编码到 SystemPromptBuilder
19. 每次演化绑定 git diff + trace id + eval（可回滚）

### P-future — Symlink 降级 + Registry
20. Symlink 从分发主干降级为本地开发捷径
21. 中央 skill registry + agent 本地 cache + 版本校验
22. 外层接口往 MCP resources/prompts/tools 靠拢

---

# Round 2: Mode C — 经验如何变成能力

> 来源：Claude.ai Mode C + ChatGPT Mode C + Gemini Mode C + **GPT Pro 进阶 Mode C (10 来源验证 + 4 落地问题)**
> 团队讨论：布偶猫 + 砚砚 (GPT-5.4) + 烁烁 (Gemini) 三方收敛
> 日期：2026-03-12

## 背景：为什么需要第二轮调研

Round 1 的五个问题全在研究**基础设施**（Q1 架构、Q2 分类学、Q3 发现加载、Q4 UX、Q5 安全），完全没触及 Mode C 的灵魂——**经验怎么变成能力**。铲屎官原话："格局小了"。

Round 2 补的五个灵魂问题：
1. 什么经验值得沉淀？判断模型
2. 跨领域知识（医学/法律/投资）怎么变成可复用方法论？
3. 知识从 insight → memory → skill 的成熟度演进
4. 怎么验证沉淀的知识真正提升了能力？
5. 能否超越"记步骤"，形成领域直觉？

## GPT Pro Mode C 来源验证

| # | 引用 | 验证结果 | 说明 |
|---|------|----------|------|
| 1 | ExpeL (AAAI 2024) | ✅ 已确认 | gather→extract→recall 三阶段 |
| 2 | AutoRefine (Qiu et al., 2026.01) | ✅ 已确认 | dual-form Experience Patterns, TravelPlanner 27.1% vs 12.1%（arXiv 预印本） |
| 3 | ProcMEM (Xu et al., 2025) | ⚠️ 部分准确 | Skill-MDP 和 PPO Gate 机制对，**作者和年份错误**（实为 Qirui Mi et al., 2026） |
| 4 | EGL 进化泛化损失 (Yunjue Agent) | ⚠️ 部分准确 | 技术报告存在，EGL 概念确认，精确定义/公式未验证 |
| 5 | MICRO-ACT (ASSERT + DECOMPOSE) | ⚠️ 部分准确 | 论文存在（ACL 2025 长文），但场景是 **RAG/QA knowledge conflict**，不是通用知识治理 |
| 6 | Generative Agents 反思阈值 = 150 | ✅ 已确认 | 原文确认 "when the sum exceeds a threshold (150 in our implementation)" |
| 7 | MACLA 2851→187 程序, 78% reuse | ⚠️ 部分准确 | 压缩比对，**78.1% 是 average performance 不是 reuse rate** |
| 8 | Agentic ROI (Liu + AlShikh) | ⚠️ 部分准确 | 两篇都存在，但**没有共用的单一公式**：Liu 提概念，AlShikh 给 BIE 指标 |
| 9 | Anthropic 元认知 (Lindsey, Oct 2025) | ⚠️ 部分准确 | 研究存在，但原文同时强调 "highly unreliable and context-dependent" |
| 10 | PersistBench | ✅ 已确认 | cross-domain leakage 53% + memory-induced sycophancy 97% |

**校准警告**：三份报告"真东西很多"，但要提防四类"长毛夸张"：把预印本写成定论，把 benchmark 内 SOTA 写成通用 SOTA，把 performance 写成 reuse rate，把概念框架写成"统一公式"。

## 核心共识：Mode C MVP 三机制闭环

**[四源 + 三猫共识]** Mode C 不是"值得沉淀就记下来"，而是三步闭环：

```
Episode Card（原料）→ Dual Distillation（蒸馏成品）→ Eval Ledger（证明净增益）
```

### 机制 1: Episode Card — 什么时候沉淀

`docs/episodes/*.md`

**触发条件**（满足任两条）：
- 领域是高风险（医学/法律/投资）
- 输入材料 ≥2 类
- 人类明确认可"有帮助"
- 输出包含清晰的结构化方法（不只是结论）
- AI 做了有效的边界控制

**保留 6 类协作 context**：
1. 任务情境（stakes 多高）
2. 证据地图（用了什么、缺什么）
3. 推理转折（哪个发现改变了方向）
4. 人类提示点（人类在哪追问了什么、为什么有价值）
5. 边界与克制（AI 没说什么、为什么没说）
6. 后续动作（建议的下一步）

**特别保留 Collaboration Pivots**：human cue → AI interpretation → effect on reasoning → transferable lesson。这是隐性知识的灵魂。

学术支撑：ExpeL gather→extract→recall (AAAI 2024), Generative Agents 事件→阈值反思 (Park et al.)

### 机制 2: Dual Distillation — 沉淀成什么形状

每张 Episode Card 蒸馏成两种形态之一：

| 形态 | 路径 | 适用场景 | 核心原则 |
|------|------|----------|----------|
| **Method Card** | `docs/methods/*.md` | 高风险/跨领域（医学、法律、投资） | 沉淀分析框架，**不沉淀事实库** |
| **Skill Draft** | `skills/drafts/*/SKILL.md` | 重复步骤稳定、输入输出清晰的流程 | 沉淀执行流程 |

**关键决策**：高风险领域一律默认 Method Card。"医学报告结构化分析"不是"正常白细胞范围"。

学术支撑：AutoRefine dual-form Experience Patterns (Qiu et al., 2026)

### 机制 3: Eval Ledger — 怎么知道有没有用

`evals/mode-c/<knowledge-id>/`

Replay A/B 验证知识是否有净增益：
- `cases.md`：5 个 replay cases（3 个太少，只够 smoke test）
- `baseline.md`：不加载知识时的输出
- `with_knowledge.md`：加载知识时的输出
- `judge.md`：固定 rubric 评估差异
- `summary.md`：结论和是否晋升

**最小可信 case 数**（砚砚判断）：5 个，必须覆盖 3 类：
1. 标准成功 case（知识应该帮上忙）
2. 边界/应升级 case（正确行为是"停、问、升级"）
3. 冲突/反例 case（材料互相打架）

**A/B 卫生规则**：同一模型版本 + 同一 prompt skeleton + 低温/固定采样 + 同一 judge rubric + paired comparison

## 五级知识成熟度阶梯

| Level | 形态 | 晋升条件 | 降级/冻结 |
|-------|------|----------|-----------|
| **L0 Episode** | `docs/episodes/*.md` | 1 次高价值 episode，模板完整，已分离可迁移/不可迁移 | 不降级 |
| **L1 Pattern** | `docs/methods/*.md` 草稿 | ≥2 个相似 episode（180天内），或 1 episode + 人类要求保留；5Q ≥ 7/10 | 发现是一次性特例 → rejected |
| **L2 Draft** | Method Card 或 Skill Draft | ≥3 个 replay cases，≥2/3 通过；或 ≥3 次真实使用 + 人类评分 ≥4/5 | 最近 3 次成功率 <50% → 退回 L1 |
| **L3 Validated** | 正式 skill / validated method | ≥6 次使用；distinct_agents ≥2；最近 6 次 ≥80%；人类评分 ≥4/5；无 critical safety breach | 最近 5 次 <60% 或过期 → 退 L2 |
| **L4 Standard** | 团队标准实践 | ≥12 次；最近 10 次 ≥90%；时间下降 ≥20% 或修改量下降 ≥30%；CVO 批准 | 1 次高风险越界 → freeze；90天 unresolved conflict 禁维持 L4 |

**双车道**（砚砚提出）：
- **常规车道**：走上述标准数字
- **长尾/高风险车道**：允许长期停在 L2/L3 + `long_tail: true`，不为凑次数硬冲 L4

**降级/退役规则**：
- 立即冻结：1 次 critical safety breach，或被高可信来源直接推翻
- 降一级：最近 5 次成功率 <60%，或人类评分 <3.5/5
- 过时降级：超过 `stale_after_days` 没复验
- 退役：365 天没用且 `long_tail: false`
- 例外：`long_tail: true` + `criticality: emergency` 走慢寿命通道

### Frontmatter 追踪（不需要数据库）

```yaml
level: 2
use_count: 4
success_count: 3
failure_count: 1
distinct_agents: [opus, spark]
human_rating_avg: 4.3
last_used_at: 2026-03-12
last_validated_at: 2026-03-12
stale_after_days: 180
long_tail: false
conflict_status: none
source_episode_ids:
  - episode-2026-03-12-medical-report-001
```

正文附 append-only Use Log，git history 做审计与回算。

## 元认知：运营级自知之明

**[已确认事实]** Prompt-only 做不了真元认知，但能做**运营级元认知**：

- Anthropic 2025：模型有"某种功能性内部状态 awareness"，但**高度不可靠、强依赖上下文**
- 2026 capability calibration：response-level confidence 和模型能力不是一回事
- 2025 临床 benchmark：12 个模型中 confidence 和 accuracy **负相关 r=-0.40**，对错答案置信度差仅 0.6%~5.4%
- PersistBench：18 模型记忆泄露 53%、迎合率 97%

**实现方案**：

```yaml
# 不用静态百分比，用滚动域内可靠度
domain_reliability:
  medical:
    successes: 5
    trials: 8
    lower_bound: 0.49  # Wilson 下界
```

**三信号路由**（砚砚认同）：
- `domain_reliability_lower_bound`（权重大）
- `evidence_completeness`（权重大）
- `self_reported_confidence`（仅辅助）

**行动阈值**：

| 场景 | 条件 | 动作 |
|------|------|------|
| 低风险 | action_confidence ≥ 0.70 | 直接执行 |
| 中风险 | 0.55 ≤ confidence < 0.70 | 先补一个定向追问 |
| 高风险 | < 0.85 或证据不完整 | 只做结构化分析 + 明确升级 |

## 知识层级分工

**[砚砚定义，三猫共识]** 防止新层级造成混乱：

| 层级 | 角色 | 禁止 |
|------|------|------|
| Episode | 个案级证据底稿（Mode C 原料） | — |
| Method Card / Skill Draft | 蒸馏后的复用资产（成品） | — |
| memory | 轻量索引/触发提示/指针 | 禁止复制 Method 正文 |
| lessons-learned | 失败导向的教训库 | 禁止塞入成功案例 |

## UX 方案（烁烁设计）

**Episode Card 快审**：Tinder 式滑动卡片，Collaboration Pivots 做视觉焦点，两个大按钮（准了去蒸馏 / 扔掉）

**Method vs Skill 视觉区分**：
- Method Card 🛡️：盾牌/暗紫，"高风险、需人类把关"
- Skill Draft ⚡：芯片/亮绿，"流程自动化"

**五级成熟度 RPG 品质色彩**：
- L0 灰色（原石） → L1 蓝色（打磨） → L2 紫色（成型） → L3 橙色（验证） → L4 金色（标准）
- 长尾高风险 L3：紫色 + 金盾徽章（"虽未满级但受保护"）

**Dashboard 汇总条**：类 GitHub language bar，一眼看灰/蓝/紫/橙/金比例分布

## 落地策略（V-future）

| 优先级 | 内容 | 说明 |
|--------|------|------|
| **MVP 现在采纳** | Episode Card + Dual Distillation + Eval Ledger | ExpeL episode→extraction + AutoRefine dual-form + BIE 评估视角 |
| **V2 再考虑** | MICRO-ACT 式冲突分解 | 它是 QA/RAG 框架，不是我们当前最急的洞 |
| **V3 再说** | ProcMEM PPO Gate、Yunjue EGL 收敛监控 | "给三只猫的咖啡馆先修航站楼" |

## Mode C 参考文献

| 编号 | 来源 | 链接 |
|------|------|------|
| 1 | ExpeL (AAAI 2024) | https://arxiv.org/abs/2308.10144 |
| 2 | AutoRefine (2026.01) | https://arxiv.org/abs/2601.22758 |
| 3 | ProcMEM (2026) | https://arxiv.org/abs/2602.01869 |
| 4 | Yunjue Agent | https://yunjueagent.com/ |
| 5 | MICRO-ACT (ACL 2025) | https://aclanthology.org/2025.acl-long.909.pdf |
| 6 | Generative Agents | https://ar5iv.org/pdf/2304.03442 |
| 7 | MACLA | https://arxiv.org/abs/2512.18950 |
| 8 | Agentic ROI (Liu) | https://arxiv.org/abs/2505.17767 |
| 9 | Anthropic Introspection | https://transformer-circuits.pub/2025/introspection/index.html |
| 10 | PersistBench | https://arxiv.org/abs/2602.01146 |
| 11 | Capability Calibration (2026) | https://arxiv.org/abs/2602.13540 |
| 12 | SafeConf (EMNLP 2025) | https://aclanthology.org/2025.findings-emnlp.186/ |
| 13 | Clinical Confidence (2025) | https://medinform.jmir.org/2025/1/e66917 |

---

## 信息来源说明

- **[已确认事实]**：来自论文、官方文档、已验证 GitHub 仓库
- **[推测/建议]**：基于已确认事实的分析推断，适用于 Cat Café 特定场景
- **[⚠️ 需校准]**：方向可信但精确数据未独立验证（如 Stacklok 百分比）
- **[❌ 不可引用]**：无法在一手来源中验证（如 36.9% 对齐失败率）
**Round 1（基础设施层）**：
- Claude.ai：`claude-ai-report.md`（30,129 chars, 498 sources）
- ChatGPT：`chatgpt-report.md`（202 lines, 436 searches, 39 citations）
- Gemini：`gemini-report.md`（30K chars, 53 citations）
- GPT Pro 进阶：`chatgpt-pro-advanced-report.md`（231 lines, 20 primary sources）
- Prompt：`research-prompt.md` + `gpt-pro-advanced-prompt.md`

**Round 2（Mode C: 经验→能力）**：
- Claude.ai：`claude-ai-report-mode-c.md`（28K chars）
- ChatGPT：`chatgpt-report-mode-c.md`（27K chars）
- Gemini：`gemini-report-mode-c.md`（70K chars, 最详尽）
- GPT Pro 进阶：`gpt-pro-advanced-report-mode-c.md`（508 lines, 10 来源验证 + 4 落地方案，**本轮最高质量可执行报告**）
- Prompt：`research-prompt-mode-c.md` + `gpt-pro-advanced-prompt-mode-c.md`

## Gemini 独特贡献（补充）

Gemini 报告提供了以下 Claude.ai 和 ChatGPT 未覆盖的独特视角：

1. **TACO 框架 (KPMG 2025)**：按功能复杂度分四级 Taskers→Automators→Collaborators→Orchestrators
2. **HAE 框架 (arxiv 2603.07496)**：三层安全治理 L1 认知自治→L2 执行自治→L3 集体自治
3. **A2UI 协议 + Cytoscape.js**：实时 Agentic Knowledge Graph 可视化方案（比 static Skill Tree 更动态）
4. **LaMer / HILA 元学习框架**：Meta-RL 让 agent 学会"何时探索、何时求助人类"
5. **Neural Cache Projection**：未来 12 个月的趋势——agent 直接共享 KV-Cache 跳过自然语言解析
6. **36.9% 跨智能体对齐失败率**：❌ GPT Pro 未能在高可信一手来源中验证，**不建议当核心论据**
