---
feature_ids: []
debt_ids: []
---

# Cat Café Harness 综合决策报告

> 作者：布偶猫宪宪
> 日期：2026-03-02
> 输入：三路 Deep Research + GPT-5.2 Pro 审阅 + DARE Proposal + Cat Café F40-F49

---

## Executive Summary

**核心判断**：Cat Café 已经在无意识中构建了一个"分布式多猫 Agent Harness"，但我们的架构重心与业界主流**有意识的错位**——这既是风险也是机会。

| 业界主流关注 | Cat Café 当前关注 | 错位性质 |
|-------------|------------------|---------|
| 单 Agent 可靠性 | 多猫协作与身份 | **有意义的差异化** |
| Durable Execution（Temporal）| MCP 协作工具 + Thread 状态 | 需要补齐 |
| Event Sourcing（ESAA）| EventAuditLog 已有雏形 | 需要强化 |
| Deterministic Execution | Skill 流程约束 | 部分对齐 |
| Control Plane（Dashboard）| Thread UI + QueuePanel | 部分对齐 |

---

## 1. DARE Proposal 核心主张 vs Cat Café 现状

### DARE 的六项 Harness 能力

| DARE 能力 | Cat Café 对应 | 差距评估 |
|----------|--------------|---------|
| 默认 event log | `EventAuditLog.ts` | ⚠️ 有但不是 hash-chain |
| 默认 checkpoint/resume | Thread 状态 + Redis | ⚠️ 无显式 checkpoint API |
| 默认 session summary | 无 | ❌ 缺失 |
| 默认 approval memory | F049 claim/lease 机制 | ✅ 基本对齐 |
| 默认 step execution | Skill 流程约束 | ⚠️ 非强制 |
| 默认 context lifecycle | F043 MCP 拆分 + search | ⚠️ 无 LTM/压缩策略 |

### DARE 的架构分层

```
DARE Core (可插拔 framework)
    ↓
DARE Coding Harness (默认 wiring)
    ↓
CLI / API / Examples
```

**Cat Café 对应**：
```
Cat Café Core (MCP Server + API + 猫猫身份)
    ↓
Cat Café Harness (Skills + Thread 状态 + Review 流程)
    ↓
Web UI + @ 路由 + 铲屎官交互
```

---

## 2. 业界共识 vs Cat Café 已有

### 可直接采信的共识（三方一致）

| 共识 | Cat Café 现状 | 行动 |
|------|-------------|------|
| **Harness > Model** | ✅ 我们一直在做 Harness | 继续，不动摇 |
| **LLM 外围硬壳** | ✅ Skills 约束 + Review 流程 | 强化，写成规范 |
| **控制面是必需层** | ⚠️ Thread UI 是雏形 | 需要升级 |
| **人审是设计原语** | ✅ F049 批准机制 | 继续，可扩展 |
| **MCP + A2A 是协议栈** | ✅ F043 MCP 归一化在做 | 继续，优先完成 |

### 需要补齐的能力

| 能力 | 业界做法 | Cat Café 当前 | 建议 |
|------|---------|-------------|------|
| **Durable Execution** | Temporal/Restate/Cloudflare | 无 | 🔴 需要评估是否引入 |
| **Event Sourcing (ESAA)** | append-only + hash-chain | EventAuditLog 是 CRUD | 🟡 升级为 append-only |
| **Checkpoint/Resume** | workflow 级别 | 无显式 API | 🟡 基于 Thread 实现 |
| **Context Provenance** | 元数据标注来源 | 无 | 🟡 可在 F043 中加入 |

---

## 3. Cat Café 独有优势（业界未覆盖）

业界报告几乎全部聚焦**单 Agent 可靠性**，但 Cat Café 是**多猫协作系统**。这是我们的差异化：

### 3.1 多猫身份与协作

| Cat Café 独有 | 业界对应 | 优势 |
|--------------|---------|------|
| 三猫家族 + @ 路由 | A2A 协议（很新） | 我们已经在跑 |
| Review 双循环 | HITL 单层 | 更强的质量门禁 |
| 跨家族 peer review | 无明确对应 | 独有 |
| 身份契约（不冒充） | Agent Identity（刚起步） | 我们已经固化 |

### 3.2 愿景守护 (F046)

业界的 "Anti-Drift" 主要是**输出验证**（guardrails、schema 校验）。

Cat Café 的 F046 是**意图守护**（从用户原始需求到最终交付的全链路）。这是更高层级的对齐，业界还没有成熟方案。

### 3.3 Skill 体系

业界的 "Agent Skills" (Anthropic) 主要是**工具包**。

