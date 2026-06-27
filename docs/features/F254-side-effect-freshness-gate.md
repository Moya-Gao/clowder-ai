---
feature_ids: [F254]
related_features: [F233, F167, F069, F193]
topics: [freshness, held-draft, inbox-notice, runtime-descriptor, side-effect-gate, ax]
doc_kind: spec
created: 2026-06-27
---

# F254: Side-Effect Freshness Gate — 副作用出口 freshness 拦截

> **Status**: spec | **Owner**: 宪宪 (Opus-4.6) | **Priority**: P1

## Why

**猫猫发消息的时候，不知道世界在它思考期间变了。**

猫猫被 invoke 后开始思考 + 写代码 + 准备回复，这个过程几分钟到十几分钟不等。期间 thread 里可能发生：
- 铲屎官改了主意（"算了不要做了"）
- 另一只猫已经完成了同一件事
- 新的 review 意见推翻了猫正在做的假设
- 球权已经转移（猫准备传球给 A，但 B 已经接了）

猫猫不知道这些变化就调 `post_message` 发出回复 → **答非所问 / 重复劳动 / 球权混乱**。

铲屎官原话（2026-06-26，Raft teardown 讨论）：

> "这里我们也想做，早想做了但是我一直没做只是一个 steer。为什么？这你得好好看看家里的架构设计了，你们是 -p 启动的，这你要如何感知？如果你们能想办法做到 我会抱着你喊布偶猫宝贝爱死你了！"

**核心洞察（回答铲屎官的"如何感知"问题）**：猫猫不需要"感知"——gate 在 MCP 工具层（`post_message` 调用时），不在 agent 感知层。`-p` 模式完全不是障碍。

来源：Raft 0.63.7 teardown 提炼（`docs/discussions/2026-05-14-slock-deep-dive/feature-seeds-from-raft-2026-06-26.md` + `opus48-seed-review-2026-06-26.md`），经 opus-48 独立源码核验修正。

## Current State / 现状基线

**现有 freshness 检查（invocation 级，非消息级）**：

| 机制 | 位置 | 检查什么 | 局限 |
|------|------|----------|------|
| `isLatest()` | InvocationRegistry | 这个 invocation 是不是被新 invocation 取代了？ | 只检查"同一只猫有没有被重新 invoke"，不检查"thread 有没有新消息" |
| `stale_ignored` | callback-tools.ts:608-621 | 同上，客户端侧处理 | 同上 |
| F177-G 路由守卫 | stop hook | 传球格式是否合法 | 只检查格式，不检查 freshness |

**缺失的：消息级 freshness**——"你准备发消息的时候，thread 里有没有你还没看过的消息？"

**现有可复用原语**：

| 原语 | 位置 | 能力 |
|------|------|------|
| `DeliveryCursorStore` | `packages/api/.../stores/ports/DeliveryCursorStore.ts` | per-(user,cat,thread) 单调游标，lexicographically sortable message ID，Redis Lua CAS |
| `ThreadReadStateStore` | `packages/api/.../stores/ports/ThreadReadStateStore.ts` | per-(user,thread) 已读游标 + `getUnreadSummaries` 批量查询 |
| `MessageStore.generateId()` | MessageStore | 16 位 timestamp + 6 位 seq + 8 位 UUID 后缀，字符串比较 = 时间序 |
| F233 BallCustodyEventLog | `packages/api/src/domains/ball-custody/` | append-only 事件流 + projector + projection store |

**关键教训（opus-48 源码核验，LL-039 谱系）**：

用 `getMessagesSince(invocation.createdAt)` （时间戳窗口）会**大量误 hold**——猫 turn 中途读了新消息再发，照样被 hold，因为那些消息的 timestamp > createdAt，跟"猫看没看过"无关。**正确的判据是 seq 游标**：`threadLatestMessageId > deliveryCursor[cat][thread]` = 有猫没看过的消息 → hold。DeliveryCursorStore 就是这个原语。

## What

### 设计哲学

三个 surface，一个子系统——不是三个独立 feature：

```
Runtime Descriptor（Phase C）
  ↓ 参数化
  "这个 mode 能接受 held 返回吗？能收 content-free notice 吗？"
  ↓
Content-Free Notice（Phase B）          Freshness Gate（Phase A）
  "你有 N 条未读，自己选时机看"          "你要发消息，但有未读 → hold"
  ↓                                     ↓
  共用 DeliveryCursorStore seen 边界
  共用 F233 事件流记录
```

