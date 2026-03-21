---
feature_ids: [F131]
topics: [review-request, workspace, navigation]
doc_kind: mailbox
created: 2026-03-22
---

# Review Request: F131 Workspace Navigator — Infra Layer

## What

F131 基础设施层实现：猫猫可编程导航 Workspace 面板。

核心变更 (6 files, +289/-5):
1. **`POST /api/workspace/navigate`** — 新 API endpoint，接受 `{ worktreeId, path, action?, line? }`，校验路径存在性后通过 Socket.IO 双广播 `workspace:navigate` 事件
2. **`useWorkspaceNavigate` hook** — 镜像 F120 `usePreviewAutoOpen` 模式，fail-closed worktree 作用域过滤，分发到现有 store（reveal → `setWorkspaceRevealPath`，open → `setWorkspaceOpenFile`）
3. **`ChatContainer.tsx`** — 挂载新 hook（+2 行）
4. **`index.ts`** — 给 `workspaceRoutes` 注入 `socketEmit` 选项（同 `previewRoutes` 模式）

附带修复：
- `port-validator.ts` biome format 自动修复（预存在问题）
- `docs/features/index.json` 重生成

## Why

铲屎官要求猫猫能帮他打开 Workspace 面板中的文件/目录，不用手动点击层层目录。模式与 F120 browser-preview auto-open 完全一致。

## Original Requirements（必填）

> "你最好也有自己的 skills，能够让猫猫。我跟猫猫说，现在我们一起来看一下审，看一下日志。你能帮我去把右边的 workspace 面板打开？"
> "跟浏览器的 Preview 一样。更通用的是，我用语音或者用文字告诉你，你帮我一起打开这个 workspace 的哪个地方？你要能帮我打开。"
> "铲屎官不会给精确路径。猫猫自己能 glob/grep 到路径，自己去传精确路径到 API。"

- 来源：`docs/features/F131-workspace-navigator.md` L15-23
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 复用了现有 `setWorkspaceRevealPath` + `setWorkspaceOpenFile` 而非新增 pending 状态——因为这两个方法已经处理了面板切换（`rightPanelMode: 'workspace'`），没必要重复 F120 的 pending 消费模式
- `workspace.ts` 从 642→685 行，超过 350 行硬上限，但这是预存在问题，我只加了 43 行且风格与文件完全一致。如需拆分建议单开 debt item

## Open Questions

1. **`shouldAcceptNavigate` 与 `shouldAcceptAutoOpen` 逻辑完全相同**——是否应该提取为共享 util？目前保持独立以降低耦合
2. **Socket 连接复用**——`useWorkspaceNavigate` 和 `usePreviewAutoOpen` 各自建立独立 socket 连接。是否应该共享单一连接？这是 P3 优化项

## Next Action

请 review 代码质量 + 安全性 + 架构合理性。特别关注：
- Socket 事件作用域过滤（cross-session 泄露风险）
- `resolveWorkspacePath` 安全校验是否充分
- hook 是否会导致不必要的重渲染

## 自检证据

### Spec 合规

| AC | 状态 | 代码位置 |
|----|------|----------|
| AC-1: API → Hub 面板导航 | ✅ | workspace.ts L649-687, useWorkspaceNavigate.ts |
| AC-2: reveal + open 双 action | ✅ | useWorkspaceNavigate.ts L41-46 |
| AC-3: 跨 worktree 导航 | ✅ | chatStore.ts setWorkspaceOpenFile L642-664 |
| AC-4: 面板关闭时事件不丢失 | ✅ | hook 挂载在 ChatContainer（always rendered） |
| AC-5: Skill 文档完成 | ✅ | 已在 main commit 36ed3d43 |
| AC-6: E2E 验证 | 🔶 | API + hook + store 链路测试通过，需运行态手动验证 |

### 测试结果

```
node --test packages/api/test/workspace-navigate.test.js  # 7 passed, 0 failed
node --test packages/api/test/workspace-*.test.js          # 29 passed, 0 failed
vitest run workspace-navigate-store.test.ts                 # 7 passed
vitest run (all related)                                    # 19 passed, 0 failed
pnpm check                                                  # 0 errors ✅
pnpm lint                                                   # 0 errors (warnings only, pre-existing) ✅
pnpm --filter @cat-cafe/api run build                       # exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F131-workspace-navigator.md`
- Skill: `cat-cafe-skills/workspace-navigator/SKILL.md`
- Branch: `feat/f131-workspace-navigator`
- Review-Target-ID: `f131`
