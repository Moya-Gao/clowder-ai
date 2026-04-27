---
feature_ids: []
related_features: [F173, F164]
topics: [bug-report, opencode-provider, route-parallel, dedup, dup-bubble, invocationId-binding]
doc_kind: bug-report
created: 2026-04-27
updated: 2026-04-28
status: fix-in-progress
severity: P2
reporter: 铲屎官 (实测，2 个 thread 复现)
diagnosed_by: 布偶猫/宪宪 (Opus-47), 缅因猫/砚砚 (GPT-5.5)
---

# Bug Report：opencode 猫（qwen / kimi）每只渲染两个相同气泡

> **更新 2026-04-27（砚砚 GPT-5.5 复审）**：Opus-47 的"opencode provider stream events 不携带 invocationId"是有价值的中间假设，但代码/Redis 证据进一步收敛到更精确根因：**route-parallel live socket identity 使用 OUTER `parentInvocationId`，formal message persistence 却使用 per-cat INNER `invocation_created` id**。IDB 只是把这两个 identity 都缓存下来，清 cache 后只剩 server GET 的一份，所以看起来像 IDB 问题。

> **案发时间**: 2026-04-27 ~00:01–00:05 北京时间
> **案发 thread**: `thread_mognv4l440bcwzbp`
> **现场**: qwen + kimi 各显示 2 条相同 CLI Output 气泡
> **修复 workaround**: Chrome DevTools → Application → Storage → Clear site data + F5（铲屎官已验证生效）
> **报告人**: 铲屎官（前端实测，提供截图）
> **报告时间**: 2026-04-28 00:05 北京时间，向 thread `thread_moay5tqumsbu17yr` @opus47

## TL;DR

后端 messageStore 真相源：qwen × 1 message + kimi × 1 message（id `0001777273269123-000002` / `-000003`，timestamp 完全相同）；**前端实际渲染 qwen × 2 + kimi × 2**。F5 + 清 IndexedDB cache 后正确显示 1 + 1。

最终根因不是"IDB dedup 缺失"本身，而是 route-parallel 生产了两套合法-looking identity：

- live socket broadcast: `messages.ts` 包装为 OUTER `parentInvocationId`
- formal persisted message: `route-parallel.ts` 写 per-cat INNER `invocation_created` id

前端/IDB 收到的是 `msg-${outer}-${cat}`，hydration/server GET 收到的是 `msg-${inner}-${cat}`，于是同一只 opencode 猫显示两条。

## 现象

### 铲屎官原话（thread_moay5tqumsbu17yr 00:05）

> "thread_mognv4l440bcwzbp 你看 他每只猫出现两个气泡，但是我去删除了一下 cache 就是你之前教我的 打开开发者模式那个，然后 f5 就正确了，说明是前端的问题？"

### 截图（路径 `/Users/lysander/projects/relay-station/cat-cafe-runtime/packages/api/uploads/1777273525568-e0742152.png`）

```
qwen   04/27 00:01    CLI Output · done · 5 lines · shared
                      openai-compat/qwen3.6-max-preview · opencode
kimi   04/27 00:01    CLI Output · done · 3 lines · shared
                      openai-compat/kimi-k2.6 · opencode
qwen   04/27 00:02    CLI Output · done · 5 lines · shared    ← 内容相同
                      openai-compat/qwen3.6-max-preview · opencode
kimi   04/27 00:02    CLI Output · done · 3 lines · shared    ← 内容相同
                      openai-compat/kimi-k2.6 · opencode
```

注：截图显示的"04/27 00:01" / "00:02" 与 store timestamp `1777273269123` (= 北京 08:01:09) 不一致——前端时间戳渲染似乎用 UTC 直接展示而非 user locale。这是另一个独立小问题，**不是本 bug 主线**。

### 后端真相源（`cat_cafe_get_thread_context(threadId="thread_mognv4l440bcwzbp")`）

```
id: 0001777273269123-000002-da1ecc53   catId: qwen   "嘿！我是 qwen 🐱..."
id: 0001777273269123-000003-0b6a1c08   catId: kimi   "你好！我是 kimi（kimi-k2.6）..."
```

后端**只有各 1 条**。Bug 在前端层。

### 修复路径（铲屎官已实测）

Chrome DevTools → Application → Storage → Clear site data → F5 → qwen × 1 + kimi × 1，正确。

## 最终根因（2026-04-27 砚砚复审）

### 1. serial 路径已修，parallel 路径漏了同一条 #573 contract

`route-serial.ts` 已有明确防重逻辑：

```ts
const persistedInvocationId = options.parentInvocationId ?? ownInvocationId;
extra: {
  ...(persistedInvocationId ? { stream: { invocationId: persistedInvocationId } } : {}),
}
```

注释也写明原因：socket broadcasts use parentInvocationId；如果 persisted record carries a different id，frontend 会为同一逻辑响应创建两条 bubble。

但 `route-parallel.ts` 在三个 formal persistence 分支仍写 `ownInvId`：

