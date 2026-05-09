---
feature_ids: [F194]
related_features: [F048, F183]
topics: [bug-report, invocation, liveness, lifecycle, state-machine, alpha-acceptance]
doc_kind: bug-report
created: 2026-05-09
---

# Bug Report: F194 alpha runtime acceptance failed — bubble still splits after merge (record-completion leak + grace covers it)

## 1. 报告人

铲屎官 2026-05-09 03:35（PR #1603 merged 18:58 后约 8h）：「坏消息 哈哈哈f194现在在runtime了还是裂」。

砚砚（GPT-5.5）随即拍板方向：**不要 hotfix，按 F194 完整收尾——AC-Z1（runtime acceptance）failed，重开 Phase Z**。

宪宪（Opus-47）作为 F194 author 接 ownership，按 debugging skill 5 件套立项。

## 2. 复现步骤

**Runtime preflight**：
- PORT=3002, PID=98102（started `2026-05-08T20:27:27`）
- HEAD=`8023851b7`（main, post F194 squash `5c1ab366`）

**复现 thread**：`thread_moxnb78ckc36xhga`（铲屎官实测）

**实际状态**（直接从 runtime Redis 6399 + API 端点采）：

```bash
# 旧 invocation 的 record（已经 stream 完正式消息）：
$ redis-cli -p 6399 hgetall cat-cafe:invoc:98d2949c-ebf1-4cc6-96c2-3c5d5cfe8012
  id           = 98d2949c-...
  status       = running                         # ← 卡住没转 succeeded
  userMessageId = 0001778297506839-000002        # 用户消息 "你说说我们的现状"
  updatedAt    = 1778297506872 (03:31:46.872Z)   # 4+ 分钟前
  createdAt    = 1778297506836

# Running 索引集合：
$ redis-cli -p 6399 smembers cat-cafe:invoc:running:thread_moxnb78ckc36xhga:default-user
  -> 98d2949c-...   # 旧 record 还在集合里

# 同 cat 新 invocation 的 record（streaming 中）：
$ redis-cli -p 6399 hgetall cat-cafe:invoc:a58a8757-7ff0-4a7a-9da1-02955eba62ea
  -> (empty — record 不存在！)

# /messages 返回（按时间序）：
  ...
  msg_004 catId=opus-47  isDraft=false  "按家规先搜上下文..."   # ← 旧 invocation 98d2949c 的 formal output
  msg_005 user            "布偶猫 → 缅因猫"
  msg_006 catId=codex     isDraft=false
  msg_007 user            "缅因猫 → 布偶猫"
  draft   catId=opus-47   isDraft=true   "砚砚说服我了..."     # ← 新 invocation a58a8757 的 streaming draft

# /queue 返回：
  activeInvocations: [{ catId: "opus-47", startedAt: 1778297506872 }]   # ← 旧 record 的 updatedAt！

# F194 helper 诊断事件（每次 /messages or /queue 都重复打）：
  98d2949c → kind=liveness_pending, source=record-only, recordStatus=running, trackerSlotPresent=true, draftFresh=null
  a58a8757 → kind=liveness_degraded, source=tracker+draft, reason=tracker_active_missing_record, recordStatus=absent
```

**期望行为**：active thread 同 catId 只暴露 1 个 invocation；旧的 stream 完成后立即终态化。

**实际行为**：旧 record 卡 running、新 invocation 有 draft、helper 把两个都列进 `result.active`、queue dedup 取最早 startedAt → 时钟显示 4 分钟前但内容是新的 → **气泡视觉裂**。

## 3. 根因分析

### 3.1 现象层

`/queue.activeInvocations[].startedAt` 拿的是 `98d2949c.recordUpdatedAt = 03:31:46`（旧 invocation 4 分钟前），但 `/messages` 显示的 active draft 是 `a58a8757`（新 invocation, draftAge=21s 新鲜）。前端按 `startedAt` 渲染 cat slot 计时 + 按 draft 渲染内容 → 时间戳/内容来源不匹配 = "气泡裂"。

