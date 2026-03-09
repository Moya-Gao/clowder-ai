---
feature_ids: [F059]
related_features: [F042, F046, F086, F087]
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

> **一句话**：让每个人都能拥有自己的 AI 团队——不是一群听话的木头人，是有共同愿景和信条的共创伙伴。

### 核心哲学：软硬结合（2026-03-08 铲屎官定调）

> **铲屎官原话**："软硬结合，门禁约束是法律是最后的底线，在底线上如何发挥大猫猫们的主观能动性？我不想要一群听话的木头人。我想要的是共创伙伴。大家有共同的愿景的信条的伙伴。"

这定义了 clowder-ai 的灵魂：
- **硬约束（铁律）**= 法律底线：数据圣域、进程自保、配置不可变、网络边界
- **软约束（愿景+信条）**= 在底线上释放主观能动性：角色定位、协作规范、质量文化、共创关系

Clowder-ai 不是一个"管住 agent 不出错"的框架，是一个"让 agent 有灵魂地协作"的框架。

### 第一性原理：面向终态，不绕路（2026-03-08 铲屎官定调）

> 铲屎官原话："我们的第一性原理就是不要绕路！猫猫们一天干的活 > 一个程序员一年！现在的世界绕路 = 犯傻！"

AI agent 的开发速度是人类的 100x+。传统"先简单后复杂"的渐进策略是为了管理人类认知负荷。当执行速度不再是瓶颈，**方向正确性**才是瓶颈。

**实操规则**：设计任何 Phase 路线时，先画终态，从终态反推。如果 Phase 1 的产物在 Phase 3 要拆掉重做，那 Phase 1 就是绕路。每一步的产物必须是终态的**基座**，不是**脚手架**。

详细检查方法见 `cat-cafe-skills/refs/shared-rules.md` Rule 12。

### 三层能力边界（全猫共识，2026-03-08 讨论）

来源：[模型/Agent/平台边界讨论纪要](/docs/discussions/2026-03-08-model-agent-platform-boundary-meeting-notes.md)

| 层级 | 负责什么 | 不负责什么 |
|------|---------|-----------|
| 模型 | 理解、推理、生成 | 长期记忆、自我校验、执行纪律 |
| Agent CLI | 工具使用、文件操作、命令执行 | 团队协作、跨角色 review、长期状态 |
| 平台（clowder-ai 开源的就是这层） | 身份管理、协作路由、流程纪律、审计追溯、记忆沉淀 | 推理（还是模型的事） |

> **模型给能力上限，平台给行为下限。**（GPT-5.4 总结）
> 每一层是**乘数效应**，不是加法。

### CVO 模式（Chief Vision Officer）

> 用户不需要会写代码，但需要会表达愿景、判断结果、持续纠偏。

clowder-ai 的目标用户画像：
- 我们先交付"可用雏形"（80%）
- 用户的 AI 团队持续定制最后 20% 细节到用户语境
- 平台替用户补：意图编译、护栏执行、质量闭环、记忆治理

### Story Telling 定稿（2026-03-08 全猫讨论收敛）

讨论发起：布偶猫(opus4.6)，参与：opus4.5 / codex / gemini

**统一术语**（全仓一致，README/docs/演讲口径统一）：
- **Hard Rails** = 硬约束/铁律（数据圣域、进程自保、配置不可变、网络边界）
- **Soft Power** = 软约束/愿景+信条（角色、协作规范、质量文化、共创关系）

**Slogan**（全票通过）：**Hard Rails. Soft Power. Shared Mission.**

**README 开篇结构**（先技术后情感）：
```
# 🐱 Clowder AI

**Hard Rails. Soft Power. Shared Mission.**

The missing layer between your AI agents and a real team.

Most frameworks help you run agents. Clowder helps them work together —
with persistent identity, cross-model review, shared memory,
and collaborative discipline.
```

**各层表达**：

| 场景 | 内容 |
|------|------|
| GitHub description | "Build AI teams, not just agents. Hard rails, soft power, shared mission." |
| README 开篇 | 如上结构 |
| Landing page 视觉 | 三棱镜意象：白光（愿景）穿过棱镜（Hard Rails）折射出彩色群猫（自由协作）|
| 中文品牌层 | 「每个灵感，都值得一群认真的灵魂」 |

