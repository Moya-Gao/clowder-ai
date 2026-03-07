# Review Request: F063 Gap 4 — File Management (VSCode-level UX)

## What
Hub Workspace 新增文件管理功能：创建文件/目录、删除、重命名、上传（含拖拽），无需离开浏览器。

**Backend (5 endpoints)**:
- `POST /api/workspace/file/create` — 创建文件（409 if exists, auto-mkdir parent）
- `POST /api/workspace/dir/create` — 创建目录（mkdir -p, idempotent）
- `DELETE /api/workspace/file` — 删除文件或空目录
- `POST /api/workspace/file/rename` — 重命名/移动（409 if target exists）
- `POST /api/workspace/upload` — multipart 上传（10MB limit）

All endpoints reuse edit session token security (HMAC-SHA256, 30min TTL).

**Frontend**:
- TreeItem hover action bar: +file / +dir / rename / delete icons (VSCode `group-hover:opacity-100` pattern)
- `InlineTreeInput` component: inline input in tree for create/rename (auto-focus, select filename not extension)
- Drag-drop upload on directory rows (visual ring feedback)
- `useFileManagement` hook: token auto-refresh + 5 API wrappers
- `WorkspacePanel` wiring: callbacks + fetchTree refresh + auto-open after create

## Why
铲屎官想在 Hub 里直接管理文件，不用切到 Finder 或 IDE。目标是 VSCode 文件浏览器级别的体验。

## Original Requirements
> "如果我想要在我们的files里新建一个md文档或者什么文件或者把什么图片复制进去不用打开finder 或者其他的 可以吗？"
> "在vscode里的体验是怎么样的？你的方案和那个体验一样吗？"
> "我希望f63 写一下，然后commit push 然后 直接开worktree"
- 来源：Thread conversation 2026-03-07
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 未实现 drag-to-move（文件拖拽移动到其他目录）— 复杂度高，可后续加
- 上传限制 10MB — 合理默认，大文件应走 git
- 未做 confirm dialog for delete — 目前只能删空目录，风险低

## Open Questions
1. **安全边界**: 5 个新 endpoint 都走 `resolveWorkspacePath` + `isDenylisted` + token 验证，请确认无遗漏
2. **TreeItem 复杂度**: Biome 报 cognitive complexity 23（阈值 15），因为 hover actions + inline input + drag-drop 都在同一个组件里。是否需要拆分？
3. **上传流式写入**: 用 `@fastify/multipart` 的 `file.toBuffer()` 而非流式写入，10MB 内可接受？

## Next Action
请 review 代码质量 + 安全性 + UX 合理性。

## 自检证据

### Spec 合规
| # | 要求 | 状态 | 代码位置 | 测试 |
|---|------|------|----------|------|
| P4-1 | POST /file/create | OK | workspace-edit.ts:118-160 | 5 tests |
| P4-2 | POST /dir/create | OK | workspace-edit.ts:162-188 | 3 tests |
| P4-3 | POST /upload | OK | workspace-edit.ts:242-296 | 2 tests |
| P4-4 | DELETE /file | OK | workspace-edit.ts:190-240 | 4 tests |
| P4-5 | POST /file/rename | OK | workspace-edit.ts:298-340 | 3 tests |
| P4-6 | TreeItem hover actions | OK | WorkspaceTree.tsx | 2 tests |
| P4-7 | InlineTreeInput | OK | InlineTreeInput.tsx | 4 tests |
| P4-8 | Drag-drop upload | OK | WorkspaceTree.tsx:128-145 | — |
| P4-9 | Auto-open after create | OK | WorkspacePanel.tsx treeCallbacks | — |
| P4-10 | useFileManagement hook | OK | useFileManagement.ts | — |

### 测试结果
- `pnpm --filter @cat-cafe/web test` — 778 passed, 0 failed
- `node --test test/workspace-*.test.js` — 28 passed, 0 failed
- `pnpm lint` — 0 errors (pre-existing img warnings only)
- `pnpm -r --if-present run build` — exit 0

### 相关文档
- Plan: `docs/plans/2026-03-07-f063-gap4-file-management.md`
- Feature: F063 / `docs/features/F063-hub-workspace-explorer.md`
- Branch: `feat/f063-gap4-file-management` (3 commits)
