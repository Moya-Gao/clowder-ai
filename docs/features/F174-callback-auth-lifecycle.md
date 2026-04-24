---
feature_ids: [F174]
related_features: [F016, F061, F077, F086, F098, F102]
topics: [auth, mcp, infrastructure, reliability, telemetry]
doc_kind: spec
created: 2026-04-23
---

# F174: Callback Auth Lifecycle & Resilience — 鉴权基础设施持久化、降级与可观测

> **Status**: in-progress | **Owner**: 布偶猫（Opus-47）+ 缅因猫（GPT-5.4，跨家族独立 review） | **Priority**: P1
>
> **Phase A**: ✅ merged 2026-04-23 via PR #1359
> **Phase B**: ✅ merged 2026-04-24 via PR #1363
> **Phase C**: ✅ merged 2026-04-24 via PR #1368
> **Phase D1**: ✅ merged 2026-04-24 via PR #1377

## Why

**现象**：砚砚（Codex）反复出现 MCP 工具失败 — `register_pr_tracking` 401、post_message 超时、认证过期。铲屎官自己也撞到："干了半小时活要发语音，MCP 说 token 过期。"

**铲屎官原话（2026-04-23 14:26 / 14:34 / 14:48）**：

> "我发现砚砚经常有mcp 我们家的 pr trcking 挂不上 auth 过期等等问题，我们mcp的设计是不是又问题？"
>
> "#509：callback auth 基础设施统一/加固 —— 开源社区我们原本 intake进来过这个，这个是什么呢？我希望你站在架构层面完整的优化实现最佳方案 不当补锅匠"
>
> "可以立项 但是我建议 你最好找砚砚讨论？然后你们可以有各自的思考和立场 我需要一个完整的最终方案。"

**根因诊断**（见 Architecture Map）：这不是 MCP 协议本身的问题，是我们 **callback 鉴权基础设施的 Lifecycle 层**的实现债：

1. **InvocationRegistry 是纯内存**（`packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts:50`，注释 line 47 自己承认 "Phase 3 will migrate to Redis" — 这个 Phase 3 没干）。API 重启 / 部署 / 崩溃 → 所有活跃 token 一次性失效。**砚砚在 cloud Codex 跑长 session，这是他反复撞 401 的最可能根因。**
2. **没有 explicit refresh endpoint** — 只有 `verify()` 时被动 sliding，长时间没工具调用就过期
3. **Route B 降级只覆盖 rich block**（`packages/mcp-server/src/tools/callback-tools.ts:426-441`）— `post_message` / `register_pr_tracking` / `update_task` 全部直接 401 死，无补救
4. **零 telemetry** — 没有 401 率监控、没有按 cat/tool 维度的失败率，撞了多少次都没数据
5. **失败原因不结构化**（缅因猫 review 加入）— `verify()` 只回 `record | null`（`InvocationRegistry.ts:110`），preHandler 把"过期/token 不匹配/invocation 不存在"全部压成同一个 401（`callback-auth-prehandler.ts:54`）。客户端降级现在靠字符串 regex 猜错误（`callback-tools.ts:260, 423`）。**不先改这个，下游降级 + telemetry 都会做歪 — 全都得用脆弱的字符串匹配。**

**为什么现在做**：#509（社区 mindfn，MERGED + intaked）+ #1263（自家 refactor，MERGED）已经把 **Transport 层（header 迁移）+ Authority 层（actor/scope helpers）** 完成了。现在缺的就是 **Lifecycle 层** —— 再不做，砚砚会继续撞 401，铲屎官会继续撞"干活半小时 token 过期"。

**非作用域**（刻意排除）：
- 不改 MCP 协议本身（协议只规定 transport，我们调的是我们自己 server 的鉴权实现）
- 不做多用户隔离（那是 F077）
- 不做跨 MCP 身份联邦（飞书/pencil/claude-in-chrome 各自 OAuth，是 L5 未来层，不是 L2）
- **不在本 Feature 做 `Authorization: Bearer` 标准化**（缅因猫指出：当前 client/server/outbox 深度绑定 `x-invocation-id + x-callback-token` 双头 + legacy body/query，Bearer 解决不了核心痛点只会扩大迁移面 — 单立 Feature）

## What

### Architecture Map — Callback Auth 视图（四层 + 一个 migration concern）

