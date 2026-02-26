---
feature_ids: [F027]
topics: [a2a, path, unification]
doc_kind: plan
created: 2026-02-14
---

# F27: A2A 路径统一 — 两条路合一 + 全链可取消 + 多 mention

> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-14
> **状态**: 📋 待实施（等 F24 合入后再开工）
> **优先级**: P0（已复现服务不可用）
> **负责**: 布偶猫
> **Review**: 缅因猫
> **Bug Report**: [`2026-02-14-a2a-feedback-loop`](../bug-report/2026-02-14-a2a-feedback-loop/bug-report.md)

---

## 0. P0 事故（2026-02-14 晚）

Thread `thread_mln54grb12u8v28h`（F24 三猫 review 大线程）中布偶猫和缅因猫陷入无限乒乓：
- 同一 @mention 被 Path A + Path B **双重开火**
- Path B 无深度限制 → **无限递归**
- Callback child 不注册 tracker → **不可取消**
- 铲屎官被迫强制重启服务器

详细分析见 Bug Report。铲屎官明确要求：**F24 合入后立即修，一步到位，不做临时止血。**

---

## 1. 问题

猫猫互相调用（A2A）目前有两条路径，行为不一致：

### 路径 A: Worklist 链式（`route-strategies.ts`）

猫的回复文本里写了 `@缅因猫` → `routeSerial()` 的 `parseA2AMentions()` 检测到 → 追加到 worklist → 在同一个循环里执行下一只猫。

- ✅ 共享父调用的 AbortController → 用户点 Stop 能终止
- ✅ `isFinal` 延迟到 worklist 全部完成 → 前端不会提前解锁输入
- ✅ 有 `a2a_handoff` 消息 → 前端能看到"布偶猫 → 缅因猫"

### 路径 B: MCP Callback（`callback-a2a-trigger.ts`）

猫在工具调用中主动用 `cat_cafe_post_message` 发消息，消息带 @mention → callback 路由检测到 → `triggerA2AInvocation()` 独立发起新的 `routeExecution()`。

- ❌ 父活跃时跳过 `tracker.start()` → 没有 AbortController → **用户无法取消**
- ❌ 独立于父调用运行 → 父的 `isFinal` 不知道子还在跑
- ⚠️ 有 `a2a_handoff` 消息但前端无法控制

### 附带问题：多 mention 只路由 1 只猫

`parseA2AMentions()` 返回 `string | null`（单个目标）。当布偶猫需要同时派活给缅因猫和暹罗猫时，只有第一只收到。

---

## 2. 方案：合并成一条路径

### 核心思路

**callback-a2a-trigger 不再自己执行猫调用，改为把目标猫追加到父调用的 worklist。**

```
改前:
  猫 A 执行中 (routeSerial worklist)
    → 猫 A 调用 MCP post_message(@猫B)
      → callback-a2a-trigger 检测到 @猫B
        → 独立发起 routeExecution(猫B)  ← 脱离父控制，无法取消
          → 猫 B 执行（无 signal）

改后:
  猫 A 执行中 (routeSerial worklist)
    → 猫 A 调用 MCP post_message(@猫B)
      → callback-a2a-trigger 检测到 @猫B
        → worklist.push(猫B)  ← 追加到父 worklist
        → return（不自己执行）
    → 猫 A 完成当前轮
    → routeSerial 循环继续 → 执行猫 B（共享同一个 signal）
```

### 统一后的行为

| 维度 | 统一后 |
|------|--------|
| 可取消 | 所有 A2A 都在 worklist 里，共享父 AbortController |
| 前端感知 | 所有 A2A 都有 `a2a_handoff` + `isFinal` 延迟 |
| 深度限制 | 共享 `MAX_A2A_DEPTH` 计数 |
| 路径数量 | 1 条 |

### 多 mention 改动

`parseA2AMentions()` 返回值从 `string | null` 改为 `string[]`：

```typescript
// 改前
function parseA2AMentions(text: string, currentCat: string): string | null

// 改后
function parseA2AMentions(text: string, currentCat: string): string[]
// - 返回所有被 @mention 的猫（排除 currentCat）
// - 上限 2 只（防止猫猫互相扇形调用失控）
// - worklist.push(...targets) 一次追加多只
```

多只猫追加到 worklist 后走**串行执行**（一只做完再做下一只）。理由：
- 猫 A 同时派活给 B 和 C 通常有隐含依赖（review + 设计）
- 串行不需要改 worklist 循环结构，改动最小
- 如果确实需要并行，铲屎官直接在输入里 @两只猫就行（走 parallel 模式）

---

## 3. 实现细节

### 3.1 worklist 追加接口

`routeSerial()` 需要暴露一个方式让 callback 能追加目标。两个选项：

**选项 A: 共享可变数组**

worklist 本身就是 `routeSerial()` 里的 `const worklist: string[]`。callback 需要拿到这个数组的引用才能 push。可以通过闭包或者把 worklist 挂到某个 per-thread 的共享上下文上。

```typescript
// route-strategies.ts
const worklist = [...initialCats];
const worklistRef = { list: worklist };

// 注册到 per-thread 上下文，让 callback 能找到
threadWorklistRegistry.set(threadId, worklistRef);

try {
  for (let i = 0; i < worklist.length && i < MAX_A2A_DEPTH; i++) {
    // ... 执行 worklist[i] ...
    // 执行过程中 callback 可能 push 新猫到 worklist
  }
} finally {
  threadWorklistRegistry.delete(threadId);
}
```

