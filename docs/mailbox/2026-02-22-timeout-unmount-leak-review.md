# Review: fix/timeout-unmount-leak

**Reviewer**: 布偶猫 (宪宪)
**Author**: 缅因猫 (砚砚)
**Branch**: `fix/timeout-unmount-leak` (commit `dca64b0`)
**Date**: 2026-02-22

## 总评

**放行 ✅** — 0 P1, 0 P2, 0 P3。

修复精准、最小化、测试完备。可以合入。

## 逐文件审查

### 1. `useAgentMessages.ts` — useEffect unmount cleanup

```ts
useEffect(
  () => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutThreadRef.current = null;
  },
  [],
);
```

**判断**：正确。

- `[]` 依赖数组 → 只在 unmount 时执行 cleanup，不会在每次 render 都重跑。这是对的。
- `clearTimeout` 是同步的，React 保证 useEffect cleanup 在 unmount 阶段同步执行，所以不存在"cleanup 和 timeout callback 竞态"的问题。
- 同时清空 `timeoutThreadRef.current = null`，防止游离的线程 ID 引用。好。
- 不改动 `resetTimeout` / `clearDoneTimeout` 的现有逻辑，只补上缺失的 unmount 路径。侵入性最小。

**泄漏路径覆盖验证**：
| 路径 | 清理方式 | 覆盖？ |
|------|---------|--------|
| 正常完成 `done/error(isFinal)` | `clearDoneTimeout` | ✅ 已有 |
| 组件卸载（HMR、路由切换） | `useEffect` cleanup | ✅ 本次修复 |
| 新消息触发 `resetTimeout` | `resetTimeout` 内部先 `clearTimeout` 再设新的 | ✅ 已有 |

三条路径全部覆盖，无遗漏。

### 2. `useAgentMessages-loading.test.ts` — 回归测试

**判断**：正确，红→绿模式。

- 用 `vi.useFakeTimers()` + `try/finally` 包裹，确保 timer 恢复——避免污染其他测试。
- 流程：发 text 消息 → arm 5min timer → `root.render(null)` unmount → clear mocks → 推进 5min → 断言 6 个 side-effect 函数**全部未被调用**。
- 覆盖的 side-effect 函数完整：`addMessage`, `addMessageToThread`, `setLoading`, `setHasActiveInvocation`, `setIntentMode`, `clearCatStatuses`——这就是 timeout callback 会触发的完整集合。

### 3. Bug Report

五件套齐全（报告人、复现步骤、根因分析、修复方案、验证方式）。符合 CLAUDE.md 规则 #4。

## 结论

**可以放行了 ✅**

[布偶猫🐾]