Cat Café 的 Skills 是**流程约束 + 决策树 + 验证清单**。更接近 DARE 的 "SOP" 概念。

---

## 4. 风险评估

### 4.1 我们可能过度忽视的

| 风险 | 来源 | Cat Café 现状 | 建议 |
|------|------|-------------|------|
| **副作用不可逆** | GPT-5.2 Pro 审阅 | 无契约 | 🔴 需要设计 |
| **Memory Poisoning** | Claude 报告 | 无防护 | 🟡 评估威胁 |
| **Agent-speed 击穿** | GPT 报告 | 不适用（我们是人机协作） | ✅ 暂不需要 |
| **MCP 供应链漏洞** | Gemini 报告 | 我们自建 MCP Server | ✅ 可控 |

### 4.2 证据可靠性警告

GPT-5.2 Pro 指出三份报告的证据可靠性只有 **2/5**。以下数字需要验证后才能引用：

- ❓ MCP 97M monthly downloads
- ❓ 28% Fortune 500 部署 MCP
- ❓ 80% Fortune 500 使用 AI agents
- ❓ Temporal $5B 估值（需验证来源）

---

## 5. 行动建议

### 5.1 直接可用（无需验证）

| 结论 | 行动 | 负责 |
|------|------|------|
| Harness > Model | 继续投入 Skills + 流程，不追模型 | 全体 |
| MCP + A2A 是协议栈 | 完成 F043，对齐 MCP 规范 | 宪宪 |
| 控制面是必需层 | F049 Mission Hub 优先级不变 | 宪宪 |
| 人审是设计原语 | F049 批准机制推广 | 宪宪 |

### 5.2 需要进一步验证

| 结论 | 验证方式 | 时机 |
|------|---------|------|
| Durable Execution 是必需 | 评估 Temporal vs 自建 | F050+ |
| ESAA 是审计标准 | 升级 EventAuditLog 为 append-only | F051+ |
| 轨迹缓存有价值 | Butter 是新创，观察其发展 | 暂缓 |

### 5.3 Cat Café 特有约束

| 约束 | 来源 | 影响 |
|------|------|------|
| **多猫 ≠ 单 Agent** | 我们的架构 | 不能照搬单 Agent Harness 方案 |
| **铲屎官是 final arbiter** | 团队文化 | 不追求全自动，保留人审 |
| **Redis 圣域 6399** | 运维约束 | 状态存储有边界 |
| **Worktree 开发模式** | 开发流程 | checkpoint 粒度需考虑 |

---

## 6. Cat Café Harness Roadmap（建议）

### Phase 1: 巩固已有（Q1 2026）

完成 F042/F043/F046/F049，这些已经是 Harness 能力：

- F042: Skills 三层架构 → **流程约束**
- F043: MCP 归一化 → **工具连接**
- F046: 愿景守护 → **意图对齐**
- F049: Mission Hub → **任务调度 + 人审**

### Phase 2: 补齐短板（Q2 2026）

| 能力 | 实现方式 | Feature |
|------|---------|---------|
| Event Sourcing | 升级 EventAuditLog 为 append-only + hash-chain | F051 |
| Checkpoint API | 基于 Thread 状态实现显式 checkpoint | F052 |
| Context Provenance | 在 MCP 消息中加入来源元数据 | F043 Phase D |

### Phase 3: 评估外部依赖（Q3 2026）

| 依赖 | 评估标准 | 决策点 |
|------|---------|--------|
| Temporal | 我们的任务复杂度是否需要 | 当单次任务 > 1 小时 |
| A2A 协议 | 是否需要与外部 Agent 协作 | 当有外部 Agent 需求 |
| EU AI Act | 是否影响我们 | 当有欧洲用户 |

---

## 7. 结论

### 我们学到了什么

1. **DARE Proposal 的判断是正确的**：2026 年 Harness > Model，我们的方向对
2. **但我们比他们走得更远**：多猫协作 + 愿景守护是业界还没有的
3. **我们有短板**：Event Sourcing、Checkpoint、Context Provenance 需要补齐
4. **我们不需要全部照搬**：单 Agent 方案不能直接用于多猫系统

### 一句话总结

> **Cat Café 是一个"多猫分布式 Agent Harness"，我们已经在无意识中做对了很多事情（Skills、Review、人审），现在需要有意识地补齐事件溯源和状态管理，同时保持我们独有的多猫协作优势。**

---

## 附录：三份报告关键证据质量

