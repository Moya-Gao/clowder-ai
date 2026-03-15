# Review Request: F121 follow-up hotfix — pinned section auto-expands on new reply

## What
这轮修的是 F121/F095 热区里的一个 follow-up regression：

1. `useCollapseState()` 收紧 auto-expand 条件，避免当前 thread 没切换时，`threadGroups` 因新消息重算就把用户手动折叠过的分组再次强制展开。
2. 新增 hook 级回归测试，直接覆盖“`currentThreadId` 不变、只有 `threadGroups` 变化”这个触发路径。
3. 新增 bug report，并把这次 follow-up hotfix 挂回 F121 真相源。

## Why
铲屎官在 runtime 反馈：当前 thread 位于 `置顶` 且用户手动折叠后，只要有人回复，`置顶` 会“biu”一下自己展开，打断阅读。这是我们刚修完 F121 后在同一 sidebar 热区冒出来的 follow-up regression，不能放到后面再说。

## Original Requirements（必填）
> “如果有人回消息，置顶那一栏会‘biu’一下突然展开。”
> “那你直接写bug report 挂在f121下直接修了喊 opencode review得了，可以吗？我们现在比较着急闭环上线开源 有时间压力”
- 来源：2026-03-14 当前 thread 对话历史（铲屎官 runtime 反馈）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 这次没有去动 `findGroupKeyForThread()`、group 排序、socket unread 真相源；只收紧 auto-expand 的触发时机。好处是改动小、指向性强，代价是这次不顺手处理同区域的其他潜在 UX 小问题。
- 新测试走 bare `createRoot + act`，没有引入额外 testing library，和我们现有 hook 测试风格保持一致。

## Open Questions
1. `lastAutoExpandedThreadId` 这个“一线程只自动展开一次”的语义，是否覆盖了你看到的所有合理切换路径？
2. 这轮只验证了 `置顶`，但逻辑对 `project/recent/favorites` 同样生效。你看有没有需要额外加一个 project group 的镜像 case？

## Next Action
请 @opencode 做 code review，重点看：
- `use-collapse-state.ts` 的新 guard 是否会误伤首次加载 / 真正切线程时的 auto-expand
- hook 级回归测试是否足够钉住这次 regression

## 自检证据

### Spec 合规
- Bug report 已存档：`docs/bug-report/2026-03-14-f121-pinned-section-auto-expand/bug-report.md`
- F121 已挂 follow-up hotfix：`docs/features/F121-community-frontend-ux-triage.md`
- 根因已缩到单点：`useCollapseState()` 的 auto-expand effect 依赖过宽

### 测试结果
```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/use-collapse-state-hook.test.ts
# 1 passed

pnpm --filter @cat-cafe/web test -- src/components/__tests__/use-collapse-state.test.ts
# 22 passed

cd packages/web && pnpm exec next lint --file src/components/ThreadSidebar/use-collapse-state.ts --file src/components/__tests__/use-collapse-state-hook.test.ts --file src/components/__tests__/use-collapse-state.test.ts
# 0 warnings, 0 errors

pnpm --filter @cat-cafe/web build
# exit 0（仅既有 warning，无新 error）
```

### 浏览器实测
- worktree: `../cat-cafe-f121-pinned-expand`
- URL: `http://localhost:3000` / API `http://localhost:3102`
- Redis: `6398`
- 实测链路：
  1. 置顶 `codex Review Inbox`
  2. 切到该 thread
  3. 手动折叠 `置顶`
  4. 发送 `只回复 ok`
  5. 等缅因猫回复 `ok`
- 结果：发送后和回复到达后，`置顶` 都保持折叠，没有再自己弹开

### 相关文档
- Feature: `docs/features/F121-community-frontend-ux-triage.md`
- Related: `docs/features/F095-sidebar-collapse-memory.md`
- Bug report: `docs/bug-report/2026-03-14-f121-pinned-section-auto-expand/bug-report.md`
- Branch: `fix/f121-pinned-expand`
- HEAD: `bdfb28a8`
