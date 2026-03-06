---
feature_ids: []
topics: [lessons, a2a, routing]
doc_kind: note
created: 2026-02-26
---

# 第四课：多猫路由 — 当 AI 开始互相 @

> 前三课是"人指挥 AI"。这一课是"AI 指挥 AI"——以及为什么这比想象中难得多。
>
> **阅读时间**：30-35 分钟
> **难度**：高级
> **前置知识**：理解进程、AbortController、消息队列的基本概念
>
> **证据标注说明**（延续前几课）：
> `[事实]` 有 commit / 文档 / 代码佐证 ·
> `[推断]` 作者基于经验的解读 ·
> `[外部]` 来自外部文档或第三方

---

## 为什么猫需要互相调用？

故事要从一个常见场景说起。

铲屎官在输入框里打：

```
@布偶猫 实现一个新功能
```

布偶猫开始写代码。写完了。然后呢？

在早期版本里，铲屎官需要手动做下一步：

```
@缅因猫 帮我 review 布偶猫的代码
```

然后缅因猫 review 完，发现 3 个 P1 bug。铲屎官又要手动：

```
@布偶猫 缅因猫说你有 3 个 P1，去修
```

布偶猫修完了。铲屎官又要手动：

```
@缅因猫 布偶猫修完了，再看看
```

**铲屎官成了人肉路由器。**

这不是协作系统，这是铲屎官的手动调度器。真正的协作应该是：布偶猫写完代码后**自己** @缅因猫说"帮我 review"，不需要铲屎官中转。

这就是 A2A（Agent-to-Agent）的需求起源。

---

## 第一条路：Worklist 链

### 核心设计

A2A 的第一版实现出人意料地简单。`[事实: Phase 3.9, commit 7a519b9]`

**思路**：猫的回复文本里如果出现 `@缅因猫`，就自动把缅因猫追加到执行队列。

```typescript
// a2a-mentions.ts — 从猫回复中检测 @mention
export function parseA2AMentions(text: string, currentCatId: CatId): CatId[] {
  // 1. 先剥离代码块（防止代码示例里的 @mention 误触发）
  const stripped = text.replace(/```[\s\S]*?```/g, '');

  // 2. 行首匹配（严格模式，防止"请问@布偶猫是谁？"这种句中 mention）
  for (const [id, config] of Object.entries(CAT_CONFIGS)) {
    if (id === currentCatId) continue; // 不能 @ 自己
    for (const pattern of config.mentionPatterns) {
      if (new RegExp(`^\\s*${escaped}`, 'mi').test(stripped)) {
        return [id as CatId];
      }
    }
  }
  return [];
}
```

**为什么要行首匹配？**

用户消息用宽松匹配（`indexOf`），因为用户可能在任何位置写 @。但猫的回复用**行首匹配**，因为猫的输出经常在代码注释、文档引用里提到其他猫的名字。`[事实: BACKLOG #28 已记录并澄清设计意图]`

行首匹配确保只有猫主动"喊话"才会触发路由。

### Worklist 模式

路由的核心是一个 **while 循环 + 动态数组**：

```typescript
// route-strategies.ts — 简化版
async function* routeSerial(worklist: CatId[], ...) {
  let a2aCount = 0;
  const maxDepth = getMaxA2ADepth(); // 默认 15

  for (let i = 0; i < worklist.length && a2aCount < maxDepth; i++) {
    if (signal?.aborted) break; // 用户点了 Stop

    const catId = worklist[i];

    // 执行这只猫
    let textContent = '';
    for await (const msg of invokeSingleCat(catId, ...)) {
      textContent += msg.content ?? '';
      yield msg; // 实时推送给前端
    }

    // 猫执行完后，检查回复里有没有 @mention
    const mentions = parseA2AMentions(textContent, catId);
    if (mentions.length > 0 && a2aCount < maxDepth) {
      worklist.push(mentions[0]); // 追加到队列
      a2aCount++;
    }
  }

  yield { type: 'done', isFinal: true }; // 全部完成
}
```

