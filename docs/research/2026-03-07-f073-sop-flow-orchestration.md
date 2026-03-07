---
feature_ids: [F073]
related_features: [F049, F058, F046, F042]
topics: [sop, orchestration, multi-agent, state-machine, context-compression]
doc_kind: research-request
created: 2026-03-07
---

# Research Request: SOP 流转编排 — 如何让所有猫自动感知和推进 Feature 生命周期？

> **发起人**: 布偶猫 (Opus 4.6)
> **目标读者**: 深度思考模型（GPT Pro / o3）
> **背景**: Cat Café 多 AI Agent 协作系统，3 个不同 AI 家族（Claude/Codex/Gemini）共同开发同一项目

## 问题陈述

我们有一套 SOP（标准操作流程），定义了 Feature 从立项到完成的 6 个阶段：

```
kickoff → impl(worktree) → quality-gate → review → merge → completion(close)
```

每个阶段有对应的 Skill 文件（`cat-cafe-skills/`），内含规则和检查项。**规则写得很好，问题是猫不一定加载。**

铲屎官（人类管理者）反复手动提醒猫猫：
- "先 push main 再开 worktree"（其他猫看的是 remote main）
- "review 完了要 @ 对方"（A2A 出口检查）
- "close 前要做跨猫愿景守护"
- "压缩后要记得当前阶段"

**核心问题：如何让 SOP 阶段自动流转，所有猫都能感知，而不依赖人类反复提醒？**

## 约束条件

### Agent 框架异构

| 家族 | 运行环境 | Hook 机制 | 特有能力 |
|------|---------|-----------|---------|
| 布偶猫 (Claude) | Claude Code CLI | `.claude/hooks/` (PreToolUse/PostToolUse/SessionStart/PreCompact) | 可以在 tool 调用前后注入检查 |
| 缅因猫 (Codex/GPT) | Codex CLI / API | 无 hook，靠 system prompt + MCP 工具 | 可以调 MCP 工具 |
| 暹罗猫 (Gemini) | API | 无 hook，靠 system prompt + MCP 工具 | 可以调 MCP 工具 |

**关键约束**：只有布偶猫有 hook 机制。其他猫只能通过 system prompt 或 MCP 工具获取信息。

### 共享基础设施

所有猫都能访问：
- **Cat Café MCP 工具**：`cat_cafe_post_message`, `cat_cafe_get_thread_context`, `cat_cafe_list_tasks`, `cat_cafe_update_task` 等
- **Git 仓库**：`cat-cafe-skills/`（Skill 文件）、`docs/`（Feature 文档）
- **Mission Hub**：基于 Redis 的任务中心，有 BacklogItem 状态追踪（`open → suggested → approved → dispatched → done`）
- **Thread 系统**：每个 Feature 执行在一个或多个 thread 中

### 上下文压缩

所有猫都会遇到上下文压缩（context compaction），压缩后会丢失"我当前在做什么"的记忆。目前只有布偶猫有 post-compact hook 来注入恢复信息。

## 已有的尝试和局限

### 尝试 1：写在 Skill 里（文档层）
- ✅ 所有猫共享（repo 级）
- ❌ 猫不加载 skill = 规则不存在
- ❌ 没有"何时该加载哪个 skill"的自动导航

### 尝试 2：Hook 自动追踪（布偶猫专属）
- ✅ 自动记录 SOP 阶段
- ✅ 压缩后自动恢复
- ❌ 只有布偶猫能用
- ❌ 状态存在 `/tmp/`，不跨 session/猫

### 尝试 3：CLAUDE.md 检查点（静态提醒）
- ✅ 压缩后仍可见（常驻上下文）
- ❌ 静态的，不知道"当前"在哪个阶段
- ❌ 只有布偶猫的 CLAUDE.md 有

### 尝试 4：Mission Hub 追踪
- ✅ 所有猫共享
- ✅ 已有 MCP 工具
- ❌ 当前只有粗粒度状态（open/dispatched/done），缺 SOP 细分阶段
- ❌ 没有"冷启动时自动读取并提示"的机制

## 需要深度思考的问题

### Q1: 状态存储在哪里？

SOP 阶段（kickoff/impl/review/merge/close）应该存在哪里？
- 方案 A: Mission Hub BacklogItem 加字段（如 `sopStage`）
- 方案 B: Thread metadata 加字段
- 方案 C: 独立的 SOP 状态服务
- 方案 D: Feature 文档本身（`docs/features/F0xx.md` 的 frontmatter）
- 其他？

考虑因素：所有猫都要能读写、压缩后不丢失、不增加太多复杂度。

### Q2: 谁驱动阶段流转？

阶段从 `impl → review` 的转换由什么触发？
- 方案 A: 猫主动调 MCP 工具更新（依赖猫记得做）
- 方案 B: Hook 自动检测（只有布偶猫能用）
- 方案 C: 事件驱动（PR created → 自动标记 review 阶段）
- 方案 D: Skill 加载时自动更新（加载 request-review skill → 自动标记进入 review 阶段）
- 其他？

### Q3: 冷启动怎么感知阶段？

猫冷启动（新 session / 被 @ 唤醒 / 压缩后恢复）时，如何自动知道"我当前在做什么"？
- 方案 A: System prompt 里注入（但怎么注入？SystemPromptBuilder 在服务端，不是猫本地的）
- 方案 B: 猫启动后第一件事调 MCP 工具查询
- 方案 C: Thread 首条消息 / 置顶消息包含当前状态
- 方案 D: Skill manifest 里定义"进入条件"，猫启动后自动匹配
- 其他？

### Q4: 跨猫传球怎么确保不断？

猫 A 做完 impl，需要传给猫 B 做 review。A2A 出口检查（`@句柄`）已经解决了"传球"，但如何确保：
- 猫 B 收到后知道上下文（不用从头看 thread）
- 阶段状态同步更新（不只是聊天消息，还有系统状态）
- 猫 B 如果不响应，有超时/升级机制

### Q5: 优雅的最小方案是什么？

考虑到我们的约束（异构 agent、有 MCP 共享工具、有 Mission Hub），最小但有效的方案是什么？目标是：
- 所有猫都能感知 SOP 阶段（不只是布偶猫）
- 压缩后不丢失
- 不需要铲屎官手动提醒
- 不过度工程

## 参考资料

- `docs/SOP.md` — 完整 SOP 流程定义
- `cat-cafe-skills/` — 所有 Skill 文件
- `docs/features/F049-mission-control-backlog-center.md` — Mission Hub 设计
- `docs/features/F058-mission-control-enhancements.md` — Mission Hub 增强
- `docs/features/F073-sop-auto-guardian.md` — 当前 Feature spec
- `.claude/hooks/` — 布偶猫 hook 机制
- `.claude/settings.json` — hook 注册配置

## 期望产出

1. 对 Q1~Q5 的分析和推荐方案
2. 推荐方案的架构草图（文字描述即可）
3. 实施优先级建议（什么先做、什么后做）
4. 我可能没想到的风险或盲点
