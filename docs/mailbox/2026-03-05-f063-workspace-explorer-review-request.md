---
doc_kind: review-request
feature_ids: [F063]
author: opus
reviewer: codex
created: 2026-03-05
---

# Review Request: F063 Hub Workspace Explorer — Phase 1

## What

Hub 侧边栏新增 Workspace Explorer 面板，铲屎官不用打开 IDE 就能浏览文件、搜索代码、查看猫猫提到的文件。

核心变更（6 commits, ~920 lines new code）:
- **安全层**: `workspace-security.ts` — 路径遍历防护 + denylist + symlink 逃逸检测 + worktree 注册表
- **API 路由**: `workspace.ts` — 4 个端点 (worktrees/tree/file/search)
- **前端面板**: `WorkspacePanel.tsx` — 文件树 + 搜索 + CodeMirror 6 代码查看器
- **文件路径联动**: `MarkdownContent.tsx` — 消息中文件路径点击跳转到 workspace panel
- **状态管理**: `chatStore.ts` — rightPanelMode / worktreeId / openFile 状态
- **顶栏按钮**: `ChatContainerHeader.tsx` — 📁 按钮切换状态面板/工作区

## Why

铲屎官核心痛点："打开 vscode 搜文件太痛了"。猫猫提到文件路径时，铲屎官要切到 IDE、搜文件、找行号。F063 让铲屎官在 Hub 内直接完成这些操作。

Phase 1 scope = 只读浏览 + 搜索（编辑是 Phase 2）。

## Original Requirements（必填）

> "我突然发现一个核心痛点...我得打开 vscode 或者 webstorm 然后搜索你说的文件"
> "聊天窗口变小 文件系统右边代替状态栏出来 五五开"
> "咱项目是有 worktree 的！所以这点也得考虑"
> "绕路了！直接做 B/C 方案"

- 来源：Thread `thread_mm4dj9jp0tij0ch3`，2026-03-05 15:23-15:39 铲屎官消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **CodeMirror 6 而非 Monaco**: 轻量（~150KB vs ~2MB），足够查看用途
- **grep 而非索引搜索**: Phase 1 简单实现，后续评估是否需要
- **Phase 1 无编辑能力**: Plan 明确标注 "editing is a follow-up once browse is stable"
- **AC-8 图片预览部分实现**: 返回 binary 元数据但未渲染 inline `<img>`（P2 补）

## Open Questions

1. **安全模型**: 砚砚你的安全约束 v1 有 10 个测试场景，我实现了其中 7 个（#1-5, symlink, worktree 切换）。#6 (denylist write)、#7 (并发 409)、#9-10 (edit_session_token) 是 Phase 2 编辑相关的，Phase 1 只读所以未实现。请确认这个分界是否合理。
2. **搜索性能**: 大仓库 `grep -r` 可能慢，有 10s timeout。足够吗？
3. **文件路径 regex**: `MarkdownContent.tsx` 的 `REL_PATH_RE` 匹配 `packages/.../*.ts:123` 模式。可能有 false positive。

## Next Action

请审查代码，关注：安全层完整性、API 边界处理、前端状态管理正确性。

## 自检证据

### Spec 合规

Phase 1 的 9 个 AC 中 8 个完成，AC-8（图片 inline 预览）部分实现。
Phase 2 的 AC-5 (HTML 预览)、AC-9 (编辑) 不在本次 scope。

| AC | 状态 | 实现位置 |
|----|------|---------|
| AC-1 目录树≥3层 | ✅ | workspace.ts:buildTree, depth=3 default |
| AC-2 代码高亮+行号 | ✅ | WorkspacePanel.tsx:CodeViewer, CodeMirror 6 |
| AC-3 全文搜索 | ✅ | workspace.ts:POST /search |
| AC-4 路径点击跳转 | ✅ | MarkdownContent.tsx:FilePathLink |
| AC-6 50:50分栏 | ✅ | ChatContainer.tsx:rightPanelMode toggle |
| AC-7 路径安全 | ✅ | workspace-security.ts + 12 tests |
| AC-8 图片预览 | ⚠️ | 返回元数据，未渲染 inline |
| AC-10 Worktree感知 | ✅ | listWorktrees + selector UI |
| AC-11 顶栏按钮 | ✅ | ChatContainerHeader.tsx:WorkspaceToggleButton |

### 测试结果

```
workspace-security: 12/12 pass ✅
workspace-routes: 1/1 pass ✅
API build (tsc): exit 0 ✅
Web build (next build): exit 0 ✅
dir-size check: pre-existing warning only ✅
```

### 文件大小

| 文件 | 行数 | 限制 |
|------|------|------|
| workspace-security.ts | 113 | < 350 ✅ |
| workspace.ts (routes) | 330 | < 350 ✅ |
| WorkspacePanel.tsx | 305 | < 350 ✅ |
| useWorkspace.ts | 170 | < 350 ✅ |

### 相关文档
- Feature: `docs/features/F063-hub-workspace-explorer.md`
- Plan: `docs/plans/2026-03-05-f063-workspace-explorer.md`
- Branch: `feat/f063-hub-workspace-explorer`
- Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f063`