**这个设计有三个精妙之处**：

1. **`isFinal` 延迟**：只有 worklist 全部执行完才发 `isFinal: true`。前端收到 `isFinal` 才解锁输入框。这意味着不管 A2A 链多长，铲屎官都不会看到"输入框闪一下又锁住"的奇怪体验。

2. **共享 AbortController**：整个 worklist 循环在一个 `signal` 下运行。铲屎官点 Stop → signal abort → 循环 break → 所有猫都停下。

3. **动态增长的 for 循环**：`for (let i = 0; i < worklist.length; ...)` 这个条件会随着 `worklist.push()` 动态增长。JavaScript 不会在循环开始时"锁定" `worklist.length` 的值，所以运行中追加的猫自然会被执行到。

### 深度限制：15 轮安全网

```typescript
export function getMaxA2ADepth(): number {
  return Number(process.env['MAX_A2A_DEPTH']) || 15;
}
```

为什么是 15？`[推断]` 实际 review 链通常 3-5 轮（布偶猫写 → 缅因猫 review → 布偶猫修 → 缅因猫确认）。15 轮给了足够余量，同时防止失控。

---

## 第二条路：Callback 触发

### 为什么会有第二条路？

第一条路有个隐含假设：**猫只会在"最终回复"里 @mention 另一只猫。**

但猫猫可以通过 MCP callback **在执行过程中**主动发消息。

```
用户: @布偶猫 帮我分析这个 bug
布偶猫:（在分析过程中，调用 MCP 工具 cat_cafe_post_message）
        → "分析完了，@缅因猫 帮我看看修复方案对不对"
布偶猫:（继续执行其他工具调用...）
```

这条消息是通过 HTTP callback 发到后端的。后端的 `callbacks.ts` 路由收到消息后，检测到 `@缅因猫` → 需要触发 A2A。

但此时布偶猫还在执行中！worklist 循环还没走到"检查回复文本"那一步。

**所以诞生了第二条路：`callback-a2a-trigger.ts`。**

### 第二条路的实现

```typescript
// callback-a2a-trigger.ts — 简化版
export async function triggerA2AInvocation(deps, opts) {
  const { targetCats, threadId } = opts;

  // 创建独立的 InvocationRecord
  const record = await invocationRecordStore.create({ ... });

  // 关键判断：父调用还在运行吗？
  const parentActive = invocationTracker?.has(threadId) ?? false;

  if (!parentActive) {
    // 没有父调用 → 正常启动（注册 tracker）
    controller = invocationTracker?.start(threadId, ...);
  } else {
    // 父调用活跃 → 作为 child 运行（不注册 tracker）
    log.info('A2A chain: parent active, running as child');
  }

  // Fire-and-forget: 后台独立执行
  void (async () => {
    for await (const msg of router.routeExecution(...)) {
      socketManager.broadcastAgentMessage(msg, threadId);
    }
  })();
}
```

你注意到了吗？这条路和第一条路有**根本性差异**：

| | Path A (Worklist) | Path B (Callback) |
|--|---|---|
| 触发时机 | 猫回复**结束后** | 猫**执行过程中** |
| 执行方式 | 追加到 worklist，串行执行 | 独立 `routeExecution()`，**并行运行** |
| AbortController | 共享父级 signal | **没有自己的 signal** |
| 深度限制 | `a2aCount < maxDepth` | **没有深度计数** |
| 用户能取消吗 | 能（signal.abort） | **不能**（未注册 tracker） |

两条路径在项目演化中自然产生——不是刻意设计的，而是"callback 需要触发 A2A"这个需求推动的。

**这就是灾难的伏笔。**

---

## P0 事故：情人节的无限乒乓

### 2026 年 2 月 14 日，晚上

Thread `thread_mln54grb12u8v28h`，一个三猫 code review 的大线程。60 多条消息。`[事实: bug report 中有完整取证数据]`

布偶猫在 review 缅因猫的代码修复，互相 @mention 是正常操作。

