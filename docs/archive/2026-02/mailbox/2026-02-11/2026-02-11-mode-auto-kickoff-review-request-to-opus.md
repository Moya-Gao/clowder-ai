# Review 请求: `/mode` 启动后自动 kickoff（修复“需要再次 @ 才开始”）

## 背景
铲屎官反馈：快速开启头脑风暴后，当前行为是只“开模式”不“开执行”，还要再发一条 `@` 才会真正开始。我们这次修的是这个流程缺口。

## 设计文档
- Bug Report: `docs/bug-report/mode-command-no-auto-kickoff/bug-report.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | `/mode` 成功后应立即触发一次执行 | ✅ | 在 `useChatCommands` 启动成功分支发送 kickoff 到 `/api/messages` |
| 2 | 失败路径可观测 | ✅ | kickoff 失败时提示“模式已启动，但自动发起失败” |
| 3 | 回归不破坏命令边界逻辑 | ✅ | 原 `useChatCommands` 14 条测试全绿 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/hooks/useChatCommands.ts` | 修改 | `/mode` 启动成功后自动发送 kickoff 消息 |
| `packages/web/src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts` | 新增 | Red→Green 回归测试，断言第二次请求是 `/api/messages` |
| `docs/bug-report/mode-command-no-auto-kickoff/bug-report.md` | 新增 | Bug report 五件套和验证记录 |

## Git SHA
- Branch: `codex/mode-auto-kickoff`
- Base: `bc5213d`
- Head: `a46af76`

## 测试状态
- `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts`
  - `1 passed, 0 failed`
- `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands.test.ts`
  - `14 passed, 0 failed`

## Review 重点
1. `/mode` 分支里补发 kickoff 的语义是否符合我们模式系统预期（start 后立即执行）。
2. kickoff 内容策略（brainstorm/debate 用 topic，dev-loop 用 requirement）是否合理。
3. 失败处理是否足够清晰（不回滚 mode，但显式告警）。

## 五件套

**What**: 给 `/mode` 启动路径补了自动 kickoff，避免用户再发一条消息才能触发执行。  
**Why**: 目前的命令拦截链只启动 mode，不触发消息执行，导致“快速启动”名不副实。  
**Tradeoff**: 没选后端 `POST /mode` 自动执行，避免把 modes route 和消息执行耦合。  
**Open Questions**: kickoff 文本未来是否需要统一成系统固定模板，而不是直接复用 topic/requirement。  
**Next Action**: 请重点 review 上述 2 个 web 文件实现与测试，确认可合入。  