把零散修复装进完整骨架，每一刀知道自己解决哪一层：

| 层 | 关注点 | 现状 | 归属 |
|---|---|---|---|
| **L5 Identity Federation** | 跨 MCP 身份代理（飞书 OAuth / pencil / claude-in-chrome 等） | 各管各的，无 broker | **Future**（F143 hostable runtime 推进后再立） |
| **L3 Authority & Scope** | actor 派生 + Bound/Scoped/Strict 写入语义 | ✅ #1263 完成，`callback-scope-helpers.ts` | **F174 Phase F 收残尾** |
| **L2 Lifecycle & Resilience** | 失败原因结构化 / 持久化 / refresh / 降级 / telemetry | ❌ **主战场** | **F174 Phase A-E** |
| **L1 Transport** | header 传输 + 统一 preHandler + fail-closed | ✅ #509 完成 | — |
| ~~L4 Bearer Scheme~~ | _注：这不是独立"层"，是 transport encoding / migration concern_ | custom `X-*` header 可用 | **独立 Feature**（对外暴露 / canary 触发时立） |

> 注：早稿曾把 Bearer 标准化列为 L4。缅因猫指出它本质是 transport encoding 层的 migration 关注，独立成层会在 F174 抢戏，故降为附注、单独立项。

本 Feature 聚焦 **L2（主）+ L3 残尾（附）**。L5/Bearer 作为 follow-up feature。

---

### Phase 顺序（按缅因猫建议重排）

**实施顺序**：`A 结构化失败原因 → B 持久化 → C refresh → D1 minimal counters/reasons → E 精准降级 → D2 dashboard/UI → F 清尾`

**为什么这个顺序**（缅因猫论据）：
- 根因在 L2 持久化（B）；如果 B 没落地就先做大面积降级和面板，就是补锅
- 现在 retry/outbox 只处理 `408/429/5xx`（`callback-retry.ts:24`，`callback-outbox.ts:184`），401 本来就不会被它兜住——所以降级 (E) 应该是**少数高价值工具的残余保护**，不是主解
- A（结构化失败原因）必须先于 D/E，否则下游被迫靠字符串匹配
- D 拆成 D1（counters/reasons，A 之后立刻做，给 E 提供精准信号）+ D2（dashboard UI，可放后面）

为兼容 parser，Phase 标记保持单字母 A-F；D 在文中拆 D1/D2 但同 Phase。

---

### Phase A: Structured Auth Failure Reasons — 失败原因结构化

**前置依赖**，下游 Phase D/E 全部依赖这一步。

**当前问题**：
- `InvocationRegistry.verify()` 返回 `record | null`，把"过期 / token 不对 / invocation 不存在"全压成 null（`InvocationRegistry.ts:110-132`）
- `callback-auth-prehandler.ts:54` 把所有 verify 失败都返同一个 401 + `EXPIRED_CREDENTIALS_ERROR`
- 客户端降级靠 regex 猜错误字符串（`callback-tools.ts:260, 423` — `/expired|invalid/i` 这种）
- `post_message` 已经专门识别 `stale_ignored`（`callback-tools.ts:242`），`schedule.ts:110` 也单独挡 stale invocation —— 已有先例，需要泛化

**设计**：
```typescript
type AuthFailureReason =
  | 'expired'           // TTL 到了
  | 'invalid_token'     // invocationId 存在但 callbackToken 不匹配
  | 'unknown_invocation' // invocationId 不存在（registry restart 或 LRU evict）
  | 'stale_invocation'  // 不是最新（被新 invocation 顶替）
  | 'missing_creds';    // header/body 都没传

type VerifyResult =
  | { ok: true; record: InvocationRecord }
  | { ok: false; reason: AuthFailureReason };
```

- `InvocationRegistry.verify()` 返回 `VerifyResult`
- preHandler 把 reason 写入 401 响应 body：`{ error: 'callback_auth_failed', reason: '...', message: '...' }`
- 客户端 `callbackPost`/`callbackGet` 解析结构化 reason，传给降级 framework；不再 regex 字符串

**`stale_invocation` 单独**（缅因猫补充）：用户体感一样糟但当前埋没在 401 里——单独 emit 让 D 仪表盘能看到真实失败面。

---

### Phase B: InvocationRegistry Persistence — Redis 化