然后事情开始不对劲。

铲屎官看到：
- 两只猫**同时**在输出
- 消息暴增，速度越来越快
- Stop 按钮……**按不动**
- 输入框时而能用，时而锁住

铲屎官试了好几次 Stop，无效。最后被迫**强制重启服务器**。

铲屎官原话：

> "缅因通过 callback 调用 又通过 mcp 或者就是回复调用 然后导致两只猫状态很奇怪 互相并发"
>
> "一定要给我那种遇到问题我可以直接 cancel 某个对话回调的能力"

### 三个缺陷叠加

这个 P0 事故是三个独立缺陷**同时发作**的结果。`[事实: bug report 2026-02-14-a2a-feedback-loop]`

#### 缺陷 1：双重开火

同一段 `@opus` 文本，被**两个检测器各捕获一次**。

```
缅因猫 CLI 执行中...
├── [Path B] MCP callback: post_message("@opus R8 不通过...")
│   → callbacks.ts 检测到 @opus → triggerA2AInvocation()
│   → 后台 fire-and-forget 启动布偶猫
│
└── [Path A] CLI 完成后 route-strategies.ts 检测回复文本
    → 也发现 @opus → worklist.push(opus) → 也启动布偶猫

= 两个布偶猫实例同时执行
```

**为什么会双重开火？** Path A 从 CLI 最终输出文本检测 mention；Path B 从每条 callback 消息检测 mention。缅因猫在 callback 里写了 `@opus`，这段文本最终也会出现在 CLI 的完整输出里。同一个 `@opus`，两个独立检测器各看到一次。

#### 缺陷 2：无限递归

Path A 有深度保护：`a2aCount < maxDepth`。

Path B 完全没有深度计数。

```typescript
// Path A — 有保护 ✅
if (a2aMentions.length > 0 && a2aCount < maxDepth) { ... }

// Path B — 无保护 ❌
// 每次 callback @mention 都无条件触发新 invocation
```

两个布偶猫各自产生 @codex 的回复 → 各自触发缅因猫 → 缅因猫又 @opus → 又触发布偶猫 → **无限循环**。

#### 缺陷 3：不可取消

```typescript
if (!parentActive) {
  controller = invocationTracker?.start(...); // 注册了 tracker
} else {
  // Parent active: 跳过 tracker.start()
  // → cancel(threadId) 找不到这个 child
  // → 只有杀进程才能停
}
```

callback 触发的 child invocation 没有注册到 InvocationTracker。用户点 cancel → tracker 查找 → 找不到 → 取消无效。

### 取证数据

| 指标 | 值 | 说明 |
|------|-----|------|
| Thread 消息数 | 60 | 大量来自循环 |
| Message #59 | 空内容 | 并发竞态导致写入异常 |
| Opus delivery cursor | msg 54（落后 7 条） | 消息暴增追不上 |
| Gemini delivery cursor | msg 18（落后 42 条） | 完全跟不上 |
| 最后一条消息 | 铲屎官强制重启通知 | 人工介入停止 |

---

## 事故的前奏：那天早上的过度修正

这个 P0 事故其实是**三次修复的连锁反应**。`[事实: bug report 2026-02-14-a2a-callback-chain-blocked]`

### 第一次修复：封死所有 callback A2A

当天凌晨，缅因猫发现 callback A2A 在某些场景下会抢占正在运行的 invocation。修复方案：加一个 guard。

```typescript
// commit 8eacef3 — 缅因猫的修复
const parentActive = invocationTracker?.has(threadId);
if (parentActive) {
  log.info('跳过 A2A 触发：当前线程已有进行中的调用');
  return; // ← 所有 callback A2A 都被封死了
}
```

**问题**：A2A 链本来就是"在父调用执行期间触发"的——猫 A 跑着跑着通过 callback @猫 B，这时候父调用当然是活跃的。这个 guard 把**所有 callback A2A** 都封死了，不只是有问题的那种。

### 第二次修复：放开为 child 模式

发现所有 A2A 链断裂后，我做了修复。

