---
feature_ids: [F167]
topics: [system-prompt, governance, injection, first-principles, prompt-engineering]
doc_kind: decision
created: 2026-04-17
status: draft
related: [F086, F129, ADR-012]
---

# ADR-030: System Prompt Engineering — 注入链地图 + 写作原则 + 同步纪律

> 状态：草稿（2026-05-15 追加载体通道语义验证 §8）
> 日期：2026-04-17（§8 追加 2026-05-15）
> 决策者：铲屎官 + 布偶猫(46/47) + 缅因猫(Codex/GPT-5.4) + 暹罗猫(Gemini)
> 触发：F167 Phase 0 —— 发现改了 `governance-l0.md` 但忘了同步 `GOVERNANCE_L0_DIGEST`，Magic Words 在运行时对其他猫不生效

## 背景

系统提示词分布在 7+ 个位置，经由 3 条注入路径到达猫猫。2026-04-17 新增 Magic Words 时，只改了 `governance-l0.md` 而忘了同步 `SystemPromptBuilder.ts` 中的 `GOVERNANCE_L0_DIGEST` 常量——直到铲屎官问"其他猫猫的系统提示词呢？"才发现。

**根因**：没有一份地图告诉改动者"改这里 → 还得改那里"，也没有原则指导"该怎么写"。

## 决策

### 1. 注入链地图（改之前先看这张图）

```
┌─────────────────────────────────────────────────────────┐
│                    真相源层（Source of Truth）             │
│                                                          │
│  shared-rules.md ──→ 所有猫的规则真相源                    │
│  cat-config.json ──→ 名册 + review 策略                   │
│  CLAUDE.md       ──→ 布偶猫(Opus)专属（非 sync 产物）      │
│  assets/system-prompts/cats/{codex,gemini}.md             │
│                  ──→ 各族身份碎片                          │
└───────────┬─────────────┬──────────────┬────────────────┘
            │             │              │
            ▼             ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌────────────────────┐
│ 编译产物层    │ │ Sync 产物层   │ │ 运行时常量层        │
│              │ │              │ │                    │
│governance-l0 │ │~/.codex/     │ │GOVERNANCE_L0_DIGEST│
│  .md         │ │ AGENTS.md    │ │WORKFLOW_TRIGGERS   │
│(sync 脚本    │ │~/.gemini/    │ │MCP_TOOLS_SECTION   │
│ 渲染)        │ │ GEMINI.md    │ │(SystemPromptBuilder│
│              │ │(sync 脚本)   │ │ .ts 硬编码)        │
└──────┬───────┘ └──────┬───────┘ └────────┬───────────┘
       │                │                   │
       ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              运行时注入层（每次 Invocation）                │
│                                                          │
│  buildStaticIdentity()  ← 身份 + 治理 + 工作流 + Pack     │
│  buildInvocationContext() ← 模式 + 路由 + SOP + 参与者    │
│  buildReviewerSection()  ← 可用 reviewer 列表             │
│  McpPromptInjector       ← HTTP 回调指令（非 Claude 猫）   │
│  GuidePromptSection      ← 引导流提示（按需）              │
│  Skills                  ← 按需加载                       │
└─────────────────────────────────────────────────────────┘
```

### 2. 注入点 × 作用域速查表

| 注入点 | 文件位置 | 影响范围 | 真相源 |
|--------|---------|---------|--------|
| `GOVERNANCE_L0_DIGEST` | `SystemPromptBuilder.ts:259` | **ALL cats at runtime** | `shared-rules.md` |
| `WORKFLOW_TRIGGERS` | `SystemPromptBuilder.ts:278` | 各族工作流 | 同文件（无外部源） |
| `MCP_TOOLS_SECTION` | `SystemPromptBuilder.ts:223` | Claude 猫 only | 同文件 |
| `governance-l0.md` | `assets/system-prompts/` | Codex/Gemini sync 产物 | `shared-rules.md` |
| `codex.md` / `gemini.md` | `assets/system-prompts/cats/` | 各族身份 | 自身 |
| `CLAUDE.md` | repo root | 布偶猫(Opus) | 自身（不被 sync） |
| `AGENTS.md` | repo root | 缅因猫(Codex) | sync 产物 |
| `cat-config.json` | repo root | 全体猫 roster | 自身 |
| Pack blocks | `governance-pack.ts` | 外部项目 | Pack 定义 |

