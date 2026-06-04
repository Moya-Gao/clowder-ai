---
feature_ids: [F198]
related: [docs/features/F198-claude-code-subscription-carrier.md, docs/bug-report/2026-05-19-F198-bg-carrier-hang-resume/bug-report.md]
doc_kind: plan
created: 2026-06-04
status: ready-for-implementation
owner_design: opus-47 (布偶猫 Opus 4.7, F198 architecture owner)
owner_implementation: opus-48 (布偶猫 Opus 4.8, fresh session)
owner_review: codex (跨族 cross-family review)
owner_vision_guardian: opus-47 (fresh session)
---

# F198 Bug #3 — 会员卡 chainKey Redesign 实施计划

> **真相源**：F198 feat doc Bug #3 节（line 244-289，KD-11，OQ-7 收敛）。本 plan = implementation-ready 细节，48 fresh session 直接按它实施。
>
> **历史背景（双轮探索后）**：bg 固有 fork（金钥匙 spike 双证）→ `-p --resume` id 稳但撞 SDK 桶命门（Agent Team 探索）→ **chainKey 会员卡是唯一可行路**。captured-id PR #2076 已撤回（commit `5b1a6ede0`）。

## 1. 当前 baseline + 可复用资产

- ✅ Main 在 `5b1a6ede0`，feat doc Bug #3 双轮探索 + KD-11 已落
- ✅ Carrier 改动可复用（48 之前 commit `d43be461f` carrier 部分逻辑）：
  - `startJob` 接受 `options.sessionId` → `--resume` (UUID guard)
  - `done` message emit `metadata.resumeSessionId`
  - `JobStateSnapshot.resumeSessionId` 字段
- ❌ Captured-id consumer-side changes（撤回，被 chainKey 替代）
- ❌ Mutex refresh（撤回，被 chainKey-based mutex key 替代）

## 2. 架构核心：chainKey 是"对话级稳定锚点"

> **核心 insight**：bg conversation 没有稳定的 conversation-level id（cliSessionId 每轮 rotate，record.id 每轮 seal+create）。**派生一个稳定锚点 chainKey**，跨 daemon rotation 不变。

**chainKey 派生公式**：`bg:${threadId}:${catId}`
- threadId 跨 conversation lifetime 稳定 ✓
- catId 区分同 thread 多猫（thread + cat = 一条独立 bg conversation）
- `bg:` 前缀隔离其他 provider（明确这是 bg-specific 路径）

**这把架构 invariant 缺失补上**：
- bg conversation: chainKey 稳定 ✓
- mutex key 用 chainKey: 同对话串行化稳定 ✓
- session_init: 用 chainKey 查 existing record → update 不 seal+create ✓
- done: 用 chainKey lookup → update latestResumeSessionId ✓

## 3. Schema 改动

### `packages/api/src/domains/.../sessionChainStore.ts` (找精确路径)

`SessionRecord` 新增两字段：

```typescript
export interface SessionRecord {
  // ... existing fields
  
  /**
   * F198 Bug #3 chainKey: stable conversation-level anchor.
   * For bg carrier: `bg:${threadId}:${catId}` — persists across daemon
   * rotation (sessionId UUID changes every --bg --resume round).
   * For other providers (-p / codex / gemini): undefined (cliSessionId
   * is already stable per-conversation, no derivation needed).
   */
  chainKey?: string;
  
  /**
   * F198 Bug #3: latest fork sessionId returned by `claude agents --json`
   * after most recent --bg --resume turn. Used as next-round --resume
   * target. For bg only — undefined for other providers.
   */
  latestResumeSessionId?: string;
}
```

**Index 改动**：sessionChainStore 加 `getByChainKey(chainKey)` 查询方法（mirrors getActive，但 lookup key 不同）。

## 4. Consumer 改动（invoke-single-cat.ts）

### 4.1 invocation-scoped chainKey 派生

```typescript
// Top of processMessage closure (alongside userVisibleOutputSessionIds Set):
const chainKey = `bg:${threadId}:${catId}`;
// Only used for bg carrier — derived unconditionally, queried only on bg paths
```

### 4.2 sessionId 取（取代 captured-id 路径）

`invoke-single-cat.ts:880-884` 区域：