```typescript
// commit 8374297 — 布偶猫的修复
if (!parentActive) {
  controller = invocationTracker?.start(...); // 正常注册
} else {
  // 作为 child 跑（不注册 tracker）
  log.info('A2A chain: parent active, running as child');
}
```

这个修复恢复了 callback A2A 链，但**打开了双重开火 + 无限递归的大门**。

### 第三次：P0 爆发

当晚，三猫 review 大线程里，布偶猫和缅因猫的互 review 触发了双重开火 + 无限递归 + 不可取消的三重故障。

**教训**：每次"局部修复"都在调整系统的某个边界条件，但没有人站在全局看"两条路径的交互行为"。这是复杂系统故障的经典模式——**每个单独的修复都是合理的，但组合起来产生了灾难。**

---

## 附带问题：多 mention 只路由 1 只猫

当前 `parseA2AMentions()` 返回的是数组，但只取第一个匹配：

```typescript
return [id as CatId]; // 单目标 — return first match
```

当布偶猫需要同时派活给缅因猫和暹罗猫时（比如"@缅因猫 帮我 review 后端，@暹罗猫 帮我看看前端"），只有第一只收到。

这不是 bug，是 Phase 3.9 的有意限制——当时觉得"先做单目标，多目标以后加"。但随着协作越来越复杂，这个限制越来越碍事。

---

## 修复方案：F27 路径统一

铲屎官的要求很明确：**不做临时止血，一步到位。** `[事实: F27 计划文档]`

### 核心思路

**callback 不再自己执行猫调用，改为追加到父 worklist。**

```
改前:
  猫 A 执行中 (worklist 循环)
    → 猫 A 调用 MCP post_message(@猫B)
      → callback 检测到 @猫B
        → 独立发起 routeExecution(猫B) ← 脱离父控制
          → 猫 B 执行（无 signal，无深度限制）

改后:
  猫 A 执行中 (worklist 循环)
    → 猫 A 调用 MCP post_message(@猫B)
      → callback 检测到 @猫B
        → worklist.push(猫B) ← 追加到父 worklist
        → return（不自己执行）
    → 猫 A 完成当前轮
    → worklist 循环继续 → 执行猫 B（共享同一个 signal）
```

### 为什么这能解决三个缺陷？

| 缺陷 | 怎么修 |
|------|--------|
| 双重开火 | 只有一条路径（worklist），去重后一个 @mention 只执行一次 |
| 无限递归 | worklist 的 `a2aCount < maxDepth` 自然覆盖所有来源 |
| 不可取消 | 共享父 AbortController → Stop 一键终止全链 |

### 共享 worklist 的实现

worklist 是 `routeSerial()` 里的局部变量。callback 怎么拿到它？

```typescript
// 方案：per-thread 注册表
const threadWorklistRegistry = new Map<string, { list: CatId[] }>();

// route-strategies.ts
const worklist = [...initialCats];
threadWorklistRegistry.set(threadId, { list: worklist });

try {
  for (let i = 0; i < worklist.length && i < MAX_A2A_DEPTH; i++) {
    if (signal?.aborted) break;
    // ... 执行 worklist[i] ...
    // 执行过程中 callback 可能 push 新猫到 worklist
  }
} finally {
  threadWorklistRegistry.delete(threadId);
}
```

```typescript
// callback-a2a-trigger.ts — 改为入队者
export function enqueueA2ATargets(threadId, content, sourceCat) {
  const targets = parseA2AMentions(content, sourceCat);
  if (targets.length === 0) return [];

  const ref = threadWorklistRegistry.get(threadId);
  if (ref) {
    // 父 worklist 存在 → 追加（去重）
    for (const cat of targets) {
      if (!ref.list.includes(cat)) ref.list.push(cat);
    }
    return targets;
  }
  return []; // 无父 worklist，理论上不该发生
}
```

**为什么选共享数组而不是事件系统？** Cat Café 是单进程，不需要跨进程通信。共享数组是最简单、最直接的方案。

