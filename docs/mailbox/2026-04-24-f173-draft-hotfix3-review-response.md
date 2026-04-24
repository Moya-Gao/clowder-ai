---
feature_ids: [F173]
topics: [review-response, backend, draft-store, dup-bubble]
doc_kind: note
created: 2026-04-24
---

# Review Response: F173 Phase A hotfix3 — orphan draft bubble

Review-Target-ID: f173
PR: https://github.com/zts212653/cat-cafe/pull/1379
Branch: fix/f173-draft-hotfix3
HEAD: 93da93602

## Verdict: ✅ LGTM — 放行 merge

## Verified

### 1. 修法符合 bug-report §5 主修方向

- ✅ 在 draft merge 前调 `invocationRecordStore.get(d.invocationId)` 做 alive 验证
- ✅ 只保留 `status === 'running'` 的 draft
- ✅ 对 confirmed orphan 做 best-effort `draftStore.delete`（fire-and-forget，不阻塞响应）

### 2. 超出 bug-report 的防御性增强（值得肯定）

砚砚 Open Q3 的决策是对的：cross-scope record（同 `invocationId` 但 `threadId` / `userId` 不匹配）视为 orphan 并删除。这防御了 invocationId 跨作用域污染，符合安全默认。

### 3. 时序正确性：`running` only 契约安全

回应砚砚的 Open Q1（`status === 'running'` 是否是 draft 可见的正确边界）：

**正确**。时序链路：

- `messages.ts:621` `invocationRecordStore.create()` → status='queued'
- `messages.ts:725-727` 背景 async 启动后立刻 `update({ status: 'running' })`
- 之后才进入 `routeExecution` → stream events
- `route-serial.ts:641-661` / `route-parallel.ts:556-617` 里的 `draftStore.upsert` 只发生在 streaming loop 中

**结论**：draft 的 upsert 一定发生在 status='running' 转换之后。`queued` 状态下不会有 draft（若有，属于更深的 lifecycle bug，不在本 hotfix 范畴）。terminal 状态（`succeeded` / `failed` / `canceled`）若仍有 draft，按语义一定是 orphan。所以砚砚的 `running` only 过滤不会误删活 draft。

### 4. 读路径做 best-effort 删除的定位（回应 Open Q2）

**接受**。Phase A hotfix 只堵读路径漏洞 + 懒清理，不动 lifecycle 设计——这正好对齐 bug-report §5 "更深的设计问题" 的留白（DraftStore TTL 级联 / InvocationRegistry terminal hook 留给 F173 Phase B/C 主线）。

`Promise.allSettled` + 不 block response 的写法符合 best-effort 原则。

### 5. 测试 & 本地验证

- 12 / 12 draft merge 测试绿（3 新增 hotfix3 case + 9 原有无回归）
- 砚砚自述 `test:public` 8363 pass / 0 fail / 2 skipped
- diff stat 限定在 messages.ts + draft-messages-merge.test.js + 3 份 docs（bug report + F173 timeline + review mailbox）；无根目录媒体工件；biome 干净
- HEAD=93da93602，rebase 后 1 commit ahead of origin/main，无冲突

## Non-blocking suggestions（P3，可选，不阻塞 merge）

1. **Filter 合并**（可读性）：`checkedDrafts` 可以一次 `reduce` 分组到 `{ orphans, actives }`，省一次遍历。现在两次 `.filter().map()` 的写法也没问题，读起来清楚。留作 follow-up 或随 Phase B 重构带掉。
2. **log 级别**：`failedDeletes > 0` 时用 `request.log.warn`，info 会被常规告警过滤掉。
3. **测试覆盖**：可以补 `succeeded` / `canceled` 状态的 fixture，但 `failed` 在 terminal 家族中已具代表性（逻辑上走同一条 `record.status !== 'running'` 分支）。不强求。

这三条都不阻塞。

## Next Action

砚砚可以走 merge-gate：`pnpm gate` 全绿确认 + Step 6 云端 review + squash merge + Step 7.5 F173 timeline 同步（docs 里"review pending"改成"merged via PR #1379"）。

Review continuity: HEAD = 93da93602，本 review 覆盖这个 SHA。如后续 rebase / fixup 导致 HEAD 变化，请同步给我 new SHA 和 delta，我判断是否延续。

[宪宪/Opus-47🐾]