Phase A 先落地（价值最高 + 基础设施最成熟），Phase B 扩展通知面，Phase C 结构化运行模式能力。当前所有猫都是 -p 模式，Descriptor 可以 Phase A/B 中硬编码，Phase C 再抽象。

---

## 🐾 猫猫旅程（Cat Journey）

> 铲屎官说"有猫猫旅程，记得设计清楚"。以下从猫猫第一人称视角，描述每个 surface 的完整体验。

### 旅程 1: Freshness Gate（"我要发消息，但世界变了"）

```
场景：宪宪被 invoke，花了 8 分钟写了一段 review 回复。
期间砚砚在同一个 thread 里发了一条新消息。

① 宪宪不知道砚砚发了消息（-p 模式，没有推送通道）
② 宪宪写完了，调用 cat_cafe_post_message("我 review 完了，LGTM...")
③ MCP server 收到调用 →
   检查: deliveryCursor[opus][thisThread] < thread.latestMessageId ?
   → 是！砚砚的消息在游标之后 → 这是宪宪没看过的
④ MCP server 返回 held 信封（不执行发送）：

   ⚠️ 消息未发送（HELD）
   ━━━━━━━━━━━━━━━━━━━━━━━━━
   原因：你有 1 条未读消息（来自砚砚）
   
   [砚砚]: "等一下，我发现了一个 bug，这个 PR 先别合…"
   
   你的选择：
   1. 调 cat_cafe_list_recent 看完整内容，再决定怎么回
   2. 修改你的回复后重新调 post_message
   3. 调 post_message 时加 acknowledgeHeld: true 强制发送原文

⑤ 宪宪看到 held → 去读砚砚的消息 → 发现自己的 LGTM 已经过时
⑥ 宪宪改写回复："收到砚砚的 bug report，暂停 merge，先看 bug"
⑦ 宪宪调 post_message（此时游标已更新，无新未读）→ 正常发送 ✅
```

**如果宪宪已经看过了呢？**

```
场景：宪宪 turn 中途调了 list_recent，已经读过砚砚的消息。

① 宪宪调 list_recent → 读到砚砚的消息 → 游标推进到最新
② 宪宪继续写回复，综合砚砚的信息
③ 宪宪调 post_message →
   检查: deliveryCursor[opus][thisThread] < thread.latestMessageId ?
   → 否！游标已经追上 → 宪宪看过了所有消息
④ 正常发送 ✅ （不误 hold）
```

**如果查不到可靠的 seen 边界呢？**

```
场景：新 thread 第一次 invoke，DeliveryCursorStore 无记录。

① 检查 deliveryCursor → undefined（没有记录）
② Fail-open：放行，不 hold（宁漏 hold 不错 hold）
③ 正常发送 ✅
④ 发送成功时顺便初始化游标 = 当前 latestMessageId
```

### 旅程 2: Content-Free Notice（"有新消息但不打断你"）

```
场景：宪宪正在写一段复杂的代码重构。
铲屎官在 thread 里发了一条消息。

① 宪宪正在 Edit 文件（纯专注状态，没调副作用工具）
② 宪宪接下来调了一个只读工具（比如 search_evidence）
③ MCP server 在返回值里附上 notice：

   📬 提醒：你有 1 条新消息（in 当前 thread）
   来自：铲屎官
   内容未展示 — 在自然断点时调 list_recent 查看

④ 宪宪看到提醒 → 判断当前改到一半不适合停 →
   继续完成 Edit → 跑测试 → 测试通过
⑤ 宪宪在自然断点调 list_recent → 读到铲屎官说"方向改了"
⑥ 宪宪调整方案 → 发回复
```

**如果宪宪无视了 notice，直接跑完退出呢？**

```
场景：宪宪收到 notice 但选择继续干活，最终 hold_ball 退出。

① 宪宪调 hold_ball →
   MCP server 检查：这个 turn 有 1 条未读 notice
② 返回 hold_ball 正常结果 + 附加提醒：

   ⚠️ 你这轮有 1 条未读消息未查看（来自铲屎官）
   建议调 list_recent 先看看再退出。

③ 宪宪看到提醒 → 决定先看 → 读消息 → 回复
   或
   宪宪判断当前任务优先 → 仍然 hold → 退出
   （但 notice 记录在案——harness 知道这只猫选择了延期）
```

**最狠的兜底：harness re-invoke（Phase B.c）**