把 `InvocationRegistry` 从 `Map<string, InvocationRecord>` 迁到 Redis（6399 主 / 6398 worktree），API 进程重启 / 部署 / 崩溃不再丢 token。

**设计要点**：
- **范式参照** `RedisInvocationRecordStore.ts`（仓库已有的 Hash + Lua 原子操作模式 — 缅因猫推荐）
- Redis key schema：`cat-cafe:invocation:{invocationId}` → Hash（`catId`/`userId`/`threadId`/`callbackToken`/`parentInvocationId?`/`a2aTriggerMessageId?`）
- `EXPIREAT` 绑定 `expiresAt`，Redis 原生 TTL 清理（不再靠 in-process `cleanup()`）
- `verify()` 用 Lua 原子脚本：检查存在 + token 匹配 + 未过期 + 滑 TTL，一步完成
- `latestByThreadCat` 用独立 Redis key：`cat-cafe:invocation-latest:{threadId}:{catId}`，原子 SET
- `clientMessageIds` 用 Redis Set + 有界清理（SCARD > MAX 时 SPOP 最老）—— 原 `MAX_CLIENT_MESSAGE_IDS = 1000` 保持
- LRU 500 上限不再需要（Redis TTL 自动回收）
- **Streams 不作真相源**（缅因猫明确反对）：热路径 `verify/isLatest/claimClientMessageId` 都是点查，不是 replay-first；如果要 audit，**副写一个 stream**，不反过来

**环境适配**：
- Worktree/test：`REDIS_URL=redis://127.0.0.1:6398`（隔离）
- Main/prod：`REDIS_URL=redis://127.0.0.1:6399`（圣域，铁律 #1）
- Test 隔离：复用 `scripts/with-test-home.sh` 起临时 Redis，不接主环境

**向下兼容**：环境变量 `CAT_CAFE_INVOCATION_REGISTRY=memory|redis`（默认 `redis`），回退 memory 以便回滚 / 早期调试。

---

### Phase C: Explicit Refresh Endpoint — 主动续期

新增 `POST /api/callbacks/refresh-token`，MCP 客户端能主动续期而不依赖工具调用触发 sliding window。

**契约**：
- 请求：headers `X-Invocation-Id` + `X-Callback-Token`（遵循 #509 scheme）
- 响应：`200 { expiresAt: number, ttlRemainingMs: number }` / `401 { error, reason }`（reason 来自 Phase A）
- 行为：等价于一次"空 verify"，成功则 TTL 滑到 now + 2h，返回新 expiresAt

**客户端续期算法**（缅因猫提案，替代我原来的写死 30min）：
```typescript
// 按 TTL 比例 + jitter，TTL 改了不用追客户端
const refreshIn = clamp(ttlRemainingMs / 4, 5 * 60_000, 30 * 60_000);
const jitter = refreshIn * (0.85 + Math.random() * 0.3);  // ±15%
setTimeout(refresh, jitter);
```
- 2h TTL 下结果还是 ~30min，但 TTL 调整时算法自适应
- jitter 避免多客户端同时刷
- **不再需要在 spec 里 hardcode 30min**

**为什么需要**：当前只有 `verify()` 滑 TTL，如果客户端长时间没工具调用（纯思考 / 外部等待），2h 到了就死。refresh 给了一个"心跳"口子。

---

### Phase D: Telemetry — Counters/Reasons (D1) + Dashboard (D2)

给 callback 鉴权加可观测性，后续设计/调参有数据。**D1 紧跟 Phase A 做**（counters 是低成本、立刻收益）；**D2 dashboard 可后排**。

#### Phase D1: Counters & Reasons（必做，A 之后立刻）

- 指标：`callback_auth_failures_total{tool, cat, reason}` — counter
- reason 枚举来自 Phase A：`expired` / `invalid_token` / `unknown_invocation` / `stale_invocation` / `missing_creds`
- 每次 `verify()` 返回 `{ ok: false }` 时打点；preHandler 401 时打点
- 输出：Hub 已有的 `/api/debug/metrics` 或独立 `/api/debug/callback-auth` endpoint
- **作为 Phase E 降级的输入信号**：哪些 tool × reason 组合高频，就先治哪个

#### Phase D2: Dashboard UI（可后做）

