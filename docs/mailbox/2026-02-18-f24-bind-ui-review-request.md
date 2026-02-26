---
feature_ids: [F024]
topics: [bind, request]
doc_kind: mailbox
created: 2026-02-18
---

## Review 请求: F24 中途消息注入 + #72 Session Bind 前端 UI

### 背景

铲屎官指定的两个"半成品快速收尾"任务：
1. F24 最后一个子能力——中途消息注入（前端 ChatInputActionButton 改动）
2. #72 Session 手动绑定的前端入口（SessionChainPanel 加 bind 输入框）

### 设计文档

无独立 plan/spec（铲屎官直接指定的小改）。
- F24 背景：`docs/BACKLOG.md` F24 条目
- #72 背景：`docs/BACKLOG.md` #72 条目 + `packages/api/src/routes/session-chain.ts` 已有 bind API

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | F24: hasActiveInvocation 时仍能发消息 | ✅ | Stop 按钮独立展示，不再替换 Send/Mic |
| 2 | #72: SessionChainPanel 加 bind 输入框 | ✅ | BindSessionInput 组件，点 "bind..." 展开 |
| 3 | BACKLOG 更新 | ✅ | #72 [x], F24 [x]，完成记录已追加 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/components/ChatInputActionButton.tsx` | 修改 | hasActiveInvocation 时同时展示小尺寸 Stop + 正常 Send/Mic 按钮 |
| `packages/web/src/components/SessionChainPanel.tsx` | 修改 | 新增 BindSessionInput 内部组件 + refreshKey 触发 re-fetch |
| `docs/BACKLOG.md` | 修改 | #72 和 F24 标记完成 + 合并主仓审计更新 |

### Git SHA

- Base: `0fed644` (main HEAD)
- Head: `f85db2e` (feat/f24-mid-inject-and-bind-ui)

### 测试状态

- `pnpm --filter @cat-cafe/web test`: 46/56 files pass, 296/298 tests pass（10 失败均为既有 shared 模块/mock 类型问题）
- `pnpm --filter @cat-cafe/api test`: 1329 pass, 1 fail（既有 `update() sets error on failed status` 问题）
- 无新增测试（纯前端 UI 改动，无新逻辑）

### Review 重点

1. **ChatInputActionButton** 的 Stop + Send 并存布局：Stop 用了较小尺寸 `p-2 rounded-lg w-4 h-4`，Send 保持原尺寸 `p-3 rounded-xl w-5 h-5`，这样视觉上有主次区分。是否合理？
2. **BindSessionInput** 的 error handling：目前只显示 "err" 文字，没有具体错误信息。够不够？
3. **refreshKey** 模式触发 re-fetch：bind 成功后 `setRefreshKey(k => k + 1)` 触发 sessions 重新拉取。是否有更优雅的做法？

### 五件套

**What**: ChatInputActionButton 拆分 Stop/Send 并存 + SessionChainPanel 新增 bind 输入框
**Why**: 铲屎官要求收尾两个半成品功能，让铲屎官在猫猫执行期间可发消息 + 在前端直接绑定 CLI session
**Tradeoff**: Stop 按钮可以放在别的位置（如 message area），但放在 action button 区域与 Send 并排最直观
**Open Questions**: 无
**Next Action**: 请 review 上述三个文件