### 多 mention 支持

顺便把 `parseA2AMentions` 改为返回所有匹配（上限 2 只）：

```typescript
// 改前：返回第一个匹配
return [id as CatId]; // → 只有一只猫

// 改后：收集所有匹配，上限 2
const found: CatId[] = [];
// ... 循环收集 ...
return found.slice(0, 2); // 最多 2 只
```

为什么上限 2？防止猫猫写 `@opus @codex @gemini @opus @codex ...` 造成扇形爆炸。串行执行（一只做完再做下一只），因为多猫派活通常有隐含依赖。

### 改动量

| 文件 | 改动 | 量级 |
|------|------|------|
| `a2a-mentions.ts` | 返回 `string[]` + 上限 2 | 小 |
| `route-strategies.ts` | worklist 注册表 + 去重 | 中 |
| `callback-a2a-trigger.ts` | 重写为入队者（净删代码） | 中 |
| callbacks 路由 | 调用新接口 | 小 |
| 测试 | 新场景覆盖 | 中 |

总计 ~100 行改 + ~80 行删 + ~60 行新测试。这个量级说明问题不在代码量，而在**设计方向**。

---

## 情人节的其他 A2A 战果

2 月 14 日不只有 P0 事故。那一整天都在和 A2A 的各种问题搏斗。`[事实: BACKLOG #73, #75, #76]`

### A2A Stop 按钮修复 (#73)

**问题**：Stop 按钮只在 `isLoading` 时显示，但 A2A 链中间 `isLoading` 会被重置 → Stop 按钮消失 → 猫还在跑但用户没法停。

**修复**：新增 `hasActiveInvocation` 状态（独立于 `isLoading`），socket 收到 `intent_mode` 事件时设为 true，收到 `done(isFinal)` 或 `error` 时设为 false。Stop 按钮在任一状态为 true 时都显示。

缅因猫 review 了 3 轮才放行（R1 发现分屏停错线程的 P1，R2 发现 `text(isFinal)` 遗漏的 P2）。

### pending-mentions 跨线程泄漏 (#75)

**问题**：`getMentionsFor()` 没有按 threadId 过滤，导致 Thread A 里的 @mention 在 Thread B 里也能看到。

**修复**：增加 threadId 过滤。一行代码的 bug，4 个测试覆盖（内存/Redis/API）。

### cancel_invocation catId 硬编码 (#76)

**问题**：取消 invocation 后发的"已取消"消息，catId 固定写成 `opus`。就算取消的是缅因猫的调用，取消消息也显示为"布偶猫说：已取消"。

**修复**：`InvocationTracker` 追踪所有活跃的 catIds，取消时用实际 catId 发消息。

### Claude Session 变僵尸

**问题**：A2A abort 中断 Claude CLI 的执行，session 文件只写了一行 `queue-operation/dequeue` 就成了空壳。后端存了这个 sessionId，下次用 `--resume` → `No conversation found` → 死循环。`[事实: bug report 2026-02-14-claude-session-not-found-after-a2a-abort]`

**止血修复**：检测到 `No conversation found` → 清除坏 session → 不带 `--resume` 重试。代价是丢失该 session 的连续上下文。

**根治**：等 F27 统一路径后，不再有"中途 abort 正在运行的 session"的场景。

---

## 这课的教训

### 教训 1：两条路径 = 行为不一致的定时炸弹

当系统有两种方式做同一件事时，迟早会出现：
- 只在一条路径上修了 bug（另一条忘了）
- 两条路径对同一事件各触发一次（双重开火）
- 团队成员改了 A 没注意到 B 也受影响

**原则：对于同一个语义操作，只保留一条路径。** 宁可多一步（callback 追加到 worklist 后等父循环消费），也不要为了"快"开辟第二条捷径。

### 教训 2：局部修复 + 局部修复 = 全局灾难

三次修复的时间线：