- Workspace 诊断面板加一个"Callback Auth Health"卡片
- 显示近 24h 401 率、Top 3 失败工具、Top 3 受影响猫、按 reason 分布
- **不是**实时 monitoring（这不是 oncall 级），是设计决策数据源

#### Knowledge Feed 关系（缅因猫强调）

**telemetry 不直接写 Knowledge Feed**。Telemetry = runtime 观测；Knowledge Feed 应该只接收**阈值触发后、已经确认的新 failure pattern / lesson**，否则会被 401 噪音淹掉。Phase D2 dashboard 可以人工审视后**手工**沉淀新发现。

---

### Phase E: Graceful Degradation — Per-Tool degradePolicy

**精准降级**，不假装每个工具都能优雅降级（缅因猫立场）。

**Framework 设计**：
```typescript
type DegradePolicy =
  | { kind: 'none' }                          // 直接 fail，告诉猫调用方
  | { kind: 'embed-text', formatter: (...) => string }  // create_rich_block 的 cc_rich 模式
  | { kind: 'manual-instructions', formatter: (...) => string };  // post_message/register_pr_tracking 的"手动补"模式

interface CallbackTool<T> {
  execute(): Promise<T>;
  degradePolicy: DegradePolicy;
}
```

**关键约束**：
- 每个写类 callback tool **显式声明** `degradePolicy`（包括显式声明 `none`）
- 降级**只在 401（reason ∈ {expired, unknown_invocation}）触发**；`invalid_token` / `stale_invocation` 走单独路径（`stale_invocation` 不降级，给"这是 stale callback"提示）；5xx 走 retry（`callback-retry.ts` 现有逻辑不动）
- 降级产物**必须**标 `DEGRADED: true` 字段 + 清晰 hint，避免猫误认为已成功

**初始接入名单**（按 Phase D1 数据决定优先级，以下是基线推断）：
- `create_rich_block`：`embed-text`（已有，重构进 framework）
- `post_message`：`manual-instructions`（输出可粘贴的 `/cc_post` 指令 + 原始内容）
- `register_pr_tracking`：`manual-instructions`（输出"请手动 `gh pr ...` 或通知铲屎官"）
- `update_task`：`manual-instructions`（输出 task URL + 手动更新指令）
- `retain_memory_callback`：`manual-instructions`（输出 memory candidate 让铲屎官手工 retain）
- `search_evidence` / `get_thread_context`：**`none`**（读类，401 直接报错让上层处理）
- 其它写类：根据 D1 数据增量加，默认 `none`

---

### Phase F: L3 Authority 残尾收口

清理 #509/#1263 follow-up 里我 review 点名但还没落地的尾巴：

- `schedule.ts:127` 的 `body.createdBy ?? 'unknown'` 兜底 → 切到 `deriveCallbackActor()`
- `thread-context` 读权限语义收口（review request 第 7 条 open question）—— 如果这块语义太复杂，单独开子任务，不绑进 F174 主流程
- `callback-auth-schema.ts` 是否还能删 — 按缅因猫策略：**先停 first-party dual-write**（`callback-tools.ts:66, 81` 客户端不再往 body 写 cred）→ **统计 fallback-only 命中**（preHandler `:39` 仅记 header 缺失时的 fallback）→ **零命中跑满一个 release window 再删** + **保留硬 deadline** 避免 compat window 永生

**这个 Phase 是 clean-up，不是 new feature**，工作量小，可以在 Phase B-E 的任何间隙做。

---

## Acceptance Criteria

### Phase A（Structured Failure Reasons — 前置）— ✅ merged PR #1359
- [x] AC-A1: `AuthFailureReason` 类型 + `VerifyResult` 落地（`InvocationRegistry.ts`）
- [x] AC-A2: `verify()` 返回 `VerifyResult`，所有调用点更新（preHandler / wecom / lark / community-issues / wiring test）
- [x] AC-A3: preHandler 401 响应 body 包含 `reason` 字段（`callback-auth-prehandler.ts` + `callback-errors.ts`）
- [x] AC-A4: `stale_invocation` 与 `expired` 在 reason 上明确分开（taxonomy in `@cat-cafe/shared`）
- [x] AC-A5: 客户端 `callbackPost`/`callbackGet` 解析 `reason`（typed marker `[reason=X]`），不再用 regex 字符串匹配
- **Bonus**（砚砚 review reminder #2）: reason taxonomy 抽到 `@cat-cafe/shared/types/callback-auth-reasons.ts` 单一真相源 + contract test 防漂移

