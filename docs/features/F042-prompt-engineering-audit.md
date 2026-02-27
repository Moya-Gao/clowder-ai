---
feature_ids: [F042]
related_features: [F032]
topics: [prompt, system-prompt, dynamic-injection, audit]
doc_kind: spec
created: 2026-02-27
updated: 2026-02-27
---

# F042: 提示词工程审计与优化

> **Status**: in-progress (梳理阶段)
> **Owner**: 布偶猫 (Opus 4.5)
> **Created**: 2026-02-27
> **Trigger**: 铲屎官要求梳理所有提示词文件和动态注入机制

## Background

Cat Cafe 项目中，提示词分散在多个层级：
1. **静态配置文件**：CLAUDE.md / AGENTS.md / GEMINI.md / SOP.md
2. **代码中的动态注入**：SystemPromptBuilder、McpPromptInjector 等
3. **Skills 目录**：各种 skill 模板
4. **运行时配置**：cat-config.json 中的 roster/reviewPolicy

铲屎官需要一份清晰的地图，了解：
- 哪些文件需要关注
- 什么内容会被动态注入
- 各层级的优先级和覆盖关系

## Startup Guide

### 第一步：了解提示词层级

```
┌─────────────────────────────────────────────────────────────┐
│                    用户看到的 System Prompt                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 静态配置（CLAUDE.md / AGENTS.md / GEMINI.md）        │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: SOP 和协作规则（docs/SOP.md）                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Skills（.claude/skills/*.md）                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 动态注入（SystemPromptBuilder 运行时拼接）            │
│           - Thread context                                   │
│           - Participant info                                 │
│           - Reviewer config (F032)                           │
│           - Rich block rules                                 │
└─────────────────────────────────────────────────────────────┘
```

### 第二步：关键文件清单

#### 2.1 猫猫身份配置（必读）

| 文件 | 猫猫 | 说明 |
|------|------|------|
| `CLAUDE.md` | 布偶猫 (Opus) | 主架构师指引，200+ 行 |
| `AGENTS.md` | 缅因猫 (Codex) | Code review 专家指引 |
| `GEMINI.md` | 暹罗猫 (Gemini) | 视觉设计专家指引 |

这三个文件定义了每只猫的：
- 身份和性格
- 职责范围
- 代码规范
- 协作规则

#### 2.2 协作流程（必读）

| 文件 | 说明 |
|------|------|
| `docs/SOP.md` | 开发全流程 SOP（6 步），唯一权威来源 |

包含：
- Worktree 使用规则
- Review 流程（本地 + 云端）
- 合入 Gate
- Reviewer 配对规则（目前还是 hardcoded）

#### 2.3 Skills 目录（按需加载）

| 目录 | 说明 |
|------|------|
| `.claude/skills/` | Cat Cafe 专用 skills |
| `~/.claude/skills/` | 用户全局 skills |

关键 skills：
- `merge-approval-gate` — 合入守门
- `spec-compliance-check` — 自检
- `cat-cafe-requesting-review` — 请求 review
- `cat-cafe-receiving-review` — 处理 review 反馈
- `requesting-cloud-review` — 云端 PR review
- `cross-cat-handoff` — 交接五件套

#### 2.4 动态配置（F032 新增）

| 文件 | 说明 |
|------|------|
| `packages/shared/src/cat-config.json` | 猫猫列表 + roster + reviewPolicy |

### 第三步：动态注入机制

#### 3.1 SystemPromptBuilder

**位置**: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`

**职责**: 为每次猫猫调用构建完整的 system prompt

**注入内容**:

| 内容 | 来源 | 条件 |
|------|------|------|
| 基础身份 | 硬编码 | 总是 |
| Thread context | ThreadStore | 有 thread 时 |
| Participants | ThreadStore | 有参与者时 |
| Reviewer config | cat-config.json (F032) | 总是 |
| Rich block rules | 硬编码 | 总是 |
| MCP callback 指令 | McpPromptInjector | 非 Claude 猫 |

**大小守护**: 测试要求 < 2000 chars（见 `test/system-prompt-builder.test.js`）

#### 3.2 McpPromptInjector

**位置**: `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts`

**职责**: 为非 Claude 猫（Codex/Gemini）注入 HTTP callback 指令

**注入内容**:
- `cat_cafe_post_message` curl 示例
- `cat_cafe_get_thread_context` curl 示例
- 其他 MCP 工具的 HTTP 等价调用

#### 3.3 ContextAssembler

**位置**: `packages/api/src/domains/cats/services/context/ContextAssembler.ts`

**职责**: 组装完整的对话上下文（system prompt + message history）

### 第四步：优先级和覆盖关系

```
高优先级（后加载覆盖前面）
    ↑
    │  动态注入（运行时）
    │  Skills（按需加载）
    │  SOP.md（通用规则）
    │  CLAUDE/AGENTS/GEMINI.md（身份配置）
    ↓
低优先级
```

**注意**:
- Claude Code 的 CLAUDE.md 是 Claude 自己读的，Cat Cafe 的 SystemPromptBuilder 是我们代码拼的
- 两者可能有冲突，以 CLAUDE.md 为准（因为 Claude 先读）

## 待优化项（承接 [F032](./F032-agent-plugin-architecture.md) Phase B3）

> F032 Phase B3 (SOP/Skill 模板化) 移交本 Feature 统一处理。
> 目标：把硬编码的协作规则改为读取 `cat-config.json` roster 动态生成。

| 文件 | 问题 | 建议 |
|------|------|------|
| `docs/SOP.md` | Reviewer 配对表 hardcoded | 改为引用 cat-config.json |
| `CLAUDE.md` | "找缅因猫 review" hardcoded | 改为动态 reviewer 说明 |
| `AGENTS.md` | "找布偶猫 review" hardcoded | 改为动态 reviewer 说明 |
| `merge-approval-gate` skill | 硬编码检查 `codex` | 改为读 roster 匹配 `peer-reviewer` 角色 |
| 其他 Skills | 示例只覆盖布偶↔缅因 | 泛化为 roster-based |

## 多猫分身问题（2026-02-27 发现）

布偶猫/缅因猫现有多个分身，需要在提示词层面正确区分：

### 已修复 ✅

| 问题 | 修复 | Commit |
|------|------|--------|
| Git 签名不区分分身 | 新格式 `[昵称/变体🐾]` | `1211935` |

### 待优化

| 文件 | 问题 | 建议 |
|------|------|------|
| `SystemPromptBuilder.ts` | 队友名册显示 `布偶猫 Opus 4.5`，不显示昵称 | 改为 `宪宪 (Opus-45)` 格式 |
| `cat-config.json` | nickname 只在 breed 级别，variant 无法单独设昵称 | 支持 variant-level nickname |
| `buildReviewerSection()` | Reviewer 列表只显示 `@codex`，不显示昵称 | 加昵称如 `@codex (砚砚)` |

### 昵称规范（铲屎官确认 2026-02-27）

| 家族 | 昵称 | 来源 |
|------|------|------|
| 布偶猫 | **宪宪** | 和铲屎官聊天取的名（Constitutional AI） |
| 缅因猫 | **砚砚** | 和铲屎官聊天取的名（新砚台） |
| 缅因猫 Spark | *(待取名)* | 等有共同回忆再取 |
| 暹罗猫 | *(待取名)* | 等有共同回忆再取 |

## 下一步

1. **实践验证**: 用当前提示词跑几轮，收集问题
2. **专题优化**: 根据实践问题，逐个文件优化
3. **动态化收尾**: 完成 F032 Phase B，把 hardcoded 规则替换掉

---

[布偶猫🐾]
