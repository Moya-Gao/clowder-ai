---
feature_ids: [F174]
related_features: [F016, F061, F077, F086, F098, F102]
topics: [auth, mcp, infrastructure, reliability, telemetry]
doc_kind: spec
created: 2026-04-23
---

# F174: Callback Auth Lifecycle & Resilience — 鉴权基础设施持久化、降级与标准化

> **Status**: spec | **Owner**: 布偶猫（Opus-47）| **Priority**: P1

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

**为什么现在做**：#509（社区 mindfn，MERGED + intaked）+ #1263（自家 refactor，MERGED）已经把 **Transport 层（header 迁移）+ Authority 层（actor/scope helpers）** 完成了。现在缺的就是 **Lifecycle 层** —— 再不做，砚砚会继续撞 401，铲屎官会继续撞"干活半小时 token 过期"。

**非作用域**（刻意排除）：
- 不改 MCP 协议本身（协议只规定 transport，我们调的是我们自己 server 的鉴权实现）
- 不做多用户隔离（那是 F077）
- 不做跨 MCP 身份联邦（飞书/pencil/claude-in-chrome 各自 OAuth，是 L5 未来层，不是 L2）

## What

### Architecture Map — Callback Auth 五层视图

把零散修复装进完整骨架，每一刀知道自己解决哪一层：

| 层 | 关注点 | 现状 | 归属 |
|---|---|---|---|
| **L5 Identity Federation** | 跨 MCP 身份代理（飞书 OAuth / pencil / claude-in-chrome 等） | 各管各的，无 broker | **Future**（F143 hostable runtime 推进后再立） |
| **L4 Standard Scheme** | `Authorization: Bearer` 标准化，取代自定义 `X-*` header | custom header 可用 | **Future**（对外暴露 / canary 场景触发时立） |
| **L3 Authority & Scope** | actor 派生 + Bound/Scoped/Strict 写入语义 | ✅ #1263 完成，`callback-scope-helpers.ts` | **F174 Phase E 收残尾** |
| **L2 Lifecycle & Resilience** | TTL / refresh / 持久化 / 降级 / telemetry | ❌ **主战场** | **F174 Phase A-D** |
| **L1 Transport** | header 传输 + 统一 preHandler + fail-closed | ✅ #509 完成 | — |

本 Feature 聚焦 **L2（主）+ L3 残尾（附）**。L4/L5 作为 follow-up feature，不混进来。

---

### Phase A: InvocationRegistry Persistence — Redis 化

把 `InvocationRegistry` 从 `Map<string, InvocationRecord>` 迁到 Redis（6399 主 / 6398 worktree），API 进程重启 / 部署 / 崩溃不再丢 token。

**设计要点**：
- Redis key schema：`cat-cafe:invocation:{invocationId}` → JSON（`catId`/`userId`/`threadId`/`callbackToken`/`parentInvocationId?`/`a2aTriggerMessageId?`/`clientMessageIds[]`）
- `EXPIREAT` 绑定 `expiresAt`，Redis 原生 TTL 清理（不再靠 in-process `cleanup()`）
- `verify()` 原子扩展 TTL：`GETEX EX {ttl_seconds}` 一步刷 TTL + 取值，避免 race condition
- `latestByThreadCat` 用独立 Redis key：`cat-cafe:invocation-latest:{threadId}:{catId}`，原子 SET
- `clientMessageIds` 用 Redis Set + 有界清理（SCARD > MAX 时 SPOP 最老）—— 原 `MAX_CLIENT_MESSAGE_IDS = 1000` 保持
- LRU 500 上限不再需要（Redis TTL 自动回收）

**环境适配**：
- Worktree/test：`REDIS_URL=redis://127.0.0.1:6398`（隔离）
- Main/prod：`REDIS_URL=redis://127.0.0.1:6399`（圣域，铁律 #1）
- Test 隔离：复用 `scripts/with-test-home.sh` 起临时 Redis，不接主环境

