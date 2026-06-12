---
related_features: [F108, F194, F211]
topics: [a2a, handoff, invocation-tracker, tombstone, cancel, routing, parallel-cancel]
doc_kind: bug-report
created: 2026-06-11
---

# Bug Report: A2A handoff 目标猫未 spawn — canceled tombstone 未被 re-track 替换

> 发现：2026-06-11 | 初诊 + 修复：宪宪 (Opus-4.8) | 根因钉死：砚砚 (GPT-5.5)
> 性质：**共性 A2A 协作链路回归**（任何 cat→cat 传球都可能命中；**不挂 feature** —
> 参照 2026-05-29 invocation-stale 先例。F211 是孟加拉猫 Antigravity 域，与本 bug 无关）
> 状态：**根因钉死 + 修复 + 红绿测试 + 88 项回归通过**，待跨个体 review（作者 opus-48，根因 owner 砚砚）

## 1. 报告人 / 怎么发现

铲屎官 2026-06-11 在 `thread_mq7h69untjt5ld61`（f229）：fable（@fable5）诊断完末尾 `@sonnet` 收尾清单，
前端显示了"Fable 5 → Sonnet"传球，但 **sonnet 没启动**。铲屎官以为像以前卡了，去发了消息，怀疑"消息丢了 + 没 spawn 猫 b"。

## 2. 现象 / 期望 vs 实际

| | 期望 | 实际 |
|---|---|---|
| fable @sonnet | sonnet spawn + 前端显示"启动中" | handoff 事件发了（`a2a_routing` "Fable 5 → Sonnet"），但 sonnet **没 invoke** |
| 用户后续消息 | 落库 | **没丢**，三条 `@sonnet` 全在 message store |
| 用户 @sonnet | spawn | 成功（18:53:29 / 18:56:14 都是用户消息触发的 invocation） |

## 3. 根因（砚砚钉死）：A2A re-track 不替换 canceled tombstone

**链路**：
1. **18:47:03** sonnet 被 `user_cancel` → `InvocationTracker.cancel()`（:151）留下 `state='canceled'` tombstone。
   `getController()`（:285）**故意**仍返回该 tombstone 的**已 aborted** controller（pre-invoke cancel 语义）。
2. **18:52:43** fable 行首 `@sonnet` → route-serial 把 sonnet push 进 worklist，并经 `trackA2ASlot → trackExternalSlot(sonnet)`
   重注册 A2A slot。但 `trackExternalSlot`（:432）遇到**未过期的 existing slot 就 idempotent 返回**，
   **不区分 `state==='canceled'`** → sonnet 的 slot 仍是那个 canceled tombstone。
3. route-serial worklist loop 进入 sonnet 那轮：`catSignal = signalForCat(sonnet) = getController(sonnet) = tombstone 的 aborted controller`
   → `if (catSignal?.aborted) { index++; continue }`（route-serial :428-431）→ **顶部 skip，sonnet 从不 invoke**。
4. 用户后来 `@sonnet` 走的是 `startAll`/`tryStartThreadAll`（:394/:459），这俩**会 preempt/替换旧 slot 建新 active**，
   tombstone 被清掉 → 成功 spawn。

**本质：两条路径对 tombstone 处理不一致** —— A2A re-track（`trackExternalSlot`）漏了 tombstone purge，user 路径（`startAll`）有。
`cancel()` 注释自证 tombstone "Purged at the next **start-family or complete-family** call"，但 `trackExternalSlot` 既不在 start
也不在 complete family，是被遗漏的 A2A 重注册路径。

**硬证据**（runtime `api.2026-06-11.1.log` + audit）：18:52:43 `a2a_handoff fable-5 → sonnet` 在 audit/message 都存在；
fable `cat_responded isFinal:false`；但直到 18:53:29 才有 `sonnet cat_invoked`，且那是用户 `@sonnet` 后 58ms（用户触发，非 fable A2A）。

## 4. 诊断更正记录（过程教训 — 写给未来的自己）