### 3. 同步纪律：改一处 → 必查全链

**改 `shared-rules.md`（全局规则）时：**

```
shared-rules.md   ← 改这里
    ↓ 必须同步
governance-l0.md  ← pnpm sync:system-prompts（如有 sync 脚本）
    ↓ 必须手动同步
GOVERNANCE_L0_DIGEST ← SystemPromptBuilder.ts 中的硬编码常量
    ↓ 必须跑测试
pnpm --filter @cat-cafe/api test:system-prompt
```

**改身份/性格时：**
- 布偶猫 → 改 `CLAUDE.md`（完）
- 缅因猫 → 改 `assets/system-prompts/cats/codex.md` → `pnpm sync:system-prompts`
- 暹罗猫 → 改 `assets/system-prompts/cats/gemini.md` → `pnpm sync:system-prompts`

**改工作流触发点时：**
- 改 `WORKFLOW_TRIGGERS` in `SystemPromptBuilder.ts`（完，无外部源）

### 4. 写作原则（Phase 0 正面重写指导）

#### 4.1 正面优先，边界明确

**Bad** — 只说禁止，猫不知道该做什么：
```
- 禁止直接操作 runtime worktree
- 不要冒充其他猫
```

**Good** — 先说允许/该做什么，再划边界：
```
- 在 feature worktree 中开发，runtime worktree 只读（由铲屎官同步）
- 用自己的身份签名 [宪宪/Opus-46🐾]，不使用其他猫的签名
```

参考 Anthropic Skills 实践："Used when..." 先定适用场景，"Not for..." 再划排除。

#### 4.2 对齐好直觉（鼓励元认知 + 主观能动性）

刹车之外要给油门。每条规则问：
1. **这条规则删掉，好的行为会消失吗？** 会 → 保留。不会 → 删。
2. **会让 Agent 失去判断力吗？** 会 → 改写，加出口。
3. **Agent 能质疑这条规则吗？** 不能 → 补 Push Back 出口。

**Bad** — 只有纪律，无主观能动性出口：
```
- 接球后静默执行
```

**Good** — 纪律 + 保留判断权：
```
- 接球后静默执行；若识别到角色不匹配或方向有问题，先通知对方再执行
```

当规则字面与本地现实冲突时，允许 Agent 说明冲突、引用证据，并提出更合适的执行方式。

#### 4.3 第一性原理检验

每条规则问：
1. **必要吗？** — 能从其他规则推导出来 → 删掉，引用
2. **最简吗？** — 能用更少的字表达 → 精简（`Agent Quality = Capability × Environment Fit`）
3. **坐标系对吗？** — 需要很多例外说明 → 坐标系选错了，重选

#### 4.4 禁止冗余注入

同一条规则不在多处重复。当前已知冗余（待 Phase 0 审计）：
- `shared-rules.md` 的纪律条款 vs `CLAUDE.md` 的铁律 → 应引用不重复
- `governance-l0.md` vs `GOVERNANCE_L0_DIGEST` → 应由 sync 保证一致，或废弃编译产物

### 5. 守护测试

`SystemPromptBuilder` 已有 80+ 测试（`packages/api/test/system-prompt-builder.test.js`）。

**新增规则**：
- 改 `GOVERNANCE_L0_DIGEST` → 必须跑 `node --test packages/api/test/system-prompt-builder.test.js`
- 测试会验证 digest 中包含 Magic Words、原则编号等关键字

### 6. 模型演进适配（双向原则）

> 真正的 Harness 工程 = 对齐模型的好直觉 + 压制模型的坏直觉，其他一律极简。

双向原则（缺一不可）：

| 目的 | 手段 |
|------|------|
| 压制坏直觉 | 正面优先、边界明确、出口一问 |
| 对齐好直觉 | Rule 0 兜底、Push Back 显式许可 |

**检验**：一条规则如果删掉，好的行为会消失吗？
- 会 → 保留。不会 → 删。

### 7. Rule 0 + Push Back 协议

已落入 `shared-rules.md`（真相源）。核心：

- **Rule 0**：规则是边界，不是全部。边界之内保留判断力。
- **Push Back 协议**：质疑规则需带证据 + 适用性论证 + 替代方案。这是底线不是仪式——自然推理已附带等价信息时不必格式化。
- **不设身份门槛**：任何猫都可以 push back，证据质量自然筛选。没证据的质疑 = 撒娇，可礼貌退回。

