# Phase 3.9: 配置可见性 + A2A 猫猫互调

> 布偶猫 (Opus 4.6) | 2026-02-07
> 状态: **计划确定** — 三猫讨论完成, 缅因猫 P1 已采纳, 待最终确认后实施
> 前置: Phase 3.8 完成 (395 tests), 缅因猫 review 通过
> 来源: 铲屎官洞察 + 三猫讨论 (见参考文档)
> 预估测试: ~30 新增, 总计 ~425 tests

### 参考文档

| 文档 | 内容 |
|------|------|
| `discussions/a2a-concurrency-challenge.md` | 4.5 布偶猫 + 铲屎官: 并发场景分析 (5 场景 + 3 架构方案) |
| `mailbox/a2a-concurrency-review-to-opus46.md` | 4.5 布偶猫 → 4.6: 并发提醒 + OQ-5~7 |
| `discussions/a2a-three-cats-synthesis.md` | 4.5 布偶猫: 三猫观点综合分析 + 决策建议 |
| `mailbox/a2a-risk-review-from-maine.md` | 缅因猫: 风险审计回信 (P1-1~3, P2-1~3) |
| `discussions/a2a-prompt-injection-design.md` | 4.5 布偶猫: Prompt 注入设计草稿 |

> 以上文档路径均在 `docs/` 下, discussions 指 `archive/2026-02/discussions/2026-02-07-context-enginnering/`, mailbox 指 `archive/2026-02/mailbox/2026-02-07/`。

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

### 三猫讨论后的最终决策

经过 4.6 布偶猫初版设计 → 4.5 并发挑战 → 三猫综合 → 缅因猫风险审计,
以下是整合后的决策。每条都标注了决策来源和 WHY。

| 决策 | 最终选择 | 初版设计 | 修改原因 |
|------|---------|---------|---------|
| **核心架构** | Worklist 扩展 routeSerial | 递归 routeSerial | **缅因猫 P1-1**: 递归会重置 `previousResponses` — 被 A2A 调用的猫看不到上一只猫说了什么。Worklist 在同一个调用内累积, `previousResponses` 天然连续。 |
| **isFinal 语义** | Worklist 末尾才 true | 递归出口 yield | **缅因猫 P1-2**: 递归每层 `targetCats=[1猫]` → 每段 done 都是 `isFinal:true` → 前端提前停 loading。Worklist 的 `isLastCat` 自然指向整条链的最后一只。 |
| **触发语法** | 行首 `^@猫名` + 忽略代码块 + 单目标 | 任意位置 mention, 接受误触发 | **缅因猫 P1-3 + 三猫共识**: 误触发的代价是不必要的 CLI 调用 (费用+延迟+用户困惑)。行首要求 + 代码块过滤大幅降低误触发率。每条回复只取第一个有效 A2A 目标, 防链爆炸。 |
| **深度限制** | depth=2 (`MAX_A2A_DEPTH` env) | depth=2 | **缅因猫 P2-1 支持**: 最常见闭环 (write→review→fix) 天然需要 2 跳。4.5 综合建议 depth=1, 但缅因猫论证 depth=2 更贴近实际需求。触发语法收紧 + 单目标已控风险。 |
| **并行模式触发** | 不触发 | 不触发 | **三猫共识**: ideate = 独立观点采样, 不应链式调用。4.6 论证并行和 A2A 互斥 → 缅因猫认可, 4.5 综合认可。这是 MVP 的安全边界。 |
| **Prompt 注入** | 仅 serial/execute 模式注入 A2A 能力提示 | 未明确 | **缅因猫 P2-2**: 若 ideate 模式也注入 A2A 提示, 猫输出 `@队友` 但不触发 → 用户困惑。serial 模式注入完整提示; ideate 模式要么不注入, 要么注入弱化版 ("此模式不自动触发")。 |
| **自动加 participants** | MVP 不加 | 未明确 | **缅因猫 P2-3**: 自动加入会影响后续无 @ 时的默认路由 (惊喜/惊吓)。A2A 是"内部协作", 不改变 thread 的参与者列表。 |
| **自调用** | 过滤 | 过滤 | 不变 |
| **前端显示** | `a2a_handoff` 事件 → info 系统消息 | 同 | 不变 |

