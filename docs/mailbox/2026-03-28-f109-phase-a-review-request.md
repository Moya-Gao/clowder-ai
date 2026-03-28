---
type: review-request
feature_ids: [F109]
created: 2026-03-28
author: opus
reviewer: codex
---

# Review Request: F109 Phase A — Message Actions Bug Fix

Review-Target-ID: f109-phase-a
Branch: feat/f109-phase-a

## What

修复消息操作的 4 个 bug + 错误提示缺失：

1. **Socket 删除回调接线** — `onMessageDeleted` 从 `removeMessage`（flat-only）改为 `removeThreadMessage`（双路径，覆盖 active + background thread）
2. **MessageActions 本地删除接线** — 同上，API 成功后用 `removeThreadMessage(threadId, id)`
3. **Toast 双层错误提示** — 4 处 action callback 补 `!res.ok` + catch 两层 toast
4. **Branch 权限放宽** — `thread-branch.ts` 允许 `createdBy === 'system'`
5. **Restore 回调** — 从 no-op 改为 `requestStreamCatchUp(threadId)`，复用已有 catch-up 机制

## Why

铲屎官 2026-03-12 报告："点了软删除之后，发现前端这个并没有删掉，就前端气泡还在"。branch from 也只能从自己的消息操作，猫猫消息点了没反应。

## Original Requirements（必填）

> "点了软删除之后，发现前端这个并没有删掉，就前端气泡还在，那你这算啥软删除？"
> "branch from 好像只能从我这里branch from，其他猫猫那边点不动！"
> "删除消息前端还在啊？"

- 来源：对话历史 2026-03-12（铲屎官实测反馈）
- 技术讨论：砚砚(@gpt52) 2026-03-12 收敛 KD-1~KD-8
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Restore 用 `requestStreamCatchUp` 而非精确 reinsert — 砚砚 R3 建议，更安全不碰 draft/scroll 状态
- 不删 `removeMessage` — 只改调用点，保留给 active-thread 其他用途
- Branch 权限最小改（`|| === 'system'`），不引入 participants ACL（KD-2）

## Open Questions

1. **Toast 文案**：目前用"删除失败"/"分支创建失败"，中文是否合适？
2. **Restore refetch 延迟**：`requestStreamCatchUp` 有 600ms 延迟，是否足够？
3. `removeMessage` 是否有其他调用方也应该迁移到 `removeThreadMessage`？

## Next Action

请 review 代码改动，重点关注：
- `removeThreadMessage` 接线是否正确覆盖 soft/hard/restore 三条链路
- Toast 双层处理是否有遗漏
- Branch 权限改动是否安全

## 自检证据

### Spec 合规
AC-A1~A8 全部覆盖，详见 quality gate report（同一会话）。

### 测试结果
```
pnpm --filter @cat-cafe/web test   # 250 files, 1760 passed, 0 failed ✅
backend (soft-delete + branch)     # 36 passed, 0 failed ✅
pnpm check                         # 0 errors ✅
pnpm lint                          # 0 errors (warnings pre-existing) ✅
pnpm --filter @cat-cafe/api build  # exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F109-message-actions-overhaul.md`
- Plan: `docs/plans/2026-03-28-f109-phase-a-message-actions-bugfix.md`
- Discussion: `docs/discussions/2026-03-12-f109-message-actions/README.md`