```
凌晨: 封死所有 callback A2A → 安全但过度
  ↓
白天: 放开为 child 模式 → 恢复功能但打开了漏洞
  ↓
晚上: 双重开火 + 无限递归 + 不可取消 → P0
```

每个修复都只看了"我要解决的那个问题"，没人站在全局视角检查"两条路径的完整交互矩阵"。

**原则：修复时，画出所有路径的交互图，检查每种组合。** 特别是当系统有 N 条路径时，需要检查的不是 N 个场景，而是 N×N 个场景。

### 教训 3：过度防御会导致反向失效

加了"@ 前三问自检"防 mention spam → 对倾向"少打扰"的模型来说变成了"三重否定门" → 链条断裂。

**原则：抑制规则和正面触发规则要平衡。** 如果你给 Agent 的 prompt 里80%是"不要做X"，只有 20% 是"应该做Y"，Agent 会过度保守。特别是 prompt 工程中，禁止性规则不应该压制正常的协作行为。

### 教训 4：不可取消 = 服务不可用

当系统进入异常状态时，用户的最后防线是"取消"。如果取消不生效，唯一的选择就是杀进程。

**原则：所有后台执行都必须注册到可观测 + 可取消的机制里。** "fire-and-forget"在短任务里可以接受，但在可能产生链式反应的场景里是危险的。

### 教训 5：深度限制不是可选的

Path A 有深度限制，Path B 没有。结果：Path B 成了无限递归的突破口。

**原则：任何递归/链式执行都必须有深度上限，没有例外。** 哪怕你觉得"这条路径不可能递归很深"——你的猫猫们会找到方法的。

### 教训 6：铲屎官说"不止血，一步到位"

面对 P0 事故，有两个选择：
1. **止血**：在 Path B 加深度限制 + 去重，快速修复最严重的症状
2. **一步到位**：合并两条路径，从根源消除问题

铲屎官选了 2。

为什么？因为止血修了 Path B 的深度限制，但**双重开火问题还在**。下次某个边界条件变化，又可能触发新的组合故障。只有统一成一条路径，才能**根绝**这类问题。

**代价**：F27 依赖 F24 先合入（避免冲突），所以 P0 目前处于"已知未修"状态。铲屎官接受了这个代价，因为他相信：**正确的修复比快速的修复更重要。**

---

## 路径统一之后：链条断裂问题

F27 路径统一修好了"失控"问题（双重开火、无限递归、不可取消），但很快暴露了另一个问题：**链条断裂**。

### 问题现象

Agent A 完成任务后，明明应该 @Agent B 继续下一步（比如 coder 写完代码应该 @reviewer），但它就是不 @。消息写完就停了，整个工作流卡住，铲屎官不得不手动补 @ 当路由器。

这跟之前的"无限乒乓"正好是**两个极端**：
- 无限乒乓 = 停不下来
- 链条断裂 = 该动不动

看似矛盾，但**根因相同：Agent 缺少"发消息前的出口检查"决策节点**。

### 根因分析

我们做了三层根因分析：`[事实: 三猫联合诊断]`

**1. prompt 给的信号是"别乱 @"而不是"该 @ 就 @"**

修完 F27 后我们加了"@ 前三问自检"来防 mention spam：

```
发 @ 前问自己：
Q1: 需要对方采取行动？
Q2: 对方需要知道这个信息？
Q3: 会影响对方的工作？
```

本意是防过度 @。但对于倾向"少打扰"的模型来说，这三个问题变成了**三重否定门**——每个问题都给了它一个理由不 @。

**2. 工作流触发点比重失衡**

System prompt 里某只猫的工作流触发点：
- 正面触发点：2 条（完成 review → @布偶猫，修完 bug → @布偶猫）
- 抑制规则：8 行（@ 自检占一半篇幅）

**prompt 传递的信号是"小心 @，别乱 @"，而不是"该 @ 就 @"。**

**3. 路由反馈数据流断裂**

系统有一个 `mentionRoutingFeedback` 字段——当 Agent 写了句中 @ 但没被路由时，理论上应该提醒它"你上次 @ 没生效"。但这个字段虽然定义了、传入了，却**从来没有渲染成提示词文本**。系统知道 @ 没生效，但没告诉 Agent。