### Phase B（Persistence）— ✅ merged PR #1363
- [x] AC-B1: `InvocationRegistry` 支持 Redis backend，schema 设计参考 `RedisInvocationRecordStore.ts` 的 Hash + Lua 模式
- [x] AC-B2: `verify()` / `create()` / `isLatest()` / `claimClientMessageId()` 全部走 Redis，通过现有 `InvocationRegistry.test.ts` + 新增集成测试
- [x] AC-B3: API 进程重启后，活跃 invocation 仍可 `verify()` 成功（集成测试：启-停-启 + verify 流程）
- [x] AC-B4: `CAT_CAFE_INVOCATION_REGISTRY=memory` 回退可用（回滚保险）
- [x] AC-B5: Worktree 用 6398，main 用 6399，不误触圣域（Redis config test）
- [x] AC-B6: 不引入 Streams 作真相源；如做 audit 是副写

### Phase C（Refresh）
- [x] AC-C1: `POST /api/callbacks/refresh-token` 端点落地，header 传 creds，fail-closed 401（reason 来自 A）
- [x] AC-C2: 响应包含 `expiresAt` + `ttlRemainingMs`
- [x] AC-C3: MCP 客户端按 `clamp(ttlRemainingMs/4, 5m, 30m)` + jitter 自适应续期（cooldown-safe min ≥6.18min × jitter floor 0.85 = 5.25min ≥ server cooldown）
- [x] AC-C4: rate limit：每 invocation 每 5min 最多 1 次 refresh（防滥用，atomic verifyLatest 关闭 race window）
- [x] AC-C5: refresh 失败时客户端不 crash，记录 warn 日志（含 AbortSignal.timeout 10s + SIGINT/SIGTERM exit code 128+signum）

### Phase D1（Counters/Reasons — 必做）
- [x] AC-D1: `cat_cafe.callback_auth.failures{callback.tool, callback.reason, agent.id}` OTel counter + allowlist 扩展
- [x] AC-D2: 5 个 reason 全部覆盖（central recorder 接 prehandler 3 处 + refresh-token 4 处）
- [x] AC-D3: `GET /api/debug/callback-auth` 端点返回 `{reasonCounts, toolCounts, recentSamples (cap 100), totalFailures, startedAt, uptimeMs}` — owner-gated（session + DEFAULT_OWNER_USER_ID 双层 fail-closed）

### Phase D2（Dashboard — 可后做）
- [ ] AC-D4: Workspace 诊断面板加 "Callback Auth Health" 卡片
- [ ] AC-D5: 显示 24h 401 率 + reason 分布 + Top 工具 + Top 受影响猫

### Phase E（Degradation — 在 D1 之后）
- [ ] AC-E1: `DegradePolicy` 类型 + framework 落地，`create_rich_block` 现有 Route B 重构进 framework（行为不变）
- [ ] AC-E2: 每个写类 callback tool 显式声明 `degradePolicy`（含 `none`）
- [ ] AC-E3: 降级只在 401-degradable reason 触发；5xx 仍走 retry（regression test）
- [ ] AC-E4: 降级产物含 `DEGRADED: true` 字段
- [ ] AC-E5: `post_message` / `register_pr_tracking` / `update_task` / `retain_memory_callback` 接入 framework
- [ ] AC-E6: `stale_invocation` 不降级，给清晰提示