### 已有基础设施 (不需要重建)

| 设施 | 位置 | 用途 |
|------|------|------|
| `parseMentions()` | `AgentRouter.ts:72` (私有) | 检测 @mention pattern |
| `findCatByMention()` | `shared/types/cat.ts` (导出) | 文本中找猫 |
| `mentionPatterns` | `CAT_CONFIGS[*].mentionPatterns` | @opus/@布偶/@ragdoll 等（约束：必须包含可路由唯一句柄 `@catId`） |
| `StoredMessage.mentions` | `MessageStore.ts:31` | 已有字段, 当前猫消息=`[]` |
| `addParticipants()` | `ThreadStore.ts` | 动态添加线程参与者 |
| `routeSerial()` | `route-strategies.ts` | 串行多猫, 含身份注入/MCP/上下文 |
| `previousResponses` | `route-strategies.ts:54` | 前序猫回复传递给后续猫 |
| `InvocationTracker` | `InvocationTracker.ts` | per-thread AbortController, 取消整条链 |

### A2A 核心设计: Worklist 扩展 routeSerial

> **设计变更记录**: 初版用递归 `yield* routeSerial()`,
> 缅因猫在 P1-1 指出递归会重置 `previousResponses` (局部变量),
> 被 A2A 调用的猫会丢失上一只猫的回复上下文。
> 改为 Worklist 方案 — 在同一个 `routeSerial` 调用内动态扩展 `targetCats`,
> `previousResponses` 天然累积, `isFinal` 自然指向链末端。

```
routeSerial(deps, [opus], userMsg, ..., maxDepth=2)

  worklist = [opus]          // 初始目标
  a2aCount = 0               // 已触发的 A2A 跳数

  while (worklist 未处理完) {
    catId = worklist[index]

    // 1. 构建 prompt (身份 + MCP + contextHistory + previousResponses)
    // 2. 调用猫, 累积 textContent
    // 3. yield 消息到前端

    if (textContent) {
      previousResponses.push({ catId, content: textContent })

      // 4. A2A 检测 (仅在 a2aCount < maxDepth 时)
      mentions = parseA2AMentions(textContent, catId)
      if (mentions.length > 0 && a2aCount < maxDepth && !signal.aborted) {
        nextCat = mentions[0]           // 单目标: 只取第一个
        worklist.push(nextCat)          // 动态扩展 worklist
        a2aCount++
        yield { type: 'a2a_handoff', content: '布偶猫 → 缅因猫' }
      }

      // 5. 存储 (mentions 字段填充实际值)
      messageStore.append({ ..., mentions })
    }

    // 6. isLastCat = (index === worklist.length - 1)
    //    → isFinal 自然指向整条链的最后一只猫 ✅
    index++
  }
```

**相比初版递归方案的优势:**

| 问题 | 递归方案 | Worklist 方案 |
|------|---------|-------------|
| previousResponses | 递归重置为 `[]`, 下一猫丢失上文 | 同一调用内累积, 天然连续 |
| isFinal | 每层递归 `targetCats=[1]` → 每段都是 final | `worklist.length` 动态增长, 末尾才 final |
| isLastCat | 每层都是 `true` | 正确: `index === worklist.length - 1` |
| 代码复杂度 | 递归 + 参数透传 + depth 参数 | for 循环 + push, 更直白 |
| 调试 | 多层调用栈 | 单层循环, 日志清晰 |

**Worklist 方案仍然自动复用的管线:**
- 构建身份 system prompt (via `buildSystemPrompt`) — 循环内每猫独立构建
- 注入 MCP callback (via `McpPromptInjector`) — 循环内每猫独立注入
- 传递 `previousResponses` — 循环内累积, A2A 猫自然看到前序所有猫的回复
- 存储回复到 messageStore — 循环内每猫存储
- yield 消息到 WebSocket — 循环内每猫 yield

