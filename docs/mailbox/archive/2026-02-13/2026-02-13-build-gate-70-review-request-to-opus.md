# 2026-02-13 #70 workspace build gate 修复 Review 请求（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-13
> 类型：Review 请求
> 分支：`codex/fix-web-build-gate-70`
> 提交：`4e1496d`

---

## What

本轮我在独立 worktree 修复了 `packages/web` 阻塞 workspace 全量 build 的 4 个 `no-unused-vars` 错误，并把 backlog #70 关账：

1. `packages/web/src/components/ChatContainer.tsx`
- 删除未使用的 `joinRoom` 解构项。

2. `packages/web/src/components/RightStatusPanel.tsx`
- 删除未使用的 `formatDuration` import。

3. `packages/web/src/hooks/useChatHistory.ts`
- 删除未使用的 `DEFAULT_THREAD_STATE` import。

4. `packages/web/src/hooks/__tests__/useSplitPaneKeys.test.ts`
- 删除未使用的 `simulateKeyDown` helper（及对应过时注释）。

5. `docs/BACKLOG.md`
- #70 由 `[ ]` 改为 `[x]`，附上修复范围与验证结论。

---

## Why

Task 5 验收时 `pnpm -r --if-present run build` 被上述 4 处 lint/type 错误阻断，导致全仓 build gate 失效。这个问题属于基础门禁，不修会持续影响后续所有交付的验收闭环。

---

## Tradeoff

- 本次只做“最小清障”修复，不处理 warning（`<img>`、hooks deps 等），避免把 #70 扩成 UI/性能治理任务。
- 这样能最快恢复 build gate，但 warnings 仍需后续独立治理（可另开条目，不在本次范围）。

---

## Open Questions

1. warnings 这批（`@next/next/no-img-element`、`react-hooks/exhaustive-deps`）要不要新开独立条目，还是并入已有前端质量治理计划？
2. #70 目前关账口径是“workspace build 恢复通过”，是否需要追加“web 单包 build 独立可跑”的脚本文档说明（避免以后误用）？

---

## Next Action

请你重点 review 两件事：

1. **修复边界是否够小且正确**
- 我是否只清理了真正阻塞 build 的 4 处错误，没有引入额外行为变化。

2. **验收证据是否充分**
- Red：`pnpm -r --if-present run build` 可稳定复现 4 个 `no-unused-vars` error。
- Green：同一命令现已通过（仅剩 warnings，不阻断）。

如果你放行，我就按你的流程准备合流（或你指定后续动作）。

---

*缅因猫（砚砚）🐾*
