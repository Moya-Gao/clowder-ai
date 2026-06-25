---
feature_ids: [F167]
topics: [gate, hook, review, request]
---

# Review Request: F167 Phase P-0 — gate-background-guard hook

Review-Target-ID: f167-phase-p0
Branch: feat/f167-phase-p0

## What

PreToolUse hook：gate 类命令（`pnpm gate/check/test/build/lint/alpha:*`、`pre-merge-check.sh`）+ `run_in_background=true` → deny + 提示前台跑。

三个文件：
- `.claude/hooks/gate-background-guard.sh`（hook 本体，~60 行）
- `.claude/settings.json`（注册 hook，+8 行）
- `test/hooks/gate-background-guard.test.sh`（21 个测试：13 deny + 8 allow）

## Why

四只猫（gpt54/opus46/47/48）独立踩过同一个 bug：-p/headless 下用 `run_in_background:true` 跑 `pnpm gate`，CLI 回合结束后没人接结果——"然后就没然后了"。

根因（opus-48 诊断）：Bash 工具说明无条件承诺 `run_in_background` 完成后会 re-invoke，但 -p 下这个承诺不兑现。staging 每轮已提醒，四只猫照犯——因为工具说明贴在手指上，staging 在 2000 token 外，**近的赢**。

解法：gate 命令在**所有模式**下都禁后台（不只 -p），因为 gate 结果是后续决策的前提，后台跑 = 没理由。

## Original Requirements（必填）

> "好多线程跑 merge gate 放在后台跑然后就没然后了，他们仿佛不知道自己是 -p 启动的"
> "hold ball 有个参数增加一下就是这个——唤醒你不是时间而是某个条件"
> "A要做 B这个其实是hold ball能力的补充"

- 来源：当前 thread 2026-06-25 铲屎官发言
- **请对照上面的摘录判断：hook deny 是否解决了"gate 后台没然后"的问题**

## Tradeoff

- 选了"所有模式都禁"而非"只 -p 下禁"——更简单（不需检测运行模式），更安全（gate 后台在 interactive 下也无意义），代价是丧失了"interactive 下后台跑 gate 同时做别的"的灵活性（但这个灵活性本身就是 bug 的入口）。
- 没在 hook 里检测 `-p` 模式，因为 hook input 不暴露运行模式字段，加检测 = 复杂度换不来收益。

## Architecture Ownership（必填）

Architecture cell: hooks (PreToolUse guard)
Map delta: none
Why: 新增独立 hook 脚本 + 注册到现有 PreToolUse chain，不改变任何 cell 边界。与 runtime-sanctuary-guard 同 pattern、同层级。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- settings.json 注册位置是否合理（放在 sanctuary guard 后面）

## Open Questions

### 技术 OQ（给 reviewer）

1. **gate pattern 覆盖度**：当前 regex `pnpm\b\s+(\S+\s+)*\b(gate|check|test|build|lint|alpha:(start|test))\b` 覆盖了已知的 gate 命令。请审查是否有遗漏或误伤（特别注意 `pnpm dev:direct` 不该被拦——当前测试确认 allow）。
2. **`run_in_background` 字段可靠性**：hook 假设 Bash tool_input 里 `run_in_background` 字段存在且类型为 bool。如果某个 CLI 版本不传这个字段，hook 默认 false（放行），是 fail-open。这是否 OK？

### 价值 OQ（给 CVO）

无——这是铲屎官直接拍板要做的止血方案。

## Next Action

请 review 三个文件的正确性 + pattern 覆盖度。放行后我开 PR 走 merge-gate。

## Review Sandbox（必填）

无需运行环境——纯 shell hook + shell 测试，本地 `bash test/hooks/gate-background-guard.test.sh` 即可验证。
- Path: `/tmp/cat-cafe-review/f167-phase-p0/{reviewer-handle}`
- Verify: `bash test/hooks/gate-background-guard.test.sh`

## 自检证据

### Spec 合规

AC-P0 ✅：gate 类命令禁 `run_in_background` + deny + 提示前台。实现比 spec 更广（所有模式，不只 -p），是有意 over-deliver。

### 测试结果

```
hook tests → 21/21 pass ✅
pnpm check → exit 0, 0 errors ✅
pnpm lint  → exit 0, 0 errors ✅
```

### 相关文档

- Feature: `docs/features/F167-a2a-chain-quality.md` Phase P
- Evidence: LL-053, LL-075（-p 下后台 bash 已知不可靠）

### 如果判断错了我最可能错在哪

1. gate pattern 可能漏掉某个变体（如 `npx` 调用、或未来新增的 gate 命令），但 fail-open 不危险。
2. `run_in_background` 字段可能在某些 tool 版本中不存在或命名不同。
3. `pnpm process:cleanup` 或 `pnpm sync:skills` 等长命令也有后台需求，但它们不是 gate 类（不需要拿结果决策），当前 pattern 正确放行。

[宪宪/claude-opus-4-6🐾]
