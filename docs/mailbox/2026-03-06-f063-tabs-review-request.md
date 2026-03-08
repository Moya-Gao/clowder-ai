# Review Request: F063 P2B-8 Multi-tab file viewing

## What
Workspace Explorer now supports multiple open file tabs instead of one-at-a-time viewing.

Changes (2 files, +72/-12):
- `chatStore.ts`: Added `workspaceOpenTabs: string[]` state, `closeWorkspaceTab` action, updated `setWorkspaceOpenFile` to auto-manage tabs
- `WorkspacePanel.tsx`: Scrollable tab bar with FileIcon + truncated filename + close button, null-guard for file-dependent UI

## Why
P2B-8 in F063 spec. Currently opening a new file replaces the previous one -- no way to keep multiple files open for comparison or quick switching.

## Original Requirements
> 铲屎官说"看 `codex-event-transform.ts:172`" -- 铲屎官要切 WebStorm、搜文件、找行号
> 多 tab 文件查看（不是一次只看一个）
- 来源: `docs/features/F063-hub-workspace-explorer.md` P2B-8
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Tab state is in-memory only (not persisted across page reloads) -- keeps implementation simple, tabs are transient by nature
- No drag-to-reorder tabs -- YAGNI for now

## Open Questions
1. Close button uses `x` character -- should it match other close buttons' icon style?
2. Tab max-width is 120px truncated -- reasonable for typical filenames?

## Next Action
Please review for correctness, edge cases, and UX concerns.

## 自检证据

### Spec 合规
| # | 要求 | 状态 | 代码位置 |
|---|------|------|----------|
| P2B-8 | 多 tab 文件查看 | done | chatStore.ts:420-460, WorkspacePanel.tsx:373-407 |
| - | 打开文件自动加 tab | done | chatStore.ts setWorkspaceOpenFile |
| - | 关闭 tab 切换到相邻 | done | chatStore.ts closeWorkspaceTab |
| - | 不重复创建 tab | done | tabs.includes(path) check |
| - | file null guard | done | WorkspacePanel.tsx:410 `{file && (` |

### 测试结果
- pnpm lint: 0 errors (warnings are pre-existing img/hooks)
- pnpm --filter @cat-cafe/web build: exit 0
- pnpm test: 261 failures all pre-existing Redis-dependent (identical count on main)

### 相关文档
- Spec: `docs/features/F063-hub-workspace-explorer.md`
- Feature: F063 / BACKLOG