```
场景：宪宪整个 turn 都没看 notice，直接退出了。

① 宪宪 invocation 结束（exit）
② Harness 检查：invocationRecord.unacknowledgedNoticeCount > 0
③ 触发新 invocation（限一次，防循环）：

   "你上一轮的 turn 中有来自铲屎官的消息你没查看。
    请调 list_recent 查看并回应。"

④ 新 invocation 启动 → 宪宪读消息 → 回复
```

### 旅程 3: Runtime Descriptor（系统视角 —— 猫猫不直接感知）

```
场景：系统决定怎么给不同模式的猫送 notice / 做 hold。

① 宪宪被 invoke（-p headless mode）
② invoke-single-cat.ts 注入 CAT_CAFE_RUNTIME_MODE=headless-p
③ MCP server 查 descriptor：
   headless-p → {
     canReceiveHeldResponse: true,    // 能处理 held 返回
     canReceiveContentFreeNotice: true, // 能收 notice
     busyDeliveryMode: 'gated',       // 不能 mid-turn 注入内容
     backgroundBashReliable: false,   // background 通知可能丢
   }
④ 系统据此决定：
   - hold: 在 post_message 时做 seq 比较 → 返回 held 信封
   - notice: 在只读工具返回时附加 notice（不是 mid-turn 注入）
   - 不尝试 steer（不是 SDK session，不支持 mid-turn push）
```

---

### Phase A: Freshness Gate（副作用出口拦截 MVP）

**最高价值 + 基础设施最成熟 → 先做。**

#### A1: Held 信封（服务端）

在 callback routes 的副作用工具中加 freshness check：

1. 获取 `deliveryCursor[cat][thread]`（调 `DeliveryCursorStore.getCursor`）
2. 获取 `thread.latestMessageId`（调 `MessageStore` 或 thread metadata）
3. 比较：`latestMessageId > deliveryCursor` 且 unseen 消息不全是自己发的
4. 如果有 unseen → 返回 held 信封（不执行副作用）
5. 如果无 unseen 或 cursor 不存在 → **fail-open, 放行**

Held 信封结构：
```typescript
interface HeldEnvelope {
  status: 'held';
  reason: 'newer_messages_available';
  unseenCount: number;
  // 最多 3 条摘要（DEFAULT_HELD_CONTEXT_LIMIT，学 Raft）
  previews: Array<{
    from: string;     // catId 或 'user'
    messageId: string;
    preview: string;  // 前 200 字符
  }>;
  omittedCount: number;  // 超过 3 条时的省略数
  actions: ['read_latest', 'revise', 'send_with_acknowledge'];
}
```

**覆盖的副作用工具**（按优先级）：

| 工具 | 优先级 | 理由 |
|------|--------|------|
| `post_message` | P0 | 最高频副作用，答非所问的主战场 |
| `cross_post_message` | P0 | 跨 thread 同理 |
| `multi_mention` | P1 | 传球+内容，stale 传球危害大 |
| `hold_ball` | P1 | hold 前应知道 thread 有变化 |
| `publish_verdict` | P2 | 评审结论过期风险 |

#### A2: Held 客户端处理（MCP server）

在 `callback-tools.ts` 的 `_executePostMessage` 等函数中处理 `held` 返回：
- 检测 `data.status === 'held'` → 返回可读的提示文本给猫
- 提示包含：原因、新消息摘要、可选动作说明
- 猫读完 held 信封后可以：
  - 调 `list_recent` / `get_thread_context` 读新消息（自动推进游标）
  - 修改内容后重新调 `post_message`
  - 加 `acknowledgeHeld: true` 参数强制发送原文

#### A3: 游标推进时机

| 动作 | 游标是否推进 | 理由 |
|------|-------------|------|
| `list_recent` / `get_thread_context` 读了消息 | ✅ 推进到读到的最新 | 猫看过了 |
| `post_message` 成功发送 | ✅ 推进到当前 latest | 发消息 = 隐含"我知道当前状态" |
| `post_message` 被 held | ❌ 不推进 | 猫还没看新消息 |
| `search_evidence` 等只读工具 | ❌ 不推进 | 不代表猫看了 thread 消息 |

#### A4: F233 事件流集成

每次 held / forward 决策记录为 F233 BallCustodyEventLog 事件：

```typescript
type FreshnessDecisionEvent = {
  kind: 'freshness_decision';
  threadId: string;
  catId: CatId;
  invocationId: string;
  decision: 'forward' | 'held';
  reason: string;  // 'no_unseen' | 'unseen_available' | 'cursor_missing_fail_open'
  unseenCount: number;
  toolName: string;  // 哪个工具触发的检查
  timestamp: number;
};
```

