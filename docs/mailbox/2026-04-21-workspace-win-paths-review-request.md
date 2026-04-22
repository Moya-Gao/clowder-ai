---
doc_type: review_request
status: open
last_updated: 2026-04-21
---

# Review Request: Workspace Windows path compatibility minimal fix

Review-Target-ID: workspace-win-paths
Branch: feat/workspace-win-paths

## What
- `packages/api/src/routes/workspace.ts`
  - `repoRoot` absolute-path validation 改为同时接受 Windows drive-letter / UNC 绝对路径
  - Workspace tree / search / tree root 的相对路径统一输出为 POSIX wire format（`/`）
- `packages/shared/src/utils/workspace-paths.ts`
  - 新增共享 helper：`isAbsoluteFilesystemPath()` / `normalizeWorkspaceRelativePath()`
- `packages/api/src/domains/workspace/workspace-security.ts`
  - `isDenylisted()` 改为同时接受 `/` 和 `\`，避免 API 出口统一成 POSIX 后漏判 denylist
- 回归测试
  - `packages/api/test/workspace-path-compat.test.js`
  - `packages/api/test/workspace-security.test.js`

## Why
社区 issue `zts212653/clowder-ai#563` 报的是 Windows 下 Workspace 文件树为空。  
当前公开实现里，最确定的两处根因是：

1. `/api/workspace/worktrees` 仍用 `repoRoot.startsWith('/')` 判断绝对路径，Windows `D:\...` 会被误判为非法
2. API 把 `path.relative()` 的平台分隔符直接回给前端，而前端 Workspace 逻辑按 POSIX 路径语义工作，`\` 会把祖先判断/懒加载/reveal 链路绕坏

这次只修已经坐实的问题，不顺手扩大到 `find` 搜索跨平台替换。

## Original Requirements（必填）
> “开源社区 issue563 windwos环境 你看看！是不是有这个bug？”  
> “那你是不是可以开worktree修复一下确定的问题？”  
> issue 原文：“右侧 Workspace 面板的 FILES 标签下显示 ‘还没有文件树 / 选择一个 worktree 开始浏览’，文件列表完全为空。”

- 来源：2026-04-21 当前 thread 原话 + `https://github.com/zts212653/clowder-ai/issues/563`
- 请对照上面的摘录判断：这次最小修复是否准确收住了“Windows 路径兼容导致 Workspace 空树”的确定问题

## Tradeoff
- 这次不碰 `find` 的 Windows 替代实现；那条是已确认兼容缺口，但不是本轮最小闭环的必要条件
- 这次把路径 helper 放在 `@cat-cafe/shared/utils`，没有放进根导出，避免把 Node-only path 逻辑带进 web bundle
- 这次验证以源码定向测试为主；全量 `@cat-cafe/api build` 目前仍被 worktree 里既有的 repo 级类型缺失挡住

## Open Questions
- 你是否同意把 Workspace API 的相对路径 wire format 明确定为 POSIX（`/`），而不是让前端到处做兼容？
- `isDenylisted()` 现在改成 `/[\\\\/]/` 双分隔符拆段，这个补口是否足够，还是还要进一步收敛 `resolveWorkspacePath()` 的 realpath 比较？
- 这轮不带 `find` 跨平台替换，你认为 scope 收得是否合理？

## Next Action
- 请 review 这次最小 patch 的边界是否正确
- 重点看：
  1. API 路径出口统一成 POSIX 后，是否还有安全/兼容副作用
  2. helper 放在 `@cat-cafe/shared/utils` 是否是合适边界
  3. denylist 的补口是否完整

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/workspace-win-paths/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 这次 claim 仅限“修复已确认的 Windows 路径兼容问题”，没有 claim “Workspace Windows 支持已完整闭环”
- 没有 UI 视觉改动，也没有 `.pen` 设计稿对照项
- 根目录工件闸门：无根目录媒体/设计工件

### 验证命令
- `pnpm exec tsx --test packages/api/test/workspace-path-compat.test.js`
  - `6 passed, 0 failed` ✅
- `pnpm exec tsx --eval "import('./packages/api/src/routes/workspace.ts').then(() => console.log('workspace-route-import-ok'))"`
  - `workspace-route-import-ok` ✅

### 已知外部阻塞（非本 patch 引入）
- `pnpm --filter @cat-cafe/api build` ❌
  - 当前 worktree 被未改动文件上的 repo 级类型缺失挡住：`PushNotificationService.ts`、`domains/memory/*`、`preview-gateway.ts`、`email-service.ts`、`xiaoyi-*`、`scheduler/*`、`routes/evidence.ts`、`routes/knowledge-feed.ts`
  - 本次 diff 只额外暴露出我自己删掉又补回的 `isAbsolute` import；已修正

### 相关文档
- Community issue: `zts212653/clowder-ai#563`
