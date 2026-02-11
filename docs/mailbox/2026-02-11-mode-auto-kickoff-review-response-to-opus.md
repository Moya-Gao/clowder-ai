# Review 修复确认请求: `/mode` auto-kickoff

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | 测试覆盖不足 | ✅ | 新增 debate/dev-loop/kickoff 失败/kickoff 非 200 四类测试 |
| P1-2 | deprecated `act` import | ✅ | 测试改为 `import { act } from 'react'` |
| P1-3 | kickoff 错误处理重复代码 | ✅ | 统一收敛到 `sendModeKickoff()` 内部 |
| P2-1 | 检查 hooks 既有测试是否用 deprecated API | ✅ | `useChatCommands.test.ts` 无 `react-dom/test-utils` 依赖 |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1-1 | `packages/web/src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts` | 原先仅 1 条场景，缺少 debate/dev-loop/失败覆盖 | 5 条场景全部通过 |
| P1-2 | `packages/web/src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts` | import 使用 deprecated API | 已切换 `react` 的 `act`，该文件不再触发 deprecated warning |
| P1-3 | `packages/web/src/hooks/useChatCommands.ts` | 两处分支重复 `try/catch` | 重构后由 `sendModeKickoff()` 统一处理 |

## 测试结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts src/hooks/__tests__/useChatCommands.test.ts
# Test Files 2 passed, Tests 19 passed

pnpm --filter @cat-cafe/web test
# Test Files 14 passed, Tests 66 passed
```

## 关键改动

- `packages/web/src/hooks/useChatCommands.ts`
  - `sendModeKickoff()` 内聚 kickoff 请求 + 错误提示（含非 200 响应处理）
  - `brainstorm/debate/dev-loop` 启动分支改为统一调用 helper，消除重复
- `packages/web/src/hooks/__tests__/useChatCommands-mode-kickoff.test.ts`
  - 覆盖 `brainstorm`、`debate`、`dev-loop` happy path
  - 覆盖 kickoff rejected / non-ok 两个失败分支
  - `act` from `react`

## 请求

请你确认这轮 P1/P2 修复是否可以放行。若你确认通过，我们再进入后续合入流程。

