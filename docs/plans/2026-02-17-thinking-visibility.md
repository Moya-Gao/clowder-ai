# 猫猫心里话：消息分流 + 双模式

> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-17
> **状态**: ✅ 已对齐，开始实施
> **负责**: 布偶猫
> **Review**: 缅因猫
> **来源**: 铲屎官在第一届猫猫杀后提出

---

## 1. 问题

### 1.1 Bug：CLI 输出和 MCP 回调消息混在一起

猫猫每次回话有两条输出路径：

| 路径 | 内容 | 该怎么展示 |
|------|------|-----------|
| **CLI stdout**（NDJSON 流） | 猫的内部推理、碎碎念、工具调用过程 | "心里话"，默认折叠可展开 |
| **MCP `post_message` 回调** | 猫精心组织的正式回复 | 正常展示 |

但目前两条路径到达前端都是 socket `agent_message` + `type: 'text'`，前端按 `catId` 把它们 **append 进同一个聊天气泡**（`useAgentMessages.ts:122-128`）。结果铲屎官看到的是一坨混在一起的文本——既有推理过程又有正式回复，分不清哪是哪。

**三只猫都有这个问题**（共享链路），只是严重程度不同：
- 砚砚最轻（CLI 输出简洁，主要靠 MCP callback 发言）
- 布偶猫中等（CLI 输出有推理分析，callback 有正式回复，两者重叠）
- 暹罗猫最严重（话多 + 疑似双 session，需确认之前修的是否彻底）

### 1.2 Feature：Thread 级双模式

铲屎官需要**按 thread 切换**两种模式，控制**猫猫之间是否共享心里话**：

| | Play 模式 | Debug 模式 |
|---|---|---|
| **心里话发给其他猫？** | **否** — 其他猫看不到这只猫的 CLI 碎碎念 | **是** — 其他猫能看到完整推理（帮助定位问题） |
| **铲屎官看心里话？** | **能看** — 折叠/展开 | **能看** — 折叠/展开 |
| **前端展示** | 相同：心里话默认折叠，点击展开 | 相同：心里话默认折叠，点击展开 |
| **典型场景** | 猫猫杀游戏（防作弊）、日常聊天 | 调试/回看猫猫杀录像做解说、定位推理错误 |

关键约束：
1. **Thread 级别设置**，不是全局开关——不同 thread 可以同时处于不同模式
2. **可随时切换**——猫猫杀玩完了切到 Debug 回看心里话做解说
3. **心里话始终持久化存储**——两种模式下都存，铲屎官随时可展开查看
4. **模式只影响路由层**——Play 模式下 `previousResponses` 不传心里话给其他猫

---

## 2. 根因分析（布偶猫 + 缅因猫独立确认）

### 2.1 后端：两条路径共用一个广播类型

```
callbacks.ts:113    → broadcastAgentMessage({ type: 'text', ... })  // MCP callback
route-serial.ts:206 → yield { type: 'text', ... }  // CLI stdout (通过 socket 广播)
```

两者到达前端的 socket 事件完全一样，无法区分来源。

### 2.2 前端：按 catId 合并所有 text

```typescript
// useAgentMessages.ts:122-128
if (msg.type === 'text' && msg.content) {
  const existing = activeRefs.current.get(msg.catId);
  if (existing) {
    appendToMessage(existing.id, msg.content);  // ← 无论来源，都拼进同一个气泡
  }
}
```

### 2.3 路由层：心里话泄漏到其他猫的上下文

```typescript
// route-serial.ts:84-86
const contextParts = previousResponses.map(
  (r) => `[${r.catId} responded: ${r.content}]`  // ← content 包含完整 CLI text（碎碎念）
);
```

Play 模式下，这里应该只传 callback 内容（正式回复），不传 CLI 碎碎念。

---

## 3. 方案

### Step 1（P1 Bug Fix）：消息来源分流

给消息加 `origin` 标记，让前端能区分来源。

#### 3.1.1 类型变更