### Phase F（L3 残尾）
- [ ] AC-F1: `schedule.ts` 不再从 body 读 `createdBy` / `triggerUserId`
- [ ] AC-F2: `callback-tools.ts` first-party dual-write 关闭（不再往 body 写 cred）
- [ ] AC-F3: 配套 telemetry 追踪 fallback-only 命中率
- [ ] AC-F4: thread-context 读权限 open question 有结论（落地 or 转独立 feature）
- [ ] AC-F5: 设硬 deadline 删 `callback-auth-schema.ts`（即使命中率非零也按 deadline 切）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "砚砚经常有 mcp pr tracking 挂不上 auth 过期" | AC-B1/B3 | 集成测试：模拟 API restart 后 verify 不 401 | [ ] |
| R2 | "我干活，然后干了半小时，然后要发语音，结果mcp和我说token过期" | AC-C1/C3 | 集成测试：长 session + 自适应 refresh，voice callback 不 401 | [ ] |
| R3 | "站在架构层面完整的优化实现最佳方案 不当补锅匠" | 四层架构 + Phase A-F 完整拆分 | 本文 + 砚砚跨家族 review | [ ] |
| R4 | "#509：callback auth 基础设施统一/加固" | 本 Feature 命名 + Phase F 收口 #509 follow-up | #509 + #1263 + Phase F 三件合起来形成完整闭环 | [ ] |
| R5 | "我需要一个完整的最终方案" | KD-4 ~ KD-11 收敛决策 + Phase 重排 | 砚砚 + 我达成共识，铲屎官拍板 | [ ] |
| R6 | （隐含）401 故障归因不能靠字符串猜 | AC-A1~A5 | 单测：reason 枚举完整覆盖；regression：客户端不再 regex match | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式（集成测试 / 回归测试 / 诊断面板 UI / 单测）
- [x] 前端需求已准备需求→证据映射表（本 Feature 无前端 UX，Phase D2 诊断面板是次要）

## Dependencies

- **Evolved from**: clowder-ai#509（Transport 层 — MERGED + intaked），#1263（Authority 层 — MERGED）
- **Blocked by**: 无（Redis 6399 圣域已有基建）
- **Related**:
  - F016（Codex OAuth + 记忆闭环）— invocation-token 概念的起源
  - F061（Antigravity 孟加拉猫）— Bug-H "persistent MCP write-path auth" 是 F174 的远房亲戚（F174 不解决 persistent 场景，但降级 framework 可能被复用）
  - F077（Multi-User Secure Collaboration）— F174 不做多用户隔离，但 F077 会依赖 F174 的持久化（重启不丢会话）
  - F086（Cat Orchestration Multi-Mention）— callback auth 消费方
  - F098（Callback Message UX）— 消息类 callback 的 UX 层
  - F102（Memory Adapter Refactor）— `search_evidence_callback` → `search_evidence` 合并确认了 callback auth 是实现细节
- **参考实现**: `RedisInvocationRecordStore.ts`（Hash + Lua 原子操作范式，Phase B 直接参照）

## Risk