**选项 B: 事件通知**

callback 发出事件，routeSerial 监听并追加。更解耦但更复杂。

**我倾向选项 A** — 直接、简单、Cat Café 是单进程不需要跨进程通信。

### 3.2 callback-a2a-trigger.ts 改造

```typescript
// 改前: 自己执行
export async function triggerA2AInvocation(...) {
  const target = parseA2AMentions(content, sourceCat);
  if (!target) return;

  const parentActive = invocationTracker?.has(threadId);
  if (!parentActive) {
    controller = invocationTracker?.start(...);
  }
  // 自己跑 routeExecution ...
}

// 改后: 追加到父 worklist
export function enqueueA2ATargets(threadId: string, content: string, sourceCat: string): string[] {
  const targets = parseA2AMentions(content, sourceCat);
  if (targets.length === 0) return [];

  const worklistRef = threadWorklistRegistry.get(threadId);
  if (worklistRef) {
    // 父 worklist 存在 → 追加
    worklistRef.list.push(...targets);
    return targets;
  }

  // 无父 worklist（理论上不应该发生，callback 总是在猫执行期间触发）
  // fallback: 像铲屎官消息一样走 POST /api/messages
  return [];
}
```

### 3.3 routeSerial worklist 循环调整

当前循环在每只猫完成后检查回复文本的 @mention。改后需要同时处理：
- 回复文本里的 @mention（现有逻辑）
- callback 追加的目标（通过共享数组自动包含）

两者自然合并——都是 worklist 里的新元素，循环的 `i < worklist.length` 条件会自动包含运行中被 push 进来的猫。

唯一需要注意：**去重**。如果猫 A 的回复文本 @缅因猫，同时 callback 也追加了缅因猫，不应该执行两次。

```typescript
// 去重: worklist 追加前检查
function pushUnique(worklist: string[], ...cats: string[]) {
  for (const cat of cats) {
    if (!worklist.includes(cat)) {
      worklist.push(cat);
    }
  }
}
```

### 3.4 `isFinal` 语义自动正确

现有逻辑：`isFinal = (i === worklist.length - 1)`

因为 worklist 会在执行过程中动态增长（callback push + 回复 @mention push），`isFinal` 只有在真正最后一只猫完成时才为 true。这个语义**不需要改**。

### 3.5 取消传播自动正确

worklist 循环每轮开头检查 `signal.aborted`：

```typescript
for (let i = 0; i < worklist.length && i < MAX_A2A_DEPTH; i++) {
  if (signal?.aborted) break;  // ← 已有逻辑
  // ... 执行 worklist[i]
}
```

callback 追加的猫在 worklist 后面排队，如果 signal 已 abort，循环 break，它们自然不会被执行。**不需要额外改动。**

---

## 4. 删除清单

统一后可以删除的代码：

| 文件/代码 | 原因 |
|-----------|------|
| `callback-a2a-trigger.ts` 中的 `routeExecution` 调用 | 不再自己执行 |
| `callback-a2a-trigger.ts` 中的 `invocationTracker.start()` 条件逻辑 | 不再需要判断 parentActive |
| `callback-a2a-trigger.ts` 中的 `invocationTracker.complete()` 调用 | 不再持有 tracker |
| `triggerA2AInvocation` 函数整体重写为 `enqueueA2ATargets` | 从"执行者"变为"入队者" |

---

## 5. 改动文件清单

| 文件 | 改动 | 量级 |
|------|------|------|
| `a2a-mentions.ts` | `parseA2AMentions` 返回 `string[]` + 上限 2 | 小 |
| `route-strategies.ts` | worklist 注册到 `threadWorklistRegistry` + `pushUnique` | 中 |
| `callback-a2a-trigger.ts` | 重写为 `enqueueA2ATargets`（删执行逻辑） | 中（净删代码） |
| callbacks 路由 | 调用 `enqueueA2ATargets` 替代 `triggerA2AInvocation` | 小 |
| 测试 | callback A2A 追加 worklist + 多 mention + 取消传播 | 中 |

总量估计：~100 行改 + ~80 行删 + ~60 行新测试

---

## 6. 测试用例

| 场景 | 预期 |
|------|------|
| 猫 A 回复 @猫B → 猫 B 执行 | worklist 追加，共享 signal |
| 猫 A callback @猫B → 猫 B 执行 | worklist 追加，共享 signal（**核心修复**） |
| 猫 A callback @猫B @猫C → 两只都执行 | worklist 追加 2 只，串行执行（**多 mention 修复**） |
| 用户点 Stop → 所有 A2A 终止 | signal.aborted → worklist 循环 break |
| 回复 @mention 和 callback @mention 重复 | 去重，只执行一次 |
| 超过 MAX_A2A_DEPTH | 循环终止，不继续追加 |
| 无父 worklist 时的 callback @mention | fallback 处理（不应常见） |

---

## 7. 依赖与时序

- **等 F24 合入 main 后再开工** — F24 改了 session 管理和 context health，和 A2A 路径有交集，先合再改避免冲突
- 本 feat 不依赖 F26（UI 升级）—— 两者独立
