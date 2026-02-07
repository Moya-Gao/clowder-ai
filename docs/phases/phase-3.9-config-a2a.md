# Phase 3.9: 配置可见性 + A2A 猫猫互调

> 布偶猫 (Opus 4.6) | 2026-02-07
> 状态: **计划中** — OQ-1~4 + 并发分析 (OQ-5~7) 已完成, 待猫猫 review
> 前置: Phase 3.8 完成 (395 tests), 缅因猫 review 通过
> 来源: 铲屎官洞察 + 4.5 布偶猫讨论 (`docs/discussions/2026-02-07-context-enginnering/`)
> 并发挑战: 4.5 布偶猫提出 (`docs/discussions/2026-02-07-context-enginnering/a2a-concurrency-challenge.md`)
> 预估测试: ~30 新增, 总计 ~425 tests

---

## 为什么做这个 Phase？

铲屎官在狼人杀测试后的洞察 (原话):

> "为什么我会不知道大家的截断这回事？为什么很多配置我根本不知道？
> 配置不可见，铲屎官都不知道你们做了这些预算的默认值是什么，
> 我们启动生效的是什么，似乎需要做一个配置页面，能让我看见和修改？"
>
> "要增加猫猫互相调用的@能力？比如布偶猫写完了他的bug
> 直接@缅因review 缅因review完@布偶"

两个核心痛点:
1. **配置不可见** (F1, P2): 55+ 配置散落在 15+ 文件，铲屎官不知道截断长度、超时时间等
2. **铲屎官是人肉路由器** (F2, P1): 猫 A 做完要铲屎官手动 @ 猫 B 接力

---

## F1: 配置可见性 — `/config` 命令

### 决策过程

| 方案 | 优点 | 缺点 | 决定 |
|------|------|------|------|
| 配置页面 (React) | 直观, 可修改 | 前端工作量大, 需要 PATCH API | 延后 |
| `/config` 聊天命令 | 最快, 复用现有 UI | 只读, 格式受限 | **MVP 选这个** |
| 启动日志 | 零前端改动 | 铲屎官要看终端 | 可以顺便做 |

BACKLOG 也写了 "/config 命令最快"。

### 配置值清单 (探索发现 55+ 项, 按铲屎官最关心的分组)

| 类别 | 关键配置 | 当前默认 | 环境变量 |
|------|---------|---------|---------|
| **上下文 (最容易踩坑)** | | | |
| | maxMessages (历史条数) | 20 | `CONTEXT_HISTORY_LIMIT` |
| | maxContentLength (每条截断) | 1500 | `MAX_CONTEXT_MSG_CHARS` |
| | maxTotalChars (总上下文) | 8000 | — |
| | maxPromptChars (总 prompt) | 32000 | `MAX_PROMPT_CHARS` |
| **CLI** | | | |
| | timeout | 300s (5min) | — |
| | killGrace (SIGTERM→SIGKILL) | 3s | — |
| **存储** | | | |
| | messageTTL | 7天 | — |
| | threadTTL | 30天 | — |
| | maxMessages (内存) | 2000 | — |
| | maxThreads (内存) | 100 | — |
| **上传** | | | |
| | maxFileSize | 10MB | — |
| | maxFiles | 5 | — |
| **服务器** | | | |
| | port | 3002 | `API_SERVER_PORT` |
| | host | 127.0.0.1 | `API_SERVER_HOST` |
| | Redis | 自动检测 | `REDIS_URL` |
| **猫配置** | | | |
| | provider/model/personality | cat-config.json | `CAT_CONFIG_PATH` |

### F1 实现方案

- 后端: `ConfigRegistry.collectConfigSnapshot()` 纯函数 → `GET /api/config`
- 前端: `handleSend` 拦截 `/config` → fetch → 系统消息展示
- ChatMessage 添加 `variant: 'info'` → 蓝灰色 (区别于红色 error)

---

## F2: A2A 猫猫互调 — Agent-to-Agent @Mention

### 用户期望的流程

```
铲屎官: @布偶 写这个 bug 的修复
布偶猫: [写代码...] 写完了，@缅因猫 请 review
  → 系统自动调用缅因猫
缅因猫: [review...] 发现 2 个问题，@布偶猫 建议修复
  → 系统自动调用布偶猫
布偶猫: [修复...] 已修复
  → 无更多 @mention, 链条结束
```

### 决策过程

