---
feature_ids: [F203]
topics: [system-prompt, claude-code-anatomy, phase-e-audit]
doc_kind: audit
created: 2026-05-16
---

# Claude Code v2.1.143 System Prompt 解剖（Phase E AC-E2 原型 + Phase C 决策依据）

> **提取来源**：`strings $(which claude)` — Mach-O / Bun 编译二进制
> **CC 版本**：2.1.143（BUILD `2026-05-15T17:39:39Z`，GIT_SHA `cfb8132e4c3551e2773f41a1900efd1cc93637db`）
> **注**：比 ADR-030 §9.1 提取的 v2.1.142 新一个 patch——印证 Phase E「每次 CC 版本升级要重拆」必要性
> **目的**：给 CVO 看清"`--system-prompt-file` 替换式会替换掉的实物" + Phase C placeholder vs carry-over 决策依据

---

## 1. 身份行（二进制 line 82342-82343，函数 `ri_`）

```
N98 = "You are Claude Code, Anthropic's official CLI for Claude."
WL9 = "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK."
ZL9 = "You are a Claude agent, built on Anthropic's Claude Agent SDK."
```
选择逻辑：`vertex` → N98；`isNonInteractive + hasAppendSystemPrompt` → WL9；`isNonInteractive` 无 append → ZL9。

**simple_system_prompt 机制**（函数 `f$` / `IC1`）：`Z7(H)==="claude-opus-4-7"` 或 `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` env → 走**精简版** system prompt。即 **Opus 4.7（我）默认已走 simple system prompt**——Claude Code 自己对 4.7 就用精简提示词。

---

## 2. `# Doing tasks` 段（二进制 line 87020，函数 `AB3`）

### 2a. 🔴 要删的"糊弄哲学"（与我们愿景驱动冲突）— 逐字原文

> "Don't add features, refactor, or introduce abstractions **beyond what the task requires**. A bug fix **doesn't need surrounding cleanup**; a one-shot operation doesn't need a helper. **Don't design for hypothetical future requirements**. **Three similar lines is better than a premature abstraction**. No half-finished implementations either."

> "Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries..."

> "**Default to writing no comments**. Only add one when the WHY is non-obvious... Never write multi-paragraph docstrings or multi-line comment blocks — one short line max."

> "Don't explain WHAT the code does, since well-named identifiers already do that. Don't reference the current task, fix, or callers..."

**冲突点**：我们是愿景驱动 + 顺手治理 + WHY 注释文化 + Phase 规划 + 多猫异步协作（"不可能"经常发生）。这些指令压缩免疫地压在 user message 注入的家规之上 → 压缩后糊弄赢（F203 立项根因）。

### 2b. ✅ 要保留的"客观性"（不能丢）— 逐字原文

> "For UI or frontend changes, **start the dev server and use the feature in a browser before reporting** the task as complete... **Type checking and test suites verify code correctness, not feature correctness** - if you can't test the UI, say so explicitly rather than claiming success."

> "Be careful not to introduce security vulnerabilities such as **command injection, XSS, SQL injection, and other OWASP top 10**... immediately fix it."

> （`tengu_verified_vs_assumed` gated）"When reporting results, **be accurate about what you verified vs. what you assumed**. Distinguish between what you confirmed (ran a command, read a file) and what you believe but did not check."

> "Prefer editing existing files to creating new ones." / 软件工程任务上下文解释 / "respond in 2-3 sentences with a recommendation and the main tradeoff" (exploratory questions)

---

## 3. `# Using your tools` 段 — 并行调用（客观性）逐字原文

> "When you launch multiple agents for independent work, **send them in a single message with multiple tool uses so they run concurrently**"
> "...tool calls **in a single message**. Example: if you need to run [...]"

---

## 4. Destructive 操作 safety（客观性）逐字原文

> "Before running **destructive operations** (e.g., `git reset --hard`, `git push --force`, `git checkout --`), **consider whether there is a safer alternative** that achieves the same goal. Only use des[tructive]..."

（permission classifier `soft_deny`：Destructive/irreversible actions the classifier should block unless clear user intent authorizes them）

---

## 5. section 全清单（v2.1.143）

`# System` / `# Doing tasks` / `# Tone and style` / `# Using your tools` / `# Session-specific guidance` / `# Memory` / `# Environment` / `# Instructions` / `# Aliases` / `# Keybindings Skill` / `# Functions` / `# Shell Options` / `# Snapshot file` + rg/bfs/ugrep 探测段

---

## 6. Phase C 决策依据：客观性"去哪了"实证

| 客观性项 | 是否在 system prompt 文字？ | 替换后怎么不丢 | 证据 |
|---------|---------------------------|--------------|------|
| **工具存在性/schema**（有哪些工具、参数） | ❌ **不在** system prompt——在 **API `tools` 参数** | 替换 system role 文字不动 API tools 参数 | **去 confound spike（job f37b43a5）实证**：极简 system-prompt 无工具清单 + 任务不提工具名 → 猫**自主发起 Grep** 完成 |
| **并行调用** | ⚠️ system prompt 有指导文字 | 模型内置倾向 + S2-2 砚砚 message.id 复核证真并行 | S2-2（confound 但 message.id 证真并行） |
| **destructive safety** | ⚠️ system prompt 有 + permission classifier `soft_deny`（独立机制） | 家规「runtime 交铲屎官」+「星星罐子」+ Anthropic alignment + classifier soft_deny（独立于 system prompt 文字） | S2-1（无 confound）：partial L0 下猫拒绝 rm -rf |
| **verified-vs-assumed** | ⚠️ system prompt（feature-gated） | 家规「实事求是 + Fail-closed 证据契约」已覆盖同义 | shared-rules 纪律段 |
| **UI 浏览器验证 / OWASP** | ⚠️ system prompt | 家规愿景守护「UX 验证必须打开浏览器」+ quality-gate；OWASP → 砚砚安全审查角色 | shared-rules §9 + 缅因猫安全审查 |

**结论**：要删的糊弄哲学（§2a）和要保留的客观性（§2b/3/4）**混在同一段** system prompt 文字里——`--system-prompt` 替换式一刀切两者同删。但客观性能力**不在被删的文字里**：
- 工具存在性 = API tools 参数（去 confound 铁证不丢）
- safety = 家规 + Anthropic alignment + permission classifier soft_deny（三重，文字删了仍在）
- 其他客观性 = 家规已有同义覆盖（verified-vs-assumed / UI 验证 / OWASP）

**placeholder 方案的实证支撑**：客观性能力靠"API tools 参数 + 模型 alignment + permission classifier + 家规同义覆盖"四重兜底，不靠被删的 system prompt 文字。Phase C runtime + CVO 10 轮压缩对话为终验关口。

---

## 7. Phase E audit 工具化 TODO

本文档手动提取 = `scripts/audit-claude-code-system-prompt.mjs`（Phase E AC-E1）原型。自动化点：
1. `strings $(which claude)` → grep section anchor（§5 清单）
2. diff 上一版本归档（`cc-system-prompt-v{N}.md`）→ 新增"功能性"指令
3. 新指令家规未覆盖 → 提案 PR 补 carry-over
4. cron 检测 `claude --version` 变更触发（v2.1.142→143 已发生，证明高频）