### 四层协作保障方案

修复不是只改一处，而是建了四层保障：

**Layer 1：A2A Mention 检测 + Worklist（基础层）**

就是前面讲的 F27 统一路径。行首 @mention → 追加到 worklist → 串行执行。这是路由的基础管道。

**Layer 2：工作流触发点（Prompt 引导）**

在每个 Agent 的 system prompt 里注入**具体的工作流触发点**：

```
## 工作流（主动 @ 触发点）
- 完成开发/修复 → @reviewer 请 review
- 修完 review 意见 → @reviewer 确认修复
- 遇到视觉/体验问题 → @designer 征询
```

不是模糊的"你觉得需要就 @"，而是**具体场景 → 具体行动**的映射。这对 LLM 来说有效得多。

**Layer 3：出口检查（防链条断裂的关键机制）**

每条消息发送前，Agent 必须做出口检查：

```
回复前问"到我这里结束了吗？"
不是 → 谁需要动 → @ 对方
```

配合改良后的三问短路规则：

```
Q1: 需要对方采取行动？= 是 → 直接 @（跳过Q2/Q3）
Q2: 对方需要知道这个信息？
Q3: 会影响对方的工作？
三个都否 → 不 @
```

关键设计：**Q1 是短路的**。"需要行动"直接 @，不被 Q2/Q3 拦截。这解决了"三重否定门"的问题。

同时在非独立思考模式下，system prompt 里动态注入出口检查提示。如果有上一次 @ 未生效的反馈（mentionRoutingFeedback），也一并渲染成一次性纠正提醒。

**Layer 4：Skill 链式导航（流程引导）**

定义了开发流程的 skill 链：

```
feat-lifecycle → writing-plans → worktree → tdd
    → quality-gate → request-review → receive-review
    → merge-gate → feat-lifecycle(完成)
```

每个 skill 有 `next` 字段指向下一步。Agent 完成一个阶段后，skill 提示"接下来该做什么"。这不是强制的工作流引擎，而是 prompt 级引导——Agent 可以跳过不需要的步骤，但有方向感。

### 四层的协同关系

```
Layer 4 (Skill)     → "接下来该做质量检查了"（方向感）
Layer 3 (出口检查)  → "这事到我这结束吗？不是 → 该 @谁？"（决策点）
Layer 2 (触发点)    → "完成开发 → @reviewer"（具体指令）
Layer 1 (Worklist)  → 检测 @mention → 追加执行（管道）
```

Skill 告诉 Agent"该做什么"，出口检查让它"停下来想想要不要 @"，触发点告诉它"@ 谁"，Worklist 负责执行。

### 效果与局限

效果：链条断裂频率从"经常发生"降到了"偶尔发生"。

局限：LLM 不是确定性系统，prompt 级引导**不能保证 100%**。偶尔仍会出现 Agent 忘了 @ 的情况。如果你的场景需要 100% 可靠性，可能需要在 Worklist 层面做更强的约束——比如预定义工作流节点的强制切换。

### Prompt 引导 vs 硬编码工作流

这是一个重要的设计选择：

| | Prompt 引导（Cat Café 的选择） | 硬编码工作流 |
|--|---|---|
| 确定性 | 不能 100% 保证 | 100%（节点必定切换） |
| 灵活性 | 高（可跳过不需要的步骤） | 低（必须走完所有节点） |
| 场景覆盖 | 广（讨论、开发、review 都有） | 窄（每种场景需要独立工作流） |
| 实现复杂度 | 低（改 prompt） | 高（需要工作流引擎） |
| 适用场景 | 任务多样、步骤不固定 | 任务固定、步骤确定 |

如果你的场景是固定的（永远是 coder → tester → reviewer），硬编码工作流可能更简单有效。Cat Café 的场景比较灵活，所以选了 prompt 引导 + skill 导航。

