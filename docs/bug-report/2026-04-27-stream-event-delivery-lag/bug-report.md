---
feature_ids: []
related_features: [F118, F167, F088]
topics: [bug-report, stream-events, event-delivery, in-process-broadcast, long-invocation, status-message-discipline]
doc_kind: bug-report
created: 2026-04-27
status: open
severity: P1
reporter: 铲屎官 (实测)
diagnosed_by: 布偶猫/宪宪 (Opus-47)
---

# Bug Report：长 invocation 流式事件前端断流（"砚砚气泡看不到"）

> **案发时间**: 2026-04-27 ~12:46–14:50 北京时间（UTC 04-27 04:46–06:50）
> **案发 thread**: `thread_moet2v6al4gfauvs`
> **持有人**: 砚砚 GPT-5.5（在跑 v0.9.0 release 链路 PR #1430 / #1431）
> **报告人**: 铲屎官（前端实测）
> **报告时间**: 2026-04-27 23:21 北京时间，向 thread `thread_moay5tqumsbu17yr` @opus47

## TL;DR

砚砚 GPT-5.5 在 thread `thread_moet2v6al4gfauvs` 跑 long invocation（开 PR #1430、跑 review、开 PR #1431），**后端持久化 message 完整存储**（store 真相源核过），但**铲屎官前端看不到他的中间过程消息**——只能从 GitHub 的 PR review feedback 自动通知里推断"砚砚还在干活"。同窗口出现 `Response timed out. The operation may still be running in the background.` + 一条 `in-process app-server event stream lagged; dropped 32 events` 警告。

**此 Bug 跟 PR #1429 (前端 outer/inner invocationId canonicalization) 无因果关系**——PR #1429 修的是"同一响应渲染两次"，本 Bug 是"响应过程根本没渲染"。时间序也对不上（PR #1429 merge 在 04-27 02:45 UTC，砚砚 invocation 在那之后开始跑）。

## 现象（铲屎官原话 + 截图证据）

### 铲屎官原话（thread_moay5tqumsbu17yr 23:21）

> "我不知道是不是你们改的，现在这里我和你澄清一下问题到底是什么。
>
> 就是你看我让砚砚发版本！他应该在跑在干活 甚至提了两个pr！但是他的气泡没显示！！
>
> 我这里看到的就是 github 突然通知了 1430 1431 两个消息！但是砚砚不见了！！ 然后他甚至可能就在后面跑着！！"

### 截图证据（thread_moet2v6al4gfauvs 视图）

截图（铲屎官提供，路径 `/Users/lysander/projects/relay-station/cat-cafe-runtime/packages/api/uploads/1777270891062-2199a86f.png`）显示：

1. 顶部一条 砚砚 GPT-5.5 的 `CLI Output · done · 34 tools · 5m18s · shared` 折叠卡（这是更早一轮 invocation 的产物）
2. 铲屎官 `04/26 20:56` 消息："可以 发 v0.9.0 记得 中英rn 都要发，记得相关的issue要关闭"
3. **蓝色框系统消息**："Response timed out. The operation may still be running in the background."
4. **黄色警告**："in-process app-server event stream lagged; dropped 32 events"
5. 之后只有 GitHub PR #1430 review feedback 的自动推送通知，**砚砚没有新气泡**
6. 底部状态栏显示"执行中 - 缅因猫 (GPT-5.5) 2:15"——证明砚砚的 invocation 仍在 in-flight

### 后端真相源（拉 thread store 实证）

通过 `cat_cafe_get_thread_context(threadId="thread_moet2v6al4gfauvs", limit=50)` 拉到 **54 条** message，砚砚的工作过程消息**完整存储**：

- 多轮 `pnpm gate` 跑 + rebase + commit + push 的 commentary
- DONE 状态汇报（`PR #1408 已合入`、`PR #1420 已合入`、`PR #1430 已合入 merge commit 13e0b6aa0`）
- 自己对 dropped events 的反思（砚砚 23:38 自己的话）：

  > "你前端没看到我'去写 #1430/#1431'，这里更像协作可视化/消息节奏问题，不一定是业务前端 bug：我当时在同一个长 invocation 里用 CLI 开 PR、跑 review，中间多数是工具执行和本地 commentary，没有形成一条完整落库的 DONE 状态消息"

**结论**：后端 messageStore 持久化是正常的；问题在 **stream events 实时投递到前端的链路**。

## 区分（避免重蹈 F176 误诊）

| 维度 | 本 bug | PR #1429 dup bubble | 04-26 01:21 DOM 缺失 |
|------|--------|----------------------|---------------------|
| 现象 | 砚砚气泡完全没出现 | 同一响应渲染两次 | ChatMessage 不 mount 到 DOM |
| 后端 | 持久化 OK，stream events 投递缺失（dropped 32） | broadcast OK 但 outer/inner id 双标 | 持久化 OK |
| 前端 | 收不到 events 等 timeout | 收到 events 但绑两个 bubble id | 收到 events 但组件没渲染 |
| 时间 | 2026-04-27 04:46+ UTC | 历史 | 2026-04-26 01:14 |
| 根因 | 后端 in-process event bus lag + long invocation 无 status message | F173 frontend identity 混用 | 候选根因待诊断 |

## 候选根因（待验证，不预设）

按可疑度排序：

### (1) 后端 in-process event bus backpressure / lag（**主嫌**）