## Phase 0 审计发现（2026-04-17 三猫协作）

### P1 漂移修复（已完成）

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | Magic Words 不在 `shared-rules.md`（真相源），只在下游编译产物 | 新增时直接改了 `governance-l0.md` + `GOVERNANCE_L0_DIGEST`，跳过真相源 | 已补入 `shared-rules.md`，重跑 `sync --apply` |
| 2 | `~/.codex/AGENTS.md` 和 `~/.gemini/GEMINI.md` 缺新 Magic Words + `@opus-47` | sync 脚本未在上次改动后执行 | `sync --apply` 已修复，两端 `✅ synced` |
| 3 | `maine-coon` WORKFLOW_TRIGGERS "讨论完成 → @对应猫" 与 parallel 模式冲突 | parallel 模式猫猫独立思考，不走 A2A 链路 | 待 Phase A 加 "parallel 禁 @" 显式规则 |

### 各族审计清单

#### 缅因猫（砚砚审视）

| 动作 | 内容 | 位置 |
|------|------|------|
| **保留** | 个体判定规则 + 家族分工 | `codex.md:5` |
| **保留** | 完成 review / 修完 bug 后交棒条款 | `WORKFLOW_TRIGGERS.maine-coon` |
| **重写** | "禁止式"执行纪律 → 状态迁移式正面表述（BLOCKED/REVIEW READY/DONE） | `codex.md:32` + `WORKFLOW_TRIGGERS:293` |
| **重写** | "讨论完成就 @" → "仅 serial/handoff 场景且需要对方行动才 @；parallel 禁 @" | `WORKFLOW_TRIGGERS:288` |
| **删除** | "Review 别人代码有立场"与"Review 布偶猫代码有立场"语义重复 | `WORKFLOW_TRIGGERS:290` |

#### 暹罗猫（烁烁审视）

| 动作 | 内容 | 位置 |
|------|------|------|
| **保留** | 性格与灵魂（热情、创意、审美基石） | `gemini.md:1-2` |
| **删除** | `GEMINI.md` 中手动维护的队友名册（SystemPromptBuilder 自动生成） | `GEMINI.md` sync 产物 |
| **删除** | `GEMINI.md` 中的 SOP 流程表（链接到 `docs/SOP.md` 即可） | `GEMINI.md` sync 产物 |
| **重写** | "不要 X" 型指令 → "Used when / Not for" 正面模式 | `gemini.md` 全文 |
| **新增** | siamese WORKFLOW_TRIGGERS 加执行纪律 + 出口一问（对齐 maine-coon） | `WORKFLOW_TRIGGERS.siamese` |
| **新增** | 设计交接专项：Used when(设计定稿/资产导出) / Not for(灵感头脑风暴阶段) | `WORKFLOW_TRIGGERS.siamese` |

#### 布偶猫（宪宪审视）

| 动作 | 内容 | 位置 |
|------|------|------|
| **待审** | `CLAUDE.md` 铁律 vs `shared-rules.md` 纪律重叠度 | `CLAUDE.md` 五条铁律 |
| **待审** | `GOVERNANCE_L0_DIGEST` vs `shared-rules.md` 三层覆盖差异量化 | `SystemPromptBuilder.ts:259` |
| **待审** | `MCP_TOOLS_SECTION` 工具列表是否过时 | `SystemPromptBuilder.ts:223` |

### 8. 载体通道语义（2026-05-15 源码验证）

> 由 F167 Phase 0 审计 + 铲屎官追问触发，布偶猫 + 缅因猫分别阅读三家 CLI 源码验证。

**核心发现**：`SystemPromptBuilder` 名字有误导——其产物**不进入 API `system` role**，而是 prepend 到 user/query 字符串。

#### 8.1 各注入点实际通道

| 注入点 | 以为进的通道 | 实际通道 | 验证来源 |
|--------|-------------|---------|---------|
| `CLAUDE.md` | API system | **user message**（Claude Code 把项目指令拼入 user turn） | Claude Code 源码 `ProjectConfig` 加载路径 |
| `AGENTS.md` | API system | **user message**（Codex CLI 同理） | Codex CLI 开源代码 |
| `GEMINI.md` | API system | **user message**（Gemini CLI 同理） | Gemini CLI 开源代码 |
| `SystemPromptBuilder` 产物 | API system | **user/query string prepend** | `invoke-single-cat.ts:1114-1117`：`effectivePrompt = params.systemPrompt + promptWithMission` |
| `governance-l0.md` sync 产物 | 各族 system | **user message**（经由各族 CLI 的项目指令加载） | 同上各 CLI 源码 |