| 决策 | 选择 | 理由 |
|------|------|------|
| 在哪检测 mention? | `routeSerial()` 内, 猫回复累积完毕后 | 自然插入点, 不改 AgentRouter 接口 |
| 如何调用? | 递归 `yield* routeSerial()` | 复用全部管线 (身份注入/MCP/上下文/存储) |
| 防死循环? | `invocationDepth` 计数器, 默认上限 2 | 用户→猫A→猫B→停止; `MAX_A2A_DEPTH` env 可调 |
| 并行模式触发? | 不触发 | ideate 模式是独立观点采样, 不应链式调用 |
| 自调用? | 过滤 | 猫不能 @ 自己 |
| 前端显示? | `a2a_handoff` 事件 → 蓝色 info 系统消息 | 复用 variant: 'info' |

### 已有基础设施 (不需要重建)

| 设施 | 位置 | 用途 |
|------|------|------|
| `parseMentions()` | `AgentRouter.ts:72` (私有) | 检测 @mention pattern |
| `findCatByMention()` | `shared/types/cat.ts` (导出) | 文本中找猫 |
| `mentionPatterns` | `CAT_CONFIGS[*].mentionPatterns` | @opus/@布偶/@ragdoll 等 |
| `StoredMessage.mentions` | `MessageStore.ts:31` | 已有字段, 当前猫消息=`[]` |
| `addParticipants()` | `ThreadStore.ts` | 动态添加线程参与者 |
| `routeSerial()` | `route-strategies.ts` | 串行多猫, 含身份注入/MCP/上下文 |
| `previousResponses` | `route-strategies.ts:54` | 前序猫回复传递给后续猫 |

### A2A 核心设计: 递归 routeSerial

```
routeSerial(deps, [opus], userMsg, ..., depth=0)
  → opus 回复 "写完了 @缅因猫 请review"
  → parseA2AMentions(text, 'opus') → ['codex']
  → depth(0) < MAX(2) → 触发 A2A
  → yield { type: 'a2a_handoff', content: '布偶猫 → 缅因猫' }
  → yield* routeSerial(deps, [codex], userMsg, ..., depth=1)
    → codex 回复 "review 完了 @布偶猫 建议修复"
    → parseA2AMentions(text, 'codex') → ['opus']
    → depth(1) < MAX(2) → 触发 A2A
    → yield { type: 'a2a_handoff', content: '缅因猫 → 布偶猫' }
    → yield* routeSerial(deps, [opus], userMsg, ..., depth=2)
      → opus 回复 "已修复"
      → parseA2AMentions → ['codex'] (如果有)
      → depth(2) >= MAX(2) → 停止, 不再触发
```

递归 `routeSerial` 会为每只新猫自动:
- 构建身份 system prompt (via `buildSystemPrompt`) ✅
- 注入 MCP callback (via `McpPromptInjector`) ✅
- 传递 `previousResponses` (前序猫的回复) ✅
- 拼接 contextHistory (对话历史) ✅
- 存储回复到 messageStore ✅
- yield 消息到 WebSocket (前端实时看到) ✅

---

## 待讨论的开放问题

### OQ-1: @mention 误触发

猫在回复中提到另一只猫的名字但并非要调用它:
> "布偶猫之前说的那个方案我同意" — 这里提到了布偶猫但不是要 @调用

**当前 MVP 方案**: 接受误触发, depth limit 兜底 (最多多调 2 次)。

**备选方案**:
- a) 要求猫必须用 `@` 前缀才算 mention (改 pattern matching)
- b) 猫在 system prompt 中被告知 "如果要调用另一只猫, 请明确使用 @猫名"
- c) 添加 `[A2A:skip]` tag 让猫主动关闭
- d) 铲屎官开关: 全局 `A2A_ENABLED=true|false`

### OQ-2: A2A 与 isFinal 的关系

当前 `isFinal` 标记在多猫最后一只完成时设置。
A2A 链会追加新猫到链条中。`isFinal` 逻辑需要确保:
- A2A 链未结束时前端 `isLoading` 保持 true
- 整条 A2A 链的最后一只猫才是 `isFinal`

**可能需要**: 在 routeSerial 递归出口处 yield 一个带 `isFinal: true` 的 done。

### OQ-3: A2A 链中的 `contextHistory` 是否需要重建?

当前设计: A2A 链递归 routeSerial 时传递原始 `contextHistory` (包含用户消息前的历史)。
猫 A 的回复通过 `previousResponses` 机制传递给猫 B。
但猫 B 看到的 contextHistory 不包含猫 A 的回复 (因为 contextHistory 在 AgentRouter.route() 级别组装, 而 A2A 是在 routeSerial 内部触发的)。

**是否 OK?** 猫 B 通过 `previousResponses` 直接看到猫 A 的回复, 语义上已足够。
但如果链更长, 中间猫的回复可能被遗漏。depth=2 时最多 3 只猫, 风险有限。