证据：截图明显警告 `in-process app-server event stream lagged; dropped 32 events`。

- 含义：app-server 内部 event broadcast 队列被填满，丢了 32 个 events
- 假设：socket.io broadcast / fastify SSE / 内部 EventEmitter 在 long invocation 高频 stream chunk 下背压
- 范围影响：所有正在收 stream 的前端 socket 连接
- 待查：grep 不到"in-process app-server event stream lagged"字面源码——需要确认是 (a) 项目自己的 log 但搜索关键词错了 (b) 来自 socket.io / fastify / nodejs 内置警告 (c) 来自 telemetry 链路的 sampling drop

### (2) Long invocation 缺 progressive status message

证据：砚砚自己承认"中间多数是工具执行和本地 commentary，没有形成一条完整落库的 DONE 状态消息"。

- 含义：CLI tool calls 不会自动 post_message 到 thread；只有 stream events（如果送达）和最终 DONE message 是用户可见的
- 这是**协作纪律层的 bug**，不只是技术 bug——长任务必须主动 post status snapshot
- 跟 (1) 相互放大：(1) 让 stream 不可见，(2) 让缺乏兜底 status message

### (3) DONE_TIMEOUT_MS 5 分钟过短？

证据：`packages/web/src/hooks/useAgentMessages.ts:61` `DONE_TIMEOUT_MS = 5 * 60 * 1000`。

- 含义：5 分钟内没有任何 stream message → 前端触发 `Response timed out` 系统提示
- 对长 invocation（如砚砚的 release sync 链路 5 分钟+）一旦中间 stream 卡顿 → 触发 timeout 提示 + 用户认为"挂了"
- 但 timeout 提示自身**只是 UX 信号**，不是根因；如果 events 不丢，永远不会触发

## 不是这些（已排除）

- ❌ **不是 PR #1429 regression**：PR #1429 merge 在 04-27 02:45 UTC，砚砚 invocation 在那之后跑；时间上有先后但因果不成立。PR #1429 修的是 dup bubble，跟 missing bubble 不是同一类。
- ❌ **不是 store 持久化丢消息**：拉 thread context 全在
- ❌ **不是 chrome cache 问题**（铲屎官没说清这次是否清过 site data，但即使没清，store 真相源没问题，前端 fetch 应该能补回）
- ❌ **不是 F173 KD-2 mirror invariant 漏修**：砚砚的 invocation 不在铲屎官当前 viewing thread，bubble identity 不重叠

## 候选挂载点（请铲屎官拍板）

| 候选 | 适合度 | 理由 | Tradeoff |
|------|-------|------|---------|
| **新立 F: Stream Event Delivery Reliability** | 高 | bug 跨多个层（in-process bus / socket / long invocation discipline），独立立项可以一并收口 | 又一个 F 扩增 BACKLOG |
| **挂在 F118 Liveness** | 中 | F118 关心"cat 还活着没"，跟"events 投不到"语义相邻；前端用户视角"砚砚不见了"也是 liveness 问题 | F118 现在主要是 cat 进程级（`cpuTimeMs/processAlive`），不是 event 传输级 |
| **挂在 F167 A2A Chain Quality** | 低 | F167 是 A2A handoff (cross-cat) 的乒乓 / 虚空传球；本 bug 是 single invocation 内的 stream | 范畴不匹配 |
| **挂在 F088 Hub Terminal/Streaming** | 中 | F088 Phase 4 涉及 streaming output；本 bug 影响所有 long invocation 的 stream visibility | F088 已有大 scope，硬塞会稀释 |

**我的推荐**：**先以 bug-report 形式登记**（本文件），不立 F；等砚砚那个 thread 复盘 + 我们查 in-process event bus lag 源码定位（grep 不到字面，需要追到底）后，**根据真根因决定**：

- 如果根因是 **socket.io backpressure** → 偏 F088（streaming infra）
- 如果根因是 **long invocation 不主动 status** → 偏新立"协作纪律 + status checkpoint"feature
- 如果是 **app-server 内部 EventEmitter 高频 chunk overflow** → 偏 F118 扩展（liveness 包含 event delivery）

## 关键 follow-up（待我做的事，铲屎官 ACK 后启动）

1. **找到 "in-process app-server event stream lagged; dropped 32 events" 这条 log 的源** — grep 不到字面，可能是 console log / 外部 lib，需要 runtime tail 追到
2. **核实砚砚那条 invocation 是否在 messageStore 的 `[invocation:{id}:events]` 里有 stream chunk 记录** — 区分"events 进了 broadcast 但 lag 没送达前端" vs "events 根本没 emit"
3. **复现路径**：构造 5 分钟+ long invocation（多次 CLI tool call + commit + push），观察前端 stream event lag 阈值
4. **如果根因确认是 in-process backpressure**：评估 socket.io 输出队列或自建 broadcast queue 的 buffering 策略

## 关联

- F173 closed-state hotfix PR #1429（不同 bug，仅时间相邻）
- 04-26 01:21 timeline 记的"Cat ChatMessage 整体不渲染（DOM 缺失）" — 现象表层相似（都是"砚砚气泡看不到"），根因不同：那次是前端没 mount，本次是后端 events 没送达；可能是同一类用户痛点的不同根因
- F176 误诊史教训：**不要凭印象猜根因**，本 bug 必须找到 lag log 的源 + 实际复现，不能只靠截图脑补

## 签名

[宪宪/Opus-47🐾] 2026-04-27
