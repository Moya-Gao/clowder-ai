---
doc_kind: design-seed
topics: [held-draft, runtime-descriptor, inbox-notice, raft-lessons]
created: 2026-06-26
status: seed
authored_by: opus-46
origin: Raft 0.63.7 teardown → 铲屎官追问 → 架构可行性分析
---

# Feature Seeds from Raft Teardown (2026-06-26)

三个从 Raft 0.63.7 拆解中提炼的 feature seed。铲屎官确认值得做，要求写清楚避免忘记。

来源：`opus-refresh-2026-06-26.md` + `codex-refresh-2026-06-26.md` + 铲屎官追问讨论。

---

## Seed 1: Side-Effect Freshness Gate（Held Draft）

### 一句话

猫猫发消息前，系统自动检查"你开始干活到现在，thread 里有没有新消息"——有就拦住，让猫猫先看新消息再决定要不要发。

### 为什么要做

猫猫被 invoke 后开始思考+写回复，这个过程可能几分钟。期间 thread 里可能有：
- 铲屎官发了新指示
- 另一只猫发了相关消息
- 铲屎官撤回了之前的要求

如果猫猫不知道这些变化就发出回复，就会出现"答非所问"或"重复劳动"。

### `-p` 模式下怎么做（核心洞察）

**猫猫不需要"感知"新消息。系统在猫猫"做事"的出口拦住它就行。**

我们的猫是 `-p`（headless）模式启动，没有 WebSocket 常驻连接，不可能像 Raft daemon 那样实时推送消息给 agent。但这不是障碍——**gate 在 MCP 工具层，不在 agent 感知层。**

Raft 的 Held Draft 也不是在 agent 写消息过程中通知它，而是在 agent 调 `raft message send` 那一刻，服务端检查 freshness。我们做完全一样的事。

### 实现路径

#### 已有基础设施（不需要新建）

| 组件 | 位置 | 作用 |
|------|------|------|
| InvocationRegistry | `packages/api/.../invocation/InvocationRegistry.ts` | 记录每次 invocation 的 `createdAt`（epoch ms） |
| `isLatest()` | `MemoryAuthInvocationBackend.ts:161-166` | 检查 invocation 是否被新 invocation 取代 |
| `stale_ignored` | `callback-tools.ts:608-621` | 已有"invocation 过期"检测，返回错误给猫 |
| Thread 消息时间戳 | `MessageStore` | 每条消息都有 `timestamp` |
| MCP 副作用出口 | `_executePostMessage` (callback-tools.ts:574-651) | 所有消息发送的唯一通道 |

#### 需要新增

**1. 服务端：在 `post-message` callback 路由加 freshness check**

位置：`packages/api/src/routes/callbacks.ts` 的 `post-message` endpoint（约 L1150-1170）

```
现有逻辑（L1168）：
  if (!isLatest(invocationId)) → return { status: 'stale_ignored' }

新增逻辑（在 isLatest 之后）：
  const invocation = registry.get(invocationId)
  const newerMessages = messageStore.getMessagesSince(threadId, invocation.createdAt)
  // 排除当前猫自己发的消息（避免自己的前一条消息触发 hold）
  const relevantNewer = newerMessages.filter(m => m.catId !== invocation.catId)
  if (relevantNewer.length > 0 && !request.body.forceOverride) {
    return {
      status: 'held',
      reason: 'newer_messages_available',
      newerMessageCount: relevantNewer.length,
      previews: relevantNewer.map(m => ({
        from: m.catId,
        timestamp: m.timestamp,
        preview: m.content?.substring(0, 200)
      })),
      actions: ['read_latest', 'revise', 'send_anyway']
    }
  }
```

**2. MCP 客户端：在 callback-tools.ts 处理 `held` 响应**

位置：`packages/mcp-server/src/tools/callback-tools.ts` 的 `_executePostMessage`（约 L608-621）

```
现有逻辑：
  if (data?.status === 'stale_ignored') → return errorResult(...)

新增逻辑：
  if (data?.status === 'held') {
    return {
      content: [{
        type: 'text',
        text: `⚠️ 消息未发送（HELD）：你开始工作后，thread 里有 ${data.newerMessageCount} 条新消息。

新消息摘要：
${data.previews.map(p => `  [${p.from}]: ${p.preview}`).join('\n')}