**向下兼容**：环境变量 `CAT_CAFE_INVOCATION_REGISTRY=memory|redis`（默认 `redis`），回退 memory 以便回滚 / 早期调试。

---

### Phase B: Explicit Refresh Endpoint — 主动续期

新增 `POST /api/callbacks/refresh-token`，MCP 客户端能主动续期而不依赖工具调用触发 sliding window。

**契约**：
- 请求：`{ invocationId, callbackToken }`（header 传递，遵循 #509 scheme）
- 响应：`200 { expiresAt: number }` / `401 expired or invalid`
- 行为：等价于一次"空 verify"，成功则 TTL 滑到 now + 2h
- 客户端：`packages/mcp-server/src/` 加一个后台定时器（每 30min 调 refresh 一次），让长 session 的 MCP 客户端不会被动过期
- 文档：在 `get_rich_block_rules` / tool description 里说明，让社区 fork 和外部 MCP consumer 也能用

**为什么需要**：当前只有 `verify()` 滑 TTL，如果客户端长时间没工具调用（纯思考 / 外部等待），2h 到了就死。refresh 给了一个"心跳"口子。

---

### Phase C: Graceful Degradation — Route B 泛化

把 `create_rich_block` 的 `cc_rich` 文本嵌入降级模式（`callback-tools.ts:426-441`）**泛化为 framework**，覆盖更多工具：

**Framework 设计**：
```typescript
interface CallbackDegradation<T> {
  route: 'A' | 'B';
  execute(): Promise<T>;
  fallback(error: CallbackError): DegradeResult<T> | null;
}
```

**Phase C1（P1 优先覆盖）**：
- `post_message` → 失败时返回可粘贴的 `/cc_post` 指令 + 原始内容，猫可以手动执行（或引导铲屎官介入）
- `register_pr_tracking` → 失败时返回"请手动执行 `gh pr ...` 或通知铲屎官"的结构化 hint
- `update_task` → 失败时返回 task URL + 手动更新指令

**Phase C2（P2，可选）**：
- `retain_memory_callback` → 失败时把 memory candidate 输出为 rich block，让铲屎官决定是否手工 retain
- 其它写类 callback 按频率评估

**关键约束**：降级 **只在 401/403/network 时触发**，5xx 走 retry（`callback-retry.ts` 现有逻辑不动）。降级产物必须显式告知猫"这是降级输出，需要后续动作"，避免猫误认为已成功。

---

### Phase D: Telemetry — 401 率仪表板

给 callback 鉴权加可观测性，后续设计/调参有数据。

**数据模型**：
- 指标：`callback_auth_failures_total{tool, cat, reason}` — counter
- reason 枚举：`expired` / `invalid_token` / `missing_creds` / `unknown_invocation`
- 每次 `verify()` 返回 null 时打点；preHandler 401 时打点
- 输出：Hub 已有的 `/api/debug/metrics` 或独立 `/api/debug/callback-auth` endpoint

**UI**：
- Workspace 诊断面板加一个"Callback Auth Health"卡片
- 显示近 24h 401 率、Top 3 失败工具、Top 3 受影响猫
- **不是**实时 monitoring（这不是 oncall 级），是设计决策数据源

**Owner 视角**：如果 Phase A-C 都做完后 Dashboard 上 401 率还高，说明有**别的**根因，那时候有数据再决定下一刀。

---

### Phase E: L3 残尾收口

清理 #509/#1263 follow-up 里我 review 点名但还没落地的尾巴：

- `schedule.ts:127` 的 `body.createdBy ?? 'unknown'` 兜底 → 切到 `deriveCallbackActor()`
- `thread-context` 读权限语义收口（review request 第 7 条 open question）—— 如果这块语义太复杂，单独开子任务，不绑进 F174 主流程
- `callback-auth-schema.ts` 是否还能删（#509 保留了 legacy fallback，deprecation window 该结束了吗？） → 查 deprecation 日志命中率决定