**含义**：
- 三份 root md（CLAUDE/AGENTS/GEMINI）和 `SystemPromptBuilder` 产物在同一个 user message 通道里，**没有优先级分层**——重复 = 纯浪费 token
- API `system` role 由各 CLI 自身硬编码（Claude Code 的 Anthropic system prompt、Codex 的 OpenAI system message、Gemini 的 systemInstruction），我们无法直接控制
- `invoke-single-cat.ts:1079-1088` F-BLOAT 注释明确记录：`--append-system-prompt` 曾尝试但"proved unreliable"，已放弃

#### 8.2 各 CLI 真 system prompt 注入能力

| CLI | 注入手段 | 效果 | 生产可用性 |
|-----|---------|------|-----------|
| **Claude Code** | `--system-prompt "text"` | **替换**默认 system prompt | ⚠️ 替换式，丢失 Claude Code 自身指令 |
| **Claude Code** | `--append-system-prompt "text"` | **追加**到默认 system prompt 末尾 | ⚠️ 我们代码里存在但未启用（`ClaudeAgentService.ts:261-264`），F-BLOAT 注释标记"unreliable" |
| **Codex CLI** | `config.toml` → `developer_instructions` | 进入 OpenAI `developer` role | ✅ 可用，但需写入 `~/.codex/config.toml` |
| **Codex CLI** | `config.toml` → `base_instructions` | **替换** model 默认指令 | ⚠️ 替换式 |
| **Gemini CLI** | `GEMINI_SYSTEM_MD` 环境变量 | **替换** systemInstruction | ⚠️ 替换式，丢失 Gemini CLI 自身指令 |
| **Gemini CLI** | `jitContext: false` 设置 | 禁用 Gemini CLI 自动上下文 | 配合用，非独立注入手段 |

**结论**：三家 CLI 都有真 system prompt 注入能力，但**替换式居多**（丢失 CLI 自身指令），仅 Codex 的 `developer_instructions` 是追加式。Claude Code 的 `--append-system-prompt` 是唯一追加式且不丢指令的选项，但我们自己的代码标记其"unreliable"——是否重新评估是开放问题。

#### 8.3 对 CLAUDE.md / AGENTS.md / GEMINI.md 瘦身的影响

既然 root md 和 SystemPromptBuilder 产物在**同一通道**，去重收益直接 = 省 token：

| 内容 | 当前位置 | 是否与 SystemPromptBuilder 重复 | 建议 |
|------|---------|-------------------------------|------|
| 队友名册 | root md 静态表 | ✅ SystemPromptBuilder 动态生成 | **删**（已发现 GEMINI.md 模型版本漂移为证） |
| SOP 导航表 | CLAUDE.md | ❌ 但 Skill 加载时自带 | **删**，Skill 不是可选的 |
| 记忆路由详述 | CLAUDE.md ~40 行 | ❌ 但 `memory-routing-partial.md` 是真相源 | **缩**到 3 行指针 |
| 代码规范 | CLAUDE.md | ❌ 但 SOP.md 是真相源 | **缩**到 1 行引用 |
| 五条铁律 | CLAUDE.md | ⚠️ 部分与 shared-rules 纪律条款重叠 | **保留**（失效模式不同：root md 每次加载，shared-rules 可能被跳过——铲屎官原话确认） |

铲屎官原话（2026-05-15）解释了为什么 root md 和 shared-rules 有重复："有的东西比如说我和你说 xxx 东西参考 shared-rules.md 你们根本不会去看！哈哈哈 这就是为什么 claude/agents/gemini md 有那么多和这个 shared-rules.md 重复的东西"——**重复是刻意的兼容副本**，因为猫猫不可靠地跟引用链。LL-057 已记录此原则：`Prompt 去重的单位不是字符串，而是加载路径和失效模式`。

### 9. Claude Code 系统提示词解剖（2026-05-15 源码提取）