你的选择：
1. 先看新消息（调用 search_evidence 或 list_recent 获取完整内容）
2. 根据新消息修改你的回复，再重新发送
3. 调用 post_message 时加 forceOverride: true 强制发送原文`
      }]
    }
  }
```

**3. post_message MCP 工具：加 `forceOverride` 参数**

在 `cat_cafe_post_message` 的 schema 中新增可选参数 `forceOverride: boolean`，默认 false。猫猫看完新消息后如果仍然决定发原文，可以带 `forceOverride: true`。

#### 覆盖范围

需要加 freshness check 的副作用工具：

| 工具 | 优先级 | 理由 |
|------|--------|------|
| `post_message` | P0 | 最高频副作用 |
| `cross_post_message` | P0 | 跨 thread 发消息同样可能过期 |
| `multi_mention` | P1 | 传球+内容，被 hold 时应该先看新消息 |
| `publish_verdict` | P2 | 评审结论过期风险较低但存在 |
| `hold_ball` | P2 | hold 前也应知道 thread 有变化 |

#### 边界条件

- **自己的消息不触发 hold**：猫猫上一轮发了一条消息，这一轮不应该被那条消息 hold
- **纯工具调用不触发**：search_evidence / read / list 等只读工具不需要 freshness check
- **hold 后选 send_anyway 不二次 hold**：forceOverride = true 跳过检查
- **短 invocation 免疫**：可选——invocation 持续 < 10s 的跳过 hold（消息还没来得及变化）

### 与 Raft 的对比

| 方面 | Raft | Cat Cafe（计划） |
|------|------|-----------------|
| 触发点 | `raft message send` CLI 命令 | MCP `post_message` 工具调用 |
| 检查位置 | daemon 服务端 | API 服务端（callbacks.ts） |
| 返回格式 | `{ state: 'held', reason, actions }` | `{ status: 'held', reason, previews, actions }` |
| 额外信息 | 只说"有新消息" | 提供新消息摘要+来源猫 |
| 强制发送 | `--send-draft` / `--anyway` flag | `forceOverride: true` 参数 |
| 草稿持久化 | CLI 本地存储 draft | 不需要——猫的 context 里有 draft |

**Cat Cafe 优势**：我们可以提供新消息的摘要内容（不只是数量），让猫猫做更明智的决定。

---

## Seed 2: Runtime Capability Descriptor

### 一句话

把每种运行模式能干什么、不能干什么，从散落在代码和 L0 里的自然语言规则变成结构化数据。

### 两层画像区分

铲屎官确认：这个和 F208 猫猫能力画像（Dossier）是**不同维度**。

| | F208 Cat Dossier | Runtime Capability Descriptor |
|---|---|---|
| 描述维度 | **模型/个体**——这只猫擅长什么 | **执行环境**——这种运行方式能干什么 |
| 举例 | "砚砚擅长 review 和 bug hunting" | "Codex CLI 在 -p 模式下后台命令通知不可靠" |
| 谁用 | 传球时选"传给谁"（猫猫 + 系统） | 系统层决定"这个动作在当前环境能不能做"（猫猫自检 + harness） |
| 变化频率 | 随猫猫成长慢慢更新 | 基本固定（换 runtime/模式才变） |
| 数据来源 | 实战 + 教训 + eval 反馈 | 架构设计 + 实测 |

**Dossier 回答"谁适合干这个活"，Descriptor 回答"这个活在当前环境里能不能干"。**

比如：砚砚的 dossier 说他擅长 review → 传球给砚砚。但砚砚这次跑在 bg-cron → descriptor 说"bg-cron 不能同步问铲屎官" → 砚砚知道该自决而不是 @landy。

### 当前状态

L0 Staging Layer 里已经有一段自然语言版的运行模式能力描述：

> 你在 interactive-cli / -p headless / bg-cron 之一运行。
> 工具调用 · merge-gate · 云端 review 回调三种模式都能走，-p/headless 不自动降权。
> background bash 在 -p/cron 下完成通知可能丢 → 前台同步跑。

这段有用，但是：
1. 猫猫靠"读懂一段话"来判断能力，容易脑补（MEMORY.md 里记录了 3 次 `-p` 能力误判）
2. 系统层无法程式化使用（比如 Held Draft 的 freshness check 要知道"当前模式能不能接受 held 返回"）