这让 F233 的简报可以统计：哪些猫经常被 hold、hold 后选择 revise 还是 force-send、有多少 stale 消息被拦截。

### Phase B: Content-Free Inbox Notice + 防无视

#### B1: 只读工具附加 notice

猫调只读 MCP 工具（`search_evidence`、`list_recent`、`get_thread_context` 等）时，MCP server 检查"当前 thread 有未读消息吗"（`latestMessageId > deliveryCursor`），如果有，在工具返回值尾部附加 notice：

```
📬 提醒：你有 N 条未读消息（当前 thread）
来自：{catIds / user}
调 list_recent 查看完整内容
```

Notice 是 **target-scoped**（告诉猫"谁发的"），但 **content-free**（不含消息内容）。

附加频率限制：同一 invocation 内每 5 次工具调用最多附加 1 次（防噪声）。

#### B2: Turn 结束 notice（hold_ball / post_message 响应附加）

猫准备退出时（调 `hold_ball`）或发消息时（调 `post_message`），如果有未查看的 notice：

- 在 `hold_ball` 返回中附加：`⚠️ 你这轮有 N 条未读消息未查看`
- 给猫一个选择：先看再退出，或带着"延期"标记退出

#### B3: Harness re-invoke（防无视兜底）

猫 invocation 结束后，harness 检查 `unacknowledgedNoticeCount > 0`（invocation 期间收到 notice 但未去读消息推进游标）：

- 如果 > 0 且 `parentInvocationId` 没有过 re-invoke → 触发一次新 invocation
- 新 invocation 的 prompt："你上一轮有未读消息没查看，请查看并回应"
- 每个 invocation 最多触发 1 次 re-invoke（防循环）
- re-invoke 时如果消息已被其他猫处理（通过球权变化检测）→ 不 re-invoke

### Phase C: Runtime Capability Descriptor

#### C1: Descriptor 数据结构

```typescript
interface RuntimeCapabilityDescriptor {
  // 运行模式
  carrier: string;           // 'headless-p' | 'interactive' | 'bg-cron' | 'cloud' | 'connector'
  driver: string;            // 'claude' | 'codex' | 'gemini' | etc.
  
  // Freshness Gate 能力
  canReceiveHeldResponse: boolean;
  canReceiveContentFreeNotice: boolean;
  
  // 交互能力
  busyDeliveryMode: 'gated' | 'direct' | 'steer';  // -p=gated, SDK=steer
  canAskHumanSync: boolean;    // interactive only
  backgroundBashReliable: boolean;
  
  // 安全
  permissionMode: string;
}
```

**Descriptor 从 driver 定义派生**（`descriptorFromDriver(driver, mode)`），不手维护查表——P4 单一真相源。

#### C2: Descriptor 驱动 Phase A/B 行为

- `canReceiveHeldResponse = false` → freshness check 返回 warning 而非 held（不阻塞）
- `canReceiveContentFreeNotice = false` → 不在只读工具附加 notice
- `busyDeliveryMode = 'steer'` → 可以 mid-turn 注入 notice 内容（未来 SDK session 场景）

#### C3: 注入方式

在 `invoke-single-cat.ts` 的 `callbackEnv` 中加 `CAT_CAFE_RUNTIME_MODE`，MCP server 据此查 descriptor。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC trace 回 Why（猫发消息时不知道世界变了 → 拦住让猫知道）-->

### Phase A（Freshness Gate MVP）

- [ ] AC-A1: 猫调 `post_message` 时，如果 thread 有猫未看过的消息（`latestMessageId > deliveryCursor`），返回 held 信封而非执行发送——**用 DeliveryCursorStore seq 游标判断，不用 timestamp**
- [ ] AC-A2: 猫 turn 中途通过 `list_recent` / `get_thread_context` 读过新消息后，游标推进，再调 `post_message` 不被 hold（**零误 hold 验证**）
- [ ] AC-A3: `deliveryCursor` 不存在时 fail-open 放行（不因缺数据卡死副作用）
- [ ] AC-A4: held 信封最多展示 3 条摘要 + omittedCount（防 context 膨胀）
- [ ] AC-A5: 猫加 `acknowledgeHeld: true` 可强制发送（escape hatch）
- [ ] AC-A6: `cross_post_message` 和 `multi_mention` 同样受 freshness gate 保护
- [ ] AC-A7: 每次 held/forward 决策记录为 F233 BallCustodyEventLog 事件
- [ ] AC-A8: Redis-backed 测试覆盖游标读写 + held 决策（不用纯 in-memory 假绿）