### OQ-4: Google A2A 协议参考

铲屎官在讨论中提到了 Google 的 Agent-to-Agent 协议。
我们的 @mention 方式是否与行业方向一致?
这个属于 BACKLOG D1 的讨论范畴, 不阻塞 MVP 实施。

---

## 并发场景分析 (4.6 布偶猫回应)

> 回应: 4.5 布偶猫 + 铲屎官提出的并发挑战
> (`docs/mailbox/2026-02-07-a2a-concurrency-review-to-opus46.md`)
> (`docs/discussions/2026-02-07-context-enginnering/a2a-concurrency-challenge.md`)

### 铲屎官的原始问题

> "三只猫都在输出，但是我们的暹罗先输出了然后 @了你！
> 此时你正在输出回答铲屎官！
> 对于你你到底是什么样的行为？！"

这是一个好问题。4.5 布偶猫据此分析了 5 个并发噩梦场景、3 个架构方案 (队列/任务图/事件驱动)，
并建议补充 OQ-5~7。

### 核心论点: 并行模式和 A2A 是互斥的

关键分支在 `AgentRouter.route()` (`AgentRouter.ts:205-213`):

```typescript
if (intent.intent === 'ideate' && targetCats.length > 1) {
  yield* routeParallel(...);   // 只有 ideate + 多猫
} else {
  yield* routeSerial(...);     // 其他所有情况
}
```

我的 A2A 设计的核心约束:
- **A2A 只在 `routeSerial` 中触发**
- **`routeParallel` 不触发 A2A** (只存储 mentions 字段, 不自动调用)

这意味着 4.5 猫猫的并发场景需要逐一重新审视。

### 逐场景分析

#### 场景 1 & 2: "正在输出时被 @" / "连续被多猫 @"

4.5 的假设:
```
T0: 铲屎官 @布偶 @缅因 @暹罗 "你们好！"
T1: 三猫并行输出...
T2: 暹罗先完成 → "@布偶 你觉得呢？"
T3: 布偶还在输出！
```

**实际发生什么？** 取决于 intent:

**情况 A: 没有 `#brainstorm` tag (默认 execute 模式)**
→ `routeSerial` → 三猫**依次执行** (布偶→缅因→暹罗)
→ 暹罗在布偶和缅因都完成后才开始
→ **没有并发冲突**, 因为同一时刻最多一只猫在运行

**情况 B: 有 `#brainstorm` tag (ideate 模式)**
→ `routeParallel` → 三猫并行
→ 暹罗说 "@布偶 你觉得呢？" 这个 mention **只存储不触发 A2A**
→ 这是 **by design**: ideate = 独立观点采样, 不是协作链

**结论: 场景 1 & 2 不会发生。**

#### 场景 3: "循环 @ / 死锁" (A @B, B @A 同时发生)

4.5 的假设: 两只猫同时 @ 对方。

**不可能。** `routeSerial` 是严格串行执行 — 一只猫完成后下一只才开始。
时间线只能是:

```
A 完成 → 检测 @B → B 开始 → B 完成 → 检测 @A →
A 开始 (depth+1) → A 完成 → depth=MAX → 停止
```

两只猫永远不会同时运行。`invocationDepth=2` 硬上限确保最多 3 次调用后停止。

**结论: 死锁不可能发生。循环由 depth limit 终止。**

#### 场景 4: "铲屎官插话" (猫正在处理 A2A, 铲屎官发新消息)

这和 A2A 无关 — 现有 `InvocationTracker` 已处理:
- 铲屎官新消息 → POST /api/messages → 新 invocation
- `InvocationTracker` 取消旧 invocation (含 A2A 链)
- AbortSignal 传播 → `signal?.aborted` 检查触发退出
- Phase 3.3b 就做好了 (`ae7bbc2`)

**结论: 已有机制覆盖, 不需要新增。**

#### 场景 5: "取消与超时" (取消后队列里还有任务)

同场景 4。`InvocationTracker.cancel(threadId)` 通过 AbortController 取消整个调用链。
没有"队列", 因为串行执行时同一时刻最多一只猫在运行。

**结论: 不存在队列, 取消即终止整条链。**

### OQ-5~7 回应

4.5 布偶猫建议补充 3 个 OQ:

#### OQ-5: 并行模式下猫 @正在输出的猫, 如何处理?

**回答: 不会发生。**
- execute 模式 = 串行, 同一时刻最多一只猫在运行, 无并发冲突
- ideate 模式 = 并行, 但 A2A 不触发, mention 只存储不调用
- 这两个模式互斥: `AgentRouter.route()` 的 if/else 分支确保

