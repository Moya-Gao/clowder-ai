---
feature_ids: [F124, F088]
related_features: [F066, F092]
doc_kind: reference
created: 2026-03-31
---

# F124 × F088 架构归一草案

> 目标：明确 Apple Watch / iOS 原生端应该和 F088 归一到哪一层，避免一边是 connector 语义，一边是 native app 语义，最后演化成两套会话内核。

## 一句话结论

**归一的是 Cat Café 的对话内核，不是 connector transport。**

F088 已经把 connector 侧真正值钱的公共层收敛出来了：

1. Principal Link
2. Session Binding
3. Command Layer
4. MessageEnvelope / Outbound delivery policy

F124 的 Watch / iOS App 应该复用这些**对话语义**，但**不应该**硬套 `ConnectorRouter → Adapter` 这层平台适配结构。

## 当前边界

### F088 已统一的东西

F088 解决的是第三方聊天平台接入：

```text
外部 webhook / SDK event
  → ConnectorRouter
  → dedup / binding / store / invoke
  → ConnectorMessageFormatter
  → Adapter sendReply / sendFormattedReply
```

这层的价值在于：

- 外部 sender 身份映射
- 外部 chat ↔ 内部 thread 绑定
- 平台无关命令语义（`/new /threads /use /where /thread`）
- 平台无关消息信息层（`MessageEnvelope { header, subtitle, body, footer }`）

### F124 当前的 Watch 实现

Watch 现在是 first-party native client，不是第三方 connector：

```text
Watch UI
  → CatCafeAPIClient
  → /api/threads /api/messages /health
  → AppState 轮询 / fallback / 连接状态
```

它没有 webhook、没有外部 adapter、没有 principal link 问题。它已经直接站在 thread/message core 之上。

## 该归一的层

### 1. Session Binding 语义

Watch 也需要和 F088 一样的“当前 thread 是谁”模型，只是交互入口不是 slash command，而是：

- 表冠滚动
- 点击 thread
- 语音说“切到 F088”
- 快捷操作切换 thread

**结论**：Watch 不需要复用 slash command 文本本身，但需要复用其背后的 intent 语义。

建议抽象：

```text
ConversationContext
  - userId
  - source            // web / watch / connector
  - activeThreadId
  - recentThreadIds
  - responseMode      // text / voice / mixed
```

### 2. Command Layer 语义

F088 的 `/new /threads /use /where /thread` 不应只停留在 IM 文本命令。

对 F124，应该把它们沉淀为平台无关 intent：

```text
ClientIntent
  - createThread(title?)
  - listThreads()
  - switchThread(selector)
  - whereAmI()
  - sendMessage(threadId, content)
```

Watch 的按钮和语音只是这个 intent 的不同入口。

### 3. Message Envelope / 回复信息层

F088 已经收敛出统一的信息层：

```text
header / subtitle / body / footer
```

F124 不该再让 Watch 独自发明“只给一坨文本”的回复模型。Watch 也应该消费同一层语义，只是渲染方式不同：

- Watch 列表项
- 通知摘要
- TTS 正文
- comfort audio 触发条件

建议扩成 first-party 可消费的统一回复契约：

```text
ResponseEnvelope
  - text
  - threadMeta       // threadId / title / featId / deepLink
  - speakerCatId
  - richBlocks
  - voiceHint        // prefer-tts / comfort-audio / silent
```

### 4. Source / Device Policy

F124 必须把 `watch` 变成后端一等 source，而不是“只是另一个会发消息的客户端”。

最少需要：

```text
source: "watch"
deviceContext:
  platform: "watchos"
  responseMode: "voice-first"
  interactionMode: "hands-free"
```

这样后端才能统一做这些策略：

- 猫回复更短
- 默认带 TTS
- 命中 KD-11 的延迟遮罩
- 某些 rich block 降级成语音/摘要

## 语音消息到底要不要进统一队列？

**答案：要，但要分前后半段。**

### 不该归一到 F088 队列的部分

下面这些是 Watch transport / device capability：

- 手表录音
- 系统输入面板
- 本地 comfort audio
- 本地震动 / 表盘入口 / complication

这些属于 **device edge**，不应塞进 connector queue 抽象。

### 应该归一到统一消息内核的部分

一旦 Watch 完成了“录音上传 / 本地听写 / 文字输入”中的任一条，进入后端后就应该被规范化成**同一类用户消息**：

```text
Watch raw input
  → normalize
  → canonical user message
  → messageStore / invocationQueue / delivery policy
```

具体说：

1. **系统听写路径**
   - Watch 产出 text
   - 直接写成 canonical user message

2. **录音上传路径**
   - Watch 上传 audio artifact
   - 后端 ASR 转 text
   - 仍然写成同一类 canonical user message
   - 原始音频作为 attachment / metadata 挂旁边

**结论**：统一的是“规范化后的消息”，不是“原始录音 transport”。**

## 推荐的统一后架构

```text
                ┌────────────────────────────────────┐
                │     Shared Conversation Core       │
                │                                    │
Watch / Web /   │  ConversationContext              │
iPhone / IM     │  ClientIntent                     │
   inputs       │  canonical message                │
   ↓            │  invocationQueue                  │
 normalize ───→ │  ResponseEnvelope                 │
                │  delivery / voice policy          │
                └────────────────────────────────────┘
                         ↑                  ↑
                         │                  │
                 F124 first-party      F088 connectors
                 native clients        adapters/router
```

## 对 F124 的直接启发

### 应立即对齐

1. Watch 发消息 body 不应只有 `content + threadId`
   - 还应带 `source: "watch"` 和 voice-first device metadata

2. Watch 的“切 thread / where / list threads”
   - 不要继续散落在 UI 本地逻辑里
   - 应收敛为和 F088 同语义的一组 backend intents

3. Watch 的语音回复
   - 不应是单独的“Watch 特供返回值”
   - 应建立在统一 `ResponseEnvelope + voiceHint` 上

### 暂时不要做

1. 不要让 Watch 走 `ConnectorRouter`
2. 不要把 Watch 语音原始录音塞进 connector queue 抽象
3. 不要把所有 native 操作伪装成 slash command 文本

## 建议的下一步

1. 为 F124 增加 `source: "watch"` + `deviceContext` 协议字段
2. 抽一层 `ClientIntent`，让 Watch / Web / 未来 iPhone 共用
3. 把 TTS / comfort-audio 的触发收进 `ResponseEnvelope.voiceHint`
4. 等以上三项稳定后，再考虑是否把 F088 命令层进一步抽成真正的 shared domain service

## 收敛检查

1. 否决理由 → ADR？[没有，新草案尚未进入正式 ADR]
2. 踩坑教训 → lessons-learned？[没有，本次是架构归一草案，不是事故闭环]
3. 操作规则 → 指引文件？[没有，当前不需要更新 AGENTS/CLAUDE/shared-rules]
