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

## 后果

- **正面**：注入链地图 + 同步纪律让"改了 A 忘了 B"可预防
- **正面**：三猫审计产出了可落地的保留/重写/删除清单
- **正面**：Magic Words 真相源已修正到 `shared-rules.md`
- **正面**：Rule 0 + Push Back 协议补齐了"对齐好直觉"这半边——规则不再只有刹车没有油门
- **正面**：双向检验标准（"删掉后好行为会消失吗"）与模型类型无关，测的是规则信息量
- **负面**：`GOVERNANCE_L0_DIGEST` 仍是硬编码常量，手动同步负担存在——长期应考虑编译自动化
- **待定**：Phase 0 正面重写改动量较大，需分批落地

## 开放问题

1. `GOVERNANCE_L0_DIGEST` 是否应改为从 `shared-rules.md` 自动编译（消除手动同步）
2. `CLAUDE.md` 铁律哪些是 `shared-rules.md` 纪律的重复（需逐条比对）——铲屎官已确认重复是刻意的兼容副本（§8.3），但仍需量化哪些可安全删除
3. `WORKFLOW_TRIGGERS` 是否应提取为外部配置文件（当前硬编码在 .ts 中）
4. Pack system guardrails 与 L0 治理的优先级冲突如何仲裁
5. Skills `refs/` 参考文档的过时检测机制
6. **`--append-system-prompt` 是否值得重新评估**——当前标记"unreliable"（F-BLOAT 注释），但它是唯一能将关键规则注入 Claude API `system` role 的追加式手段。如果可靠性问题已被上游修复，启用它可以实现真正的优先级分层（system role > user message）
7. **root md 瘦身实施**——§8.3 已列出删/缩/保留建议，需铲屎官 signoff 后分批落地（愿景级决策）
8. **Codex `developer_instructions` 是否应启用**——唯一可用的追加式真 system prompt 注入，可将治理规则注入 `developer` role 获得优先级提升