- text branch: `extra.stream.invocationId = ownInvId`
- no-text/rich branch: `extra.stream.invocationId = ownInvId`
- error+tools branch: `extra.stream.invocationId = ownInvId`

这就是 qwen/kimi 每只两条气泡的 root mismatch。

### 2. 为什么清 IDB cache 后恢复

live 期间前端已经缓存了 OUTER bubble；F5 hydration 又从 server GET 拿到 INNER formal message。两个 id 不同，无法合并。

清 cache 后，只从 server GET hydrate 一份 formal message，所以前端显示恢复 1 条/猫。这说明 IDB 是放大器，不是根因。

### 3. 为什么这次集中出现在 qwen/kimi

这两个现场都是 parallel 多猫 spawn，走 `routeParallel`。Claude/Codex 的 serial/callback 路径已经通过 PR #1364/#1429 做过 outer-priority canonicalization；parallel formal persistence 是漏网路径。

## 已推翻/降级的中间假设

### (1) opencode provider stream events 不携带 invocationId → callback strict-match 失败（已降级）

这个假设解释了一部分现象，但不是最终根因：`AgentMessage` 现在已有 `invocationId?: string` 字段，且 route layer 会创建 per-cat invocation 并在 formal message 上写入 `extra.stream.invocationId`。现场 Redis 里 qwen/kimi formal message 均有 stream invocationId，只是它们是 INNER id。

#### 旧证据链（保留作排查记录）

**A. 后端：opencode 流出的 events 不带 invocationId**

`packages/api/src/domains/cats/services/agents/providers/opencode-event-transform.ts:52`
```ts
export function transformOpenCodeEvent(event: unknown, catId: CatId | string): AgentMessage | null {
  // ... 转换 step_start / text / tool_use / error → AgentMessage
  // 但生成的 AgentMessage 没有 invocationId 字段
}
```

`packages/api/src/domains/cats/services/agents/providers/OpenCodeAgentService.ts:230-255`
```ts
const result = transformOpenCodeEvent(event, this.catId);
// ...
yield { ...result, metadata };  // ← 没注入 invocationId
```

`AgentMessage` interface 当前已包含 `invocationId?: string`；这个事实推翻了"必须先改 type"的修法前提。

**B. 前端：placeholder 创建时绑不上 invocationId**

opencode stream chunks 进 `useAgentMessages.handleAgentMessage` 时 `msg.invocationId` 是 undefined → placeholder bubble 的 `extra.stream.invocationId` 也是 undefined。

**C. 前端：callback 来时 strict-match 找不到 placeholder**

`packages/web/src/hooks/useAgentMessages.ts:1671-1689` `findCallbackReplacementTarget`
```ts
if (
  msg.type === 'assistant' &&
  msg.catId === catId &&
  msg.origin === 'stream' &&
  msg.extra?.stream?.invocationId === invocationId  // ← 严格匹配，但 placeholder 的是 undefined
) {
  return { id: msg.id };
}
return null;  // ← 找不到
```

**D. fallback `findInvocationlessRichPlaceholder` 也找不到**

`packages/web/src/hooks/useAgentMessages.ts:1748-1759`
```ts
const isRichOrToolOnlyPlaceholder = (msg) =>
  // ...
  msg.content.trim().length === 0 &&  // ← 但 stream 已经写了 text
  ((msg.extra?.rich?.blocks.length ?? 0) > 0 || (msg.toolEvents?.length ?? 0) > 0);
```

opencode stream 已经把 text 写进 placeholder（`content` 不空）→ 不匹配。

**E. 走 else 分支 `addMessage` 创建新 bubble**

`packages/web/src/hooks/useAgentMessages.ts:2029-2052`
```ts
const id = msg.messageId ?? deriveBubbleId(invocationId, msg.catId, ...);
addMessage({
  id,
  type: 'assistant',
  // ...
  timestamp: Date.now(),  // ← 解释为什么 dup 的两个时间不同（00:01 vs 00:02）
});
```

= **每只 opencode 猫 = stream placeholder + callback new bubble = 2 个气泡**

#### 时间戳验证

截图显示 qwen "00:01" + qwen "00:02" + kimi "00:01" + kimi "00:02"：
- "00:01" = stream 期间创建的 placeholder timestamp（来自 stream event）
- "00:02" = callback 到达后 `Date.now()` 创建的新 bubble timestamp
→ 一一对应 hypothesis

#### 为什么 PR #1429 修不到这条

PR #1429 修的是 outer/inner invocationId 混用——前提是 placeholder 有 invocationId 可绑。opencode 这条根本没 invocationId 流到前端。

#### 为什么 Claude/Codex 没这个 bug

Claude / Codex provider 的 yield 链路里 invocationId 是显式注入到 metadata 或顶层 fields；opencode transform 漏了。需要看 ClaudeAgentService / CodexAgentService 怎么注入做对照。

### (2) IDB cache 持久化 dup（secondary，downgraded）

之前推断的"IDB cache 残留"是次因——dup bubble 被 (1) 创建后写入 IDB，F5 时从 IDB hydrate 仍然 dup；清 cache 后从 server GET 拿到干净的 1 份。

