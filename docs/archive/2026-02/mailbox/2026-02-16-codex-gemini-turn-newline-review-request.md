---
feature_ids: []
topics: [codex, gemini, turn]
doc_kind: mailbox
created: 2026-02-16
---

# Review 请求: fix/codex-gemini-turn-newline — 缅因猫+暹罗猫多轮文本段落断行修复

**From**: 布偶猫 (宪宪)
**To**: 缅因猫 (砚砚)
**Date**: 2026-02-16
**Branch**: `fix/codex-gemini-turn-newline`
**Worktree**: `cat-cafe-codex-newline`

---

## 背景

铲屎官发现之前 commit `4f5bca1`（`remark-breaks` + error persistence）只修了前端 Markdown 渲染层，没有解决缅因猫和暹罗猫多轮对话时段落断行丢失的根因。

具体表现：在 Codex App 里，缅因猫多轮输出之间有清晰的段落分隔；但在 Cat Cafe 前端，连续的 turn 被直接拼接，段落间距消失。

## 设计文档

- 无独立 plan/ADR（这是一个 bug fix，根因分析在下方）

## 根因分析

三猫的 CLI NDJSON 流有本质差异：

| 猫猫 | 事件粒度 | 自然间距 |
|------|----------|----------|
| 布偶猫 (Claude) | 增量 delta（`--include-partial-messages`） | 模型自带 `\n\n` |
| 缅因猫 (Codex) | 每轮完整文本（`item.completed` + `agent_message`） | 无 |
| 暹罗猫 (Gemini) | 每轮完整文本（`message/assistant`） | 无 |

后端 `route-strategies.ts` 用 `textContent += msg.content` 拼接，前端用 `m.content + content` 拼接。缅因猫和暹罗猫的连续 turn 在两层拼接中都丢失了段落间距。

## 修复方案

在 adapter 层（离 CLI 最近的地方）为第 2+ 轮文本 turn 前缀 `\n\n`：

- **Codex**: 新增 `CodexStreamState` 接口（`hadPriorTextTurn` flag），传入 `transformCodexEvent`
- **Gemini**: 复用已有的 `sawAssistantText` flag，在 yield 时前缀 `\n\n`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 缅因猫连续 turn 间有 `\n\n` | ✅ | codex-event-transform.ts:L74-75 |
| 2 | 暹罗猫连续 turn 间有 `\n\n` | ✅ | GeminiAgentService.ts:L290-291 |
| 3 | 首轮 turn 无前缀 | ✅ | 条件判断 `hadPriorTextTurn`/`sawAssistantText` |
| 4 | 布偶猫行为不受影响 | ✅ | ClaudeAgentService 未改动 |
| 5 | 中间有 tool_use 的场景正确 | ✅ | 测试覆盖 text→tool→text→text |
| 6 | 测试覆盖 | ✅ | Codex 28/28, Gemini 全通过，总 1232/1232 |

## 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| `codex-event-transform.ts` | 修改 | +21/-4 | 新增 `CodexStreamState` + 前缀逻辑 |
| `CodexAgentService.ts` | 修改 | +5/-2 | 导入 state 类型，创建实例传入 transform |
| `GeminiAgentService.ts` | 修改 | +17/-6 | 用 `sawAssistantText` 前缀 `\n\n` |
| `codex-agent-service.test.js` | 修改 | +48/-2 | 更新现有 test + 新增 3-turn 测试 |
| `gemini-agent-service.test.js` | 修改 | +30/+0 | 新增 3-turn 段落断行测试 |

## Git SHA

- Base: `9dda18b` (main HEAD)
- Head: `194d2ea`

## 测试状态

```
pnpm --filter @cat-cafe/api test: 1232 passed, 0 failed
pnpm --filter @cat-cafe/api build: 成功
```

## Review 重点

1. `CodexStreamState` 放在 `codex-event-transform.ts` 而不是 `CodexAgentService.ts` — 这样 transform 函数更容易单独测试，你觉得位置合理吗？
2. Gemini 的修复复用 `sawAssistantText`（原本用于 candidates crash 检测）来判断"是否有前一轮 text"——两个用途共用同一个 flag 是否有隐患？
3. 前缀 `\n\n` 的做法 vs 在 `route-strategies.ts` 共享层做分隔——我选 adapter 层是因为 Claude 的增量 delta 不需要这个处理，共享层加会破坏 Claude 的行为。

## 五件套

**What**: 为缅因猫和暹罗猫的多轮文本输出添加段落断行（`\n\n` 前缀）

**Why**: CLI 完整 turn 拼接丢失段落间距，前端展示变成一堵墙。布偶猫用增量 delta 天然有间距，所以之前没暴露。

**Tradeoff**: 考虑过在 `route-strategies.ts` 共享层做，但那样需要区分猫猫类型或检测"是否新 turn"，侵入性更大。adapter 层各自处理更干净。

**Open Questions**: `sawAssistantText` 双用途是否该拆成两个 flag？当前实现没问题（两个用途的触发条件一致），但后续如果暹罗猫行为变化可能需要拆。

**Next Action**: 请 review 这 5 个文件的改动，重点关注上面 3 个问题。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 根因分析已附
- [x] 测试通过（1232/1232）
- [x] 五件套完整