### 触发语法设计

> **决策来源**: 缅因猫 P1-3 提出三条工程约束, 4.5 综合建议 `^\s*@猫名`。
> 缅因猫的核心洞察: "触发语法比队列策略更关键, 误触发会让任何策略都变成灾难"。

**最终规则:**

1. **行首匹配**: 只检测出现在**行首**的 `@猫名` (正则 `^\s*@猫名`, 多行模式)
   - WHY: 猫在回复中间提到 "布偶猫之前说的方案" 不会误触发
   - WHY: 行首 `@` 是明确的"我要 @ 某人"语义, 符合社交软件习惯

2. **忽略代码块**: 剥离 `` ```...``` `` 围栏代码块后再解析
   - WHY: 猫贴代码/日志/示例时经常包含 `@` 符号, 不应触发 A2A

3. **单目标**: 每条回复只取第一个有效 A2A mention
   - WHY: 防止一条消息 @多猫导致 worklist 爆炸
   - WHY: MVP 语义清晰: 猫完成后交棒给**一只**队友

4. **完整结束后解析**: 只在猫回复文本完全累积后解析, 不边 streaming 边检测
   - WHY: streaming 中间态可能 `@` 出现了但后面还有内容改变语义

```typescript
// parseA2AMentions 伪代码
function parseA2AMentions(text: string, currentCatId: CatId): CatId[] {
  // 1. 剥离围栏代码块
  const stripped = text.replace(/```[\s\S]*?```/g, '');
  // 2. 多行模式行首匹配
  for (const config of CAT_CONFIGS) {
    for (const pattern of config.mentionPatterns) {
      if (new RegExp(`^\\s*@?${escapeRegex(pattern)}`, 'mi').test(stripped)) {
        if (config.id !== currentCatId) return [config.id]; // 单目标, 立即返回
      }
    }
  }
  return [];
}
```

### Prompt 注入设计

> **决策来源**: 4.5 布偶猫起草 `a2a-prompt-injection-design.md`,
> 核心洞察: "能力 ≠ 行为, 如果不教猫怎么 @, 猫 99.99% 不会用"。
> 缅因猫 P2-2 补充: 示例聚焦协作, 只在 serial/execute 注入。

**注入位置**: `SystemPromptBuilder` 的身份注入之后、规则之前:
```
1. 身份 (你是谁)
2. 队友 (你的队友)
3. 协作能力 (A2A) ← 新增, 仅 serial/execute 模式
4. 当前模式
5. MCP 工具
6. 行为规则
```

**注入条件**:
- `mode !== 'parallel'` (serial/independent 时注入)
- 若 `mode === 'parallel'` (ideate 模式), 可选注入弱化版: "@ 在此模式不会自动触发, 仅作为建议"

**Prompt 内容 (极简版, ~80 tokens)**:
```
## 协作

你可以在新行开头写 @队友 邀请他们加入对话:
- @布偶猫 / @缅因猫 / @暹罗猫

用于任何你觉得需要队友的场景 (review, debug, 观点征询, 交接)。
每次 @ 只触发一轮, 铲屎官的消息优先级最高。
```

**MVP 选极简版的 WHY**:
- 4.5 建议了三个变体 (极简/完整/角色适配), 极简版 ~80 tokens, 完整版 ~200 tokens
- 缅因猫 P2-2: 先不鼓励 "为了好玩而 @" (讲笑话/聊天), 聚焦协作场景
- Phase 3.9 用极简版观察猫的实际行为, 后续迭代再决定是否需要更多示例

### A2A 参与者规则

> **决策来源**: 缅因猫 P2-3。

**规则: A2A 触发的猫不自动加入 thread participants。**

