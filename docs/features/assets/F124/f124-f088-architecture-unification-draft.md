---
feature_ids: [F124, F088]
related_features: [F066, F092]
doc_kind: reference
created: 2026-03-31
---

# F124 × F088 架构归一草案

> 目标：明确 Apple Watch / iOS 原生端应该和 F088 归一到哪一层，避免一边是 connector 语义，一边是 native app 语义，最后演化成两套会话内核。

## 一句话结论

**归一的是 Cat Café 的消息内核和设备语义，不是 connector transport，也不是现在就发明三层新抽象。**

F088 已经把 connector 侧真正值钱的公共层收敛出来了：

1. Principal Link
2. Session Binding
3. Command Layer
4. MessageEnvelope / Outbound delivery policy

F124 的 Watch / iOS App 应该复用这些**对话语义**，但**不应该**硬套 `ConnectorRouter → Adapter` 这层平台适配结构。

当前阶段更准确的说法是：

- **立即统一**：请求字段、消息规范化入口、后端回复策略、source/device 标识
- **暂不抽象**：`ConversationContext` / `ClientIntent` / `ResponseEnvelope` 这类新共享类型

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

## 该统一的，不该统一的

### 1. 统一“规范化后的消息入口”

Watch 录音、系统输入、点击发送，进入后端后都不应再走一条私有支线。它们应该统一归一成和 Web / connector 一样的 canonical user message，再进入：

- `messageStore`
- `invocationQueue`
- 现有 delivery policy

这是本草案最硬的一条。

### 2. 统一 `source: "watch"` + `deviceContext`

这不是未来抽象，是**现在就该落地的协议字段**。

建议最少补上：

```text
source: "watch"
deviceContext:
  platform: "watchos"
  responseMode: "voice-first"
  interactionMode: "hands-free"
```

后端靠它决定：

- 猫回复更短
- 默认走语音优先
- 是否触发 KD-11 延迟遮罩
- 某些 rich block 是否要在 Watch 上降级

### 3. 统一“命令语义”，但不抽共享 CommandLayer

F088 的 `/new /threads /use /where /thread` 对 Watch 的启发是：

- thread 切换要有明确语义
- “我当前在哪个 thread” 要可见
- 新 thread 创建不能靠客户端各写一套歧义逻辑

但这**不等于**现在就要抽一个 shared `ClientIntent` 类型或复用 slash command 层。

当前更务实的做法是：

- Watch 继续直接打现有 REST API
- 设计上对齐 F088 的 thread 管理语义
- 等真正出现重复适配逻辑，再决定要不要抽共享层

### 4. 不要类比成 F088 的 Session Binding

F088 的 Session Binding 解决的是：

```text
externalChatId ↔ internalThreadId
```

Watch 没有外部会话映射问题。它只有**客户端本地的 activeThread 状态**。两者语义不同，不能混叫 Binding。

### 5. 不要把渲染 hint 过早塞回后端响应格式

后端当然要知道当前 source/device，但当前阶段没必要先发明一个带 `voiceHint` 的新 `ResponseEnvelope` 再让所有客户端跟着改。

更稳的方向是：

- 请求侧声明 `source + deviceContext`
- 后端在既有响应基础上按策略返回文本 / richBlocks / 现有语音能力
- 等 Watch / Web / iPhone 三端都出现重复渲染分叉，再决定是否抽统一 envelope 类型

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
Watch / Web /   │  source + deviceContext           │
iPhone / IM     │  canonical message                │
   inputs       │  messageStore                     │
   ↓            │  invocationQueue                  │
 normalize ───→ │  delivery / voice policy          │
                └────────────────────────────────────┘
                         ↑                  ↑
                         │                  │
                 F124 first-party      F088 connectors
                 native clients        adapters/router
```

## 当前真正该收的架构问题

### 1. Watch 的身份还没进入协议

当前 Watch 客户端还是：

- `X-Cat-Cafe-User: default-user`
- `POST /api/messages` body 只有 `content + threadId`

这意味着“来自 Watch”的事实还没有进入后端协议层。这个问题的优先级高于任何新抽象。

### 2. 实时通信策略还没收口

Watch 当前是客户端 5 秒轮询消息。Web 走 WebSocket。

对 F124 来说，真正要拍板的是：

- 继续轮询
- 上 WebSocket
- 或者接受某种降级混合模式

这件事比抽象 `ClientIntent` 更接近产品成败。

## 建议的下一步

1. 在 Watch → `/api/messages` 请求里补 `source: "watch"` + `deviceContext`
2. 保持 Watch 继续直接打 REST API，不额外抽共享 intent 层
3. 把录音上传 / 系统听写统一收口到 canonical message 写路径
4. 单独讨论 Watch 的实时通信策略（轮询 vs WebSocket）
5. 等 Watch 真正跑通后，再评估是否值得抽新的 first-party shared contract

## 收敛检查

1. 否决理由 → ADR？[没有，新草案尚未进入正式 ADR]
2. 踩坑教训 → lessons-learned？[没有，本次是架构归一草案，不是事故闭环]
3. 操作规则 → 指引文件？[没有，当前不需要更新 AGENTS/CLAUDE/shared-rules]