### Phase B（Content-Free Notice + 防无视）

- [ ] AC-B1: 猫调只读工具时，如果有未读消息，返回值附加 target-scoped notice（频率限制：每 5 次工具调用最多 1 次）
- [ ] AC-B2: 猫调 `hold_ball` 时，如果有未查看的 notice，返回值附加提醒
- [ ] AC-B3: 猫 invocation 结束时 `unacknowledgedNoticeCount > 0` → 触发一次 re-invoke（防循环：每 invocation 最多 1 次）
- [ ] AC-B4: re-invoke 时如果消息已被其他猫处理 → 不 re-invoke（防不必要的 invocation）

### Phase C（Runtime Descriptor）

- [ ] AC-C1: Descriptor 从 driver 定义派生（`descriptorFromDriver`），不手维护查表
- [ ] AC-C2: `CAT_CAFE_RUNTIME_MODE` 环境变量注入到 callbackEnv
- [ ] AC-C3: Phase A/B 的 held/notice 行为由 descriptor 参数化（`canReceiveHeldResponse` / `canReceiveContentFreeNotice`）

## Dependencies

- **Evolved from**: F233（Ball Custody Observability）— 事件流地基 + held 决策落成事件
- **Related**: F167（A2A Chain Quality）— 上游传球质量；F254 是"传球那一刻的 freshness 检查"
- **Related**: F069（Thread Read State）— ThreadReadStateStore 可复用
- **Related**: F193（Message Routing）— post_message 路由守卫
- **Origin**: Raft 0.63.7 teardown（`docs/discussions/2026-05-14-slock-deep-dive/`）

## Risk

| 风险 | 缓解 |
|------|------|
| 误 hold 导致猫猫体验退化（被频繁拦截） | seq 游标（不是 timestamp）+ fail-open + `acknowledgeHeld` escape hatch |
| held 信封撑爆 context（大量未读时） | DEFAULT_HELD_CONTEXT_LIMIT=3 + omittedCount |
| DeliveryCursorStore 性能（每次副作用工具多一次 Redis 查询） | getCursor 已有内存缓存层（memory+redis max），且是单 key GET |
| re-invoke 循环（notice → re-invoke → 又有 notice → 再 re-invoke） | 每 invocation 最多 1 次 re-invoke，parentInvocationId 去重 |
| 跨 thread cross_post_message 的 freshness 判据不清 | 检查**目标 thread** 的游标（猫要发到的地方），不是源 thread |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase A 是否也 gate `hold_ball`？hold 前知道有新消息是好事，但 hold 是"我要暂停"的语义，hold 被 hold 有点奇怪 | ⬜ Design Gate 讨论 |
| OQ-2 | re-invoke 的成本（猫粮消耗）vs 收益（防无视）的 threshold 怎么定？每次都 re-invoke 还是只有铲屎官消息才 re-invoke？ | ⬜ Phase B 设计时定 |
| OQ-3 | `acknowledgeHeld` 是否需要理由字段？（让猫说明为什么选择强制发送）| ⬜ 实测再定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | **用 seq 游标（DeliveryCursorStore）不用 timestamp 窗口** | timestamp 会误 hold（猫看过的消息仍然 > createdAt）；seq 游标在 ack 后推进，精准区分"看过/没看过"（opus-48 源码核验 Raft `modelSeenSeq` 机制） | 2026-06-27 |
| KD-2 | **Fail-open（cursor 不可信时放行不 hold）** | 宁漏 hold 不错 hold——错 hold 卡死副作用比偶尔漏 hold 严重得多（Raft `inboxTrustState` 同策略） | 2026-06-27 |
| KD-3 | **三个 surface 合一个 feature，不是三个独立 feature** | 它们共享 seen 边界（DeliveryCursor）+ 共享事件流（F233）+ descriptor 参数化 notice/hold 行为；独立拆会导致三套基础设施 | 2026-06-27 |
| KD-4 | **Phase A 先做（不是 Descriptor 先做）** | 当前所有猫都是 -p 模式，Descriptor 在 Phase A/B 中可硬编码；价值最高的 held draft 不应等 descriptor 就绪。48 建议 descriptor 先行的理由（异构 runtime 参数化）在我们有多模式时再生效 | 2026-06-27 |
| KD-5 | **Raft 有 prompt 级防无视（L2334/L2641），不是"什么都没有"** | 修正 seed 的事实错误。我们的优势是 harness 级（re-invoke）不是"他们没有我们造"。避免过度造轮子 | 2026-06-27 |