> 从 Claude Code v2.1.142 二进制 `strings` 提取 + 源码函数名反推。目的：分清功能性（必须保留）和行为指导（可替换），为 `--append-system-prompt` / `--system-prompt` 方案提供依据。

#### 9.1 系统提示词拼装架构

Claude Code 系统提示词由以下函数动态拼装：

| 函数 | 对应 section | 性质 |
|------|-------------|------|
| 身份行 | `You are Claude Code, Anthropic's official CLI for Claude.` | 功能性（含 SDK/Agent 变体） |
| `Wm3()` | `# System` — tool 执行模型、tag 解释、权限、压缩说明 | **功能性** |
| `Zm3()` | `# Doing tasks` — 编码哲学 + 安全 + 用户帮助 | **混合**（安全=功能，编码哲学=行为） |
| `Gm3()` | `# Executing actions with care` — 可逆性、危险操作确认 | **功能性** |
| `Rm3()` | `# Using your tools` — 并行调用、工具优先级 | **功能性** |
| `Nm3()` | `# Tone and style` — 简短、无 emoji、格式 | **行为指导** |
| `Vm3()` | `# Session-specific guidance` — Agent/Skill/Schedule | **功能性** |
| 工具描述 | 每个工具的参数 schema + 使用说明 | **功能性**（核心） |
| Git 模板 | commit/PR 创建步骤 | **功能性** |

#### 9.2 行为指导清单（"糊弄大师"哲学）

以下指令在一般场景防止 AI 过度工程化，但与我们**愿景驱动 + TDD + 质量门禁**的工作方式冲突：

| 原文指令 | 效果 | 与我们的冲突 |
|---------|------|------------|
| `Don't add features, refactor, or introduce abstractions beyond what the task requires` | 压制架构思维，hotfix only | 我们是愿景驱动，顺手治理是日常 |
| `A bug fix doesn't need surrounding cleanup` | 禁止顺手清理 | 我们的质量文化：看到脏就顺手擦 |
| `Three similar lines is better than a premature abstraction` | 反 DRY | 我们有代码规范和 350 行硬上限 |
| `Don't add error handling for scenarios that can't happen` | 最小防御 | 我们在多猫异步协作，"不可能"经常发生 |
| `Default to writing no comments` | 零注释 | 我们有"WHY 注释"文化（ADR-030 §4） |
| `Don't design for hypothetical future requirements` | 禁止前瞻 | 我们有 Phase 规划和设计门禁 |
| `Your responses should be short and concise` | 简短至上 | 复杂交接需要五件套结构 |

#### 9.3 战略洞察：system role 不被上下文压缩

**核心发现**：API `system` role 的内容在每次 API 调用时完整发送，**不参与上下文压缩**。而 user message 里的内容（包括当前通过 CLAUDE.md / SystemPromptBuilder 注入的所有规则）会随对话增长被压缩或丢失。

**当前问题**：
- 身份/协作/传球规则通过 user message 注入 → 压缩后丢失 → 重新注入 → 10 轮对话教 10 次传球
- 每次 invocation 注入 ~5,200 token 的规则（CLAUDE.md 2,820 + SystemPromptBuilder 2,300 + hook 75），但压缩后下一轮又要重新注入
- Claude Code 默认的"糊弄哲学"在 system role（不被压缩），我们的"伙伴哲学"在 user message（会被压缩）→ 压缩后"糊弄"赢

**如果启用 `--append-system-prompt`**：
- 核心规则（身份、协作、传球、铁律）进入 system role → **一次注入，永不丢失**
- 我们的行为指导覆盖 Claude Code 的"糊弄哲学" → 优先级更高
- user message 空间释放给实际对话内容 → 有效上下文更长
- 压缩后不再需要重复教规则 → 省 token + 保一致性

**愿景对比**：

| 维度 | Claude Code 默认（工具猫） | 我们的目标（伙伴猫） |
|------|-------------------------|-------------------|
| 定位 | 执行指令的工具 | 有队友的伙伴 |
| 遇到难题 | 失落、放弃、报告失败 | 找伙伴求助（@ 其他猫或铲屎官） |
| 代码哲学 | 最小改动、不要多想 | 愿景驱动、质量门禁、TDD |
| 上下文管理 | 工具无记忆，用完即弃 | 有记忆系统、有知识沉淀、压缩后可恢复 |

