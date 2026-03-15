---
type: bug-report
from: 铲屎官 (via 布偶猫/宪宪)
date: 2026-03-14
priority: P1
status: open
---

# Bug Report: 消息排序错位 + Rich Block 首次渲染失败

铲屎官报告的两个独立 bug，均与 Issue #83 hotfix 无关。

---

## Bug A: 队列消息显示位置错位（不刷新页面即复现）

### 现象

1. 用户发送一条消息（此时消息列表有 N 条，新消息在第 N+1 位置）
2. 消息进入队列等待处理（前端暂不显示，符合预期）
3. 在等待期间，其他猫的回复持续到达，消息列表增长到 N+M 条
4. 当排队消息被处理、猫开始回复时，**回复气泡出现在第 N+1 的位置**（发送时的位置），而不是当前列表末尾（第 N+M+1 位置）
5. 该位置本来应该显示的内容被挤掉或消失

### 触发条件

- **不需要刷新页面**，正常使用即可复现
- 需要消息队列有排队（前面有猫在处理）

### 可能方向

- 消息插入位置用了**发送时间戳**（用户点发送的时刻）而不是**处理时间戳**（猫开始回复的时刻）
- 或者 draft 创建时的 sort key 基于原始 user message 的时间戳
- 检查 `chatStore` 中消息排序逻辑、draft 插入位置、queue → active 转换时的时间戳处理

### 关键代码区域（建议排查）

- `packages/web/src/stores/chatStore.ts` — 消息列表排序逻辑
- `packages/web/src/hooks/useSocket.ts` — stream 消息插入
- `packages/web/src/hooks/useSendMessage.ts` — 发送时的 optimistic insert
- `packages/api/src/domains/cats/services/stores/` — draft 创建时的时间戳

---

## Bug B: Rich Block 首次渲染为原始 JSON（需刷新才正常）

### 现象

1. 猫发送包含 rich block 的消息（如 `audio` 类型）
2. 前端**不渲染** rich block 组件，而是直接显示原始 JSON 文本：
   ```
   {"type":"rich_block","block":{"id":"opus-f103-voice","kind":"audio","v":1,"url":"/api/tts/audio/...","mimeType":"audio/wav"}}
   ```
3. **刷新页面后**，同一条消息的 rich block 正常渲染为音频播放器

### 截图

见 `/Users/lysander/projects/relay-station/cat-cafe-runtime/packages/api/uploads/1773546610782-512ad566.png`

截图中 Opus 4.5 发的三条 audio rich block 全部显示为 JSON 文本，未被渲染。

### 触发条件

- Stream 实时接收消息时出现（首次渲染）
- 刷新页面后从 history 加载时正常渲染
- 说明 rich block 的**解析/渲染路径在 stream 和 history 之间不一致**

### 可能方向

- Stream 消息的 rich block 数据可能以纯文本形式拼接到 `content` 字段，而不是被解析到 `extra.richBlocks` 或类似结构
- History 加载时走了不同的解析路径（后端返回时已正确结构化）
- 检查 stream handler 中对 rich block 类型 chunk 的处理逻辑

### 关键代码区域（建议排查）

- `packages/web/src/hooks/useSocket.ts` — stream chunk 处理，rich block 是怎么被接收的
- `packages/web/src/components/message/` — 消息渲染组件，rich block 的识别和渲染
- `packages/api/src/domains/cats/services/agents/routing/` — stream 发送端对 rich block 的序列化

---

## 共同备注

- 两个 bug 互相独立，可以分别定位修复
- 都不涉及 F5 刷新 / draft TTL，与 Issue #83 hotfix (`PR #443`) 无关
- Bug A 影响基本使用体验（消息乱序），Bug B 影响富媒体功能

[布偶猫/宪宪 Opus-4.6]
