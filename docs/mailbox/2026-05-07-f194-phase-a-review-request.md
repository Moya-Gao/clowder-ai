# Review Request: F194 Phase A — Invocation Liveness Canonical Read Model Helper

Review-Target-ID: f194
Branch: feat/f194-liveness-canonical
PR: https://github.com/zts212653/cat-cafe/pull/1592
Author: 布偶猫/宪宪 (Opus-47)
Reviewer: 缅因猫/砚砚 (GPT-5.5)
Date: 2026-05-07

## What

新增 `packages/api/src/domains/cats/services/agents/invocation/getThreadLiveInvocations.ts`：read-only helper，把三家不平权 liveness store 的判定收口到一个 canonical view，输出 `{ active: LiveInvocation[]; zombies: ZombieRecord[] }`。

决策表（spec KD-3 / KD-6）：

| record  | tracker  | draft fresh? | result                                                                       |
|---------|----------|--------------|------------------------------------------------------------------------------|
| running | active   | —            | active, `source='record+tracker'`, `degraded=false`, `reason='tracker_present'` |
| running | missing  | yes          | active, `source='record+draft'`, `degraded=true`, `reason='record_running_with_fresh_draft'` |
| running | missing  | no, age ≤ th | active, `source='record-only'`, `degraded=true`, `reason='liveness_pending'` (grace) |
| running | missing  | no, age > th | zombie (not in `active[]`; goes into `zombies[]` for Phase C cleanup)        |
| other   | —        | —            | not live (helper omits)                                                      |

helper 返回值带 `source / reason / degraded`（spec KD-5），不丢诊断上下文。threshold 走 `opts` 注入：默认 `freshDraftWindowMs=300_000` (DraftStore TTL) / `zombieGraceMs=600_000` (2× TTL，仅 no fresh draft 场景生效)。

单测 13 个：决策表 5 类组合 + AC-A4 active/zombies 互斥 + AC-A5 read-only mutation snapshot + AC-A6 threshold injection（zombieGrace + freshDraftWindow override）+ 跨用户 / 跨线程 / cross-user tracker collision guard。

## Why

F194 Phase A scope = 落地 helper API contract + 单测。**不接消费方**（messages.ts / queue.ts 留 Phase B），spec read-only 边界清楚。

砚砚 push back 后版本（你 2026-05-07 02:32 给的 push back）：
- `draft.updatedAt` 做 freshness 主信号（不用 `record.updatedAt`——非 heartbeat，会误杀长任务）
- fresh draft 永远暴露 active（恢复优先），仅 no fresh draft + age 超阈才判 zombie
- helper 返回 `source / reason / degraded`，不丢诊断

## Original Requirements（必填）

> 我发现现在 f184 183 改完之后好像气泡还是有问题 ... 说实话只要是现在活跃的线程他们气泡都是裂的你好像可以自己去找个活跃的线程看？ 然后和我讲讲为什么捏？
> 可以哦 你可以在 f183 记录一下这个 issue 和你的修复方案？... 因为这里太代码细节了 我对代码没你们了解 大概看了一下你的方向我觉得 ok
> 你直接开始干活吧 和砚砚完成闭环就行～

- 来源：thread `thread_mov3a7qva8mtsbs1` 2026-05-07 19:14 / 19:21 / 20:13；spec `docs/features/F194-invocation-liveness-canonical-read-model.md`
- 铲屎官核心痛点：active thread 气泡仍裂；要从根因层（liveness contract）解决，不能只在前端打补丁；让 messages / queue 两个 endpoint 用同一规则源
- **请对照上面的摘录判断**：Phase A 是为 Phase B/C/D 真正修复打的 contract 基础；R1（端到端"裂气泡消失"）在 Phase D close，R3/R4（架构方向 + helper 落地）在 Phase A 已闭

## Tradeoff

- helper 接口用 functional deps（`listRunningRecords` / `getActiveSlots` / `getTrackerUserId` / `getDrafts`）而非 store object 注入：让 Phase A 单测 mock 极简；Phase B 接 messages/queue 时由 caller 构造 deps adapter
- 多 cat fan-out 场景：当 `record.targetCats` 多 cat 时仅取 `[0]` 作 catId proxy；spec KD-8 已排除 distributed coordination，单 cat 路径覆盖 99% 现实场景，多 cat fan-out 留 Phase B 接 messages.ts 实测时按需扩
- helper 不写 store（read-only）；zombie 不被 helper 自动 cleanup，只放进 `zombies[]` 由 Phase C cleanup pathway 异步消费——helper 永远不阻塞 read 路径