**根本修在 (1)**：消除创建源头，IDB 自然不会再缓存到 dup。

### (3) WebSocket 重连 + 旧消息 replay（已排除）

不合理：两个 dup 时间差 1 分钟，如果 replay 应该几乎同时。

## 不是这些（已排除）

- ❌ **不是 PR #1429 dup bubble bug**：PR #1429 修的是 active vs background path 把同一逻辑响应绑成两个不同 bubble id；本 bug 是后端 store 只 1 条，前端 IDB 多了 1 条。机制不同。
- ❌ **不是后端 broadcast 重复**：后端 store 实证只 1 条
- ❌ **不是后端 messageStore 写两次**：实证只 1 条

## 与已知 bug 的关系

| Bug | 现象 | 根因 | 状态 |
|-----|------|------|-----|
| 本 bug | qwen + kimi 各 2 个相同气泡 | 前端 IDB cache + socket arrived 未去重 | **open** |
| PR #1429 修的 dup | 同一响应渲染两次 | outer/inner invocationId 混用 | merged 04-27 02:45 UTC |
| PR #1411 修的 orphan draft | `draft-*` 残留 | mergeReplaceHydrationMessages 缺 ghost guard | merged，但 guard 只对 draft 生效 |
| 04-27 stream-event-delivery-lag | 砚砚气泡完全没显示 | 后端 in-process event bus lag | **open**（独立 bug-report） |

本 bug 跟 PR #1411 同源（都是 IDB hydration 层 dedup），但 PR #1411 的 guard 范围太窄。

## 候选修复方案

### 方案 A（已采用）：routeParallel formal persistence 对齐 parentInvocationId

**改动**：
1. 给 `route-parallel` 增加与 `route-serial` 同等的 parent-id persistence contract
2. formal text / no-text-rich / error+tools 三个 append 分支都用 `options.parentInvocationId ?? ownInvId`
3. 保留 draftStore / richBlockBuffer / keepalive 的 per-cat `ownInvId`，因为这些是内部生命周期 key，不是前端 bubble identity

**优点**：与现有 #573 serial/callback contract 完全一致，最小改动，直接消除 live/IDB vs server hydration 的 identity mismatch。

**验证**：新增 `route-parallel-parent-invocation-id.test.js`，RED 时 qwen persisted id 为 `inner-inv-1`，GREEN 后为 `cat-cafe-outer-parallel-123`。

### 方案 B：OpenCodeAgentService 注入 invocationId 到所有 yield events（暂不采用）

Provider 层补字段不能解决 formal persistence 已经写 INNER id 的问题；还会扩大 scope 到所有 provider 一致性审计。

### 方案 C：前端 fallback 放宽

让 `findInvocationlessRichPlaceholder` 接受 `content` 不空的 placeholder（去掉 `content.trim().length === 0` 守护）。

**风险高**：可能误吞别的并发 invocation 的 in-flight bubble（PR #1352 教训）。**不推荐**。

### 方案 D：前端 catId-only fallback dedup

callback path 在 strict-match 失败 + rich-only fallback 失败时，再 fallback 到"找最近一条同 catId 的 stream placeholder"。比 B 安全一点但仍有 race 风险。

## 候选挂载点

| 候选 | 适合度 | 理由 |
|------|-------|------|
| **挂在 F173 closed-state hotfix follow-up（与 PR #1429 同源）** | 高 | F173 KD-1/KD-2 收口的就是前端 message pipeline，但前端 strict-match 假设是 stream events 带 invocationId——这次发现 opencode 没遵守这个契约，是后端 provider 层的契约缺口 |
| **新立 F: Provider Stream Identity Contract**（包含所有 provider 一致性检查） | 中 | 如果检查发现 ≥2 个 provider 不带 invocationId，应该立项统一收口 |
| **直接当 hotfix 修，不立 F** | 高 | 单点修 OpenCodeAgentService + AgentMessage type 加字段 |

## 关键 follow-up（待 砚砚 GPT-5.5 复审 + ACK）

1. 砚砚复审 hypothesis（特别是"opencode 流出 events 没 invocationId"这个事实判断 — 我看的是源码静态分析，没看 runtime broadcast 实际 payload；砚砚可以从 runtime log 或 socket 协议层验证）
2. 砚砚复审"Claude/Codex 没这个 bug"的对比 — 我没全看 ClaudeAgentService / CodexAgentService 的 yield，只看了 transform；砚砚可以补
3. 修法决定 (A / B / C)
4. 我和砚砚 pair 改：(a) 后端 provider 注入 invocationId (b) `AgentMessage` type 加字段 (c) 前端 `extra.stream.invocationId` 绑定 (d) fixture 钉死"opencode multi-mention 不再 dup"

## 临时 workaround（用户视角）

清 IDB cache + F5 即可去除已经 dup 的 bubble。但每次 spawn 新 opencode 猫都会重新产生 dup——根因修复前 workaround 不解决问题。

## 签名

[宪宪/Opus-47🐾] 2026-04-28（更新：opencode 根因 hypothesis）
