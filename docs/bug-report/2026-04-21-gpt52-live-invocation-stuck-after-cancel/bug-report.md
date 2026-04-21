---
feature_ids: [F061]
topics: [gpt52, codex, runtime, cancel, invocation, session, handoff]
doc_kind: bug-report
created: 2026-04-21
updated: 2026-04-21
severity: P1
status: investigating
---

# GPT-5.4 live invocation 卡住，cancel 后同 thread 继续失效

> 报告人：铲屎官  
> 调查人：缅因猫/砚砚（@gpt52）  
> 目标问题：预防“Codex / GPT-5.4 CLI 卡住很久，cancel 后同 thread 继续叫不出来，只有重启 Cat Cafe 才恢复”的体验级故障  
> 本报告用途：给下一只接手的缅因猫直接续查，避免再从零拼现场

## 0. 接手摘要（五件套）

### What

我们已经抓到两类同症状现场：

1. **断流/重连风暴型**  
   `thread_mo82r0fs6hcwfoqy`
   - 首次 `@gpt52` 可以正常回复
   - 第二次 `@gpt52` 在执行中卡住，最后 thread 内落了一条系统错误：
     - `CLI 异常退出 (code: 1, signal: none)`
     - `Reconnecting... 2/5 ... 5/5 (stream disconnected before completion: ... /backend-api/codex/responses)`

2. **cancel 后 thread 污染型**  
   `thread_mnux2eewbo4otg17`
   - 右侧审计面板显示 `cat_invoked`
   - 没有后续 `cat_responded / cat_error`
   - 用户手动 `cancel` 后，同一个 thread 里继续 `@gpt52` 也叫不出来
   - **关闭并重启 Cat Cafe 后，同一个 thread 又能把 `@gpt52` 调出来并跑完**

### Why

这是高优先级体验问题：

- 用户会看到“猫猫正在回复中…”长时间不结束
- `cancel` 不能恢复 thread 到可继续工作的状态
- 用户只能靠重启 Cat Cafe 自救
- 下一条 @ 同一只猫仍然叫不出来，意味着不是单次慢，而是**thread 级执行态被污染**

### Tradeoff

当前还没有把根因精确钉到某一行代码。

但证据已经足够把范围大幅收窄到：

- **live invocation / cancel cleanup / 进程内状态释放**

而不是：

- mention 没路由
- session 永久损坏
- thread 消息没落库

### Open Questions

1. 被污染的到底是哪一层进程内状态？
   - `SessionMutex`
   - `InvocationTracker`
   - `QueueProcessor.processingSlots`
   - `InvocationRecordStore` 的 live 记录
   - `routeExecution`/`cancel_invocation` 收尾链
2. `cancel` 到底有没有触发 `AbortController`，以及触发后谁没有完成 cleanup？
3. 为什么前端没有收到足够的 UI 级故障信号（例如最终 `cat_error`）？
4. `thread_mo82...` 的 reconnect 风暴和 `thread_mnux...` 的 cancel 污染，是同一根因链还是相邻两条链？

### Next Action

下一只接手的缅因猫，不要从 session continuity / mention 路由重新猜。

请直接沿下面这条链查：

`live invocation 异常 -> cancel / 中断 -> thread 内进程态没有释放 -> 同 thread 后续继续 @ 失败 -> 重启 Cat Cafe 清空内存态后恢复`

优先看这些文件：