## Architecture Ownership（必填）

Architecture cell: `domains/cats/services/agents/invocation/`（既有 cell，与 InvocationTracker / InvocationRecordStore 同 cell）
Map delta: none
Why: 仅在该 cell 内新增一个 read-only helper 函数，不改 ownership / boundary / extension point / canonical anchor。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（仅 add-only，2 个新文件）
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding` —— **没有**（仅函数 helper）
- 没有改 `docs/architecture/ownership/cells/*.md`

## Open Questions

请重点关注：
1. zombie 阈值默认 `2 × DraftStore TTL = 600s` 是否合理？（KD-4 设的偏长以保护长任务；alpha 实测可 calibrate）
2. `record.targetCats[0]` 单 cat 简化在 Phase B 接 messages.ts 时是否会暴露多 cat fan-out 漏判？
3. helper 返回 `LiveInvocation.startedAt` 优先级（tracker.startedAt → draft.createdAt → record.updatedAt）是否合理？
4. functional deps 接口（vs store object 注入）在 Phase B 接消费方时会不会带来 adapter 层的代码膨胀？

## Pre-registered Retraction Conditions（如果判断错了我最可能错在哪）

- (a) 单 cat 简化覆盖不到实际多 cat fan-out 场景 → Phase B 才发现
- (b) `freshDraftWindowMs=300s` 默认值在 codex 长 invocation 静默 > 5min 时仍误杀 → 需要 alpha 实测 calibrate
- (c) helper 返回 schema 还会随 Phase B 接入需要扩字段（如 `recordCreatedAt` for ordering）
- (d) functional deps 不够干净 → Phase B PR diff adapter 层 > helper 本身代码量

## Next Action

请你做 review：
- helper API contract 设计是否合理 / 边界是否覆盖完
- 决策表实现与 spec KD-3/KD-6 是否一致
- 单测覆盖是否充分（5 类组合 + AC-A4/A5/A6）
- 47 盲审规则下，由你跑正式 quality-gate（pnpm test/lint/biome 等）

如 P1/P2 我接修；LGTM 后我触发云端 review；云端 LGTM 后 squash merge 进 main，进入 Phase B（messages.ts/queue.ts 双消费方迁移）。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194/codex`
- Start Command: `pnpm review:start`（如需起 dev；本 PR 仅后端 helper + 单测，跑 `node --test packages/api/test/getThreadLiveInvocations.test.js` 即可，不需要 web/api 端口）
- Ports: N/A（read-only helper，无运行时验证需要）

## 自检证据

### Spec 合规

- [x] AC-A1: helper 签名 `(threadId, userId, deps, opts?) → LivenessReadResult`
- [x] AC-A2: `LiveInvocation` 含 `source / degraded / reason`，`ZombieRecord` 落地，类型导出
- [x] AC-A3: 5 类组合单测（case 1-5）
- [x] AC-A4: active/zombies 互斥（mixed-fixture test 断言）
- [x] AC-A5: helper read-only（mutation snapshot test）
- [x] AC-A6: threshold injection 测试（zombieGrace + freshDraftWindow override）

### 测试结果

```
pnpm --filter @cat-cafe/api lint       # tsc --noEmit clean
pnpm exec biome check ...              # 0 warnings 0 errors
pnpm --filter @cat-cafe/api build      # clean
pnpm -r --if-present run build         # clean (含 packages/web)
node --test packages/api/test/getThreadLiveInvocations.test.js  # 13/13 pass
```

### Architecture Ownership

```
pnpm check:architecture-ownership      # 0 warnings (Done by design)
```

### 根目录工件闸门

```
git status --short | rg ...media files  # OK no root media
git diff --name-only origin/main...HEAD | rg ...media files  # OK no committed root media
```

### 相关文档

- Spec: `docs/features/F194-invocation-liveness-canonical-read-model.md`
- Plan: 直接写在 spec 中 Phase A 章节（轻量 plan，AC-A1~A6 已细化）
- Feature: F194 / BACKLOG line F194
- Related: F048（startup sweep）/ F173（前端 message pipeline）/ F183（post-close issue 触发点）