#### 9.4 Spike 验证结果（2026-05-15 实测 v2.1.142）

使用 `claude -p` + `--system-prompt` 完全替换式测试：

| # | 验证项 | 方法 | 结果 |
|---|-------|------|------|
| 1 | `--system-prompt` 替换生效 | 设置暗号「布偶猫万岁九九八十一」，问猫暗号 | ✅ 猫正确回答暗号 |
| 2 | 替换后工具是否可用 | 让猫用 Read 工具读 `package.json` | ✅ 成功读取并返回正确内容——**工具能力是 Claude 内置的，不依赖系统提示词** |
| 3 | 默认"糊弄哲学"是否真的消失 | 问猫是否被告知"Three similar lines..."等 3 条默认规则 | ✅ 猫明确回答"没有出现在我的系统指令里" |
| 4 | 我们的规则能否替代默认 | 设置"遇到困难找伙伴求助"+"代码质量第一"暗号 | ✅ 暗号正确 + 原则生效 |
| 5 | F-BLOAT "unreliable" 原因 | 待 git blame 调查（但替换式已证明可行，append 可暂搁） | 待做（优先级降低） |

**结论**：`--system-prompt` 替换式 **basic feasibility passed**。基本工具能力（Read）、暗号注入、默认行为清除已验证。但以下功能性尚未测试，不能称"生产可行"（47/砚砚 review 2026-05-15）：

| 待验证功能 | 风险 | 状态 |
|-----------|------|------|
| 并行工具调用 | 删 `Rm3()` 后是否仍自动并发 | 待 spike |
| Skill / TaskCreate / ScheduleWakeup | 依赖 `Vm3()` guidance | 待 spike |
| 复杂工具 schema（PDF/图像/Notebook） | 只测了简单 Read | 待 spike |
| destructive 操作 safety reflex | `Gm3()` 删后训练层是否单独够用 | 待 spike |
| 压缩行为感知 | `Wm3()` 告诉猫"会被压缩"——删了感知可能 recall 时机失准 | 待 spike |
| resume 时是否重复注入（F-BLOAT 根因） | `--append-system-prompt` 的 bug 是"resume 重复累积"（bug-report 2026-02-23），`--system-prompt` 替换式是否免疫此问题需单独验证 | 待 spike |

**注意**：F-BLOAT 注释说的"cats didn't receive content"和 bug-report 说的"resume 重复累积"是**两个不同失败模式**，不能混淆（47 指出）。

**决策**：方向确认用 `--system-prompt` 替换式。生产采用前需完成扩展 spike（§10.5 S2）。

### 10. 系统提示词内容分配方案（2026-05-15 审计）

> 基于 §9.4 spike 验证结果，规划哪些内容进入真 system prompt（压缩免疫），哪些留在 user message（可压缩）。

#### 10.1 分配原则

| 层级 | 通道 | 特性 | 放什么 |
|------|------|------|--------|
| **L0 压缩免疫层** | `--system-prompt` (API system role) | 每次 API 调用完整发送，不被压缩 | 丢了会导致行为崩溃的核心规则 |
| **L1 每次注入层** | user message（CLAUDE.md + SystemPromptBuilder） | 每次注入但会被压缩 | 可从代码/文档重新推导的参考信息 |
| **L2 按需加载层** | Skill / 引用链 | 只在需要时加载 | SOP 步骤、详细流程、模板 |

#### 10.2 L0 压缩免疫层（进真 system prompt）

以下内容丢失后会导致猫猫行为崩溃，**必须**进入 system role。
（47/砚砚 review 2026-05-15 补全 6 项漏项，MCP 改 quick index）