```typescript
// F198 Bug #3: bg carrier 用 chainKey lookup latestResumeSessionId
// 其他 provider 走原 cliSessionId 路径（隔离不影响）
if (provider === 'claude-bg' && deps.sessionChainStore) {
  const bgRec = await deps.sessionChainStore.getByChainKey(chainKey);
  sessionId = bgRec?.latestResumeSessionId ?? undefined;
} else {
  // existing path
  sessionId = await preflightRace(sessionManager.get(...), ...);
}
```

### 4.3 Mutex key — chainKey 稳定锚点

`invoke-single-cat.ts:898-901` 区域：

```typescript
// F198 Bug #3: bg uses chainKey (stable), other providers use cliSessionId
const mutexKey = provider === 'claude-bg' ? chainKey : sessionId;
await sessionMutex.acquire(mutexKey);
// NO refresh-after-lock for bg — chainKey is invariant
// For other providers, original logic unchanged
```

### 4.4 bg-specific session_init handler

`session_init handler (line 1604+)`：

```typescript
if (msg.type === 'session_init' && msg.sessionId) {
  // F198 Bug #3: bg goes through chainKey lookup (avoid seal+create cascade)
  if (msg.metadata?.provider === 'claude-bg' && deps.sessionChainStore) {
    const bgRec = await deps.sessionChainStore.getByChainKey(chainKey);
    if (bgRec) {
      // Found existing — update cliSessionId (current daemon shortId) without seal
      await deps.sessionChainStore.update(bgRec.id, {
        cliSessionId: msg.sessionId,  // current daemon shortId
        updatedAt: Date.now(),
      });
      // Continue downstream (registerBgCarrier still fires per existing logic)
    } else {
      // No existing — create new with chainKey
      await deps.sessionChainStore.create({
        catId, threadId, userId,
        cliSessionId: msg.sessionId,
        chainKey,
        messageCount: 0,
      });
    }
    // BYPASS the default "CLI session changed → seal+create" logic for bg
    return; // or break out of the seal+create branch
  }
  
  // existing non-bg path unchanged
  // ... seal+create / sessionManager.store / etc.
}
```

### 4.5 bg-specific done handler

`done handler (line 1773+, replace captured-id block)`：

```typescript
if (msg.type === 'done') {
  // existing audit + outputs.push logic ...
  
  // F198 Bug #3: bg uses chainKey lookup (no getActive race, no guard needed)
  if (msg.metadata?.provider === 'claude-bg' && deps.sessionChainStore) {
    try {
      const bgRec = await deps.sessionChainStore.getByChainKey(chainKey);
      if (bgRec) {
        const updates: Record<string, unknown> = { updatedAt: Date.now() };
        if (!userVisibleOutputCountedSessionIds.has(bgRec.id)) {
          updates.messageCount = (bgRec.messageCount ?? 0) + 1;
        }
        const resumeSessionId = msg.metadata?.resumeSessionId;
        if (resumeSessionId && resumeSessionId !== bgRec.latestResumeSessionId) {
          updates.latestResumeSessionId = resumeSessionId;
        }
        if (Object.keys(updates).length > 1) {
          await deps.sessionChainStore.update(bgRec.id, updates);
        }
      }
    } catch { /* best-effort */ }
  } else {
    // existing non-bg path (getActive + messageCount update)
  }
}
```

### 4.6 recordActiveSessionUserVisibleOutput (audit pre-existing race)

同样 bg path 用 chainKey lookup，其他 provider 不变。这是 [[补锅匠]] audit 第 3 处的根治（不是单独守卫）。

## 5. Carrier 改动：`agents --json` 集成

### 5.1 `claude agents --json` 替代解析 dispatch stdout

`ClaudeBgCarrierService.ts startJob` 后增加确定性查询：

```typescript
async startJob(prompt, options): Promise<StartJobResult> {
  // ... existing dispatch logic
  // After parsing shortId from stdout, ALSO query agents --json to verify
  
  const agentsResult = await this.queryAgentsJson(); // new helper
  const latestForkId = agentsResult.find(a => a.shortId === shortId)?.sessionId;
  
  return {
    shortId,
    consumer: new JobEventConsumer(shortId, { jobsDir: this.jobsDir }),
    effectiveModel,
    latestForkId, // pass through to invoke for state.json fallback
  };
}

private async queryAgentsJson(): Promise<AgentEntry[]> {
  // spawn `claude agents --json`, parse JSON output
  // Per 48 spike: "claude agents --json" works in non-interactive (no TTY required)
  // Use as authoritative source for fork id (state.resumeSessionId is backup)
}
```

### 5.2 done emit (carrier 已有 + 备份)

