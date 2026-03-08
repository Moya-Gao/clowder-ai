---
feature_ids: [F059]
related_features: []
topics: [open-source, governance, community]
doc_kind: feature-spec
created: 2026-03-04
---

# F059: Cat Café 开源计划

> **Status**: spec
> **Owner**: 布偶猫
> **Priority**: P2
> **Target**: 2026-03-30（铲屎官定）

## 愿景

> **一句话**：把 Cat Café 的通用架构能力开源，但保护核心资产和隐私。

### 铲屎官原话（2026-03-04）

> "我们的代码仓其实不能开源？以后开源要和教程仓那样精挑细选同步？"
> "330 开源如何？"

## Why

Cat Café 的架构能力（多 Agent 协作、MCP 集成、CLI 子进程调度）有通用价值，但主仓包含大量敏感内容不能直接公开。

## What

### 需要保护的资产（不开源）

| 资产 | 位置 | 风险 |
|------|------|------|
| 铲屎官个人信息/对话 | `docs/` 讨论记录、mailbox | 隐私 |
| 三猫内部决策过程 | `docs/features/`、`docs/decisions/` | 策略暴露 |
| 设计资产 | `designs/*.pen`、Pencil 打样 | 知识产权 |
| 部署配置 | `cat-config.json`、MCP 配置 | 安全 |
| Git 历史 | 所有 commit message 含内部讨论 | 即使删文件历史还在 |
| 猫猫故事/文化 | `docs/stories/` | 个人创作 |

### 可以开源的能力

| 能力 | 对应代码 | 价值 |
|------|---------|------|
| 多 Agent CLI 子进程调度 | AgentRouter / spawn 层 | 多 LLM 协作框架 |
| MCP callback 回传机制 | McpPromptInjector / callbacks | 非 Claude Agent 的 MCP 集成 |
| A2A mention 路由 | a2a-mentions / route-serial | Agent 间通信协议 |
| Invocation 状态机 | invocation-state-machine | Agent 生命周期管理 |
| Thread/消息存储 | MessageStore / ThreadStore | 多线程对话持久化 |
| Skills 框架 | skill manifest + 路由 | 按需加载 prompt 系统 |
| 防腐化工具链 | check-dir-size / dependency-cruiser | 代码质量门禁 |
| 前端 Hub UI | React + Tailwind 组件 | 多 Agent 聊天 UI |

### 开源策略

1. **主仓（cat-cafe）保持私有** — 工作室仓，包含全部资产
2. **开源仓独立建** — 新 repo，精挑细选同步
3. **同步方式**：脚本过滤（strip 敏感内容）+ 手动 cherry-pick
4. **License**：**MIT**（铲屎官拍板 2026-03-07）

### 开源版铁律（Agent 安全约束）

> 铲屎官原话（2026-03-07）："猫猫咖啡的 redis 等不能动，不然开源的猫猫干着干着把自己老家端了"

开源版 Agent MD（CLAUDE.md / AGENTS.md / GEMINI.md）必须内置以下硬约束，防止 agent 破坏自身运行环境：

1. **数据存储圣域** — Agent 不得删除/清空自己的 Redis 数据库、SQLite 文件或任何持久化存储。测试用临时实例，生产实例只读不删。
2. **进程自保** — Agent 不得 kill 自己的父进程、不得修改自己的启动配置使自己无法重启。
3. **配置不可变** — Agent 运行时不得修改 `cat-config.json`、`.env`、MCP 配置等运行时配置文件。配置变更必须通过人类操作。
4. **网络边界** — Agent 不得访问 localhost 上非自己的服务端口（防止跨 agent 干扰）。

这些铁律要同时体现在：
- [ ] 开源版 Agent MD（prompt 层约束）
- [ ] 代码层防护（关键操作前检查，如 `FLUSHDB` 拦截）
- [ ] README 安全说明

### 商用许可说明

| 选项 | 商用 | 条件 | 适合场景 |
|------|------|------|---------|
| MIT | 允许闭源商用 | 保留版权声明 | 最大传播 |
| Apache-2.0 | 允许闭源商用 | 保留版权+NOTICE+标注修改+专利授权 | 社区框架（推荐） |
| AGPL-3.0 | 允许但必须开源 | 修改后代码必须公开（含 SaaS） | 防白嫖 |

**待铲屎官拍板**：是否允许商用闭源？

### 开源前的准备工作

- [ ] 梳理代码模块边界，确认哪些可以独立抽取
- [ ] 编写 strip 脚本：从主仓导出时自动去除敏感路径/内容
- [ ] 去除硬编码的用户信息（userId、threadId 等）
- [ ] 编写开源版 README、架构文档、贡献指南
- [ ] 三猫通用版 Agent MD：CLAUDE.md + AGENTS.md + GEMINI.md（去掉内部规则/铁律/个人偏好，保留架构说明和协作约定）
- [ ] 确认 License
- [ ] 补充必要的注释和 JSDoc（开源代码需要比内部代码更多的文档）
- [ ] 确认 CI/CD：开源仓的测试需要独立跑通（不依赖私有 Redis 等）

## Acceptance Criteria

- [ ] AC-1: 开源仓可独立 clone + install + 基础功能运行
- [ ] AC-2: 开源仓不包含任何铲屎官个人信息/内部讨论
- [ ] AC-3: 主仓 → 开源仓的同步脚本可重复执行
- [ ] AC-4: README 包含架构说明 + Quick Start + 贡献指南

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 开源粒度：整个 Cat Café 框架 vs 拆成多个小包？ | 待讨论 |
| OQ-2 | License 选择 | **决定：MIT（铲屎官拍板 2026-03-07）** |
| OQ-3 | 是否保留"猫猫"品牌/命名？ | 待讨论 |
| OQ-4 | 开源后社区治理模型 | 待讨论 |
| OQ-5 | 教程仓和开源仓的关系 | 待讨论 |

## Dependencies

- 无硬依赖，但 F056（设计语言）完成后 UI 组件更稳定，开源质量更高

## Risk

| 风险 | 缓解 |
|------|------|
| 敏感信息泄露 | strip 脚本 + 人工 review（至少两猫交叉检查） |
| 开源后维护负担 | 先小范围（核心框架），不一步开源全部 |
| 内部开发被开源仓拖慢 | 单向同步（主仓→开源仓），不接受开源仓反向 PR |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-04 | 铲屎官提出开源需求，目标 3/30 |
| 2026-03-04 | F059 立项，初步梳理可开源/不可开源边界 |