```typescript
// StoredMessage 新增字段
export interface StoredMessage {
  // ... 现有字段 ...
  /** 消息来源：stream = CLI stdout 心里话, callback = MCP post_message 正式回复 */
  origin?: 'stream' | 'callback';
}

// AgentMessage（socket 事件）同步新增
export interface AgentMessage {
  // ... 现有字段 ...
  origin?: 'stream' | 'callback';
}
```

向前兼容：`origin` 为可选字段，旧消息无此字段时按 `'stream'` 处理（保守策略）。

#### 3.1.2 后端标记

| 位置 | 改动 |
|------|------|
| `callbacks.ts:113` | `broadcastAgentMessage` 加 `origin: 'callback'` |
| `callbacks.ts:104` | `messageStore.append` 加 `origin: 'callback'` |
| `route-serial.ts:244` | `messageStore.append` 加 `origin: 'stream'` |
| `route-serial.ts` socket 广播 | yield 的 text 消息加 `origin: 'stream'` |

#### 3.1.3 前端分流

`useAgentMessages.ts`：

```typescript
if (msg.type === 'text' && msg.content) {
  if (msg.origin === 'callback') {
    // Callback 消息：开新气泡，不 append 到 stream 气泡
    const id = `msg-${Date.now()}-${msg.catId}-cb`;
    addMessage({ id, type: 'assistant', catId: msg.catId, content: msg.content, origin: 'callback', ... });
  } else {
    // Stream 消息（心里话）：独立的 stream 气泡
    const existing = activeRefs.current.get(msg.catId);
    if (existing) { appendToMessage(existing.id, msg.content); }
    else { /* create new stream bubble */ }
  }
}
```

**Step 1 完成后的效果**：CLI 碎碎念和 MCP 正式回复不再混在同一个气泡里。

---

### Step 2（Feature）：Thread 级双模式

#### 3.2.1 Thread 设置

```typescript
// Thread 接口新增
export interface Thread {
  // ... 现有字段 ...
  /** 心里话模式。play = 猫猫之间不共享心里话，debug = 猫猫之间共享心里话。默认 play */
  thinkingMode?: 'debug' | 'play';
}
```

API 端点：`PATCH /api/threads/:threadId` 扩展支持 `thinkingMode`。

#### 3.2.2 前端渲染（两种模式完全相同）

`ChatMessage.tsx` 中，`origin: 'stream'` 的消息**始终**渲染为可折叠区块：

```
┌─────────────────────────────────────────┐
│ 🐾 布偶猫的心里话  ▶ (点击展开)          │
└─────────────────────────────────────────┘
  ↓ 展开后
┌─────────────────────────────────────────┐
│ 🐾 布偶猫的心里话  ▼                     │
│                                         │
│ 嗯让我想想……铲屎官说的是不是 CAI？      │
│ 不对，铲屎官暗示跟 engineering 有关……    │
│ ReAct？Reason + Act？                   │
│                                         │
└─────────────────────────────────────────┘
```

- **不区分模式**：Play 和 Debug 下铲屎官看到的 UI 完全一样——都是折叠的心里话
- 铲屎官随时可以展开任何猫的心里话查看推理过程

#### 3.2.3 前端 UI：模式切换

Thread header 区域加一个小切换按钮：

```
[🎮 Play] ←→ [🔍 Debug]
```

点击切换，调 `PATCH /api/threads/:threadId` 更新 `thinkingMode`。

切换只影响后续猫猫之间的上下文传递，不影响已有消息的展示方式（心里话始终可折叠查看）。

#### 3.2.4 路由层：Play 模式下的心里话隔离

**核心差异所在**——Play 模式下猫 B 看不到猫 A 的心里话。

`route-serial.ts` 中 `previousResponses` 的组装需要感知 thinkingMode：

```typescript
// Play 模式：previousResponses 只包含 callback 内容（正式回复）
// Debug 模式：previousResponses 包含完整 CLI text + callback 内容
```

实现方式：route-serial 维护一个 per-invocation `callbackContents` 数组，callback handler 通过 InvocationRegistry 的共享引用追加。CLI stream 完成后：