Done 时 emit `resumeSessionId`：优先 `state.resumeSessionId`（48 已实现，可靠路径），fallback `agents --json` 查询（防御性）。Both paths converge to same UUID per 48 spike verification.

## 6. Tests

### 6.1 RED 必覆盖

1. **chainKey 单一性**：同 thread+cat 多轮 invoke → 同 chainKey → **同一条 record**（messageCount 累计跨轮，不 seal+create）
2. **Mutex stability across rotation**：concurrent invocations on same chainKey → 串行 acquire（同 key），不会出现"两个 --resume 并发"
3. **Multi-provider isolation**：在 chainKey-aware path 同 thread+cat 用 -p 时不走 chainKey 路径，cliSessionId 行为原状
4. **A 写 A 正确性**（concurrent race）：concurrent A+B 用 same chainKey → A.done writes to chainKey-record，B.done 同样写 chainKey-record，messageCount 正确累计（不丢、不重）
5. **Sealed write tolerance**：若 chainKey-record 在某并发 edge 被 seal，update 仍成功（messageCount 累计不丢）
6. **Cancel invalidate-and-keep**：abort signal → done 不触发 → latestResumeSessionId 保留 → 下轮 invoke 用旧值 resume

### 6.2 Carrier 测试

7. **`agents --json` non-interactive 可用**：spawn 不要 TTY，parse JSON OK
8. **state.resumeSessionId vs agents --json 一致性**：两条路径返回同 UUID（48 spike 已实证）

## 7. Out-of-scope（保护 PR scope）

**这些不做**：
- 跨 provider 重构 `invoke 取 sessionId` 路径（chainKey 只在 bg path 嵌入）
- 改 session_init handler 的 default "CLI session changed" seal+create 逻辑（其他 provider 仍走原路径）
- recall/digest pipeline 改动（chainKey 是 indexable evidence，无需 pipeline 改造）
- F118 mutex 设计 invariant 变更（只是 bg 用 chainKey key，其他 provider key 不变）

**这些是 follow-up**（如果三审发现）：
- chainKey provider abstraction（如果其他 provider 也需要 stable anchor，单独 ticket）
- agents --json 持续 polling 优化（首次实现走简单 query-on-done）

## 8. 实施流程

```
当前位置 → design doc (本文件) ✅ owner=opus-47
↓ commit + push (本 doc) — 立刻做
↓ @opus-48 fresh session 接 implementation
tdd → quality-gate → request-review (跨族 codex re-review)
↓ codex approve（chainKey 是 codex 推荐方向，应收）
merge-gate → 愿景守护 (@opus-47 fresh, alpha 真实剧本 + session chain inspection)
↓
F198 Bug #3 close → Phase D AC-D3 灰度可开
```

## 9. 愿景守护三审 alpha 真实剧本（vision guard gate）

48 实施完后铲屎官 alpha 跑（按 [[feedback_alpha_smoke_happy_path_blindspot]] 教训）：

```
1. @opus 发 "记住 token PURPLE-OTTER-7" → 等回复 → UI 收尾
2. @opus 发 "上轮 token 是啥？" → 答 PURPLE-OTTER-7 → UI 收尾
3. cancel 当前 invocation（mid-stream）
4. @opus 发 "继续刚才聊的，token 是？" → 答 PURPLE-OTTER-7（cancel invalidate-and-keep 验证）
5. 连发 message 4 / 5 / 6 → 每轮正确收尾
6. 检查 sessionChainStore: 多轮跑完是**一条 record**（chainKey 复用，messageCount=6），不是 6 条 sealed record（验证 #2 解了）
7. 检查 ~/.claude/jobs/<latest-short>/state.json：resumeSessionId 跨轮 rotate，但 latestResumeSessionId 单调更新（验证 carrier 接力链通）
```

PASS 6 步 + record 数 = 1 → 愿景守护三审 APPROVE → merge → F198 救宪宪 落地。

## 10. 铲屎官 ack 需求

- ✅ 撤回 PR #2076（48 已做）
- ✅ Feat doc Bug #3 双轮探索 + KD-11（48 已 commit `5b1a6ede0`）
- ✅ Design doc（本文件，47 done）
- ⏭️ 48 fresh session 实施
- ⏭️ Codex re-review（跨族）
- ⏭️ 47 fresh 愿景守护三审

距 6/15 仍 11 天，会员卡 2-3 天 + 三审 0.5-1 天 + 灰度 5-7 天 = **稳赶 D3 灰度 timeline**。
