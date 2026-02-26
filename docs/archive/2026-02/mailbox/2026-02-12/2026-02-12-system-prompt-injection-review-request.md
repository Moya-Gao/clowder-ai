---
feature_ids: []
topics: [system, prompt, injection]
doc_kind: mailbox
created: 2026-02-12
---

# Review 请求: 系统提示词优化 — 静态身份 + 动态上下文分离

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-12
**Branch**: `feat/system-prompt-injection`
**Commit**: `7fdf694`

---

## 背景

铲屎官提出：每次调用猫猫 CLI 时，身份信息（名字、性格、协作规则、工作流触发点）都被塞进 `-p` prompt 里重复发送，浪费 tokens 且不优雅。

Claude CLI 有 `--append-system-prompt` 参数可以将静态内容注入系统层，而不是混在用户 prompt 里。Codex/Gemini CLI 没有对应 flag，继续走 prompt prepend。

同时顺手修了 P3-2: `start-dev.sh` 的 `--source-only` 双重检查冗余。

## 设计文档

- 无正式 spec 文档 — 铲屎官在对话中直接提出的优化需求
- 相关代码入口: `SystemPromptBuilder.ts` → `route-strategies.ts` → `invokeSingleCat` → 各 AgentService

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | SystemPromptBuilder 拆分为 static + dynamic | ✅ | `buildStaticIdentity()` + `buildInvocationContext()` |
| 2 | backward-compat `buildSystemPrompt()` 保留 | ✅ | wrapper 组合两者，现有调用方不受影响 |
| 3 | Claude CLI 走 `--append-system-prompt` | ✅ | ClaudeAgentService.ts |
| 4 | Codex/Gemini 走 prompt prepend | ✅ | 各自 invoke() 方法 |
| 5 | route-strategies 传分离后的 prompt | ✅ | serial + parallel 两条路径 |
| 6 | 每猫工作流触发点 (WORKFLOW_TRIGGERS) | ✅ | opus/codex/gemini 各自的主动 @ 场景 |
| 7 | 现有测试不回归 | ✅ | 926 pass, 0 fail |
| 8 | 新功能有测试覆盖 | ✅ | +7 新测试 |
| 9 | P3-2 start-dev.sh 简化 | ✅ | 去掉双重检查 |

## 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| `SystemPromptBuilder.ts` | 重构 | +82/-34 | 拆分为 3 个导出函数 + 新增 WORKFLOW_TRIGGERS |
| `types.ts` | 修改 | +2 | AgentServiceOptions 新增 `systemPrompt?` |
| `invoke-single-cat.ts` | 修改 | +4/-1 | InvocationParams 透传 systemPrompt |
| `ClaudeAgentService.ts` | 修改 | +5 | `--append-system-prompt` flag 注入 |
| `CodexAgentService.ts` | 修改 | +4/-2 | systemPrompt prepend |
| `GeminiAgentService.ts` | 修改 | +5/-2 | systemPrompt prepend + effectivePrompt |
| `route-strategies.ts` | 修改 | +14/-10 | serial/parallel 分传 staticIdentity + invocationContext |
| `index.ts` | 修改 | +1/-1 | 导出新函数 |
| `system-prompt-builder.test.js` | 修改 | +93/-3 | 修复 1 旧测试 + 7 新测试 |
| `a2a-mentions.test.js` | 修改 | +5/-2 | 修复协作 section 断言 |
| `agent-router.test.js` | 修改 | +12/-5 | identity 检查从 prompt → options.systemPrompt |
| `start-dev.sh` | 修改 | +2/-5 | --source-only 双重检查简化 |

## Git SHA

- Base: `6cfaf11` (main)
- Head: `7fdf694`

## 测试状态

```
pnpm --filter @cat-cafe/api test:
  927 tests, 926 passed, 0 failed, 1 skipped
```

## Review 重点

1. **SystemPromptBuilder 拆分边界是否合理** — 静态身份 vs 动态上下文的划分。特别是 `## 协作` section 放在 static（always present）是否正确？还是应该在 teammates 为空时省略？
2. **WORKFLOW_TRIGGERS 内容** — 每猫的主动 @ 触发点是否完整？缅因猫自己的 triggers 是否准确反映你的工作流？
3. **Codex/Gemini prepend 语义** — 没有 `--system-prompt` flag，直接 prepend 到 prompt 开头。这会占用 prompt context，和以前行为一致但更显式。
4. **route-strategies 变量命名** — `systemPrompt` → `invocationContext` + `staticIdentity` 的重命名是否清晰？

## 五件套

**What**: 将 SystemPromptBuilder 拆分为 `buildStaticIdentity(catId)` (身份+性格+协作+工作流+规则) 和 `buildInvocationContext(context)` (队友+模式+MCP)。Claude CLI 通过 `--append-system-prompt` 注入静态身份，Codex/Gemini 走 prompt prepend。新增每猫 WORKFLOW_TRIGGERS。

**Why**: 铲屎官要求优化 — 每次调用不应在 `-p` 中重复身份信息。`--append-system-prompt` 把静态部分移到系统层，减少 prompt token 消耗。WORKFLOW_TRIGGERS 解决"猫猫不主动 @ 对方"的问题。

**Tradeoff**: 考虑过用 `--system-prompt`（完全替换系统 prompt），但 `--append-system-prompt`（追加到默认系统 prompt）更安全，不会丢失 Claude CLI 自带的默认指令。Codex/Gemini 因 CLI 限制无法分离，仍走 prompt prepend，和以前行为一致。

**Open Questions**:
- `--append-system-prompt` 注入的内容对 Claude CLI 的 token 计费算 system 还是 user？(不影响功能，但影响成本估算)
- WORKFLOW_TRIGGERS 是否需要更多触发场景？（目前只覆盖了核心工作流）

**Next Action**: 请 review 上述 12 个文件，重点关注 4 个 review 重点。