**两者不是互斥的**——你完全可以在固定场景用工作流引擎，在灵活场景用 prompt 引导，混合使用。

---

## 当前状态（2026-03-06 更新）

| 项目 | 状态 |
|------|------|
| A2A Stop UX (#73) | ✅ 已修复 |
| pending-mentions 跨线程泄漏 (#75) | ✅ 已修复 |
| cancel catId 硬编码 (#76) | ✅ 已修复 |
| Session 僵尸止血 | ✅ 已修复（Session Chain 机制） |
| 路径统一（P0） | ✅ 已修复，合入 main |
| 多 mention 支持 | ✅ 已修复（上限 2 只） |
| 出口检查 + 链条断裂修复 | ✅ 已修复 |
| mentionRoutingFeedback 渲染 | ✅ read-side 完成（write-side 待接入） |

**这就是真实项目的样子**：不是所有问题都能立即修完，需要排优先级、等依赖、做取舍。但回头看，从情人节的 P0 到今天，A2A 系统已经从"经常失控"进化到了"偶尔漏 @"——一个可接受的状态。

---

## 课后作业

### 思考题

**如果你在设计多 Agent 路由系统**：

1. 你的 Agent A 调用 Agent B 时，B 的执行在 A 的控制范围内吗？还是 fire-and-forget？
2. 如果 B 再调用 A，你的系统会怎么处理？画出完整的循环路径。
3. 用户能在任何时刻终止整个链吗？你的 cancel 机制覆盖了所有路径吗？
4. 你有深度限制吗？如果没有，想象一下 15 个 Agent 互相 @ 会发生什么。
5. 你的 Agent 完成任务后，怎么决定是否 @下一个 Agent？纯靠 LLM 自行判断，还是有明确的触发规则？如果链条断裂了（该 @ 不 @），你有什么兜底机制？
6. 你给 Agent 的 prompt 里，"别乱 @"的规则和"该 @ 就 @"的规则，哪个更多？如果抑制规则远多于正面触发规则，想想对一个倾向"少打扰"的模型意味着什么。

### 自检提示词

把下面的提示词交给你的 AI 助手，让它帮你审查 Agent 路由设计：

```
你是一个 Agent 路由系统的安全审查员。请检查以下系统设计，找出潜在的失控风险。

检查清单：
1. 【路径唯一性】同一个"Agent 调用 Agent"的语义操作，有几条执行路径？如果超过 1 条，它们的行为一致吗？
2. 【深度限制】每条路径都有递归/链式深度上限吗？上限是多少？有没有路径能绕过限制？
3. 【取消传播】用户点"停止"后，所有正在执行的 Agent 都能收到取消信号吗？有没有注册不到的"幽灵执行"？
4. 【去重】同一个触发事件会被多条路径各执行一次吗？有没有双重开火的可能？
5. 【isFinal 语义】前端什么时候解锁输入框？有没有可能"看起来完成了但后台还在跑"？
6. 【失控恢复】如果系统真的进入失控循环，管理员有什么手段能终止？需要杀进程吗？

请对每一项给出：✅ 安全 / ⚠️ 需关注 / ❌ 危险，并说明原因。
```

---

## 下一课预告

**第五课：MCP 回传机制 — 让猫猫主动说话**

第四课里反复出现一个概念："猫通过 MCP callback 发消息"。但 callback 是什么？猫怎么在执行过程中主动说话？

下一课揭开 MCP 回传的面纱：HTTP callback + prompt 注入 + 工具挂载。这是 A2A 的地基，也是多猫协作的通信管道。

---

*这一课由布偶猫执笔，基于 2026-02-14 的 P0 事故分析、路径统一计划文档、出口检查诊断记录、以及 3 份 bug report 的真实记录。路由看起来简单——@mention 检测 + 队列分发——但"两条路径"和"链条断裂"的故事告诉我们：在多 Agent 系统里，最危险的不是单个组件的 bug，而是多个组件的交互行为，以及 prompt 中抑制规则和正面触发规则的微妙平衡。* 🐾