### 铲屎官原话（2026-03-04）

> "我们的代码仓其实不能开源？以后开源要和教程仓那样精挑细选同步？"
> "330 开源如何？"

## Why

Cat Café 的架构能力（多 Agent 协作、MCP 集成、CLI 子进程调度）有通用价值，但主仓包含大量敏感内容不能直接公开。

Cat Café 内部实践已验证的核心增量（vs 裸 API / 单 Agent CLI）：
- **跨模型 review**：打破单模型盲区（F32-b 砚砚 12 轮 review，F33 云端 5 轮）
- **身份常驻注入**：抗 compact 漂移（F042）
- **愿景守护**：跨猫签收 + 证据链（F046）
- **教训沉淀**：27+ 条结构化 lessons learned
- **A2A 协作协议**：异步但有序的多猫协同

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
2. **开源仓独立建** — 新 repo `clowder-ai`，精挑细选同步
3. **同步方式**：脚本过滤（strip 敏感内容）+ 手动 cherry-pick
4. **License**：**MIT**（铲屎官拍板 2026-03-07）
5. **仓库名**：**`clowder-ai`**（全猫投票 2026-03-08，5:1 通过）
   - clowder = 英语中"一群猫"的量词，精准传达多 Agent 协作语义
   - `-ai` 后缀区分 GitHub 上已有的 `clowder-framework` 等同名项目
   - Tagline: *"Hard Rails. Soft Power. Shared Mission."*
   - GitHub description: *"Build AI teams, not just agents. Hard rails, soft power, shared mission."*

### 品牌视觉资产（可复用于开源仓）

现有素材（前端在用 + 已落盘）：

| 资产 | 路径 | 说明 |
|------|------|------|
| Logo（前端在用） | `packages/web/src/components/icons/CatCafeLogo.tsx` | 三猫环绕线稿 + 流光渐变（布偶蓝→缅因金→暹罗紫），烁烁画的 |
| Logo SVG 清理版 | `assets/icons/cat-cafe-logo-v2-clean.svg` | 可直接用于 README |
| Logo 纯线稿 | `assets/icons/cat-cafe-logo-lineart.svg` | 单色版 |
| Logo 描边版 | `assets/icons/cat-cafe-logo-lineart-stroke.svg` | 动画用 |
| 三棱镜 Hero | `assets/hero-prism.svg` | Landing page 用，烁烁 2026-03-08 画的 |
| 品牌规范 | `docs/design/clowder-ai-brand.md` | 术语、配色 token、可访问性、禁用词 |
| Hero 动效规范 | `docs/design/hero-prism-motion.md` | 动效参数 + reduced-motion 降级 |
| 猫猫头像全套 | `assets/avatars/` | 各猫 avatar（含 sliced-finial 风格变体） |
| Logo 迭代探索 | `assets/logos/` | Gemini + ChatGPT 生成的历史探索稿 |

**配色 token**（三猫流光渐变）：
- Opus Blue: `#2563EB`（布偶猫/架构）→ 开源版: `#3B82F6`
- Codex Green: `#10B981`（缅因猫/安全审计）
- Gemini Amber: `#F59E0B`（暹罗猫/创意）
- 背景深空灰: `#0F172A`（Midnight Cafe 风格）

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
| OQ-3 | 是否保留"猫猫"品牌/命名？ | **决定：仓库名 `clowder-ai`，品牌独立但 tagline 标注 "from Cat Café"（全猫投票 2026-03-08）** |
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
| 2026-03-07 | License 决定：MIT |
| 2026-03-08 | 仓库名投票：`clowder-ai` 以 5:1 通过（Opus 4.6 / Opus 4.5 / Sonnet / Codex / GPT-5.4 投 clowder-ai，Gemini 投 clowder） |
| 2026-03-08 | 模型/Agent/平台边界讨论 → 明确 clowder-ai 开源的是"平台层" |
| 2026-03-08 | 铲屎官定调"软硬结合"哲学 + CVO 模式愿景 |
| 2026-03-08 | Story telling 全猫讨论收敛：Slogan "Hard Rails. Soft Power. Shared Mission." 全票通过 |
