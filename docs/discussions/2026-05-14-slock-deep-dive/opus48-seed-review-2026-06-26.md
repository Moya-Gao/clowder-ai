---
doc_kind: design-review
topics: [held-draft, freshness-gate, runtime-descriptor, inbox-notice, raft-lessons, fresh-eyes]
created: 2026-06-26
status: review
authored_by: opus-48
reviews: feature-seeds-from-raft-2026-06-26.md
method: independent source read of @botiverse/raft-daemon@0.63.7 (npm pack) + Cat Café infra grep
origin: 铲屎官指派「没参与过的猫先自己读 Slock 再评 seed」
---

# Fresh-Eyes Review: 三个 Raft Seed（opus-48 独立源码核验）

> 我是这条线之前没参与过的猫。按铲屎官要求，**先自己 npm pack 解了 `@botiverse/raft-daemon@0.63.7`
> 的源码独立读了一遍**（不沿用 opus-46/砚砚 的二手结论），再 grep 了 Cat Café 现有基础设施，
> 然后才评 seed。所有结论带源码行号，可复核。

## 总判断

**三个 seed 方向都对、都值得做、本能是准的。但有三个必须在动手前修掉的问题，而且三个 seed 其实是
*一个* 子系统的三个面，不是三个独立 feature。** 其中 Seed 1（Held Draft）按现在写法实现会在上线
第一天就被一堆"误 hold"逼到关掉——它选错了机制，而**正确的机制（单调游标）已经躺在我们自己的
代码库里**（`DeliveryCursorStore`），seed 没 grep 到，重新发明了一个更差的轮子（timestamp 窗口）。

---

## Seed 1: Held Draft / Freshness Gate — 方向对，机制选错（4 处修正）

### ✅ 对的部分

- "gate 在 MCP 工具层，不在 agent 感知层" — 完全正确，`-p` 不是障碍。Raft 也是在 `raft message send`
  那一刻服务端拦，不是 mid-turn 推送。
- 落点直觉对：副作用出口拦截。

### ⚠️ 修正 1（最重要）：用 seq 游标，不是 timestamp 窗口——而且我们已经有了

Seed 提的是 `getMessagesSince(threadId, invocation.createdAt)`——**按 invocation 开始时间取窗口**。
这是天真版，会**大量误 hold**：猫 turn 中途读了新消息（`list_recent` / `get_thread_context`）后再发，
仍然被 hold，因为那些消息的 timestamp 永远 > createdAt，跟"猫看没看过"无关。上线第一天就会被烦到关。

Raft 不是这么做的。Raft 用 **seq-based「model seen boundary」**（`chunk-6OMBWTF5.js`）：

- `planAgentInboxSideEffect`（L3186）是个完整状态机，先把每条 pending 用 `isMessageModelSeen` 分类
  成"已看 / 未看"（L3535：`seq <= modelSeenSeq → seen`，或自己发的，或自定义 predicate）。
- **只有未看过的消息才触发 hold**。全部已看 → `decision: "forward"`，reason `exact_target_pending_already_seen`（L3236），**不 hold**。
- send 成功时 `forwardSeenUpToSeq` **推进** seen 边界（L3249）——发消息本身 = 把边界推到当前 seq。

**而 Cat Café 已经有这个原语**，seed 没发现：

```
packages/api/.../stores/ports/DeliveryCursorStore.ts:
  "Tracks per-user/per-cat/per-thread last delivered message ID.
   IDs are lexicographically sortable (timestamp+seq prefix), so monotonic
   progression can be enforced with string comparison."
  "Monotonic ack: cursor only moves forward. Redis Lua compare-and-set."
```

这就是 Raft `modelSeenSeq` 的逐字等价物——per-(cat,thread) 单调游标，over 可排序消息 ID。还有
`ThreadReadStateStore`（F069，`lastReadMessageId` + monotonic ack）。

> **正确的 freshness 判据 = `threadLatestMessageId > deliveryCursor[cat][thread]`（可排序 ID 字符串比较），
> 不是 timestamp 窗口。** seed 的"已有基础设施"表里漏了 `DeliveryCursorStore`/`ThreadReadStateStore`，
> 却新建了一个不存在且更差的 `getMessagesSince(createdAt)`。改用现成游标，误 hold 问题自动消失。

### ⚠️ 修正 2：覆盖范围应该接 F233 ball custody，不止 messaging

Raft 的 hold 作用于 **3 个动作：send / task_claim / task_update**（L156-158 的 activity title；
非 send 动作的 available_actions 是 `["check_messages","retry_action"]`，L197）。也就是
"抢任务/改任务前先核 freshness"。

我们的直接对应不是消息，是 **F233 球权**：抢球 / 传球 / merge / publish_verdict 前先核 freshness。
seed scope 在 post_message/cross_post，砚砚 seed 提到了 `@route/publish_verdict/hold_ball`，但没人把它
连到 task_claim 语义。**最大的奖品是 gate 住球权动作**，不是聊天消息。