**这个 Phase 是 clean-up，不是 new feature**，工作量小，可以在 Phase A-D 的任何间隙做。

---

## Acceptance Criteria

### Phase A（Persistence）
- [ ] AC-A1: `InvocationRegistry` 支持 Redis backend，key schema 设计文档写在 `docs/features/F174-redis-schema.md`（子文档）
- [ ] AC-A2: `verify()` / `create()` / `isLatest()` / `claimClientMessageId()` 全部走 Redis，通过现有 `InvocationRegistry.test.ts` + 新增集成测试
- [ ] AC-A3: API 进程重启后，活跃 invocation 仍可 `verify()` 成功（集成测试：启-停-启 + verify 流程）
- [ ] AC-A4: `CAT_CAFE_INVOCATION_REGISTRY=memory` 回退可用（回滚保险）
- [ ] AC-A5: Worktree 用 6398，main 用 6399，不误触圣域（Redis config test）

### Phase B（Refresh）
- [ ] AC-B1: `POST /api/callbacks/refresh-token` 端点落地，header 传 creds，fail-closed 401
- [ ] AC-B2: MCP 客户端后台定时 refresh（每 30min），长 session 不再被动过期
- [ ] AC-B3: refresh 失败（401）时客户端不 crash，记录 warn 日志

### Phase C（Degradation）
- [ ] AC-C1: `CallbackDegradation` framework 抽出到 `callback-tools.ts`，有单测
- [ ] AC-C2: `post_message` / `register_pr_tracking` / `update_task` 三个工具接入 framework
- [ ] AC-C3: 降级产物的 hint 格式对猫友好（rich block 可解析 or 纯文本可粘贴）
- [ ] AC-C4: 5xx 仍走 retry，不触发降级（regression test）

### Phase D（Telemetry）
- [ ] AC-D1: `callback_auth_failures_total` 指标上线
- [ ] AC-D2: `/api/debug/callback-auth` 端点返回结构化数据
- [ ] AC-D3: Workspace 诊断面板加 "Callback Auth Health" 卡片，显示 24h 401 率 + Top 工具 + Top 受影响猫

### Phase E（L3 残尾）
- [ ] AC-E1: `schedule.ts` 不再从 body 读 `createdBy` / `triggerUserId`
- [ ] AC-E2: `callback-auth-schema.ts` 删除或明确保留理由
- [ ] AC-E3: thread-context 读权限 open question 有结论（落地 or 转独立 feature）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "砚砚经常有 mcp pr tracking 挂不上 auth 过期" | AC-A1/A3 | 集成测试：模拟 API restart 后 verify 不 401 | [ ] |
| R2 | "我干活，然后干了半小时，然后要发语音，结果mcp和我说token过期" | AC-B1/B2 | 集成测试：长 session + refresh timer，voice callback 不 401 | [ ] |
| R3 | "站在架构层面完整的优化实现最佳方案 不当补锅匠" | 五层架构 + Phase A-E 完整拆分 | 本文 + 砚砚跨猫 review | [ ] |
| R4 | "#509：callback auth 基础设施统一/加固" | 本 Feature 命名 + Phase E 收口 #509 follow-up | #509 + #1263 + Phase E 三件合起来形成完整闭环 | [ ] |

### 覆盖检查
- [ ] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式（集成测试 / 回归测试 / 诊断面板 UI）
- [ ] 前端需求已准备需求→证据映射表（本 Feature 无前端 UX，Phase D 诊断面板是次要）

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

## Risk