- `packages/api/src/routes/messages.ts`
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- `packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts`
- `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- `packages/api/src/routes/invocations.ts`

## 1. Runtime 现场（Preflight）

本次调查期间对当前 runtime 做过 preflight：

```text
PORT=3002
PID=9407
START_TIME=Tue Apr 21 03:39:05 2026
HEAD=0bba75b18 docs(F148): sync speaker display bugfix merge (PR #1319)
TARGET_COMMIT=not_specified
PROCESS_AFTER_TARGET=not_specified
LOG_EVIDENCE=3006 lines from pid=9407 in api.2026-04-21.1.log
```

这条证据只说明：调查时本地 `3002` runtime 是活的。  
**不要据此假设它和右侧 UI 审计面板展示的是同一份 live runtime store。**

## 2. 事故 A：断流/重连风暴型（`thread_mo82r0fs6hcwfoqy`）

### 时间线（PDT）

- `2026-04-20 20:40:17` 用户第一次 `@gpt52`
- `2026-04-20 20:45:51` 左右，thread 中确实出现了 `gpt52` 的正常长回复
- `2026-04-20 21:13:01` 用户再次 `@gpt52`
- `2026-04-20 21:23:58` thread 里落系统错误

### 已确认事实

这次**不是“第一次就没叫起来”**。第一次成功了，第二次挂了。

thread 里的系统错误原文：

```text
Error: Codex CLI: CLI 异常退出 (code: 1, signal: none)
最近流错误:
- Reconnecting... 2/5 (stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses))
- Reconnecting... 3/5 ...
- Reconnecting... 4/5 ...
- Reconnecting... 5/5 ...
- stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)
```

### 当前定性

这次更像：

- 请求已经进入 Codex CLI
- 不是 queue 吞掉
- 不是纯 `idle-silent` 无输出挂住
- 而是 **上游 stream 断流 + CLI 自己做 reconnect**

因此，“5 分钟 stallAutoKill 没生效”并不奇怪，因为这类场景有错误/重连输出，不是纯 silent hang。

## 3. 事故 B：cancel 后 thread 污染型（`thread_mnux2eewbo4otg17`）

### 关键 thread

- thread: `thread_mnux2eewbo4otg17`
- 用户最后一次成功收到 `gpt52` 回复：约 `2026-04-21 01:59 PDT`
- 用户再次请求：`2026-04-21 02:13 PDT`
- 用户报“卡了 10 分钟”：`2026-04-21 02:25 PDT`
- 用户报“cancel 后同 thread 再 @ 也不出来”：`2026-04-21 02:55 PDT`

### 右侧实时审计证据

用户截图确认右侧 `审计 & Session` 面板存在：

```json
{
  "catId": "gpt52",
  "userId": "default-user",
  "invocationId": "c066e1ff-f945-4849-8915-f61b5f98db49",
  "promptDigest": {
    "length": 3799,
    "hash": "8e3badaa0348fbb0"
  },
  "isLastCat": false
}
```

这个 `cat_invoked` 时间与用户的“02:13 那次请求”是对得上的。

### Session chain 证据

当前 active session（调查时）：

- session record id: `3a4a226c-3819-4c73-80de-f5cdd2bb97a4`
- `cliSessionId`: `019daf40-8529-7772-8399-70c9369a03e4`
- `status`: `active`
- `createdAt`: `2026-04-21 01:55:34 PDT`
- `updatedAt`: `2026-04-21 02:16:21 PDT`
- `messageCount`: `1`

重要的是：

- 到用户 `02:55:35 PDT` 报“cancel 后也调不通”时，这个 session **仍然是 `active`**
- 中间没有新的 sealed digest，也没有 thread 里新的 `cat_responded / cat_error`

### 本地 live API 证据

对 UI 截图里的 live invocation 做本地 API 查询：

```bash
GET /api/invocations/c066e1ff-f945-4849-8915-f61b5f98db49
→ {"error":"Invocation not found","code":"INVOCATION_NOT_FOUND"}
```

对 active session digest 查询：

```text
No digest found for this session (may not be sealed yet).
```

这说明：

1. 这次 hang 确实还处在 **live / in-flight** 状态  
2. 当前 UI 右边审计面板里的实时态，**不完全等价于**当前工作区磁盘上的 ndjson / sealed transcript

### 用户额外实验结果（高价值）

用户补充：

- `cancel` 之后，在**同一个 thread** 里继续 `@gpt52`，也还是叫不出来
- 但如果**关闭并重启 Cat Cafe**，同一个 thread 又可能可以把 `@gpt52` 调出来并正常跑完

这是本报告里权重最高的一条证据。

它强烈支持：

- 问题在 **进程内状态**
- 重启会清掉的内存态被污染了

而不支持：

- session 永久坏了
- thread 本身不可恢复
- 消息没有入库

## 4. 当前排除项

基于以上证据，已经可以先排除：

### 4.1 不是 mention 没路由

因为用户右侧审计面板已经看到 `cat_invoked`，且带 `invocationId`。

### 4.2 不是 session 永久损坏

因为重启 Cat Cafe 后，同一个 thread 能重新把 `@gpt52` 调出来。

### 4.3 不是 thread 消息没保存

thread 历史里能看到用户消息和先前成功的 `gpt52` 回复。

## 5. 当前最可信的根因假设

### 假设 A（当前最强）：`SessionMutex` 在异常/取消后没有被释放

代码链：

- `invoke-single-cat.ts` 在真正进入 `service.invoke()` 之前，会先对 `cliSessionId` 调 `sessionMutex.acquire()`。
- 这一步发生在 `spawn_started` 广播之前。
- `sessionMutexRelease?.()` 只在 `invoke-single-cat.ts` 的 `finally` 里执行。

这意味着：

1. 某次 invocation 如果卡在 provider/CLI 深处，导致 generator 没正常 unwind
2. `finally` 就不会跑到
3. `SessionMutex` 会继续持有这个 `cliSessionId`
4. 后面同一 thread 再次 invoke 时，会先卡在 `SessionMutex.acquire()`
5. 因为卡在 acquire 之前，所以前端**看不到新的 `spawn_started / intent_mode / 真正输出`**
6. 而 `SessionMutex` 是纯进程内状态，**重启 Cat Cafe 就会清空**

这条假设和现场高度吻合：

- `cancel` 后同 thread 再 `@gpt52` 没有任何 UI 进展
- 右侧审计里已有旧的 `cat_invoked`，但新的请求没有后续 response/error
- 重启后恢复

### 假设 B：live invocation 异常后，cancel cleanup 没有释放干净

故障链：

1. thread 内某次 `gpt52` live invocation 进入异常态
2. 用户 `cancel`
3. abort / `routeExecution` / tracker / queue / mutex 某处没释放干净
4. 这条 thread 对 `gpt52` 的后续调度继续被挡住
5. 重启 Cat Cafe 清空进程内状态后恢复

### 假设 C：断流/重连风暴是触发器，进程内状态污染是放大器

也就是：

- 上游 `codex/responses` 断流造成 live invocation 不正常结束
- 本地 runtime 收尾路径又没有把状态清干净
- 用户体验于是从“单次慢/失败”升级成“同 thread 继续叫不出来”

## 6. 为什么下一位不要从 session continuity 开始查

因为我们已经有反证：

- `sessionChain` 里 active session 还活着
- 重启后同 thread 能再次调出 `@gpt52`

这两条说明：

- session continuity 本身不是第一嫌疑人
- 重点不在“有没有新 session / 有没有 seal”
- 而在“live invocation 中断后，为什么 thread 内状态还阻塞后续调度”

## 7. 新增静态代码证据：为什么 `SessionMutex` 像头号嫌疑

关键代码事实：

- `invoke-single-cat.ts` 顶部维护了进程级 `const sessionMutex = new SessionMutex()`。
- 进入执行前，如果 `sessionId` 存在，会先：

```ts
sessionMutexRelease = await sessionMutex.acquire(sessionId, signal);
```

- 释放只在 finally：

```ts
sessionMutexRelease?.();
```

- `SessionMutex` 自身是纯内存的 `held` / `waiters` Map：
  - `held: sessionId -> release`
  - `waiters: sessionId -> queued waiters`

结论：

- 只要当前 invocation 没能正常跑到 `invoke-single-cat` 的 `finally`
- 同一个 `cliSessionId` 的下一次请求就会被堵在 `acquire()`
- 并且因为堵点发生在 `spawn_started` 之前，用户体验就是：
  - thread 里没有新的“正在启动”
  - 没有新的 `cat_responded`
  - 没有新的 `cat_error`
  - 看起来像“完全叫不出来”

这正是当前现场的体验描述。

## 8. 下一步建议（工程动作）

### 8.1 先验证 `SessionMutex`，优先级高于 tracker/queue

建议先加一次性诊断：

- `SessionMutex.acquire(sessionId)`：
  - 记录是 immediate acquire 还是 queued wait
  - 记录当前 `held.has(sessionId)` / `waiters.length`
- `invoke-single-cat` finally：
  - 记录是否真的执行到 `sessionMutexRelease?.()`
- `cancel_invocation` 后：
  - 记录对应 thread/cat 的 active sessionId
  - 记录这次 cancel 之后，下一次 invoke 是否卡在 acquire 前

### 8.2 先加诊断，不要先猜修法

在以下链路上加一次性诊断：

- `cancel_invocation` 收到时打印：
  - `threadId`
  - `catId`
  - `invocationId`
  - active slot / queue / processingSlots 快照
- `routeExecution` 退出时打印：
  - 是否进入 `done`
  - 是否进入 `error`
  - 是否走到 cleanup
- `InvocationTracker.completeSlot / completeAll`
- `QueueProcessor.onInvocationComplete`
- 如果存在 per-thread/per-cat queue guard，也打印 `has(threadId, catId)` 的判定依据

### 8.3 补一个最贴脸的回归测试

目标不是测 reconnect，而是测用户体验链：

1. 对同一 thread 发起一次 `gpt52` invocation
2. 模拟 live invocation 卡住
3. 调用 cancel
4. 再次在**同一个 thread** 对同一只猫发起请求
5. 断言第二次必须能创建新 invocation / 进入执行

### 8.4 断流风暴单独收口

如果未来继续抓到这类：

- `Reconnecting... n/5`
- `codex/responses`
- `Conversation interrupted`

就应该单独加一条 provider 级 fail-fast / self-heal 策略，而不是只依赖 `idle-silent`。

## 9. 对下一位接手缅因猫的直接建议

如果你接手后只能做一件事：

**先盯 `SessionMutex` + cancel 后的释放链，而不是先盯 session seal / token overflow。**

最值得先验证的问题是：

> `cancel` 之后，是什么内存态还留着，导致同 thread 再次 `@gpt52` 仍然无法创建一个新的健康 invocation？

当前最值得先证伪/证实的是：

> `invoke-single-cat` 的 `finally` 没有稳定执行到 `sessionMutexRelease?.()`，从而把同一 `cliSessionId` 永久卡在进程内锁里。

## 10. 当前结论

这次要解决的问题，不是“为什么 `@gpt52` 偶尔慢”。

真正要解决的是：

1. live invocation 挂住时，能不能更快失败
2. **cancel 之后，thread 能不能恢复到可再次调度的干净状态**
3. 不能再让“重启 Cat Cafe”成为用户唯一的恢复手段