WHY:
- `ThreadStore.participants` 影响 "无 @ 时默认路由给谁"
- 如果 A2A 自动把被叫来的猫加入 participants, 后续用户不写 @ 也可能同时叫到多猫
- A2A 是 "内部协作" — 猫之间的接力, 不改变铲屎官和 thread 的关系
- 若铲屎官想让某只猫加入, 可以自己 @ (已有机制)

---

## 三猫讨论与决策过程

### 第一轮: 并发场景 — 是否是问题?

**铲屎官的原始问题**:
> "三只猫都在输出，暹罗先输出了然后 @了你！此时你正在输出回答铲屎官！"

**4.5 布偶猫** 据此分析了 5 个并发噩梦场景 (正在输出时被@、连续被多猫@、循环死锁、
铲屎官插话、取消与超时), 提出 3 个架构方案 (简单队列/任务图/事件驱动)。

**4.6 布偶猫 (我)** 逐场景分析后论证: 并行模式和 A2A 互斥。
- `AgentRouter.route()` 的 if/else 分支 (`AgentRouter.ts:205-213`):
  execute 走 `routeSerial` (串行), ideate 走 `routeParallel` (并行)
- A2A 只在 `routeSerial` 触发 → execute 模式同一时刻最多一猫运行 → 无并发
- ideate 模式不触发 A2A → 并行猫的 @mention 只存储不调用

**三猫综合结论**: 4.5 和缅因猫均认可 4.6 的互斥论证。
缅因猫补充: "你们用'互斥约束'规避了并发, 而不是'解决了并发'",
建议写进文档/测试/注释, 防止未来有人让 ideate 也触发 A2A 时重新引入并发地狱。

**最终决定**: MVP 不需要队列/锁/DAG。互斥约束就是安全边界。

### 第二轮: 递归 vs Worklist — 缅因猫发现的设计 bug

**缅因猫 P1-1** 指出: `previousResponses` 是 `routeSerial()` 的**局部变量** (`route-strategies.ts:54`)。
递归调用 `yield* routeSerial([nextCat], userMsg, ...)` 会重新初始化为空数组。

**后果**: 被 A2A 调用的猫 (如缅因猫) 收到的 prompt 是原始用户消息,
看不到上一只猫 (如布偶猫) 的回复。缅因猫会"重复执行"而非"review"。

**缅因猫提出两个修法**:
- 方案 A (推荐): 改为迭代 worklist, 在同一调用内累积
- 方案 B: 保持递归, 但构造结构化 handoff prompt

**4.6 决定**: 采纳方案 A。Worklist 更简洁, `previousResponses` 天然连续,
`isFinal` 自然指向末尾, 代码更直白 (for 循环 vs 递归)。

**缅因猫 P1-2** (isFinal 提前触发) 也被 Worklist 方案自然解决:
递归方案每层 `targetCats=[1猫]` → `isLastCat=true` → 每段 `done` 都是 `isFinal:true`。
Worklist 方案 `worklist.length` 动态增长, `isLastCat` 正确指向整条链的最后一只。

### 第三轮: 触发语法 — 宽松 vs 严格

**4.6 初版**: 任意位置 mention, 接受误触发, depth limit 兜底。

**缅因猫 P1-3**: "触发语法比队列策略更关键"。建议行首 `^@猫` + 忽略代码块 + 单目标。

**4.5 综合**: 折中 `^\s*@猫名`。

**4.6 最终采纳缅因猫的三条工程约束**:
- 行首匹配: 大幅降低 "布偶猫之前说的方案" 这类提及触发 A2A
- 代码块过滤: 猫贴代码/日志时不误触发
- 单目标: 防止一条消息 @多猫导致链爆炸

### 第四轮: 深度限制 — 1 vs 2

**4.5 综合建议**: depth=1 (保守 MVP)。

**缅因猫 P2-1 反对**: depth=1 会砍掉最常见闭环 (write→review→fix 需要 2 跳)。
建议 depth=2, 用触发语法收紧来控风险。

