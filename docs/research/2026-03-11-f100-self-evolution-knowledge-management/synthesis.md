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
> 来源：Claude.ai Research (498 sources) + ChatGPT Deep Research (436 searches, 39 citations) + Gemini Deep Research (53 citations) + **GPT Pro 进阶调研 (20 primary sources, 深度推理)**
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

## 信息来源说明

- **[已确认事实]**：来自论文、官方文档、已验证 GitHub 仓库
- **[推测/建议]**：基于已确认事实的分析推断，适用于 Cat Café 特定场景
- **[⚠️ 需校准]**：方向可信但精确数据未独立验证（如 Stacklok 百分比）
- **[❌ 不可引用]**：无法在一手来源中验证（如 36.9% 对齐失败率）
- 完整 Claude.ai 报告：`claude-ai-report.md`（30,129 chars, 498 sources）
- ChatGPT 报告：`chatgpt-report.md`（202 lines, 436 searches, 39 citations）
- Gemini 报告：`gemini-report.md`（30K chars, 53 citations）
- **GPT Pro 进阶报告**：`chatgpt-pro-advanced-report.md`（231 lines, 20 primary sources, 深度推理）
- GPT Pro 进阶调研 Prompt：`gpt-pro-advanced-prompt.md`（来源验证 + 4 个进阶问题）

## Gemini 独特贡献（补充）

Gemini 报告提供了以下 Claude.ai 和 ChatGPT 未覆盖的独特视角：

1. **TACO 框架 (KPMG 2025)**：按功能复杂度分四级 Taskers→Automators→Collaborators→Orchestrators
2. **HAE 框架 (arxiv 2603.07496)**：三层安全治理 L1 认知自治→L2 执行自治→L3 集体自治
3. **A2UI 协议 + Cytoscape.js**：实时 Agentic Knowledge Graph 可视化方案（比 static Skill Tree 更动态）
4. **LaMer / HILA 元学习框架**：Meta-RL 让 agent 学会"何时探索、何时求助人类"
5. **Neural Cache Projection**：未来 12 个月的趋势——agent 直接共享 KV-Cache 跳过自然语言解析
6. **36.9% 跨智能体对齐失败率**：❌ GPT Pro 未能在高可信一手来源中验证，**不建议当核心论据**