`queue.ts:resolveActiveInvocations` 的 dedup 规则是 "earliest startedAt per catId"（KD-16，cloud R15 P2）—— 在并发 running 场景下选最老的。但本场景**老的 record 是死的**，不该被纳入 dedup pool。

### 3.2 helper 规则缺口

按 F194 helper 决策表（spec line 19）：

> `running | tracker_missing | no_fresh_draft, age <= zombie_grace` → `active source='record-only', reason='liveness_pending'` (grace window)

设计意图：grace 是给 "in-flight invocation 但 tracker 状态丢了"（正常 streaming 中、临时 tracker miss）。规则 4 分钟内不打成 zombie，避免误杀 in-flight。

**但**这条规则没区分两种 record-only 子情况：

| 子情况 | 含义 | 应该判 |
|--------|------|--------|
| A. record running, no tracker, no draft, age 浅 | invocation 真正"在路上"——某个进程在跑但还没回声 | grace pending（保留） |
| B. record running, **同 catId 的 tracker slot 已经被新 invocation 占走**，自己没 draft | 旧 invocation 死透了，cat slot 已让位给新 invocation——再 grace 没意义 | **instant zombie** |
| C. record running, **该 invocation 已经 emit 了 formal assistant message**（说明 stream 完成、producer 写终态那步漏了）| 已经 succeeded，但 status 没写 | **instant succeeded reconcile** |

子情况 B + C 是这次实际发生的。F194 helper 把它们都当作 A 处理，所以进 grace、不 reconcile、被 dedup 抓出来覆盖新 invocation 的 startedAt。

### 3.3 producer 层的根因

`QueueProcessor.executeEntry`（packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts:759..1085）应该写终态：

```ts
// 4. Mark running
await invocationRecordStore.update(invocationId, { status: 'running' });   // line 759 ✅
// ... streaming for-await ...
// 8. Abort check
if (controller.signal.aborted) {
  await invocationRecordStore.update(invocationId, { status: 'canceled' });  // line 1037 ✅
  return;
}
// 9. Mark succeeded
await invocationRecordStore.update(invocationId, { status: 'succeeded' });  // line 1044 ✅
// ... outbound delivery ...
// catch:
await invocationRecordStore.update(invocationId, { status: 'failed', error });  // line 1081 ✅
```

四个分支（running 入口、abort、succeeded、catch failed）覆盖了所有理论路径。但这次 `98d2949c` 进了 running 后没进任何终态分支。可能的漏洞：

1. **for-await 循环内某处 `return`**：路径直接返回未走到 line 1044/1037
2. **for-await 循环 yield 后协程被悬挂**：例如下游 consumer 提前 break 但没传 abort 给 controller，generator 自己 hang 不退出
3. **outbound delivery 报错被无声 catch**：line 1051 `deliverOutbound` 内部 catch 掉异常，但 line 1044 之前，`status='succeeded'` 已经写了——这条不太像
4. **line 1044 update 实际被拒**：如 CAS / Lua 返回 -1 illegal transition 但调用方没处理空返回——但这次不是 CAS 路径

需要：
- 加 producer 路径的 trace（每个 update 写日志）
- 拿 98d2949c 的 reqId 去翻 log，定位最后一次出现位置
- **写防御性 try/finally**：`executeEntry` 的最外层 finally 里如果 invocationId 还在 running 就强制写 failed(error='executeEntry_left_without_terminal')

### 3.4 为什么 F194 没盖住这个洞

F194 的 helper-side reconcile 是 **按 grace 等死了再扫**——600s 确实最终会变 zombie 然后 reconcileZombies 转 failed。但：
1. 4 分钟 grace 期内**已经裂**（用户可见）
2. F194 zombie 的语义是 "流死了 + 没 draft"，所以会标 `failed(error='zombie_record_detected')`，但这次明显是 **succeeded**——formal message 已经落库了，应该终态成 succeeded 而不是 failed