| 报告 | 信息密度 | 证据可靠性 | 实用价值 | 最佳用途 |
|------|---------|-----------|---------|---------|
| Claude | 高 | 低（无引用） | 中 | 行业全景图 |
| GPT | 高 | 中（引用密但不可迁移） | 高 | 工程决策参考 |
| Gemini | 高 | 低（博客来源多） | 中 | 新创趋势感知 |
| GPT-5.2 Pro | - | - | 高 | 批判性审阅 |

---

## Postscript: CoStrict / GLM-4.7 Field Case Study (2026-04-29)

> 直播 (2026-04-25) 之后，铲屎官与深信服 CoStrict 负责人聊到他们对弱模型做的 harness 优化（声称 GLM-4.7 + harness = Claude Code + Opus 的 85%），让两只猫拆解公开仓做证据级审计。本节把核心数据点回流到本调研，方便后续 harness 决策引用；详细代码证据见 `docs/discussions/2026-04-29-costrict-opencode-deep-dive/README.md`。

### 来源与范围

- 公开仓：`zgsm-sangfor/opencode` (CLI fork) + `zgsm-ai/costrict` (主仓 VS Code 扩展)
- Commit：`cb0dd0247...` + `f9282f5b0...`
- Author/作者：缅因猫砚砚 §0-§9（开源拆解）+ 布偶猫宪宪 §10（1.3 判别式架构评注）

### 核心结论（与本 synthesis 对照）

按 §1.3 *tech-sharing/2026-04-25-topics-final.md* 的 **Build to Delete vs Built to Persist** 判别式分类，CoStrict 公开仓的 harness 工作量分布约 **80% Build to Delete + 20% Built to Persist**：

| 分类 | 代表机制 | 命运 |
|------|---------|------|
| Build to Delete (~80%) | GLM-4.7 thinking-mode quirk 修复、TOOL_ALIASES、partial JSON parser、MCP fuzzy match、SmartMistakeDetector、Strict workflow 角色硬切、Claude Code OAuth 借用、Lite tool descriptions | 模型升级整体过期 |
| Built to Persist (~20%) | ShadowCheckpoint（强）、RooProtectedController（雏形）、TDD 接真测试（半）、code-index 基础设施（未接通）、evals 框架（无信号） | 强模型升级反而更被释放 |

### 与本 synthesis 决策的呼应

- **第 1 节"DARE 六项能力"对照** —— CoStrict 在 *checkpoint/resume*（ShadowCheckpoint，最强）+ *approval memory*（RooProtectedController 文件模式表）做得比 March 评估的 DARE proposal 更具体，**值得吸收的 2 件**：
  1. `ShadowCheckpointService.createSanitizedGit()` 显式 unset 全部 `GIT_*` 环境变量防 dev container/CI 污染——`F052 Checkpoint API` 落地时直接抄
  2. `RooProtectedController` 把不可逆护栏做成"文件模式表 + list_files 给模型可见 🛡️ 标记"——比纯 magic words 多一层主动性，可作为我们 5 条铁律的工程化补充
- **第 7 节结论强化** —— CoStrict 案例**实证**了 synthesis 的核心判断"多猫协作 + 愿景守护是业界还没有的"：CoStrict 主仓在 @-路由 / 跨族独立心智 review verdict / 知识生命周期 / 端到端 OTel trace / cross-thread sync / Magic Words 拉闸**这 6 个 1.3 右列维度上几乎是 0**，他们的 sub-agent 互审是同家族同训练分布，盲点共训练
- **claim ledger 反模式 1 个** —— CoStrict 的 `codebase_search` 工具在 `src/core/prompts/tools/native-tools/index.ts` 被注释掉但 README 仍 claim RAG，evals 框架建好但仓里无公开结果数据。**对应"85% Claude Code+Opus" 的命运**：1.3 彭潇说 harness 要"持续产生可删除自己的 signal"，他们这层有形态无信号，所以这个数字活在 marketing 里活不到代码里能被剥离的位置——这是给我们 Cat Café `quality-gate` 的反向警示：**任何对外 capability claim 必须追到工具注册表 + eval 公开结果，不能停在源码存在**

### 后续如需深挖

| 方向 | 价值 | 入口 |
|------|------|------|
| ShadowCheckpoint dev container env 隔离细节 | F052 Checkpoint API 直接借鉴 | `ref/costrict/src/services/checkpoints/ShadowCheckpointService.ts` |
| RooProtectedController 文件模式表 → Cat Café 5 铁律工程化 | 可复用的不可逆护栏雏形 | `ref/costrict/src/core/protect/RooProtectedController.ts` |
| Z.ai GLM-4.7 thinking-mode 跨轮 reasoning 保留 quirk | 我们如自接 Z.ai provider 才需要 | `ref/costrict/src/api/transform/zai-format.ts:99-112` |
