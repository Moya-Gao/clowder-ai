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