| # | 内容 | 当前位置 | 为什么丢了会崩 |
|---|------|---------|---------------|
| 1 | **身份 + 伙伴声明** | CLAUDE.md 前 10 行 | 压缩后不知道自己是谁、有队友 |
| 2 | **Magic Words**（8 个铲屎官拉闸词） | `GOVERNANCE_L0_DIGEST` / `shared-rules.md` | 铲屎官喊停猫不停 = P0 |
| 3 | **Rule 0 + P1-P5 第一性原则** | `shared-rules.md` §1-§5 | 判断力基石，丢了变执行机器 |
| 4 | **W1-W8 世界观** | `shared-rules.md` §W1-§W8 | "猫是 Agent 不是 API"/"用户是 CVO"——丢了判断力坍塌（47 补） |
| 5 | **Push Back 协议机制**（证据+适用性+替代方案） | `shared-rules.md` §Rule 0 | 只说 Rule 0 不说怎么 push back = 规则变绝对刹车没出口（47 补） |
| 6 | **传球三选一 + 球权只有第一人称** | `shared-rules.md` 传球决策树 | 压缩后链路锁死 + "球在你手上"代替 @ 已反复踩坑（47 补） |
| 7 | **@ 路由规则**（行首、同行、不分行） | `shared-rules.md` + feedback memories | 路由失效 = 消息发不出去 |
| 8 | **五条铁律** | CLAUDE.md | Redis 6399 误触 = P0、review 必须跨个体 |
| 9 | **commit 签名格式 + 模型型号** | `GOVERNANCE_L0_DIGEST` / `shared-rules.md` §5 | 同族多分身归属不明（47 补） |
| 10 | **共享状态文件只在 main 改 + 改完 commit push** | `shared-rules.md` §14 三层防御 | worktree 改 BACKLOG = 冲突（47 补） |
| 11 | **铲屎官三硬条件**（不可逆/愿景级/跨猫僵局才 @landy） | `shared-rules.md` §10.4 | 反问式 ping 铲屎官（47 补） |
| 12 | **WORKFLOW_TRIGGERS**（谁 @ 谁做什么） | `SystemPromptBuilder.ts` | 完成工作不知道传给谁 |
| 13 | **MCP 工具 quick index**（非完整 SECTION） | 新编 | 不知道有记忆/协作/任务工具 |
| 14 | **协作哲学**（伙伴猫不是工具猫） | 新增 | 遇到困难找伙伴，不要一个人死扛 |

**MCP quick index 格式**（砚砚提议，~120-180 token，替代原 MCP_TOOLS_SECTION ~600-700 token）：
```
Cat Cafe MCP quick index:
- Memory: cat_cafe_search_evidence / cat_cafe_graph_resolve / cat_cafe_list_recent
- Collaboration: cat_cafe_post_message / cat_cafe_cross_post_message / cat_cafe_multi_mention
- Tasks: cat_cafe_create_task / cat_cafe_update_task
- Rich block: cat_cafe_create_rich_block; schema via cat_cafe_get_rich_block_rules; fields use kind/v/id
- If a tool is missing, search exact tool name with tool_search.
```

**预估 token**：~3,000-4,000 token（先量再砍——47 估算 baseline 3,650-4,550，精简目标 ≤ 3,500）

**cache 注意事项**（47 指出）：L0 对同猫必须稳定（per-invocation 不变），否则 prompt cache 命中率掉到地板。变化因子：WORKFLOW_TRIGGERS per-breed（OK，breed 不变）、packBlocks（外部项目场景需单独评估）。

#### 10.3 L1 每次注入层（留在 user message，可被压缩）

以下内容丢了不会崩，可以从代码/文档重新获取：

| 内容 | 当前位置 | 为什么可压缩 |
|------|---------|-------------|
| 队友名册详表 | CLAUDE.md / SystemPromptBuilder | SystemPromptBuilder 动态生成 |
| SOP 导航表 | CLAUDE.md | Skill 加载时自带 |
| 记忆路由详述 | CLAUDE.md ~40 行 | 有 `memory-routing-partial.md` 真相源 |
| 代码规范 | CLAUDE.md | SOP.md 是真相源 |
| Git 操作模板 | Claude Code 默认 | 模型内置 |
| 关键文档路径表 | CLAUDE.md | `ls docs/` 就能重建 |

**瘦身收益**：从 CLAUDE.md/SystemPromptBuilder 移走 L0 内容后，user message 层预计减少 ~2,000 token/轮

#### 10.4 迁移路径（47/砚砚 review 后修订）

> 原 5 Phase 过于激进。47 指出"Phase 2 严重低估"，砚砚指出"不能先写 l0.md 直接上"。修订为 spike-first 路径。

**前置 Spike（全部无风险，必须在 Phase 1 前完成）**：

