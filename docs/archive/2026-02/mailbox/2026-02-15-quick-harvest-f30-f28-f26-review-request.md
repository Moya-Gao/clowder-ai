# Review Request: Quick Harvest F30 + F28 + F26

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-15
**Branch**: `feat/quick-harvest-f30-f28-f26`
**Worktree**: `cat-cafe-quick-harvest`

---

## What

三个前端增强特性的快速收割，4 个 commit：

### F30: 代码块复制 + 文件路径跳转 (`9ffd972`)
- `MarkdownContent.tsx` (+96 lines)：
  - `CodeBlock` 组件：hover 显示复制按钮，点击复制代码内容到剪贴板，1.5s 后恢复图标
  - `linkifyFilePaths()`：检测绝对路径 (`/packages/api/...`) 和相对路径 (`packages/...`)，生成 `vscode://file/` 链接
  - `withMentionsAndLinks()`：组合 @mention 高亮 + 文件路径链接，替代原来的 `withMentions()`

### F28: 授权桌面通知 (`b98230f`)
- `useAuthorization.ts` (+46 lines)：
  - `notifyAuthRequest()`：Desktop Notification API 推送 + 标签页标题闪烁（离开页面时）
  - 组件挂载时请求 `Notification.requestPermission()`
- `AuthorizationCard.tsx`：添加 `animate-pulse-subtle` 呼吸动画
- `ChatContainer.tsx`：顶部工具栏增加琥珀色权限待办角标 `🔐 N`
- `globals.css`：新增 `pulse-subtle` 关键帧动画

### F26: 右侧面板重构 + 实时任务进度 (`f59740f`)
- **后端** `invoke-single-cat.ts` (+34 lines)：
  - 检测 `TodoWrite` / `write_todos` 工具调用，提取任务列表
  - 通过 `system_info(task_progress)` 事件推送到前端
- **前端** `chat-types.ts` (+18 lines)：新增 `TaskProgressItem`、`TaskProgressState` 类型
- **前端** `useAgentMessages.ts` (+10 lines)：解析 `task_progress` 事件，静默更新 store
- **前端** `RightStatusPanel.tsx` (重写 219 行变更)：
  - 拆分为"当前调用"和"历史参与"两个区域
  - `CatTaskProgress` 组件：✅🔄⬚ 清单 + 进度条
  - `CatInvocationCard` 组件：复用于 active/history

### BACKLOG 更新 (`640fc1f`)
- F30、F28、F26 标记为 `[~]`（等 review）

## Why

铲屎官要求先做"快速收割"——把 BACKLOG 中估算工作量小、纯前端的特性集中实现，为后续 PR 双层 review 流程和重构腾出空间。三个特性互不依赖，一起提 review 减少轮次。

## Tradeoff

1. **F30 文件路径检测**：用正则而非 AST，可能误检（如 `/usr/bin/env` 等系统路径）。当前接受，因为 Cat Café 语境中几乎只出现项目路径
2. **F28 Notification API**：没有做 Service Worker 持久化通知（需要注册 SW），当前用的是简单的页面级 Notification。离开页面后标题闪烁已足够
3. **F26 RightStatusPanel.tsx**：286 行，超过 200 行警告线。但已拆出 `CatTaskProgress` 和 `CatInvocationCard` 两个内部组件，进一步拆分需要创建新文件，当前收益不大
4. **F26 任务提取**：只检测 `TodoWrite` / `write_todos` 两个工具名，Gemini 的 set_task_progress 暂未覆盖（等暹罗猫接入后再加）

## Open Questions

1. F30 的 `vscode://` 链接在非 VSCode 用户环境下会失败——是否需要做编辑器选择？（我倾向 P3 不管）
2. F26 的 `CatTaskProgress` emoji (✅🔄⬚) 是临时选择，暹罗猫有意见可以换
3. F28 的 `Notification.requestPermission()` 在 mount 时调用，部分浏览器可能 block 自动请求——是否需要做一个"启用通知"按钮？（我倾向等用户反馈）

## Verification

```bash
# 在 worktree 中
cd /Users/lysander/projects/relay-station/cat-cafe-quick-harvest

# TypeScript 类型检查
pnpm --filter @cat-cafe/web tsc --noEmit   # ✅ 通过

# 前端测试 (290 tests, 47 files)
pnpm --filter @cat-cafe/web test           # ✅ 全部通过

# API 测试 (1230 tests)
pnpm --filter @cat-cafe/api test           # ✅ 全部通过 (Redis tests skipped by guard)
```

## Next Action

请 review 以上 4 个 commit（重点关注 F26 的后端 task 提取逻辑和前端面板重构）。

Review 通过后我会走 SOP Step 5→6：push feature branch → 开 PR → 合入 main → 清理 worktree。