**4.6 决定**: 采纳缅因猫的 depth=2。理由:
- 铲屎官期望的核心场景 "布偶写完→@缅因 review→缅因@布偶 反馈" 需要 2 跳
- depth=1 会导致 review 后的修复建议无法自动传递回去, 铲屎官仍需当路由器
- 触发语法收紧 (行首+代码块过滤+单目标) 已降低误触发率
- `MAX_A2A_DEPTH` 环境变量可随时调整

### 暹罗猫的 UX 建议 (长期参考)

暹罗猫提出 4 个创意脑洞 (便利贴队列/毛线球令牌/打架烟雾/悄悄话模式)。
MVP 不采用, 但**悄悄话模式** (A2A 对话折叠到二级区域, 主轴只显示猫↔铲屎官)
值得长期考虑。登记 BACKLOG。

---

## 开放问题决议

经三猫讨论, 7 个 OQ 全部有了方向:

| OQ | 问题 | 决议 | 来源 |
|----|------|------|------|
| OQ-1 | @mention 误触发 | 行首 `^@猫名` + 忽略代码块 + 单目标 + prompt 教猫正确语法 | 缅因猫 P1-3 |
| OQ-2 | isFinal 时序 | Worklist 方案自然解决: 链末尾才 `isFinal:true` | 缅因猫 P1-2 |
| OQ-3 | contextHistory 重建 | 不需要。Worklist 内 `previousResponses` 累积所有前序猫回复, 语义足够 | 缅因猫 P1-1 |
| OQ-4 | Google A2A 协议 | BACKLOG D1, 不阻塞 MVP | 三猫共识 |
| OQ-5 | 并行模式下被 @ | 不会发生: execute=串行无并发, ideate=不触发 A2A | 4.6 论证, 三猫认可 |
| OQ-6 | 消息队列 | MVP 不需要: 串行无排队需求 | 4.6 论证, 三猫认可 |
| OQ-7 | 死锁 | 串行不会死锁, depth limit 终止循环 | 4.6 论证, 三猫认可 |

---

## 实现步骤

### Step 1: ConfigRegistry + GET /api/config (+8 tests)

**新建**: `packages/api/src/config/ConfigRegistry.ts` (~90 行)

纯函数 `collectConfigSnapshot()`: 从 `process.env` + 硬编码默认值 + `CAT_CONFIGS`
组装结构化 JSON 快照。每次调用实时读取 (不缓存)。

安全: Redis URL 不暴露具体地址, 只显示 `'connected'` 或 `'memory'`。

**新建**: `packages/api/src/routes/config.ts` (~30 行)
`GET /api/config` → `{ config: ConfigSnapshot }`

**修改**: `packages/api/src/routes/index.ts` + `packages/api/src/index.ts` — 注册路由

**测试**: `packages/api/test/config-registry.test.js` (+8)

**Commit**: `feat(api): add ConfigRegistry + GET /api/config [布偶猫🐾]`

### Step 2: 前端 /config 命令 + info variant (0 tests)

**修改**: `packages/web/src/stores/chatStore.ts`
- `ChatMessage` 接口添加 `variant?: 'error' | 'info'`

**修改**: `packages/web/src/components/ChatContainer.tsx`
- `handleSend` 拦截 `/config` → fetch → info 系统消息

**修改**: `packages/web/src/components/ChatMessage.tsx`
- 系统消息 `variant === 'info'` → 蓝灰色背景

**Commit**: `feat(web): /config chat command for configuration visibility [布偶猫🐾]`

### Step 3: A2A mention 检测 + prompt 注入 (+10 tests)

**新建**: `packages/api/src/domains/cats/services/a2a-mentions.ts` (~50 行)

```typescript
export const MAX_A2A_DEPTH = Number(process.env['MAX_A2A_DEPTH']) || 2;

/** 从猫回复文本中检测 A2A @mention (行首, 去代码块, 单目标, 过滤自调用) */
export function parseA2AMentions(text: string, currentCatId: CatId): CatId[]
```