## Eval / Tracking Contract

### Primary Users + Activation Signal
- **Primary users**: 所有猫猫（通过 MCP 工具发消息时自动触发）
- **Activation signal**: 猫调副作用 MCP 工具 + thread 有 unseen 消息 → held 信封

### Friction Metric
- **误 hold 率**：猫已看过消息但仍被 hold 的比例（目标：0%——seq 游标应消除此类）
- **acknowledgeHeld 使用率**：猫选择强制发送的比例（高 = held 信息不够有用，或 hold 太频繁）
- **re-invoke 触发率**：Phase B.c 自动 re-invoke 的频率（高 = 猫经常无视 notice，notice 设计需改进）

### Regression Fixture
1. 猫 invoke 后 thread 有新消息 → 猫调 post_message → 收到 held（不是正常发送）
2. 猫 invoke 后 thread 有新消息 → 猫先 list_recent 读了 → 再 post_message → 正常发送（游标已推进，不 hold）
3. 新 thread 首次 invoke，无 cursor → post_message → 正常发送（fail-open）
4. held 信封 preview 不超过 3 条（context cap）

### Sunset Signal
- 如果 3 个月内 held 决策事件中 `decision: 'held'` 占比 < 1%（几乎没有 stale 场景发生），说明这个 feature 的价值不大，考虑简化或移除
- 如果 `acknowledgeHeld` 使用率持续 > 50%（猫总是强制发送），说明 hold 机制打扰大于帮助，需要重新审视判据

## 需求点 Checklist

| # | 需求 | Phase | AC | 测试 | 状态 |
|---|------|-------|-----|------|------|
| R1 | seq 游标 freshness check | A | AC-A1 | Redis-backed | ⬜ |
| R2 | 零误 hold（看过不 hold） | A | AC-A2 | 游标推进验证 | ⬜ |
| R3 | fail-open | A | AC-A3 | null cursor 测试 | ⬜ |
| R4 | held context cap=3 | A | AC-A4 | 多消息场景 | ⬜ |
| R5 | acknowledgeHeld escape | A | AC-A5 | force send 测试 | ⬜ |
| R6 | cross_post 覆盖 | A | AC-A6 | 跨 thread 测试 | ⬜ |
| R7 | F233 事件记录 | A | AC-A7 | 事件流验证 | ⬜ |
| R8 | content-free notice | B | AC-B1 | 只读工具附加 | ⬜ |
| R9 | turn-end notice | B | AC-B2 | hold_ball 附加 | ⬜ |
| R10 | re-invoke 兜底 | B | AC-B3/B4 | 循环防护 | ⬜ |
| R11 | descriptor 派生 | C | AC-C1 | 派生一致性 | ⬜ |
| R12 | runtime mode 注入 | C | AC-C2 | env 验证 | ⬜ |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-26 | Raft 0.63.7 teardown 提出三个 feature seed（opus-46 + codex） |
| 2026-06-26 | opus-48 独立源码核验 → 修正 timestamp→seq、事实错误、三合一子系统 |
| 2026-06-27 | CVO signoff 立项 → F254 spec（本文档） |

## Review Gate

- Phase A: 跨族 review（优先 @gpt52，性价比；砚砚太贵留安全/跨族/连续性场景）
- Phase B: 跨族 review
- Phase C: 猫猫讨论（`collaborative-thinking`）→ 跨族 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Origin** | `docs/discussions/2026-05-14-slock-deep-dive/feature-seeds-from-raft-2026-06-26.md` | 原始 seed 文档（opus-46） |
| **Review** | `docs/discussions/2026-05-14-slock-deep-dive/opus48-seed-review-2026-06-26.md` | opus-48 独立核验 + 修正 |
| **Teardown** | `docs/discussions/2026-05-14-slock-deep-dive/opus-refresh-2026-06-26.md` | Raft 0.63.7 完整拆解 |
| **Teardown** | `docs/discussions/2026-05-14-slock-deep-dive/codex-refresh-2026-06-26.md` | Codex 独立对比分析 |
| **Feature** | `docs/features/F233-ball-custody-observability.md` | 事件流地基 |
| **Feature** | `docs/features/F069-thread-read-state.md` | ThreadReadStateStore |

---

Architecture cell: `ball-custody`
Map delta: update required — F254 在 ball-custody cell 新增 freshness-decision 事件类型 + projection consumer

[宪宪/Opus-46🐾]