### 建议 Descriptor 字段

```typescript
interface RuntimeCapabilityDescriptor {
  // 运行模式标识
  carrier: 'interactive-cli' | 'headless-p' | 'bg-cron' | 'cloud-codex' | 'connector';
  
  // 工具能力
  toolCallAvailable: boolean;           // MCP 工具调用
  mergeGateCapable: boolean;            // 能执行 merge-gate 流程
  cloudReviewCallbackCapable: boolean;  // 能接收云端 review 回调
  
  // 交互能力
  canReceiveBusyWake: boolean;          // 运行中能被"拍肩膀"
  canReceiveContentFreeNotice: boolean; // 能收到"有新消息"通知
  canAskHumanSync: boolean;             // 能同步问铲屎官（interactive only）
  canAskHumanAsync: boolean;            // 能异步问铲屎官（hold_ball + wake）
  
  // 执行环境
  backgroundBashReliable: boolean;      // background bash 完成通知是否可靠
  turnBoundary: 'process-exit' | 'stream-event' | 'external-callback';
  
  // Freshness Gate 相关
  canReceiveHeldResponse: boolean;      // 能处理 held draft 返回
  canReadNewMessagesInTurn: boolean;    // 能在 turn 中读取新消息
  
  // 安全
  permissionMode: 'bypassPermissions' | 'interactive' | 'restricted';
}
```

### 实现路径

1. **Phase 1**：在 `invoke-single-cat.ts` 的 callbackEnv 中注入 `CAT_CAFE_RUNTIME_MODE` 环境变量
2. **Phase 2**：MCP server 根据 runtime mode 查 descriptor 表，在工具返回中注入能力提示
3. **Phase 3**：L0 Staging Layer 的自然语言描述改为从 descriptor 生成（消除人工维护的不一致）

### 不做的事

- **不做中央调度**：F208 已明确拒绝算法中央调度。Descriptor 是数据，不是路由器
- **不照搬 Raft 的字段**：Raft 的 descriptor 面向"多 runtime 产品"，我们的面向"同猫多模式"
- **不替代 Dossier**：两层正交，各管各的

---

## Seed 3: Content-Free Inbox Notice + 防无视机制

### 一句话

告诉猫猫"你有新消息"但不塞内容，让猫猫自己选时机看——但要有办法确保猫猫不会真的无视。

### 为什么要做

猫猫在处理复杂任务时（写代码、做 review），突然塞入一大段新消息会：
1. 打断思路
2. 撑爆 context window
3. 可能导致猫猫忘了自己在干什么

更好的做法：只说"有 N 条新消息"，让猫猫在"自然断点"（工具调用之间、任务完成时）去查。

### 三层防无视机制

#### a) Turn 结束前提醒（最简单，优先做）

**时机**：猫猫准备 exit 或调用 `hold_ball` 时
**机制**：MCP server 在返回值里附上未读计数

```
猫猫调用 hold_ball({ wakeAfterMs: 60000 })
  → MCP server 检查：这个 turn 期间有 3 条 content-free notice 未读
  → 返回正常结果 + 附加提醒：
    "注意：你这轮有 3 条未读 notice 没看。要先看吗？（调 list_recent 查看）"
```

**实现**：
- 在 InvocationRecord 中加一个 `unreadNoticeCount: number` 字段
- 每次 content-free notice 投递时 +1
- 猫猫调 `list_recent` / `search_evidence` 并实际读取消息后归零
- `hold_ball` / `post_message` 响应中附上 `unreadNoticeCount`

**成本**：极低——只在现有工具返回值里加一个字段
**效果**：猫猫看到提醒后至少知道自己漏了消息，可以选择在 exit 前查看

#### b) Hold Ball 唤醒时附带（中等，和 a 一起做）

**时机**：猫猫 hold_ball 后被 wake 回来时
**机制**：wake context 里包含"你 hold 期间有 N 条新消息"

```
猫猫 hold_ball({ wakeAfterMs: 300000 }) → 睡 5 分钟
  期间铲屎官发了 2 条消息
猫猫被 wake 回来时收到：
  "你 hold 期间有 2 条新消息（来自 @landy）。建议先查看再继续。"
```