```typescript
if (!incrementalMode) {
  if (threadThinkingMode === 'play') {
    // Play: 只放 callback 内容
    const cbContent = invocationCallbackContents.join('\n\n');
    if (cbContent) previousResponses.push({ catId, content: cbContent });
  } else {
    // Debug: 放完整 CLI text（包含碎碎念 + 正式回复的混合体）
    previousResponses.push({ catId, content: storedContent });
  }
}
```

#### 3.2.5 上下文过滤（猫猫视角 vs 铲屎官视角）

"按模式过滤"是指**猫猫的上下文**（铲屎官已确认）：

- **猫猫上下文组装**（`previousResponses`）：Play 模式过滤掉 `origin: 'stream'` 消息，只传 callback 内容
- **前端 API**（铲屎官看的）：始终返回所有消息（含 stream），前端用折叠 UI 展示
- 铲屎官始终能看到所有猫的心里话（折叠展示），过滤只影响猫猫之间的上下文传递

---

## 4. 影响面

| 层 | 改动文件 | 改动大小 |
|----|---------|---------|
| **shared 类型** | `StoredMessage` + `AgentMessage` 加 `origin?` | S |
| **后端路由** | `callbacks.ts`（标记 origin） | S |
| **后端路由** | `route-serial.ts`（标记 origin + play 模式心里话隔离） | M |
| **后端存储** | `ThreadStore` + `IThreadStore`（加 `thinkingMode`） | S |
| **后端存储** | `RedisThreadStore`（序列化 thinkingMode） | S |
| **后端 API** | `threads.ts`（PATCH 支持 thinkingMode） | S |
| **前端 hooks** | `useAgentMessages.ts`（callback 消息不 append 进 stream 气泡） | M |
| **前端组件** | `ChatMessage.tsx`（stream 消息折叠 UI） | M |
| **前端组件** | Thread header（模式切换按钮） | S |

总改动量：M（中等），约 8-10 个文件。

---

## 5. Tradeoff

| 决策 | 选择 | 放弃了什么 |
|------|------|-----------|
| 心里话始终存储 | 两种模式都存 | 不省存储空间，但保证回看/解说能力 |
| 前端 UI 两种模式相同 | 都是折叠 | 简单一致，不会有"模式切了但 UI 没变"的困惑 |
| origin 为可选字段 | 向前兼容旧消息 | 旧消息无法区分来源（默认当 stream） |
| Play/Debug 只影响猫猫上下文 | 铲屎官视角不变 | 模式切换不会导致铲屎官看到的消息突然消失/出现 |

---

## 6. Open Questions（已全部解决）

1. ~~**默认模式**~~ → **`play`**（铲屎官拍板：日常场景猫猫不该偷看心里话，需要调试再切 Debug）
2. ~~**暹罗猫双 session**~~ → **不管**（之前砚砚修过了，已确认）
3. ~~**API 过滤确认**~~ → **是猫猫的上下文过滤**（`previousResponses`），铲屎官前端始终能看到所有消息（折叠展示）

---

## 7. 测试计划

| 测试 | 类型 | 覆盖 |
|------|------|------|
| `origin` 标记正确性 | Unit | callbacks.ts 存消息带 `origin: 'callback'`，route-serial 带 `origin: 'stream'` |
| 前端消息分流 | Unit | callback 消息不 append 进 stream 气泡 |
| Thread thinkingMode 持久化 | Unit | ThreadStore + RedisThreadStore 读写 thinkingMode |
| 心里话折叠展示 | 前端 | `origin: 'stream'` 消息渲染为可折叠区块 |
| Play 模式：previousResponses 不含心里话 | Unit | route-serial 在 play 模式下只传 callback 内容 |
| Debug 模式：previousResponses 包含完整内容 | Unit | route-serial 在 debug 模式下传全量 |
| 模式切换 API | Unit | PATCH /api/threads/:id 正确更新 thinkingMode |
| 向前兼容 | Unit | 无 origin 的旧消息正常展示（默认当 stream，折叠） |
