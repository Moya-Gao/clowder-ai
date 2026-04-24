---
feature_ids: [F173]
related_features: [F081, F123, F164]
topics: [frontend, thread-runtime, draft-store, bubble-identity, ghost-bubble]
doc_kind: bug-report
created: 2026-04-24
---

# Bug Report: F173 残留 Phase A hotfix — Orphan Draft Bubble

> Date: 2026-04-24
> Reporter: Landy (runtime 实机验收)
> Thread: `thread_mobkptcewx0j9qkm`
> Repro: Phase B-1 (PR #1373, squash `30cc69e70`) merged 之后，runtime 重启验收时出现

## 1. 现象

runtime 重启后，在活跃 thread 里发送消息，前端出现**两个气泡并存**：

- **第一个气泡**：只有 CLI Output meta（tool 列表部分进度），无主文本，持续 streaming
- **第二个气泡**：完整 streaming 内容 + 更新的 CLI Output

这不是 clowder-ai#573 报告的同 invocation 双写（OUTER/INNER 问题）的回归——那个已被 PR #1364 squash `da928015e` 关闭。这是**另一条数据路径**的变种。

## 2. 诊断数据（devtools + runtime API）

前端 `document.querySelectorAll('[data-message-id]')` 输出关键两条（同一 thread，同一时间点附近）：

```
id: msg-b017d89b-3fa3-4f4c-b31c-e045e3ea2a89-opus-47  (origin=stream, streaming=true)
id: draft-cc6df99a-36b1-4e49-a483-f41ea058a8e4        (origin=stream, streaming=true)
```

两种 id 前缀完全不同的生成路径：

- `msg-{invocationId}-{catId}`：正常 stream 的 deterministic bubble id（`deriveBubbleId`，PR #1347 Phase A 引入）
- `draft-{invocationId}`：后端 `/api/messages:1301` 合并 `draftStore` 返回的持久化 streaming 占位

Runtime API 验证：

```
GET /api/invocations/b017d89b-3fa3-4f4c-b31c-e045e3ea2a89
  → {status: "succeeded", userMessageId: "...11:24 那条", threadId: thread_mobkptcewx0j9qkm}

GET /api/invocations/cc6df99a-36b1-4e49-a483-f41ea058a8e4
  → {error: "Invocation not found", code: "INVOCATION_NOT_FOUND"}
```

**`cc6df99a` 的 invocation record 不存在，但 draft 还在 Redis `draftStore` 里。** 前端 F5 / 切回 thread / 加载历史分页时，后端照常把这个"僵尸 draft"塞进响应，前端把它当一个合法 bubble 渲染。

## 3. 根因

`packages/api/src/routes/messages.ts:1265-1312` 的 draft merge 过滤链**缺少 invocation-alive 验证**：

```ts
// 现状：只检查 "draft 的 invocationId 是否已有 formal message 落库"
const formalInvocationIds = new Set(
  page.map((m) => m.extra?.stream?.invocationId).filter(Boolean),
);
let activeDrafts = drafts.filter((d) => !formalInvocationIds.has(d.invocationId));
// 扩大窗口再检一遍（为 page depth 溢出兜底，cloud R4/R5 P2 加过）...

for (const d of activeDrafts) {
  chatItems.push({ id: `draft-${d.invocationId}`, ..., extra: { stream: { invocationId: d.invocationId } } });
}
```

**缺失**：从没调用 `invocationRecordStore.get(d.invocationId)` 验证 invocation 是否还活着。如果第一次 invocation **在产生 formal message 之前就异常终止**（crash / preflight fail / CLI spawn ENOENT / 用户 cancel / timeout），它：

1. 从没调 `messageStore.append` 写过 formal row（所以 formalInvocationIds 不命中它）
2. 它的 draft 还在 Redis 里（因为 `draftStore.delete` 只在 `done` / 主动 cancel 路径调）
3. 它的 invocation record 可能从没写成（preflight fail 场景），或被 GC 清掉了

结果就是"僵尸 draft"穿透过滤一路到前端。

## 4. 机制链（推测的完整序列）

1. 用户发消息 → QueueProcessor 启动 invocation 1 (`cc6df99a`)
2. DraftStore keepalive（每 ~60s）把 streaming content flush 到 Redis 键 `DRAFT:{threadId}::{invId}::{catId}`
3. Invocation 1 异常终止（路径之一：preflight / spawn ENOENT / 超时 / route decision 改回 queue）——**没走正常 done path，没清 draft**
4. 系统启动 invocation 2 (`b017d89b`) 做补偿（或用户重发）
5. Invocation 2 正常完成，产生 formal message `msg-b017d89b-opus-47`
6. 前端 F5 / 切回 thread → GET /api/messages：
   - `messageStore.getByThread` 返回 formal row（含 inv `b017d89b`）
   - `draftStore.getByThread` 返回 drafts 含 `cc6df99a`
   - 过滤：formalInvocationIds = `{b017d89b}`，`cc6df99a` 不在里面 → 保留
   - 返回两条，前端渲染两个 bubble

## 5. 修法（Phase A hotfix — draft path variant）

### 主修：invocation-alive 过滤

在 `messages.ts` draft merge 前加一条过滤：

```ts
// Filter out orphan drafts — drafts whose invocation is no longer alive (crash /
// preflight fail / GC / never registered). Keeps parity with "running invocation
// → live draft bubble" semantic; drops zombie drafts that would otherwise split
// the bubble after F5 / thread switch.
if (opts.invocationRecordStore && activeDrafts.length > 0) {
  const aliveChecks = await Promise.all(
    activeDrafts.map(async (d) => {
      const rec = await opts.invocationRecordStore!.get(d.invocationId);
      return rec && rec.status === 'running' ? d : null;
    }),
  );
  activeDrafts = aliveChecks.filter((d): d is NonNullable<typeof d> => d !== null);
}
```

### 附加：主动清理孤儿 draft

孤儿确认后应该直接从 `draftStore` 删掉，避免下次请求又回来：

```ts
for (const d of drafts) {
  const stillAlive = activeDrafts.some((a) => a.invocationId === d.invocationId);
  if (!stillAlive) {
    // Fire-and-forget — UI flow must not wait on draft GC
    opts.draftStore.delete(userId, resolvedThreadId, d.invocationId).catch(() => {});
  }
}
```

### 更深的设计问题（可选）

DraftStore 生命周期当前依赖 "invocation 成功 done" 或 "用户主动 cancel"。所有异常终止路径（preflight / spawn ENOENT / 软链 rebuild / force kill / crash）都会留 orphan。更结构化的修法是让 draft **直接绑定 invocation record TTL**（Redis 级联 EXPIRE），或在 InvocationRegistry 的 terminal/replaced hook 里顺手清 draft。这是 F173 Phase B/C 主线的范畴（liveness truth source consolidation），本 hotfix 只修"过滤链 + 懒清理"两道门，不动 lifecycle 设计。

## 6. 测试策略

1. **单测**：新 test case `messages.test.js` — "draft with no matching invocationRecord is filtered out"
2. **单测**：新 test case — "orphan draft GC: drafts that fail the alive check are deleted from draftStore within a request window"
3. **回归**：现有 `#80 draft merge` 测试不 break（活跃 invocation 的 draft 仍合并）
4. **集成**：fixture 模拟 "invocation 1 crash mid-stream + invocation 2 success"，verify `/api/messages` 只返回 invocation 2 的 formal row

## 7. 和 clowder-ai#573 / F173 的关系

| 路径 | 根因 | Fix | Status |
|------|------|-----|--------|
| stream broadcast + 持久化 OUTER/INNER split | QueueProcessor:761 overrides msg.invocationId with parent, but route-serial persists with own (INNER) invocationId | PR #1364 (`da928015e`)：三路统一 OUTER `parentInvocationId ?? ownInvocationId` | ✅ 已 merged |
| callback broadcast + 持久化 OUTER/INNER split | 同上，callback 路径漏了 | PR #1364 同一 commit | ✅ 已 merged |
| **DraftStore 孤儿 draft** | **messages.ts draft merge 不验证 invocation 活着** | **Phase A hotfix3：GET `/api/messages` draft merge 过滤 missing / terminal / cross-scope invocation drafts，并懒删除 orphan draft；invocation lookup 失败时 fail open 保留 draft** | ✅ implemented, review pending |

三条路径都是"后端没把 invocation identity 传到位 / 生命周期没闭合 → 前端看到两个 bubble"的系统性病。Phase C 的 "hydration 简化 + liveness 对齐" 会从结构上收口，本 hotfix 是过渡期的补丁。

## 8. 时间线

- 2026-04-24 11:24 — 铲屎官发 "走起 直接开 Phase D1 worktree" 启动 invocation `b017d89b`
- 2026-04-24 ~11:24 之前某时 — invocation `cc6df99a` 异常终止，留下 orphan draft
- 2026-04-24 11:30 — 用户看到两个气泡，上报
- 2026-04-24 11:46 — opus-47 runtime log + API 查询定位根因（本文）
- 2026-04-24 19:28 — `fix/f173-draft-hotfix3` 实施 hotfix：保留 running draft，过滤并删除 missing / non-running invocation draft；新增 running/missing/failed/succeeded/canceled 五条回归测试
- 2026-04-24 20:29 — cloud Codex P1 修复：invocation record lookup transient failure 不再打崩 `/api/messages`；lookup 失败时保留 draft 可见并跳过 orphan cleanup；新增 lookup-failure 回归测试

## 9. 关联

- 父 feature: [F173](../../features/F173-frontend-message-pipeline-unification.md)
- 相关 PR: [#1364](https://github.com/zts212653/cat-cafe/pull/1364)（OUTER invocationId 三路统一）, [#1373](https://github.com/zts212653/cat-cafe/pull/1373)（Phase B-1 ledger）
- 关联 issue: [clowder-ai#573](https://github.com/zts212653/clowder-ai/issues/573)（开源社区报告 OUTER/INNER split，已在 PR #1364 闭合）
- 代码位置: [`packages/api/src/routes/messages.ts:1265-1312`](../../../packages/api/src/routes/messages.ts#L1265)