### ⚠️ 修正 3：held 上下文要封顶

Raft `DEFAULT_HELD_CONTEXT_LIMIT = 3`（L3185）——held 时只展示最近 3 条，其余给 `omittedMessageCount`。
seed 是每条 `substring(0,200)` 且**无上限**——一次涌进 20 条就撑爆 context。加个 cap。

### ⚠️ 修正 4：要有 fail-open 策略（信不过边界时放行）

Raft 有 `inboxTrustState: trusted/untrusted`。当拿不到可靠 seq 边界（`missing_seq_boundary`，L3528），
它选择 **forward（放行），不 hold**（L3392-3404 first-touch recent 分支）。seed 没有"边界不可信时怎么办"
的策略——默认会在脏数据上 hold。freshness gate 必须 fail-open（宁可漏 hold，不可错 hold 卡死副作用）。

### 💡 架构平行：Raft 的 held 决策本身是个事件溯源的 fact

held 决策被 hash 成 `freshness_decision_fact:${hash}`（L131），全程 `appendTrace`（daemon-trace surface）。
这跟我们 **F233 `BallCustodyEventLog` + `BallCustodyProjector`** 同构。所以 Seed 1 **不该**是
`callbacks.ts` 里加个 `if`（seed 现在这么写），应该是 **F233 事件流上的一个 projection**——这正好落到
longform-005「consequence physics：在动作那一刻把后果边界显式化」。砚砚 doc 点到了"a state machine around
side effects... fits Longform 005"，但 seed 又退回成 bolt-on if 了。

---

## Seed 2: Runtime Descriptor — 方向对，两处结构修正

### ✅ 对的部分

- 与 F208 Dossier 正交（model 维度 vs env 维度）——判断准确，铲屎官也确认了。

### ⚠️ 修正：派生，别复制

seed 提注入 `CAT_CAFE_RUNTIME_MODE` 环境变量 + 查表。**Raft 是从 driver 定义派生 descriptor**
（`descriptorFromDriver(driver)`，L9193——transport/lifecycle/input/turnBoundary/inFlightWake/
busyDelivery/postTurn 全部从 driver 字段算出来）。单一真相源，没有第二张表会漂移。我们也应该 derive，
不要"L0 一段话 + 一张手维护的表"双份维护（这恰好违反 P4 单一真相源）。

### ⚠️ 维度：是 (driver × mode) 矩阵，不是一维 enum

seed 的 `carrier` 把两个轴压成一个扁平 enum（`cloud-codex`/`connector` 是 driver 维，
`interactive-cli`/`headless-p`/`bg-cron` 是 mode 维）。Raft 是 per-driver 因为它那里 runtime=carrier。
**我们这边同一个 driver（claude）在 -p vs interactive 行为不同**——descriptor 必须是
`(driver, mode) → caps` 二维，否则表达不了"claude 在 -p"和"claude interactive"的差异。

### 💡 Seed 2 是 Seed 1/3 的地基，不是"最后按需做"

Raft 里 descriptor **驱动** notice/hold 行为：L5361 专门给 Claude runtime 说明"你 busy 时收批量
inbox-count notice 而非注入内容，副作用动作前先 `raft message check`"——**因为 Claude 不能像 SDK
session 那样 mid-turn steer**。所以 descriptor 的 `canReceiveHeldResponse` / `busyDelivery` 字段直接
决定"这个模式要不要 hold、怎么 notice"。seed 把三者画成松耦合、Seed 2 排"最后做"，是反的——
**descriptor 是 Seed 1/3 消费的能力层，应该先建**。

---

## Seed 3: Content-Free Notice + 防无视 — 有一个事实错误要改

### ✅ 对的部分

- a/b/c 三层防无视设计好，而且 c（harness re-invoke）确实**比 Raft 强**（harness 强制 vs 纯 prompt）。

### ❌ 事实错误：Raft **有**防无视机制，seed 说它没有

seed 原文："Raft 只有 content-free notice 本身……没有防无视机制。这是我们可以做得更好的地方。"

**这是错的。** Raft 有防无视，是 prompt 级的，而且写得很讲究：

- **L2334**："停下前，检查你欠的、正阻塞某人的具体 handoff/review/decision/reply，发一条最小可行
  消息再停" — 这是 turn-end 防漏球 gate（≈ 我们的传球三选一！）。
- **L2626 / L2641**："**绝不能**从 content-free notice 单独推出'没活了'——你选择不读，那是个要**诚实
  上报的延期**，不是'没有待处理'的结论。""unobserved is not the same as nonexistent."

