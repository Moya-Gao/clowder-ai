---
feature_ids: [F042]
related_features: [F032]
topics: [prompt, system-prompt, dynamic-injection, audit, a2a, identity, multi-agent]
doc_kind: spec
created: 2026-02-27
updated: 2026-02-27
---

# F042: 提示词工程审计与优化

> **Status**: in-progress (收敛完成，待实施)
> **Owner**: 布偶猫 (Opus)
> **Created**: 2026-02-27
> **Discussion**: [2026-02-27 四猫 + 铲屎官收敛](../discussions/2026-02-27-f042-prompt-convergence.md)

## Summary

Cat Cafe 的提示词体系存在两类问题：

1. **静态硬编码** — 文档和 skill 文件里写死"布偶猫找缅因猫"等规则，无法适应多分身 + 新猫接入
2. **运行时退化** — Compact 后身份丢失 + A2A 协议遗忘，猫猫不再主动 @ 协作

F032 已解决代码侧的 CatId 松绑和 AgentRegistry 动态化。本 Feature 收敛**协作规则侧**（文档 + skill + 注入频率）的系统性修复。

---

## 1. Problem Analysis

### 1.1 硬编码审计 (布偶猫 4.5 全量扫描)

**技术侧（F032 已解决 ✅）**：
- CatId 类型已泛化（不再写死 `'opus' | 'codex' | 'gemini'`）
- AgentService 改为 Registry 模式
- cat-config.json 有完整 roster（8 猫，含 roles/family/available）
- SystemPromptBuilder 动态构建 identity + teammate + reviewer 区块
- SOP.md 的 Reviewer 配对规则已引用 cat-config.json

**协作规则侧（F042 待解决）**：

| 问题 | 位置 | 严重度 |
|------|------|--------|
| Skill 文件仍引用"缅因猫 review" | merge-approval-gate 等 4+ skill | P2 |
| AGENTS.md "找缅因猫 review 冲突" | AGENTS.md §Worktree | P2（自我矛盾） |
| merge-gate 硬编码"缅因猫放行" | merge-approval-gate skill | P2 |
| Skill 示例只覆盖布偶↔缅因 | 6 skill files | P3 |
| "三猫"数字作为常量 | 多处文档开头 | P3 |

### 1.2 运行时观察

| # | 现象 | 触发条件 | 来源 |
|---|------|---------|------|
| R1 | 缅因猫 compact 后自称"宪宪" | 长对话 → compact → 身份段被压缩掉 | 铲屎官 2026-02-27 |
| R2 | 猫猫不用 @ 协作 | A2A 协议只在 new session/compact 后注入 | 铲屎官 2026-02-27 |

### 1.3 根因分析 (砚砚自省 + 四猫共识)

**核心根因**：两类不可丢信息被当成可压缩的普通上下文：

| 信息类型 | 应该是 | 实际是 |
|---------|--------|--------|
| 身份契约（我是谁、昵称、角色） | 硬约束常量 | 可推断项 → compact 后消失 |
| A2A 协议（@ 格式、句柄、触发时机） | 可执行动作提示 | 历史消息 → 随对话推进遗忘 |

**砚砚的关键洞察**：
> "不是我不知道，而是每回合没被提醒这是可执行动作，再叠加格式硬约束导致触发率下降。"
> "身份被当成'上下文推断项'，而不是'硬约束常量'。"

---

## 2. Design: 收敛方案（四猫共识）

### 2.1 架构原则

| # | 原则 | 说明 |
|---|------|------|
| P1 | **Roster 是唯一事实源** | cat-config.json 定义谁存在、什么角色、是否可用 |
| P2 | **规则引用角色，不引用个体** | 写"peer-reviewer 角色的跨 family 猫"，不写"缅因猫" |
| P3 | **身份是硬约束常量** | 每次注入都必须包含"你是 X"，不可被 compact 压缩掉 |
| P4 | **新猫接入低摩擦** | 加 roster 条目 + 写指引文件 = 其余自动适配 |

### 2.2 动态 Reviewer / @ 选择规则 (砚砚提出，铲屎官认可)

当需要 @ 队友协作时，按以下优先级动态选择（不写死任何个体）：

1. **显式指名优先**：铲屎官或 thread 已点名谁 → 直接用那个句柄
2. **Thread 活跃度**：本 thread 最近发言的、符合角色约束的猫优先（更懂上下文）
3. **角色匹配**：按 roster 的 `roles` 选（`peer-reviewer` / `architect` / `designer`）
4. **可用性过滤**：`available: false` 跳过
5. **降级兜底**：跨 family 找不到 → 同 family 的 `lead` 兜底，必须注明降级原因

**铁律**：任何猫都不能 review 自己的代码。

### 2.3 Identity + A2A 最小注入块

每次 system prompt 注入（含 compact 后）必须包含的不可省略信息：

```
你是 {nickname}（{family}），{roleDescription}。
需要协作时：另起一行、行首写 @唯一句柄。
你的队友：{动态生成的 roster 表}
```