砚砚原话：
> "如果旧 running record 已经有 formal message，应该终态化为 `succeeded`，不是等 600s。"
> "如果同 cat tracker slot 已被新 invocation 占用，旧 record 又没有自己的 fresh draft，也不该走 grace pending。"

这两条都是 F194 read-side 没覆盖的 corner case。

## 4. 修复方案

按砚砚定的方向，分三层：

### Phase Z1 — Producer state-machine hardening

`QueueProcessor.executeEntry` + `routeSerial`/`routeParallel` 入口加：

```ts
let terminalWritten = false;
const writeTerminal = async (status, error?) => {
  if (terminalWritten) return;
  terminalWritten = true;
  await invocationRecordStore.update(invocationId, { status, ...(error ? { error } : {}) });
};
try {
  // ... existing path ...
  // every existing terminal write goes through writeTerminal()
} finally {
  // safety net: if no terminal written, force failed with diagnostic
  if (invocationId && !terminalWritten) {
    await invocationRecordStore.update(invocationId, {
      status: 'failed',
      error: 'producer_left_running_no_terminal',
      expectedStatus: 'running',
    }).catch(() => {});
  }
}
```

加结构化 trace：每次 status update + reqId + invocationId + new status。

### Phase Z2 — Helper instant-zombie on cat-slot reuse

`getThreadLiveInvocations.ts:tryRecordGraceOrZombie` 当前只看 `now - record.updatedAt > zombie_grace`。新增前置短路：

```ts
function classifyRecordOnly(ctx) {
  // ... existing tracker/draft checks ...
  // F194 Z2: cat-slot reuse signals dead invocation — bypass grace
  if (
    ctx.activeSlotForCat &&
    ctx.activeSlotForCat.invocationId !== ctx.candidate.invocationId &&
    !ctx.candidate.hasFreshDraft
  ) {
    return zombieResult(ctx, 'cat_slot_reused');
  }
  // ... fall through to grace/zombie age check ...
}
```

### Phase Z3 — Helper instant-succeeded on formal-message-emitted

新增 dep `getInvocationHasFormalMessage(invocationId, threadId): Promise<boolean>`：检查 thread 内有没有 `extra.stream.invocationId === invocationId` 的 formal message。如果有：

```ts
// F194 Z3: stream emitted formal message but record stuck running — producer漏写
if (await ctx.deps.getInvocationHasFormalMessage(record.id, record.threadId)) {
  return succeededReconcileResult(ctx);  // emit `record_completion_leak` event + reconcileZombies-like path
}
```

reconcileZombies 加新分支，把 record 标成 `succeeded(error=null, source='completion_leak_recovery')`。

### Phase Z4 — Runtime regression test

复现脚本 / 整合测试：直接构造 thread 状态：
1. 创建 record A status=running, target=opus-47
2. messageStore.append formal message 带 `extra.stream.invocationId=A`
3. 创建 record B status=running, target=opus-47, tracker.startAll(threadId, [opus-47], userId, B.invocationId)
4. drafts 里有 B 的 fresh draft
5. 调 helper → 期望 A 立即 succeeded（不 grace），B active

### Phase Z5 — Alpha 实测 + 愿景守护

按 SOP，完整 close。

## 5. 验证方式

1. 复现 test 通过（Z4）
2. Runtime 再次跑同样场景：
   - 旧 record 应该 5s 内 reconcile 成 succeeded
   - `/queue.activeInvocations[].startedAt` 应该 = 新 invocation 的 draft.createdAt（不是旧 record 的）
   - 气泡不再裂
3. 老 thread 的历史 zombie record（多个）也应该被 sweep（restart 后 F048 + 平时 F194 helper 协同）
4. 守护猫（非 author 非 reviewer）跑一遍 alpha，对照铲屎官原话发对照表