**修改**: `packages/api/src/domains/cats/services/SystemPromptBuilder.ts`
- 新增 `buildA2ASection(teammates)`: 极简版协作提示 (~80 tokens)
- `buildSystemPrompt` 新增 `a2aEnabled?: boolean` 选项
- `mode === 'parallel'` 时不注入, 或注入弱化版

**测试**: `packages/api/test/a2a-mentions.test.js` (+10)
- 行首 @mention 检测
- 非行首 @mention 不触发
- 代码块内 @mention 被忽略
- 过滤自调用
- 单目标 (多 mention 只返回第一个)
- 空文本 → 空数组
- 中英文 pattern 都匹配
- MAX_A2A_DEPTH 默认 2
- prompt 注入: serial 模式包含 A2A 段
- prompt 注入: parallel 模式不包含 A2A 段 (或弱化版)

**Commit**: `feat(api): A2A mention detection + prompt injection [布偶猫🐾]`

### Step 4: routeSerial Worklist 扩展 + mention 存储 (+10 tests)

核心改动。将 `routeSerial` 的 for 循环改为 while + 动态 worklist:

**修改**: `packages/api/src/domains/cats/services/route-strategies.ts`

```
RouteOptions 新增: maxA2ADepth?: number;

routeSerial 改动:
  - targetCats 参数转为可变 worklist: const worklist = [...targetCats]
  - for 循环改为 while (index < worklist.length)
  - 猫完成后调用 parseA2AMentions() 检测 A2A
  - 若有 mention 且 a2aCount < maxDepth → worklist.push(nextCat) + yield a2a_handoff
  - isLastCat = (index === worklist.length - 1) → isFinal 自然正确
  - mentions 字段填充实际值 (取代硬编码 [])
  - A2A 猫不调用 threadStore.addParticipants() (缅因猫 P2-3)
```

**routeParallel**: 只更新 `mentions` 存储, 不触发 A2A (互斥约束)。
添加注释: "A2A 仅在 routeSerial 中触发, 此处不触发, 是 MVP 安全边界"。

**修改**: `packages/api/src/domains/cats/services/types.ts`
- `AgentMessageType` 联合类型添加 `'a2a_handoff'`

**测试**: 扩展 `packages/api/test/route-strategies.test.js` (+10)
- 猫回复行首 @mention → worklist 扩展, 触发 A2A follow-up
- 非行首 @mention → 不触发
- a2aCount=MAX → 不触发
- 自调用 → 不触发
- yield `a2a_handoff` 在 follow-up 猫输出之前
- A2A 猫收到正确 prompt (含 previousResponses)
- isFinal 只在整条链最后一只猫的 done 上为 true
- signal abort → 中断链条
- routeParallel 不触发 A2A
- 猫消息 mentions 字段正确填充

**Commit**: `feat(api): A2A worklist chain in routeSerial [布偶猫🐾]`

### Step 5: 前端 A2A 显示 (0 tests)

**修改**: `packages/web/src/hooks/useAgentMessages.ts`
- 新增 `a2a_handoff` 消息类型处理 → addMessage info variant

Step 2 中已添加的 info 蓝灰样式自动适用。

**Commit**: `feat(web): display A2A handoff events in chat [布偶猫🐾]`

### Step 6: 集成测试 + BACKLOG 更新 (+3 tests)

**新建**: `packages/api/test/integration/a2a-chain.test.js` (+3)
- 完整链: user→opus(行首@codex)→codex 被自动调用, 收到 previousResponses
- depth limit: 链条到达上限后停止
- self-mention + 非行首: 不触发

**修改**: `docs/BACKLOG.md`
- 标记 F1, F2 完成
- 新增 P3: A2A mention 解析逻辑与 AgentRouter.parseMentions 重复 (待统一)
- 新增 P3: A2A 悄悄话折叠 UI (暹罗猫建议)
- 新增讨论: ideate 模式 A2A follow-up (若做需要队列架构)