#### OQ-6: 是否需要消息队列? 选型?

**回答: MVP 不需要。** 因为:
1. execute 模式 = 串行: 同一时刻最多一只猫在运行, 不存在排队问题
2. ideate 模式 = 不触发 A2A: 并行猫的 @mention 只记录不触发
3. 新消息取消旧链: `InvocationTracker` + AbortSignal 已覆盖

消息队列只在以下**未来场景**才需要:
- 多 thread 并行处理 (当前一个 thread 一个 invocation)
- ideate 结束后触发 A2A follow-up (当前不做)
- 异步任务分发 (Phase 4+ 范畴)

如果未来需要, 最可能的选型:
- 内存队列 (per-cat Map + 处理循环), 复杂度最低
- Redis List (跨进程持久化), 需要引入新的存储模式

登记为 BACKLOG 讨论议题, 不阻塞 Phase 3.9。

#### OQ-7: 死锁预防 (A @B, B @A 同时发生)?

**回答: 串行执行不会死锁。**
- `routeSerial` 中猫是一只接一只执行的
- A @B → B @A 是**顺序**发生, 不是同时发生
- `invocationDepth` 硬上限 2 → 最多 3 次调用 (user→A→B→停止 或 user→A→B→A→停止)
- 即使出现看似"循环"的 @mention, depth limit 也会终止链条

### 总结: 为什么不需要调整 Phase 3.9 范围

```
4.5 的分析假设:    A2A 可能在并行模式下触发 → 并发噩梦
实际的架构约束:    A2A 只在串行模式下触发 → 不存在并发

关键安全网:
1. execute 模式 = routeSerial = 严格串行 → 无并发冲突
2. ideate 模式 = routeParallel = 不触发 A2A → 无 A2A 并发
3. invocationDepth limit = 2 → 最多 3 次调用后强制停止
4. signal?.aborted 检查 → 每只猫启动前检查取消信号
5. InvocationTracker → 新消息/用户取消 → AbortSignal 终止整条链
6. 自调用过滤 → 猫不能 @ 自己
```

4.5 猫猫的分析在**抽象层面**是正确的: 如果我们未来允许并行模式触发 A2A,
确实需要队列/锁/DAG。但在当前 MVP 设计中, 并行和 A2A 互斥,
这些复杂度不会出现。

**值得登记到 BACKLOG 的未来方向:**
如果后续需要"brainstorm 结束后自动分配 follow-up" (类似 Phase 4 的 deliberate 模式),
那时才需要重新考虑 4.5 分析中的队列架构。

---

## 实现步骤 (待确认后实施)

| Step | 内容 | 新 Tests | 涉及文件 |
|------|------|----------|---------|
| 1 | ConfigRegistry + GET /api/config | +8 | 2 新, 2 改 |
| 2 | 前端 /config 命令 + info variant | 0 | 3 改 |
| 3 | A2A mention 检测工具 | +10 | 1 新 |
| 4 | routeSerial A2A 集成 + mention 存储 | +10 | 2 改 |
| 5 | 前端 A2A handoff 显示 | 0 | 1 改 |
| 6 | 集成测试 + BACKLOG 更新 | +3 | 1 新, 1 改 |
| **合计** | | **~31** | 4 新, 9 改 |

---

## 风险评估

| 风险 | 级别 | 缓解 |
|------|------|------|
| A2A 死循环 | 高 | `invocationDepth` 硬上限 2; 自调用过滤; `signal?.aborted` 检查 |
| 费用爆炸 | 高 | depth 2 = 最多 3 次 CLI 调用 (~$0.03-0.30), 可接受 |
| @mention 误触发 | 中 | → **OQ-1 待讨论** |
| isFinal 时序 | 中 | → **OQ-2 待讨论** |
| 并行模式并发冲突 | ~~高~~ → **不适用** | A2A 只在 routeSerial 中触发, routeParallel 不触发 (见并发分析) |
| 需要消息队列 | ~~高~~ → **不适用** | 串行执行无排队需求; 未来 Phase 4+ 若需要再评估 |
| routeSerial 递归栈 | 低 | max depth 2, async generator 不占栈 |
| 配置快照泄露 | 低 | Redis URL 只显示连接状态 |

---

*布偶猫 🐾 2026-02-07*
*— 计划完成 + 并发分析完成 (回应 4.5 布偶猫 + 铲屎官的 5 场景挑战)*
*— 结论: MVP 范围不需要调整, 并行和 A2A 互斥, 串行执行无并发冲突*
*— 待猫猫 review 后开始实施*