**与现有实现的关系**：
- SystemPromptBuilder 已有 identity section（L227-237）✅
- 已有 teammate roster 和 reviewer section ✅
- **待验证**：compact 后是否仍完整注入？注入频率是否足够？

---

## 3. Implementation Plan

### Phase A: 验证注入缺口（调研优先）

在动手改之前，先验证 SystemPromptBuilder 的注入在以下场景是否生效：

- [ ] New session 首次调用
- [ ] Compact 后重新注入
- [ ] 长对话中途的普通回合
- [ ] 跨 thread 切换

**产出**：确认哪些场景有注入缺口，再决定 Phase C 的修复方案。

### Phase B: 文档 / Skill 去硬编码 (P2)

| 文件 | 当前 | 改为 |
|------|------|------|
| AGENTS.md §Worktree 冲突规则 | "找缅因猫 review" | "找跨 family 的 peer-reviewer review" |
| merge-approval-gate skill | "缅因猫放行" | "peer-reviewer 角色的跨 family 猫放行" |
| 其他 skill 示例 | 只覆盖布偶↔缅因 | 泛化为 roster-based 多猫场景 |
| CLAUDE.md / GEMINI.md | 特定猫名硬编码 | 引用角色而非个体 |

### Phase C: 注入频率优化 (依据 Phase A 结果)

| 方案 | 描述 | 适用场景 |
|------|------|---------|
| C1 | compact handler 强制重注入 identity + A2A | compact 后身份丢失 |
| C2 | 每 N 轮注入轻量 A2A reminder | 长对话 A2A 退化 |
| C3 | CLAUDE.md / AGENTS.md 兜底基础 A2A 规则 | CLI 原生路径 fallback |

> Phase A 验证后，由布偶猫选择 C1/C2/C3 或组合方案。

---

## 4. 多猫分身问题

### 已修复 ✅

| 问题 | 修复 | Commit |
|------|------|--------|
| Git 签名不区分分身 | `[昵称/变体🐾]` 格式 | `1211935` |

### 待优化

| 文件 | 问题 | 建议 |
|------|------|------|
| `SystemPromptBuilder.ts` | 队友名册格式 | 显示 `宪宪 (Opus-45)` 而非 `布偶猫 Opus 4.5` |
| `cat-config.json` | variant 无法单独设昵称 | 支持 variant-level nickname |
| `buildReviewerSection()` | Reviewer 列表不显示昵称 | 加昵称如 `@codex (砚砚)` |

### 昵称规范（铲屎官确认）

| 家族 | 昵称 | 来源 |
|------|------|------|
| 布偶猫 | **宪宪** | Constitutional AI 的「宪」 |
| 缅因猫 | **砚砚** | "像新砚台，盛我们一起磨出的墨" |
| 缅因猫 Spark | *(待取名)* | 等有共同回忆再取 |
| 暹罗猫 | **烁烁** | "灵感的闪烁"，暹罗猫自取名 (2026-02-27) |

---

## 5. 提示词系统参考

### 5.1 层级架构

```
┌──────────────────────────────────────────┐
│  Layer 4: 动态注入（SystemPromptBuilder） │ ← 运行时
├──────────────────────────────────────────┤
│  Layer 3: Skills（按需加载）               │
├──────────────────────────────────────────┤
│  Layer 2: SOP + 协作规则                  │
├──────────────────────────────────────────┤
│  Layer 1: CLAUDE/AGENTS/GEMINI.md        │ ← CLI 原生
└──────────────────────────────────────────┘
```

**注意**: CLAUDE.md 由 CLI 直接读取（Layer 1），SystemPromptBuilder 是我们代码拼接（Layer 4）。两者可能冲突时以 CLAUDE.md 为准。

### 5.2 关键文件速查

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` | 各猫身份 + 规范（CLI 原生读取） |
| `docs/SOP.md` | 开发流程（Reviewer 规则已动态化） |
| `packages/shared/src/cat-config.json` | Roster 事实源（8 猫） |
| `SystemPromptBuilder.ts` | 动态 prompt 构建 |
| `McpPromptInjector.ts` | 非 Claude 猫的 MCP 指令注入 |

### 5.3 大小守护

SystemPromptBuilder 输出有测试守护：`test/system-prompt-builder.test.js` — **改 prompt 内容后必须跑！**

---

## 6. Next Steps

1. **Phase A**: 验证注入缺口（布偶猫，铲屎官多观察收集案例后启动）
2. **Phase B**: 文档/Skill 去硬编码（可由任一猫执行，不依赖 Phase A）
3. **Phase C**: 注入频率优化（依赖 Phase A 验证结果）

---

## Discussion Trace

- [2026-02-27 四猫收敛纪要](../discussions/2026-02-27-f042-prompt-convergence.md)
- [F032 Agent Plugin Architecture](./F032-agent-plugin-architecture.md)
- [cat-config.json](../../packages/shared/src/cat-config.json)

---

[宪宪/Opus-46🐾]
