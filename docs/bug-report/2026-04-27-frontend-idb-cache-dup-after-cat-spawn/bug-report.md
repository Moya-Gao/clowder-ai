---
feature_ids: []
related_features: [F164, F173]
topics: [bug-report, frontend, indexeddb, hydration, dedup, ghost-bubble, cache-stale]
doc_kind: bug-report
created: 2026-04-27
status: open
severity: P2
reporter: 铲屎官 (实测)
diagnosed_by: 布偶猫/宪宪 (Opus-47)
---

# Bug Report：前端 IDB cache 残留导致每只猫渲染两个相同气泡（清 cache + F5 修复）

> **案发时间**: 2026-04-27 ~00:01–00:05 北京时间
> **案发 thread**: `thread_mognv4l440bcwzbp`
> **现场**: qwen + kimi 各显示 2 条相同 CLI Output 气泡
> **修复 workaround**: Chrome DevTools → Application → Storage → Clear site data + F5（铲屎官已验证生效）
> **报告人**: 铲屎官（前端实测，提供截图）
> **报告时间**: 2026-04-28 00:05 北京时间，向 thread `thread_moay5tqumsbu17yr` @opus47

## TL;DR

后端 messageStore 真相源：qwen × 1 message + kimi × 1 message（id `0001777273269123-000002` / `-000003`，timestamp 完全相同）；**前端实际渲染 qwen × 2 + kimi × 2**。F5 + 清 IndexedDB cache 后正确显示 1 + 1 → 锁定为**前端 IDB cache 持久化层 dedup 缺失**。

**和 PR #1429 (outer/inner invocationId canonicalization) 不是同一类**：PR #1429 修的是同一逻辑响应被绑两个不同 bubble id（live broadcast 路径）；本 bug 是 hydration 路径上 IDB cached old message + socket arrived new message 同时进 store 没去重。

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

## 候选根因

按可疑度排序：

### (1) IDB messages cache + socket arrived message 双写未去重（**主嫌**）

证据：
- 清 IDB cache 修复 → 数据源在 IDB
- 后端 store 只 1 条 → 不是后端写两次

机制（待源码核实）：
- 用户点击 spawn qwen/kimi → 前端创建 placeholder bubble id（例如 `msg-{inv}-qwen`）写入 store + IDB
- socket 收到 backend stream 完成消息（id `0001777273269123-000002`）→ append 到 store + IDB
- 两条 id 不同（一个是前端 derived，一个是后端 server-issued）→ dedup 失败 → 看到两份
- F5 reload → IDB hydrate 后 server-issued message 是真相源，前端 derived placeholder 不再 re-create → 正确

### (2) F164 IDB hydration 跟 socket race

参考 timeline 04-25 09:03 + PR #1411 已经修过的 `mergeReplaceHydrationMessages` ghost-tolerance guard（drop `draft-*` 前缀且无 live invocation 的 local-only message）。本 bug 现场是**完整 done CLI Output 气泡**重复，不是 draft——guard 范围不覆盖。

候选方向：把 guard 扩展到非 draft prefix 的本地 only message？需要权衡，避免误删正在 streaming 的 placeholder。

### (3) WebSocket 重连 + 旧消息 replay

如果 socket 重连后后端把已 ack 的 message 重新发了一份，且前端没用 server-issued id 做 dedup → 重复。

但这条不太合理：截图两条 message 时间差 1 分钟（00:01 vs 00:02），如果 replay 应该几乎同时。

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

## 候选挂载点（请铲屎官拍板）

| 候选 | 适合度 | 理由 |
|------|-------|------|
| **挂在 F173 (closed) 作为 closed-state hotfix follow-up** | 高 | F173 主线就是收口前端 message pipeline 包括 hydration；PR #1411 已经在 F173 Phase C 修了同一类 ghost guard |
| **挂在 F164 IDB cache feature** | 高 | F164 主导 IDB cache 层；本 bug 直接是 IDB hydration 问题 |
| **新立 F: Hydration Dedup Hardening** | 中 | 独立立项可以一并处理"非 draft prefix 的 local-only message dedup" |
| **挂在新 bug-report，不立 F** | 高 | 本文件本身就是 bug-report 登记；找到精确根因后再决定 |

**我的推荐**：**先以 bug-report 形式登记**（本文件），然后在 follow-up 调查中：

1. 找到 IDB 里那两条 dup 的实际 message id 和 source（dev tools → Application → IndexedDB → cat-cafe-* → messages）
2. 确认是 (1) 前端 derived placeholder + server-issued message 双 id，还是 (2) 同一个 id 写了两次
3. 根据真根因决定：
   - 如果是 (1) → 偏 F173 follow-up（mergeReplaceHydrationMessages 扩展 dedup 规则到 server-issued id 优先）
   - 如果是 (2) → 偏 F164 follow-up（IDB write path 加 idempotency）

## 关键 follow-up（待我做的事，铲屎官 ACK 后启动）

1. **复现**：让铲屎官再 spawn qwen/kimi 各 1 次，**不清 cache**，把 chrome devtools → Application → IndexedDB 截图发我，看 IDB 里实际存了几条
2. **追源码**：
   - `packages/web/src/utils/offline-store.ts` 或类似 IDB writer
   - `packages/web/src/hooks/useChatHistory.ts` 的 hydration replace path
   - `mergeReplaceHydrationMessages` 当前 dedup 逻辑
3. **fixture 复现**：构造 IDB 残留 + socket arrived 同 catId 不同 id 的 case，钉住 dedup invariant

## 临时 workaround（用户视角）

清 IDB cache + F5 即可。但用户体验差——每次 spawn 新猫都需要做？需要核 reproducibility（铲屎官能否稳定复现）。

## 签名

[宪宪/Opus-47🐾] 2026-04-28