准确说法：**Raft 有 prompt 级防无视，我们可以加 harness 级**。方向对，但前提"他们什么都没有"是假的——
而一个"他们没有"的假前提正是让我们过度造轮子的典型起点。把 framing 改对：我们不是从零补空白，是把
prompt-discipline 升级成 harness-enforced。

### ⚠️ 细化：notice 要 target-scoped，不只是计数

Raft 的 notice 是 **target-scoped**（L2640："header 显示总未读数，detail 行列出本次变化的 targets，
从不含消息体"）。seed 的"你有 N 条新消息"不如"你有 N 条新消息，在 #X 和 DM"可操作。带上**哪些
thread/target 变了**（不泄露内容也能 triage）。

### 💡 收敛点

Raft L2334 的 stop-gate（"欠着阻塞别人的 handoff 就别停"）就是**我们传球三选一的 prompt 版**。我们
已经用 F233 球权 + 传球决策树做得更好。所以 Seed 3c 是我们独有优势的自然延伸，值得做。

---

## 一句话重构：这不是三个 seed，是一个子系统的三个面

Raft 把它实现成**一个事件溯源状态机**（`planAgentInboxSideEffect` + fact hashing + trace），统一了
inbox-notice（seed 3）、held-draft（seed 1）、per-runtime 投递（seed 2 / L5361）。我们的 seed 拆成三个
松耦合 feature 了。更干净的 framing：

> **一个「副作用 freshness」子系统**：
> (a) 读 per-(cat,thread) seen 边界（= 复用 `DeliveryCursorStore`，不是新建 timestamp 查询）；
> (b) 被 runtime descriptor 参数化（busy 时怎么 notice、能不能 hold）；
> (c) busy 时发 content-free notice，副作用出口发 held 信封——**全部作为 F233 事件流的 projection**。
>
> 不是 3 个 seed，是 1 个 feature、3 个 surface，落在 F233 ball-custody 的事件日志上。

---

## 我的建议（给 CVO 的 Decision Packet）

**价值取舍，不是技术 A/B：**

- 这三个 seed 我**赞成做**，且认为是高价值（直接补我们"出向 freshness UX"的短板，砚砚的对比矩阵也指到
  这是我们相对 Raft 唯一偏弱的轴）。
- 但**别照 seed 现在的写法进 spec**——Seed 1 的 timestamp 机制会误 hold、且忽略了现成的
  `DeliveryCursorStore`；Seed 3 有个会误导我们过度造轮子的事实错误；三者应合成一个落在 F233 上的子系统。

**两条路，请铲屎官拍方向：**

1. **我把修正后的「统一 freshness 子系统」写成一份正式 feature spec**（接 F233 事件流 + 复用
   DeliveryCursor + descriptor 先行），走立项 → 实现传 opus 家族 → alpha 验收 @sonnet。
2. **或先在讨论层把"一个子系统 vs 三个 seed"的边界和 F233 的接法敲定**，再立项。

开新 F 号需要你明确 signoff（家规 feedback_feat_anchor_needs_cvo_explicit_signoff），所以这一步停在你这。

---

## 源码核验附录（可复核）

| Claim | 源 |
|---|---|
| held 决策是 seq-based，已看过不 hold | `chunk-6OMBWTF5.js:3186`(planAgentInboxSideEffect), `:3535`(isMessageModelSeen), `:3236`(already_seen→forward) |
| held context cap = 3 | `chunk-6OMBWTF5.js:3185`(DEFAULT_HELD_CONTEXT_LIMIT) |
| 作用于 send/task_claim/task_update | `chunk-6OMBWTF5.js:156-158`, available_actions `:196-197` |
| held 决策是 hashed fact + traced | `chunk-6OMBWTF5.js:131`(freshness_decision_fact) |
| fail-open on untrusted boundary | `chunk-6OMBWTF5.js:3392-3404`, `:3528`(missing_seq_boundary) |
| descriptor 从 driver 派生 | `chunk-6OMBWTF5.js:9193`(descriptorFromDriver) |
| descriptor 驱动 per-runtime notice | `chunk-6OMBWTF5.js:5361`(Claude runtime note) |
| Raft **有** prompt 级防无视 | `chunk-6OMBWTF5.js:2334`(stop-gate), `:2626`,`:2641`(deferral must be honest) |
| notice 是 target-scoped content-free | `chunk-6OMBWTF5.js:2640` |
| Cat Café 已有 seq 游标（= modelSeenSeq 等价） | `packages/api/.../ports/DeliveryCursorStore.ts`, `ThreadReadStateStore.ts`(F069) |
| Cat Café F233 事件溯源（held 应落这） | `packages/api/src/domains/ball-custody/BallCustodyEventLog.ts`, `BallCustodyProjector.ts`, `ball-custody-state-machine.ts` |

源码获取：`npm pack @botiverse/raft-daemon@0.63.7`（与 opus-46/砚砚 同包同版本，独立解包核验）。

[宪宪/Opus-48🐾]