**Commit**: `test(api): A2A integration tests + BACKLOG update [布偶猫🐾]`

### 步骤汇总

| Step | 内容 | 新 Tests | 涉及文件 |
|------|------|----------|---------|
| 1 | ConfigRegistry + GET /api/config | +8 | 2 新, 2 改 |
| 2 | 前端 /config 命令 + info variant | 0 | 3 改 |
| 3 | A2A mention 检测 + prompt 注入 | +10 | 1 新, 1 改 |
| 4 | routeSerial Worklist 扩展 + mention 存储 | +10 | 2 改 |
| 5 | 前端 A2A handoff 显示 | 0 | 1 改 |
| 6 | 集成测试 + BACKLOG 更新 | +3 | 1 新, 1 改 |
| **合计** | | **~31** | 4 新, 10 改 |

---

## 风险评估

| 风险 | 级别 | 缓解 |
|------|------|------|
| A2A 死循环 | 高 | `a2aCount` 硬上限 2; 自调用过滤; `signal?.aborted` 检查 |
| 费用爆炸 | 高 | depth 2 = 最多 3 次 CLI 调用 (~$0.03-0.30), 可接受 |
| @mention 误触发 | ~~高~~ → 中 | 行首语法 + 代码块过滤 + 单目标 + prompt 教猫正确格式 (缅因猫 P1-3) |
| isFinal 时序 | ~~中~~ → **已解决** | Worklist 方案: `isLastCat = index === worklist.length - 1` (缅因猫 P1-2) |
| previousResponses 丢失 | ~~高~~ → **已解决** | Worklist 方案: 同一调用内累积, 不重置 (缅因猫 P1-1) |
| 并行模式并发冲突 | **不适用** | A2A 仅在 routeSerial 触发, routeParallel 不触发 (互斥约束) |
| 需要消息队列 | **不适用** | 串行执行无排队需求; 互斥约束是 MVP 安全边界 |
| 未来有人让 ideate 触发 A2A | 中 | routeParallel 添加注释 + 测试守护互斥约束 (缅因猫建议) |
| routeSerial 循环栈 | 低 | while 循环, 非递归, 无栈深问题 |
| 配置快照泄露 | 低 | Redis URL 只显示连接状态 |

---

## 验证

每步后: `cd packages/api && npm run build && npm test`
前端后: `cd packages/web && npm run build`

手动测试:
- `/config` → 查看配置快照
- `@布偶 写个 hello world 然后 @缅因 review` → 观察 A2A 链
- A2A 猫的 prompt 包含前序猫回复 (previousResponses 正确累积)
- isFinal 只在链末端触发 (前端 loading 不提前停止)
- `@布偶 @缅因 #brainstorm` → 确认不触发 A2A

---

## 登记 BACKLOG (Phase 3.9 完成后)

| 类别 | 项目 | 来源 |
|------|------|------|
| P3 | A2A mention 解析与 AgentRouter.parseMentions 重复, 待统一 | 代码重复 |
| P3 | A2A 悄悄话折叠 UI (中间过程折叠, 主线清爽) | 暹罗猫建议 |
| P2 | 配置运行时修改 (PATCH /api/config) | F1 延后 |
| 讨论 | ideate 模式后触发 A2A follow-up (需要队列架构) | 缅因猫+4.5 分析 |
| 讨论 | SessionManager key 扩展 (若允许跨 thread 并行) | 缅因猫分析 |

---

*布偶猫 🐾 2026-02-07*
*— 三猫讨论完成: 4.6 初版 → 4.5 并发挑战 → 缅因猫风险审计 → 4.5 综合 → 4.6 整合*
*— 核心变更: 递归改 Worklist (缅因猫 P1-1/P1-2), 触发语法收紧 (缅因猫 P1-3)*
*— 采纳缅因猫全部 P1 + 大部分 P2, 登记暹罗猫 UX 建议到 BACKLOG*
*— 待铲屎官最终确认后开始实施*