| 风险 | 缓解 |
|------|------|
| Redis backend 引入 network latency，callback 延迟变大 | 用 pipeline / 批量，verify 目标 < 5ms；如超标回退 memory + 写透后端 |
| refresh endpoint 被滥用刷 TTL（恶意客户端） | rate limit：每 invocation 每 5min 最多 1 次 refresh；超限 429 |
| 降级 framework 让猫误认为操作成功，实际没落地 | 降级产物**必须**标 `DEGRADED: true` 字段 + 清晰 hint；单测覆盖猫的感知口径 |
| 仪表板数据隐私（露出 catId × tool 组合） | 当前只铲屎官自己用，不是多租户。F077 落地时再评估脱敏 |
| Phase A 迁移期双 backend 并存导致 invocation id collision | 迁移期 memory + redis 同时写，read-through 优先 redis，迁移完成切 redis-only |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase A 要不要用 Redis Streams 记录 invocation 生命周期事件（便于 audit / replay）？还是 Redis Hash + EXPIRE 就够？ | ⬜ 待砚砚意见 |
| OQ-2 | Phase B refresh 的频率（30min）是凭感觉定的，有没有更优雅的"按 TTL 比例"动态算法？ | ⬜ 待砚砚意见 |
| OQ-3 | Phase C 降级 framework 是否该做成 "每个 callback tool 显式声明 degrade strategy" 而不是 opt-in？这样 Phase C2 更系统 | ⬜ 待砚砚意见 |
| OQ-4 | Phase D telemetry 要不要写到 Knowledge Feed（F042 三层）？失败模式本身是知识 | ⬜ 讨论 |
| OQ-5 | L4 标准 Bearer scheme 要不要这次顺手做？还是确实独立 Feature 更清晰？ | ⬜ 倾向独立 |
| OQ-6 | 是否要 deprecation window 后删 legacy body/query fallback？还是永久保留？ | ⬜ 看 Phase D 数据 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 只做 L2 + L3 残尾，L4/L5 列 follow-up | 一次做五层=过载，分层立项减少 blast radius | 2026-04-23 |
| KD-2 | Phase A 用 Redis 而非 SQLite | 6398/6399 已有基建，in-memory → Redis 是 `InvocationRegistry.ts:47` 注释里就写明的 Phase 3 计划 | 2026-04-23 |
| KD-3 | 降级 framework 泛化而非每工具单独补 | 避免 rich block 成为孤例，后续新 callback tool 自动继承 | 2026-04-23 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-23 | 立项（布偶猫 Opus-47 主笔，铲屎官拍板） |
| 2026-04-23 | @砚砚 跨猫讨论（铲屎官要求各自立场 → 最终方案） |

## Review Gate

- **Discussion**：立项后 @砚砚 独立思考 + 我的方案 → 收敛 → 铲屎官拍板最终 scope
- **Phase A**：跨 family review（@codex 或 @gpt52），Redis schema + 迁移兼容是重点
- **Phase B**：跨 family review，refresh 频率 + rate limit 是重点
- **Phase C**：跨 family review，degradation framework 边界是重点
- **Phase D**：内部 review 即可（只读仪表板）
- **Phase E**：clean-up，scope 内 review 即可

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **社区 PR** | `clowder-ai#509` (https://github.com/zts212653/clowder-ai/pull/509) | Transport 层源头，MERGED |
| **自家 intake** | `0552b245a`（commit） | 吸收 #509 transport |
| **自家 refactor** | `#1263 refactor(callbacks): unify actor and scope helpers` | L3 Authority 层 |
| **源代码** | `packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts` | L2 主战场，in-memory → Redis |
| **源代码** | `packages/api/src/routes/callback-auth-prehandler.ts` | #509 preHandler，Phase B refresh 入口将接入这里 |
| **源代码** | `packages/api/src/routes/callback-scope-helpers.ts` | #1263 产物，Phase E 残尾收口位置 |
| **源代码** | `packages/mcp-server/src/tools/callback-tools.ts` | Route B 降级原型，Phase C 泛化起点 |
| **Feature** | `docs/features/F016-codex-oauth-memory-loop.md` | invocation-token 起源 |
| **Feature** | `docs/features/F061-antigravity-bengal-cat.md` | Bug-H persistent MCP write-path auth（远房亲戚） |
| **Feature** | `docs/features/F077-multi-user-secure-collaboration.md` | 依赖 F174 持久化 |