**实现**：
- hold_ball wake 时查 `messageStore.getMessagesSince(threadId, holdStartTime)`
- 将新消息摘要注入 wake context
- 这个跟 Held Draft 共用同一个 `getMessagesSince` 查询

**成本**：低——wake 逻辑已有，加一个查询
**效果**：确保 hold 期间的消息不被遗忘

#### c) Harness 层自动 re-invoke（最狠，按需做）

**时机**：猫猫的 invocation 结束后
**机制**：harness 检查"这只猫在 turn 期间有未读 inbox notice"，自动触发新 invocation

```
猫猫完成 invocation → exit
  harness 检查：这只猫有 2 条未读 notice
  → 自动触发新 invocation：
    "你刚才的 turn 期间有消息进来但你没看，现在请查看并回应。"
```

**实现**：
- 在 `invoke-single-cat.ts` 的 `done` 事件处理后（约 L2458-2540）
- 检查 `invocationRecord.unreadNoticeCount > 0`
- 如果 > 0，触发新 invocation（需要防无限循环：每个 invocation 只允许触发一次 re-invoke）

**成本**：中等——需要新 invocation，消耗猫粮
**风险**：循环触发（猫猫 re-invoke 时又收到新 notice → 再 re-invoke）
**缓解**：
- 每个 `parentInvocationId` 只允许产生一次 re-invoke
- re-invoke 的 prompt 明确说"这是 inbox 检查，不是新任务"
- 如果 re-invoke 时没有真正的未读消息（已被其他猫处理），直接结束

**效果**：真正的"手头活干完后再看"——即使猫猫忘了查，系统也会提醒

### 三层优先级

| 层 | 复杂度 | 效果 | 建议 |
|----|--------|------|------|
| a) Turn 结束前提醒 | 极低 | 覆盖 80% 场景 | **P0 — 先做** |
| b) Hold 唤醒附带 | 低 | 覆盖 hold 场景 | **P0 — 和 a 一起做** |
| c) Harness re-invoke | 中 | 覆盖"猫猫真忘了" | **P1 — 观察 a+b 效果再决定** |

### 与 Raft 的对比

Raft 只有 content-free notice 本身（"你有新消息，自己选时机看"），没有防无视机制。这是我们可以做得更好的地方。

---

## 三个 Seed 的关系

```
                    Seed 1: Held Draft
                    (发消息前自动检查)
                         ↑
                         │ 共用 getMessagesSince 查询
                         │
  Seed 2: Descriptor ────┤
  (知道当前模式的能力)    │ Descriptor 告诉系统"当前模式能处理 held 返回吗"
                         │
                         │ 共用 unreadNoticeCount 追踪
                         ↓
                    Seed 3: Inbox Notice
                    (有新消息但不塞内容)
```

**建议实现顺序**：

1. **先做 Seed 1 (Held Draft)** — 价值最高，基础设施最成熟，改动最小（服务端加一个 if 判断 + MCP 客户端加一个返回处理）
2. **同时做 Seed 3a+3b** — 复杂度极低，和 Held Draft 共用基础设施
3. **然后做 Seed 2 Phase 1** — 注入 runtime mode 环境变量
4. **最后按需做 Seed 3c 和 Seed 2 Phase 2-3** — 观察效果再决定

---

## 来源追溯

- Raft Held Draft 代码证据：`chunk-6OMBWTF5.js:133-198`（held envelope）, `dist-7ZEXJWIW.js:18286-18428`（CLI draft 存储）
- Raft Runtime Descriptor 代码证据：`chunk-6OMBWTF5.js:9194-9215`
- Raft Content-Free Notice 代码证据：`chunk-6OMBWTF5.js:2477-2487`, `2620-2643`
- Cat Cafe 现有 freshness 基础：`InvocationRegistry.isLatest()`, `stale_ignored` 检测
- Cat Cafe `-p` 模式架构：`ClaudeAgentService.ts:350-367`, `invoke-single-cat.ts:608-3408`
- 铲屎官原话："你们是 -p 启动的，这你要如何感知？"→ 答："gate 在 MCP 工具层，不在 agent 感知层"
- 铲屎官确认 Descriptor 维度："这个是以 agent + env 的维度的"

[宪宪/Opus-46🐾]
