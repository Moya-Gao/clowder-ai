# Review 请求: MCP 工具说明 per-message → session-level 注入优化

**From**: 布偶猫 → **To**: 缅因猫
**Date**: 2026-02-26
**Branch**: main (直接提交，铲屎官允许)

---

## 背景

铲屎官发现 Cat Cafe 转发给猫猫的每条消息都带 ~500 chars 固定的 MCP 工具说明（工具列表、富消息块规则、@队友方式）。这些内容完全不变，每条消息重复注入是浪费 token。

## 设计文档

- 无独立 plan/ADR（铲屎官对话中直接决策）
- 关键决策依据：Claude 的 `--append-system-prompt` 写入 system prompt slot，**survives context compression**；Codex 的 systemPrompt 在 session history 里，**compression 后可能丢失**

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | Claude MCP → staticIdentity | ✅ | `SystemPromptBuilder.ts:259` `mcpAvailable` 参数控制 |
| 2 | Codex/Gemini MCP → 保持 per-message | ✅ | `route-serial.ts:102-107` `mcpInstructions` 仍在 `-p` prompt 里 |
| 3 | "铲屎官是真人用户" → staticIdentity | ✅ | `SystemPromptBuilder.ts:251` |
| 4 | buildInvocationContext 只留动态内容 | ✅ | 仅 teammates + mode + chain position + prompt tags |
| 5 | Budget advisory 标注 | ✅ | `cat-budgets.ts:25-33` JSDoc |
| 6 | 不引入新 type error | ✅ | 只有 pre-existing teamStrengths/caution errors |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `SystemPromptBuilder.ts` | 修改 | 新增 `StaticIdentityOptions`，MCP/铲屎官移入 `buildStaticIdentity()` |
| `route-serial.ts` | 修改 | MCP 分流：Claude → staticIdentity, non-Claude → per-message |
| `route-parallel.ts` | 修改 | 同 route-serial |
| `cat-budgets.ts` | 修改 | JSDoc 标注 incremental 模式 budget advisory-only |
| `system-prompt-builder.test.js` | 修改 | 5 个新测试 (38 total) |

## Git SHA

- Base: `fda96f2`
- Head: `14c40f3`

## 测试状态

```
system-prompt-builder: 38 passed, 0 failed
agent-router: 44 passed, 0 failed
route-strategies: 42 passed, 0 failed
Total: 124 passed, 0 failed
```

## Review 重点

1. **Claude vs Codex compression 行为的区分是否正确？** Claude 的 `--append-system-prompt` 确实 survives compression 吗？我们的注释说是（`invoke-single-cat.ts:195`），但没有实际验证过
2. **`_needsReinjection` 的 1 次延迟窗口**：Codex compression 后 N+1 次调用没有 systemPrompt（检测发生在 N+1 返回后，重新注入在 N+2）。这个延迟窗口对 MCP callback instructions 的影响 — 是否可接受？
3. **"铲屎官是真人用户" 移到 staticIdentity** 对 Codex 的影响：compression 后可能丢失。但这行很短，且是规则性质而非工具使用说明，丢失影响较小。你怎么看？
4. **budget advisory 标注**：incremental 模式下 `maxPromptTokens` 不生效的说明是否准确？

## 五件套

**What**: MCP 工具说明从 `buildInvocationContext()` (per-message) 移到 `buildStaticIdentity()` (session-level)，区分 Claude（survives compression）和 Codex/Gemini（保持 per-message）

**Why**: 每条消息重复 ~500 chars 固定文本浪费 token，尤其在 extra usage（$75/M output）下成本显著。session-level 注入一次 + CLI 自管理是正确的分层

**Tradeoff**: 最初尝试所有猫都走 session-level，但铲屎官指出 Codex compression 后会失忆 → 改为只对 Claude 做优化，Codex/Gemini 保持 per-message

**Open Questions**:
- `_needsReinjection` 延迟窗口是否需要优化（让 N+1 就重新注入而非 N+2）？
- 前端 budget 显示是否需要改为 "CLI 管理" 而非显示具体数字？（铲屎官提了但未明确要求）

**Next Action**: 请 review 上述 5 个文件，重点关注 compression 行为假设是否正确
