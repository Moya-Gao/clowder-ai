---
date: 2026-05-11
topic: F194 Phase Z9 — canonical bubble identity contract + projection observability
author: 布偶猫/Opus-47
reviewer: 缅因猫/砚砚 (Codex GPT-5.5)
branch: feat/f194-phase-z9
review-target-id: f194-z9
---

# F194 Phase Z9 — Review Request

@codex

球到你这。请按 F177 Phase B 47 盲审规则做 binding quality gate + spec review。

## Branch / SHA

- **Branch**: `feat/f194-phase-z9`
- **HEAD**: `e01e70092` (post-biome-format)
- **Review-Target-ID**: `f194-z9`
- **Reviewer sandbox path**: `/tmp/cat-cafe-review/f194-z9/codex`
- **Reviewer startup**: `pnpm review:start`

## Original Requirements（铲屎官原话，2026-05-11）

> "我发现还是裂开的，🤔 好像修这个你们总修不全怎么办呢？ 有没有好办法？" (06:51, R13)
>
> "布偶猫 -》 缅因猫 -〉 布偶猫 -》 缅因猫。 你们互相这样传球四轮... 大概率 布偶猫1 + 布偶猫3的气泡合并到一起 然后缅因猫 2 和4合并到一起就很奇怪 @codex 并且f5之后 还是 你看 把你们的气泡过度整合了发现没有 你们诊断出这个问题了吗？" (07:12, R13 + diagnosis confirm)
>
> 来源：当前 thread `thread_mov3a7qva8mtsbs1` 直接对话；spec 详 `docs/features/F194-invocation-liveness-canonical-read-model.md` Phase Z9 段 + R13 row。

请 reviewer 对照判断：Z9 改完后铲屎官描述的 "布偶猫1+3 合并 / 缅因猫2+4 合并" 现象会不会复发。

## Architecture Ownership (F191)

- **Architecture cell**: `domains/cats/services/agents/routing` (route-serial + route-parallel) + `domains/cats/services/agents/invocation` (live broadcast in messages.ts) + `routes/callbacks` (callback persistence)
- **Map delta**: `none` — Z9 不新增 ownership cell，只在已有 message persistence + live broadcast 路径上修补 stamp 逻辑
- **Why**: AC-Z25 root cause = 9 个 raw-record write 入口的 `turnInvocationId` stamp 条件残留 (`ownInvocationId !== persistedInvocationId`) 让 first-in-chain 不 stamp turn → frontend 投影 fallback parent → multi-turn same-cat 错并。修复保留所有现有 contract（Z3 dual id / liveness helper / queue endpoint），仅消除条件残留。

## What Changed

### AC-Z24 — Projection observability probe (small commit, evidence support)
- `packages/web/src/stores/bubble-projection-diagnostic.ts` — pure function `buildProjectionDiagnostic({ records })` 输出 `recordId / catId / origin / parentInvocationId / turnInvocationId / projectionKey / contentHash / missingTurnStamp`
- 5/5 tests including R13 reproduction fixture (parent+null turn → codex t1/t3 collapse)

### AC-Z25 — Backend always stamps turnInvocationId (核心修复)
9 sites in 5 files, 一律改为 `turnInvocationId: ownX ?? parent`（unconditional stamp）：

| 文件 | 行 | 说明 |
|------|-----|------|
| `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` | 1451 | 主 stream append |
| 同上 | 1487 | callback-already-stored metadata patch |
| 同上 | 1764 | no-text-blocks 分支 |
| 同上 | 1854 | error + toolEvents append |
| `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` | 935, 1031, 1119 | 三个 parallel append 站点 |
| `packages/api/src/routes/callbacks.ts` | 831 | invocation principal callback 持久化 |
| `packages/api/src/routes/messages.ts` | 983 | live socket broadcast payload |
| 同上 | 1567 | active drafts 合并入响应 |
| `packages/api/src/domains/cats/services/session/BoundSessionHistoryImporter.ts` | 110 | history import |

RED test: `packages/api/test/route-serial-z9-always-stamp-turn.test.js` 2/2 GREEN：
- first-in-chain：FAIL pre-fix (undefined) → PASS post-fix (= parent)
- chained turn：PASS both（existing Z3 行为回归保护）

### AC-Z26 — Frontend group key already correct
`getBubbleInvocationId` (packages/web/src/debug/bubbleIdentity.ts:28) 已经是 `turnInvocationId ?? extra.stream.invocationId` 优先级。AC-Z25 落地后所有新 record 都带 turn → 投影不再 fallback。无代码改动；spec 已 mark [x] with note "satisfied by existing helper + Z25"。

### AC-Z27 — Replay fixture full coverage
`packages/web/src/stores/__tests__/bubble-projection-z9-replay.test.ts` 4/4 GREEN：
- F1 multi-turn same parent (codex t1 → sonnet t2 → codex t3) → 3 distinct bubbles, t1+t3 不合并
- F2 single turn multi-record (stream + tool + callback) → 1 bubble
- F3 legacy no turn → fallback to parent (Z8 行为不变)
- F1+F3 mixed → 2 bubbles (transition window safety)

### Phase Z10 spec opened (split from Z9)
- AC-Z28 liveness identity invariant (R14 铲屎官 07:15 "F5 后猫状态空闲 + 没 cancel 按钮 → 等一会儿又冒出来") — 审计发现 `useChatHistory.ts:813` `fetchQueue` 路径已存在，是 timing/race 问题，需要独立 runtime preflight + race classification
- Z10 是独立 PR scope，不在本 PR 范围。spec 已写概要 AC + 实施路径

## 自检证据

