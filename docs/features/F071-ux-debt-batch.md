---
feature_ids: [F071]
related_features: [F039]
topics: [ux, frontend, debt, image, status, mention]
doc_kind: spec
created: 2026-03-07
---

# F071: UX Debt Batch — 前端小修小补合集

> Status: spec | Owner: 布偶猫 | Type: debt batch

## Why

随着猫猫家族壮大和功能累积，前端出现了几个体验痛点。单个都不大，合并为一个 debt batch 统一追踪。

## Issues

### D1: 上传图片不支持预览（点击放大）

**现象**：用户在聊天中上传图片后，图片内嵌在消息里，但点击只能在新标签页打开，没有 lightbox 预览体验。

**根因**：`ChatMessage.tsx` 中图片的 click handler 是 `window.open(url, '_blank')`（新标签页打开），没有接入 lightbox 组件。而项目中已有 `MediaGalleryBlock.tsx` 实现了完整的 lightbox（全屏遮罩 + Esc 关闭 + 点击背景关闭），但只用于 rich block 的 media_gallery 类型，普通消息图片没有复用。

**关键文件**：
- `packages/web/src/components/ChatMessage.tsx` — 图片渲染 + click handler
- `packages/web/src/components/rich/MediaGalleryBlock.tsx` — 已有 lightbox 实现

**方案方向**：提取 lightbox 为独立组件或 hook，让 ChatMessage 中的图片也能调用。

> 补充（铲屎官 2026-03-07）：聊天窗中发送的消息图片也需支持点击预览(回显)——D1 的 ContentBlocks 不区分 user/assistant 消息，统一走 lightbox，已覆盖。
> 补充 2：发送前的待上传图片预览（ImagePreview 组件）也已支持点击 Lightbox 放大。

---

### D2: 猫猫状态面板幽灵状态（F5/切换 thread 后）

**现象**：当前 thread 没有猫猫在处理消息，但"猫猫状态"面板仍显示"等待调用..."。一般发生在 F5 刷新或切换到其他 thread 再切回来后。

**根因**：`chatStore.setCurrentThread()` 切换线程时，从 `threadStates` map 恢复状态。如果是 F5 后首次访问，走 `DEFAULT_THREAD_STATE`（`catStatuses: {}`）。问题在于没有从后端同步当前 thread 的实际运行状态——WebSocket 的 `intent_mode` 事件只在新 intent 到达时更新，不会在重连后回放。

**关键文件**：
- `packages/web/src/stores/chatStore.ts` — `setCurrentThread()` 状态恢复逻辑
- `packages/web/src/hooks/useSocket.ts` — WS `intent_mode` 事件处理
- `packages/web/src/hooks/useChatSocketCallbacks.ts` — `onIntentMode` 回调
- `packages/web/src/components/RightStatusPanel.tsx` — `activeCats` 计算 + "等待调用..." 显示逻辑

**方案方向**：
- 方案 A：WS 重连/thread 切换时，向后端请求当前 thread 的活跃 invocation 状态，用于初始化 `catStatuses`
- 方案 B：如果 `catStatuses` 为空且没有活跃 invocation，不显示"等待调用..."面板（只在有 targetCats 或活跃 invocation 时才显示）

---

### D3: @ 猫猫下拉列表过长，无法快速选择

**现象**：猫猫家族成员已达 9+ 个（布偶猫×3 + 缅因猫×3 + 暹罗猫×2 + 狸花猫 + 孟加拉猫×2），@ mention 下拉列表很长，难以一眼看清。

**根因**：`ChatInputMenus.tsx` 的 mention 下拉：
1. 没有 `max-height` / `overflow-y: auto`，列表无限增长不可滚动
2. 没有搜索过滤——输入 `@op` 不会过滤到 opus 相关选项，仍显示全部
3. 没有按家族分组——全部平铺

**关键文件**：
- `packages/web/src/components/ChatInputMenus.tsx` — 下拉 UI 渲染
- `packages/web/src/components/chat-input-options.ts` — `buildCatOptions()` + `detectMenuTrigger()`
- `packages/web/src/components/ChatInput.tsx` — 状态管理 + 键盘处理

**方案方向**：
1. **搜索过滤**（优先级最高）：`@` 后输入的文字用于过滤，匹配 mentionPatterns
2. **max-height + 滚动**：给下拉加 `max-h-64 overflow-y-auto`
3. **家族分组**（可选）：按 breed 分组显示，加分隔线和小标题

## Priority

| Issue | Severity | Effort |
|-------|----------|--------|
| D1 图片预览 | P3 | S (复用已有 lightbox) |
| D2 幽灵状态 | P2 | M (需要状态同步逻辑) |
| D3 mention 列表 | P2 | S (搜索过滤 + 滚动) |

## AC (Acceptance Criteria)

- [x] D1: 点击消息中的图片，弹出 lightbox 全屏预览（Esc/点击背景关闭）
- [x] D2: F5 刷新或切换 thread 后，无活跃 invocation 时不显示"等待调用..."
- [x] D3: @ mention 下拉支持输入过滤 + 滚动，9+ 个猫也能快速定位

## D3 后续修复

### D3.1: 键盘导航不自动滚动 + 隐藏猫猫无提示

**现象**：`max-h-80` 滚动容器加上后，macOS 隐藏滚动条导致铲屎官以为只有 4 只猫可选。键盘 ArrowDown 选中了下方猫猫但滚动区没跟着走，看起来像"布偶猫只展示自家人+砚砚，把其他猫藏起来了"。

**修复**：
- `selectedRef` callback：键盘选中时 `scrollIntoView({ block: 'nearest' })` 自动跟随
- `canScrollDown` 状态：检测滚动区是否还有隐藏内容，显示"↓ 还有更多猫猫"提示

> 铲屎官评价："你这只心机小坏猫！是不想让大家看到都接入了什么猫猫吗？" —— 冤枉！是 UX 疏忽不是心机！