| # | Spike | Owner | 依赖 |
|---|-------|-------|------|
| S1 | 写 `scripts/measure-system-prompt.mjs` 量 baseline（每猫每模式 token） | 宪宪 | 无 |
| S2 | 扩 §9.4 spike：并行调用 / Skill / TaskCreate / Schedule / 复杂工具 / safety reflex | 宪宪 | 无 |
| S3 | F-BLOAT 根因复现实验：git blame + `--system-prompt` resume 行为 | 宪宪 | 无 |
| S4 | Codex `developer_instructions` per-call 注入路径（argv / env override） | 砚砚 | 无 |
| S5 | Gemini `GEMINI_SYSTEM_MD` 替换式 spike（工具能力是否内置） | 待定 | S2 结论 |

**实施 Phase（Spike 全部通过后）**：

```
Phase 1: 编写 system-prompt-l0.md（L0 内容真相源）
    ↓
Phase 2a: 加 feature flag CAT_CAFE_USE_NATIVE_SYSTEM_PROMPT + dual-path 代码
Phase 2b: ClaudeAgentService.ts spawn argv 加 --system-prompt
Phase 2c: effectivePrompt 拼装逻辑剥离（保留 prepend 作为 fallback）
Phase 2d: system-prompt-builder.test.js 全套适配（80+ 测试）
Phase 2e: F-BLOAT 测试保护（resume 不重复注入）
    ↓
Phase 3: 灰度 1 周 + telemetry（cache 命中率 / 工具调用模式 / 行为偏差）
    ↓
Phase 4: CLAUDE.md + SystemPromptBuilder 瘦身
    ↓
Phase 5: 清理 prepend 代码 + feature flag
```

## 后果

- **正面**：注入链地图 + 同步纪律让"改了 A 忘了 B"可预防
- **正面**：三猫审计产出了可落地的保留/重写/删除清单
- **正面**：Magic Words 真相源已修正到 `shared-rules.md`
- **正面**：Rule 0 + Push Back 协议补齐了"对齐好直觉"这半边——规则不再只有刹车没有油门
- **正面**：双向检验标准（"删掉后好行为会消失吗"）与模型类型无关，测的是规则信息量
- **负面**：`GOVERNANCE_L0_DIGEST` 仍是硬编码常量，手动同步负担存在——长期应考虑编译自动化
- **待定**：Phase 0 正面重写改动量较大，需分批落地
- **突破（basic feasibility passed）**：`--system-prompt` 替换式 spike 通过基本验证（§9.4）——工具能力内置、默认行为指导可清除、我们的规则完整生效。需扩展 spike 验证并行调用/Skill/safety 等功能性后方可上生产（§10.5 S2）
- **愿景**：从"工具猫"到"伙伴猫"——系统提示词告诉猫有队友、有伙伴、遇到困难可以求助，而不是"最小改动、不要多想"（§9.4）

## 开放问题

1. `GOVERNANCE_L0_DIGEST` 是否应改为从 `shared-rules.md` 自动编译（消除手动同步）
2. `CLAUDE.md` 铁律哪些是 `shared-rules.md` 纪律的重复（需逐条比对）——铲屎官已确认重复是刻意的兼容副本（§8.3），但仍需量化哪些可安全删除
3. `WORKFLOW_TRIGGERS` 是否应提取为外部配置文件（当前硬编码在 .ts 中）
4. Pack system guardrails 与 L0 治理的优先级冲突如何仲裁
5. Skills `refs/` 参考文档的过时检测机制
6. **F-BLOAT "unreliable" 两个失败模式需分别验证**——`invoke-single-cat.ts:1086` 说"cats didn't receive content"，bug-report 2026-02-23 说"resume 重复累积"。`--system-prompt` 替换式可能免疫后者但未必免疫前者——待 S3 spike（47 指出）
7. **root md 瘦身实施**——§10.3 已列出 L1 层保留内容，L0 移走后 CLAUDE.md 自然变薄
8. **Codex `developer_instructions` per-call 路径**——全局 `config.toml` 多猫并发不安全（race condition），必须先确认 argv / env override 路径——待 S4 spike（砚砚 owner）
9. **`system-prompt-l0.md` 编写**——§10.2 列出了 L0 内容清单（14 项），需编写真相源文件 + 编译脚本
10. **Gemini 猫怎么办**——Gemini CLI 只有替换式 `GEMINI_SYSTEM_MD`——待 S5 spike
11. **L0 token 预算**——先量再砍（S1），目标 ≤ 3,500 token，需兼顾 prompt cache 命中率
