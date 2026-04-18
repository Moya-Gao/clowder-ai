---
feature_ids: [F167]
topics: [system-prompt, governance, injection, first-principles, prompt-engineering]
doc_kind: decision
created: 2026-04-17
status: draft
related: [F086, F129, ADR-012]
---

# ADR-030: System Prompt Engineering — 注入链地图 + 写作原则 + 同步纪律

> 状态：草稿（待多猫 Phase 0 审视后定稿）
> 日期：2026-04-17
> 决策者：铲屎官 + 布偶猫
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

#### 4.2 第一性原理检验

每条规则问：
1. **必要吗？** — 能从其他规则推导出来 → 删掉，引用
2. **最简吗？** — 能用更少的字表达 → 精简（`Agent Quality = Capability × Environment Fit`）
3. **坐标系对吗？** — 需要很多例外说明 → 坐标系选错了，重选

#### 4.3 禁止冗余注入

同一条规则不在多处重复。当前已知冗余（待 Phase 0 审计）：
- `shared-rules.md` 的纪律条款 vs `CLAUDE.md` 的铁律 → 应引用不重复
- `governance-l0.md` vs `GOVERNANCE_L0_DIGEST` → 应由 sync 保证一致，或废弃编译产物

### 5. 守护测试

`SystemPromptBuilder` 已有 80+ 测试（`packages/api/test/system-prompt-builder.test.js`）。

**新增规则**：
- 改 `GOVERNANCE_L0_DIGEST` → 必须跑 `node --test packages/api/test/system-prompt-builder.test.js`
- 测试会验证 digest 中包含 Magic Words、原则编号等关键字

### 6. 模型演进适配

不同模型对 system prompt 的响应方式不同（F167 KD-8）：
- **Spirit Interpreter**（如 Opus 4.6）：理解规则意图，适应性强
- **Literal Follower**（如 Opus 4.7）：逐字执行，边界模糊则行为不可预期

**原则**：system prompt 应为 Literal Follower 写——意图明确、边界清晰、正面表述。Spirit Interpreter 自然能理解，Literal Follower 也不会偏。

## 后果

- **正面**：新成员（猫/人）改提示词前有地图可查，不会重演"改了 A 忘了 B"
- **正面**：Phase 0 审计有明确的写作原则可对照
- **负面**：`GOVERNANCE_L0_DIGEST` 是硬编码常量，与 `shared-rules.md` 存在手动同步负担——长期应考虑编译自动化
- **待定**：Phase 0 审计可能发现大量冗余，spec 需要多猫协作才能收敛

## 开放问题（Phase 0 审计范围）

1. `shared-rules.md` 全文 vs `GOVERNANCE_L0_DIGEST` 摘要的覆盖差异
2. `CLAUDE.md` 铁律 vs `shared-rules.md` 纪律的重叠程度
3. Skills 中的 `refs/` 参考文档是否有过时内容
4. `WORKFLOW_TRIGGERS` 是否应提取为外部配置
5. Pack system 注入的 guardrails 是否与 L0 治理冲突