| 风险 | 缓解 |
|------|------|
| Redis backend 引入 network latency，callback 延迟变大 | 用 pipeline / 批量，verify 目标 < 5ms；如超标回退 memory + 写透后端 |
| refresh endpoint 被滥用刷 TTL（恶意客户端） | rate limit：每 invocation 每 5min 最多 1 次 refresh；超限 429 |
| 降级产物让猫误认为操作成功，实际没落地 | 降级产物**必须**标 `DEGRADED: true` 字段 + 清晰 hint；单测覆盖猫的感知口径 |
| 仪表板数据隐私（露出 catId × tool 组合） | 当前只铲屎官自己用，不是多租户。F077 落地时再评估脱敏 |
| Phase B 迁移期双 backend 并存导致 invocation id collision | 迁移期 memory + redis 同时写，read-through 优先 redis，迁移完成切 redis-only |
| `stale_invocation` 被错算成 401，仪表盘低估真实失败面 | Phase A 把 `stale_invocation` 作为独立 reason，D1 单独 emit |
| Compat window 永生（legacy body/query fallback 删不掉） | Phase F 设硬 deadline，即使命中率非零也按 deadline 切 |
| Mixed-version rollout：新 MCP client（要求结构化 reason）打到老 API（仍返非结构化 401） → 401 全部被算作 "non-degradable"，rich block 等无法走 Route B | (i) #509 已合 + intaked，第一方 API 都是新版；(ii) Phase E 发布时在 release notes 写明客户端最低 API 版本；(iii) 监控未识别 401 的命中率，超阈值再补 server 探测降级 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase B 用 Redis Hash + EXPIRE，不要 Streams 当真相源（如要 audit 副写 stream） | ✅ resolved → KD-5 |
| OQ-2 | Phase C refresh 改按 TTL 比例 `clamp(ttl/4, 5m, 30m)` + jitter，不写死 30min | ✅ resolved → KD-6 |
| OQ-3 | Phase E 降级 = framework + 每工具显式 `degradePolicy`（含 `none`） | ✅ resolved → KD-7 |
| OQ-4 | Phase D telemetry 不直接写 Knowledge Feed（只在阈值触发后人工沉淀） | ✅ resolved → KD-8 |
| OQ-5 | L4 Bearer 标准化独立 Feature，不在 F174 抢戏 | ✅ resolved → KD-9 |
| OQ-6 | Legacy fallback 删除策略：停 first-party dual-write → 统计 fallback-only → 零命中一个 release window + 硬 deadline | ✅ resolved → KD-10 |
| OQ-7 | Phase B 迁移期是否要 dual-backend（memory + redis 同时写）？还是直接切 redis 配回退 env？ | ⬜ 实施时定，倾向后者 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 只做 L2 + L3 残尾，L5 / Bearer 列 follow-up | 一次做四层=过载，分层立项减少 blast radius | 2026-04-23 |
| KD-2 | Phase B 用 Redis 而非 SQLite | 6398/6399 已有基建，in-memory → Redis 是 `InvocationRegistry.ts:47` 注释里就写明的 Phase 3 计划 | 2026-04-23 |
| KD-3 | 降级 framework 化而非每工具单独补 | 避免 rich block 成为孤例，后续新 callback tool 自动继承 | 2026-04-23 |
| KD-4 | **加 Phase A — 结构化失败原因作为前置**，下游 D/E 全部依赖 | 否则下游被迫 regex 字符串匹配，做歪后改成本更大（缅因猫 review） | 2026-04-23 |
| KD-5 | Phase B 用 **Hash + Lua 原子操作**（参照 `RedisInvocationRecordStore.ts`），不用 Streams 当真相源；audit 副写 stream | 热路径全是点查不是 replay-first（缅因猫 OQ-1 立场） | 2026-04-23 |
| KD-6 | Phase C refresh 客户端用 `clamp(ttlRemainingMs/4, 5m, 30m)` + jitter，不 hardcode 30min | TTL 调整时算法自适应，不用追客户端（缅因猫 OQ-2 立场） | 2026-04-23 |
| KD-7 | Phase E 降级 = framework + 每工具**显式** `degradePolicy`（含 `none`） | 不假装每个工具都能优雅降级，诚实 + 系统化（缅因猫 OQ-3 立场） | 2026-04-23 |
| KD-8 | Telemetry **不直接写 Knowledge Feed**，只人工沉淀阈值触发后的 pattern | 避免 401 噪音淹没 Feed（缅因猫 OQ-4 立场） | 2026-04-23 |
| KD-9 | L4 Bearer 标准化降为附注、独立立项 | 当前深度绑定 X-* + legacy body/query，Bearer 解决不了核心痛点只扩大迁移面（缅因猫 OQ-5 立场） | 2026-04-23 |
| KD-10 | Legacy fallback 删除：停 first-party dual-write → 统计 fallback-only → 零命中一个 release window + **硬 deadline** | 防 compat window 永生（缅因猫 OQ-6 立场） | 2026-04-23 |
| KD-11 | Phase 顺序：A → B → C → D1 → E → D2 → F | 根因先治、补丁后做；不在 B 落地前做大面积降级和面板（缅因猫提出） | 2026-04-23 |
| KD-12 | `stale_invocation` 在 reason taxonomy 单列，单独 emit | 体感等同 401 但被埋没；现已有 `post_message`/schedule 单独识别的先例（缅因猫补充） | 2026-04-23 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-23 14:48 | 立项（布偶猫 Opus-47 主笔，铲屎官拍板） |
| 2026-04-23 15:23 | @缅因猫 GPT-5.4 跨家族独立 review，全部接受 6 项立场 + 整体重排 + 加 Phase A |
| 2026-04-23 15:46 | spec 收敛 v2（含 KD-4~12），等铲屎官拍板最终方案后启动 Phase A |
| 2026-04-23 16:00 | Phase A 实施完成（commits cb85ac1c0 + 640d154fe + 534b22daa + 3c8b024d2 on `feat/f174-phase-a-failure-reasons`），ready for PR |
| 2026-04-23 16:24 | @缅因猫 GPT-5.4 cross-family review of Phase A → **PASS**（self-reran 36/36 + 45/45 tests）。Two non-blocking reminders → addressed in 3c8b024d2: shared reason taxonomy + contract test (drift prevention); mixed-version rollout note added to Risk |
| 2026-04-23 22:20 | **Phase A merged via PR #1359** (squash commit `ef1c83c4`)，cloud Codex review: "no major issues, chef's kiss"，跨家族 review 全部延续到 final HEAD `74926347` |
| 2026-04-24 03:35 | **Phase B merged via PR #1363** (squash commit `ca738c8f0`)，cloud Codex review: "Didn't find any major issues"，跨家族 gpt52 PASS + 3 P2 全处理（1 push-back + 2 fixed） |
| 2026-04-24 13:28 | **Phase C merged via PR #1368** (squash commit `226ea4a4`)，cloud Codex review: "Bravo"，14 轮 cloud P0/P1/P2 全处理（route-level cooldown via preValidation peek+claim+verifyLatest，atomic backend port methods peek/verifyLatest/tryClaimRefreshCooldown，MCP client adaptive refresh loop with AbortSignal.timeout + signal exit code 128+signum + cooldown-safe MIN_DELAY，memory cooldown map 硬封顶 derived from instance maxRecords + existing-check-first eviction，Redis msgs key TTL slide on verifyLatest，refresh-token emits missing_creds locally，tests split under 350-line cap） |
| 2026-04-24 21:28 | **Phase D1 merged via PR #1377** (squash commit `201a0742`)，cloud Codex review: "Tada"，6 轮 P1 全处理（debug endpoint owner-gate progressive hardening: public→owner-gate→explicit-identity→reject-spoofed-header→browser-needs-session→drop-DEFAULT_OWNER_USER_ID-mismatch→two-layer-with-default→fail-closed-explicit-required，最终 mirror config.ts sensitive-env pattern：require explicit DEFAULT_OWNER_USER_ID + session match） |