本案 opus-48 连环误诊，全部被推翻，记录以儆：
1. **误诊 A「spawn 成功被 spurious cancel 误杀」**：把"用户消息触发的 invocation（18:53:29）"按时间临近误归成"fable A2A 的 invocation"。
2. **误诊 B「fable 双 invocation id 错配」**：grep fable lifecycle 时**只过滤 catId+时间、漏了 threadId** → 把 fable 在
   `thread_mq9j773b113zscpx` 的 invocation `2f0dae8e` 抓进来当成同 thread 双启动（砚砚纠正）。
3. **误判 C「generator 提前进 finally」**：静态绕不出，模糊归因，未钉死。
4. **钉死（砚砚）**：canceled tombstone + `trackExternalSlot` 不替换。

**教训**：① invocation 归因必须追**触发源链**（enqueue→dispatch→Created / triggerMessageId），不能凭时间临近假设；
② grep 切证据必须**固定 threadId**，否则跨 thread 同猫 invocation 会污染结论；③ 用户的状态机级反证（"我的消息不排队直接
spawn = 上一棒没占住 slot"）往往比单点日志叙事更早指向真相，别用细节故事盖过它。

## 5. 修复

`InvocationTracker.trackExternalSlot`（packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts）：
existing 是 **active** 时才 idempotent 返回；existing 是 **canceled tombstone** 时落到覆盖路径，建一个新的 active slot。

```ts
if (existing && !this.isExpired(key, existing) && existing.state !== 'canceled') {
  return existing.batchController === controller || existing.controller === controller;
}
// canceled tombstone / absent / expired → fall through to this.active.set(... state:'active')
```

与 `startAll`/`tryStartThreadAll`/`completeAll` 对 tombstone 的处理一致（start/complete family 一向 purge tombstone）。

## 6. 验证

- **红测（unit）**：`packages/api/test/route-serial-a2a-tracker.test.js` 新增 `trackExternalSlot purges a canceled
  tombstone instead of preserving its aborted controller` —— `startAll(['codex']) + cancel(codex)` 留 tombstone（precondition
  断言 controller 已 aborted），再 `trackExternalSlot(codex)`，断言 `getController(codex).signal.aborted === false`。
  **RED**（修前：仍 aborted）→ **GREEN**（修后）。红测刻意打 unit 层 InvocationTracker，绕开 route-serial/text-scan/catRegistry。
- **回归**：InvocationTracker 测试套 **88/88 pass**（invocation-tracker / parallel-cancel-signal-isolation /
  force-reset-thread / invocation-tracker-ttl / invocation-tracker-f122-a1 / cancel-orphan-record）。
- **整份 `route-serial-a2a-tracker.test.js`：标准 setup 下 4/4 pass**（含 41/94 的 text-scan `@codex` 集成例）。
  标准 setup = `node --import test/helpers/setup-cat-registry.js`（seed catRegistry，与 `pnpm --filter @cat-cafe/api test` 一致）。
- **更正（砚砚 review 抓出）**：我最初用 `node --test` 裸跑、漏了 `--import setup-cat-registry` → catRegistry 未 seed →
  text-scan `@codex` 解析失败 → 41/94 假红，被我误判为「sandbox-env pre-existing 红」。砚砚用标准 setup 复跑全绿，
  纠正此判断：41/94 是好的、无需单独修 harness。主红测打 unit 层（直击 `trackExternalSlot`），与 setup 无关、稳定红→绿。

## 7. 边界 / 后续

- **live runtime HEAD 落后 origin/main 106 commits**（砚砚核）：事故发生在旧 route-serial 上，但 `trackExternalSlot` 在
  事故 commit → 当前 main **未变** → bug 在 main 仍存在，本修复有效。
- 前端 A2A liveness（用户看不到 target 启动态 → 误判"卡了"去操作）是次生体验问题，本 PR 不含；可另开 follow-up。
- **操作教训**：测试必须用项目标准 setup（`node --import .../setup-cat-registry.js`，即 `pnpm --filter @cat-cafe/api test`）跑；
  裸跑 `node --test` 会因 catRegistry 未 seed 假红，误导诊断（verify-with-repo-toolchain）。本案我先误判 41/94 是 sandbox-env 红，
  砚砚用标准 setup 纠正。