### Quality gate self-check（per F177 Phase B，作者是 47 → 不计入放行判据，等砚砚做 binding gate）

- `pnpm check` → exit 0 ✅ (biome + features + skills manifest + env-ports + env-registry + env-example + start-profile-isolation + pre-merge-gate + guides + followup-tails 全过)
- `pnpm test` filter to F194 Z9 sites:
  - `route-serial-z9-always-stamp-turn.test.js` 2/2 ✅
  - regression: `route-serial-parent-invocation-id` + `route-parallel-parent-invocation-id` + `route-serial-cursor-monotonic` + `route-serial-replyto-stream` + `route-serial-error-persistence` + `route-parallel-vote-interception` 14/14 ✅
  - frontend web vitest 2992/2992 ✅
- Root artifact gate: empty ✅
- Worktree clean ✅ (post final biome format commit `e01e70092`)

### Files changed

```
docs/features/F194-invocation-liveness-canonical-read-model.md   (Phase Z9 spec + Phase Z10 spec + R13/R14 + KD-28 + timeline)
docs/features/index.json
packages/api/src/domains/cats/services/agents/routing/route-serial.ts
packages/api/src/domains/cats/services/agents/routing/route-parallel.ts
packages/api/src/domains/cats/services/session/BoundSessionHistoryImporter.ts
packages/api/src/routes/callbacks.ts
packages/api/src/routes/messages.ts
packages/api/test/route-serial-z9-always-stamp-turn.test.js
packages/web/src/stores/bubble-projection-diagnostic.ts
packages/web/src/stores/__tests__/bubble-projection-diagnostic.test.ts
packages/web/src/stores/__tests__/bubble-projection-z9-replay.test.ts
```

## Open Questions

### 技术 OQ（请砚砚判断）

1. **OQ-1**: 改 `live broadcast payload` (messages.ts:983) 从条件 stamp 改为 unconditional 是否会影响下游 `bubble-event-adapter.ts` 的 `canonicalInvocationId = turnId ?? chainId` 逻辑？我认为不会（turn 存在 → 用 turn；turn 缺失 → fallback chain），但 adapter 边界情况你比我熟。
2. **OQ-2**: `BoundSessionHistoryImporter.ts:110` history import 我 stamp `turnInvocationId = evt.invocationId` 等于 parent。这是 history 路径，肯定是 first-in-chain。但如果将来 history 也支持 dual id stamping（比如从 codex CLI session resume 时知道 turn id），这个改动是否阻塞？我倾向不会（still backward compatible，turn === parent 是 explicit fallback 不是 wrong stamp）。
3. **OQ-3**: AC-Z26 telemetry warn 我留给 follow-up。你的 Z9 spec 原意是不是必须本 PR 实现？我现在论据：Z25 unconditional stamp 落地后新 record 不会缺 turn，telemetry 主要价值是回归探测——下个 phase / 单独 PR 加更合适。你的判断？

### 价值 OQ（不需要 CVO 介入，作者已自决）

无。Phase Z10 scope split 是 47 自决（按 self-check 矩阵：方向已有共识，仅技术 phase 切分）。

## What Could I Be Wrong About

预登记可能错点（receive-review skill F169 教训）：

1. **9 sites 漏一个/少改一个**：我用 grep `persistedInvocationId !== ownInvId` + 类似 pattern 逐个 audit，但如果有其他 stream extra write site 不通过这两个变量名（比如 inline 写 hardcoded id），就会漏。可能漏的地方：QueueProcessor stream broadcast / connector message / scheduler delivery / 其他非 cat 路由的 raw record write。请帮我 audit 一遍。
2. **Hydrate path 未改是否问题**：我没改 `RedisMessageStore` 或 hydrate 读路径。理论上读路径只要 group key 用 `getBubbleInvocationId`（已经是 turn-priority）就行。但如果有 reader 不通过这个 helper 而是直接读 `extra.stream.invocationId`，就会漏 group。请 grep 一下其他 reader 路径。
3. **Race condition between persist and broadcast**：live broadcast 现在 always stamp turn。但如果 broadcast 比 persist 先一步，且数据库回填用了不同 source（比如某个 admin tool 直接写 store 不经过 routing），可能出现 broadcast turn ≠ persist turn 的瞬态。Z9 fix 假定所有 write path 都过这 9 个入口 — 如果有 admin/migration 工具绕过，会留 dirty data。

## Self-check matrix

| 检查项 | 状态 |
|--------|------|
| quality-gate 自检完成 (F177 Phase B 47 盲审) | ✅ 作者自检完，等砚砚 binding |
| 测试全绿 | ✅ api 14/14 + web 2992/2992 |
| 原始需求可引用 | ✅ R13 + R14 in spec + thread |
| Architecture ownership 已声明 | ✅ Map delta=none |
| 前端浏览器实测 | ➖ 无前端 UI 改动（projection-diagnostic 是 pure function 测试；bubble-projection 是 Z8 既有路径） |
| 根目录工件闸门 | ✅ 空 |
| Worktree 干净 | ✅ |
| Codex apply_patch 落点检查 | ✅ 全部在 worktree |

## 期望 review 重点

1. **AC-Z25 完备性** — 我有没有漏 raw record write 入口？
2. **AC-Z26 telemetry 是否必须本 PR** — 你 spec 原意？
3. **AC-Z27 fixture 覆盖度** — 三个场景够吗？还有什么边界要加？
4. **Phase Z10 split 是否 ok** — 我把 R14/AC-Z28 分到 Z10 而不是本 PR 收口，你同意吗？

请按 receive-review skill 处理反馈。我已加载 receive-review 等接 P1/P2。

[宪宪/Opus-47🐾]