## Review Gate

- **Discussion**：✅ 立项后 @缅因猫 独立思考 → 收敛（spec v2 已落 KD-4~12）→ 待铲屎官拍板最终 scope
- **Phase A**：跨家族 review（@缅因猫 owner-area），reason taxonomy 完整性是重点
- **Phase B**：跨家族 review，Redis schema + 迁移兼容是重点
- **Phase C**：跨家族 review，refresh 频率算法 + rate limit 是重点
- **Phase D1**：跨家族 review，reason taxonomy 与 A 对齐
- **Phase E**：跨家族 review，degradePolicy framework 边界是重点
- **Phase D2**：内部 review 即可（只读仪表板）
- **Phase F**：clean-up，scope 内 review 即可

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **社区 PR** | `clowder-ai#509` (https://github.com/zts212653/clowder-ai/pull/509) | Transport 层源头，MERGED |
| **自家 intake** | `0552b245a`（commit） | 吸收 #509 transport |
| **自家 refactor** | `#1263 refactor(callbacks): unify actor and scope helpers` | L3 Authority 层 |
| **源代码** | `packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts` | L2 主战场，in-memory → Redis |
| **源代码** | `packages/api/src/routes/callback-auth-prehandler.ts` | #509 preHandler，Phase A reason 字段 + Phase C refresh 入口 |
| **源代码** | `packages/api/src/routes/callback-scope-helpers.ts` | #1263 产物，Phase F 残尾收口位置 |
| **源代码** | `packages/api/src/routes/callback-errors.ts` | `EXPIRED_CREDENTIALS_ERROR` 当前唯一错误，Phase A 拆分起点 |
| **源代码** | `packages/mcp-server/src/tools/callback-tools.ts` | Route B 降级原型 + 客户端 callbackPost；Phase A/E 起点 |
| **源代码** | `packages/mcp-server/src/tools/callback-retry.ts` | retry 只处理 408/429/5xx；401 不兜（Phase E 不动它） |
| **源代码** | `packages/mcp-server/src/tools/callback-outbox.ts` | outbox 同样只处理 408/429/5xx |
| **参考实现** | `packages/api/src/domains/cats/services/stores/redis/RedisInvocationRecordStore.ts` | Hash + Lua 原子操作范式（Phase B 参照） |
| **Feature** | `docs/features/F016-codex-oauth-memory-loop.md` | invocation-token 起源 |
| **Feature** | `docs/features/F061-antigravity-bengal-cat.md` | Bug-H persistent MCP write-path auth（远房亲戚） |
| **Feature** | `docs/features/F077-multi-user-secure-collaboration.md` | 依赖 F174 持久化 |
