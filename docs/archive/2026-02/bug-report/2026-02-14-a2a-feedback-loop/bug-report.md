---
feature_ids: []
topics: [a2a, feedback, loop]
doc_kind: bug-report
created: 2026-02-14
---

# Bug Report: A2A 反馈循环 — 两猫无限乒乓 + 不可取消

> **报告人**: 铲屎官（2026-02-14 晚，thread_mln54grb12u8v28h 中亲历）
> **分析人**: 布偶猫
> **严重度**: P0（服务不可用，必须强制重启）
> **关联**: [F27 A2A 路径统一](../../plans/2026-02-14-a2a-path-unification.md)

---

## 1. 报告人 & 发现方式

铲屎官在 thread `thread_mln54grb12u8v28h`（F24 三猫 code review 大线程）中观察到：
- 布偶猫和缅因猫互相调用后状态混乱，两猫并发执行
- 消息暴增，无法通过 UI 停止
- **被迫强制重启服务器**

铲屎官原话：
> "缅因通过callback调用 又通过mcp 或者就是回复调用 然后导致两只猫状态很奇怪 互相并发"
> "一定要给我那种遇到问题我可以直接cancel某个对话回调的能力"

---

## 2. 复现步骤

### 前置条件
- 一个有三猫参与的长 thread（60+ 消息）
- 猫猫之间有 review 互调模式（opus review → codex review → opus fix → ...）

### 期望行为
1. 布偶猫 @缅因猫 请求 review → 缅因猫跑一次 → 返回结果
2. 缅因猫结果里 @布偶猫 → 布偶猫跑一次 → 修复
3. 每次只有**一只猫在跑**，铲屎官可以随时 cancel

### 实际行为
1. 布偶猫 @缅因猫 请求 review → 缅因猫开始跑
2. 缅因猫通过 MCP callback `post_message("@opus R8不通过...")` 发送结果
3. **同时两件事发生**:
   - **Path B（callback）**: `callbacks.ts` 检测到 @opus → `triggerA2AInvocation()` 立即在后台启动布偶猫
   - **Path A（worklist）**: 缅因猫 CLI 执行完毕 → `route-strategies.ts` 检测到 @opus → `worklist.push(opus)` → 也启动布偶猫
4. **两个布偶猫实例同时执行**（双重开火）
5. 两个布偶猫各自产生 @codex 的回复 → 各自触发缅因猫
6. 缅因猫又 @opus → 又触发布偶猫
7. **无限乒乓**，消息暴增，无法 cancel（callback 路径的 child 没注册 tracker）
8. 铲屎官被迫强制重启服务器

### 证据（Redis 取证）

| 指标 | 值 | 说明 |
|------|-----|------|
| Thread 消息数 | 60 | 大量来自循环 |
| Message #59 | 空内容 | 并发竞态导致 callback 写入异常 |
| Opus delivery cursor | msg 54（落后 7 条） | 消息暴增追不上 |
| Gemini delivery cursor | msg 18（落后 42 条） | 完全跟不上 |
| 最后一条消息 | 铲屎官强制重启通知 | 确认是人工介入停止 |

---

## 3. 根因分析

### 排查过程

1. **读 callback-a2a-trigger.ts** → 发现 `parentActive` 时跳过 `tracker.start()` 作为 child 跑，没有深度限制
2. **读 route-strategies.ts** → 发现 worklist 有 `a2aCount < maxDepth` 保护（默认 15）
3. **读 a2a-mentions.ts** → 确认 `getMaxA2ADepth()` 只被 worklist 使用
4. **比对两条路径** → 确认双重开火 + 无限递归

### 根因：两个独立缺陷叠加

#### 缺陷 A: 双重开火（同一 @mention 触发两条路径）

```
缅因猫 CLI 执行中...
├── [Path B] MCP callback post_message("@opus ...") ← 立即触发
│   → callbacks.ts:107-114 → triggerA2AInvocation()
│   → parentActive=true → 后台 fire-and-forget 跑 opus
│
└── [Path A] CLI 结束后 route-strategies.ts:376 → parseA2AMentions()
    → 也检测到 @opus → worklist.push(opus) → 也跑 opus

= 两个 opus 同时跑
```

**为什么会双重开火**: Path A 从 CLI 最终输出文本检测 mention；Path B 从每条 callback 消息检测 mention。同一段 "@opus" 文本被两个独立检测器各捕获一次。

#### 缺陷 B: Path B 无深度限制（无限递归）

```typescript
// route-strategies.ts (Path A) — 有保护 ✅
if (a2aMentions.length > 0 && a2aCount < maxDepth) { ... }

// callback-a2a-trigger.ts (Path B) — 完全没有深度计数 ❌
// 每次 callback @mention 都无条件触发新 invocation
```

Path B 的每个 child invocation 都可以产生新的 callback @mention → 触发新的 child → 无限循环。

#### 缺陷 C: Child invocation 不可取消

```typescript
// callback-a2a-trigger.ts:74
} else {
  // Parent active: 跳过 tracker.start()
  // 后果: 这个 child 没有注册到 InvocationTracker
  // → cancel(threadId) 找不到它 → 无法取消
  // → 只有杀进程才能停
}
```

### 历史脉络

| 时间 | 事件 | 影响 |
|------|------|------|
| 2026-02-14 `8eacef3` | `invocationTracker.has()` guard 封死所有 callback A2A | 安全但过度——所有 callback A2A 链断裂 |
| 2026-02-14 `8374297` | 修复：父活跃时作为 child 跑（无 tracker entry） | 恢复了 callback A2A，但**打开了双重开火 + 无限递归的大门** |
| 2026-02-14 晚 | 铲屎官遭遇反馈循环，强制重启 | 本 bug |

---

## 4. 修复方案

### 方案选择: F27 一步到位（铲屎官明确要求不做临时止血）

**核心思路**: callback 不再自己执行猫调用，改为追加到父 worklist。

详见 [F27 A2A 路径统一计划](../../plans/2026-02-14-a2a-path-unification.md)。

关键改动：

#### 4.1 统一成一条路径（消除双重开火）
- `callback-a2a-trigger.ts` 不再调用 `router.routeExecution()`
- 改为：检测到 @mention → 追加到 `threadWorklistRegistry` 共享数组
- `route-strategies.ts` 的 worklist while 循环自然消费新增的猫
- **一个 @mention 只有一个执行者**

#### 4.2 统一深度限制
- worklist 的 `a2aCount < maxDepth` 自然覆盖所有 A2A（因为只有一条路）
- 不再需要 Path B 单独的深度计数

#### 4.3 全链可取消（铲屎官核心诉求）
- 所有猫执行共享同一个 `AbortController`（来自 `InvocationTracker`）
- 用户点 cancel → `tracker.cancel(threadId)` → signal abort → while 循环 break
- **不再有注册不到 tracker 的"幽灵 child"**

### 放弃的方案

| 方案 | 为什么不选 |
|------|-----------|
| 止血：parentActive 时不触发 callback A2A | 铲屎官说"不止血，F27 一步到位" |
| Path B 加深度计数 | 治标不治本，双重开火仍在 |
| Path B 也注册 tracker | 会 abort 父 invocation，更乱 |

---

## 5. 验证方式

### 修复后必须通过的场景

| # | 场景 | 期望 | 现状 |
|---|------|------|------|
| 1 | Opus @codex, codex 回复 @opus | 依次执行，不并发 | ❌ 并发双重开火 |
| 2 | Opus ↔ codex 互 review 3 轮 | 6 次调用（每轮 2 次），到 maxDepth 停 | ❌ 无限循环 |
| 3 | 循环执行中铲屎官点 cancel | 所有猫立即停止 | ❌ child 不可取消 |
| 4 | 三猫同时 @mention（@opus @codex @gemini） | 依次执行最多 2 只 | ❌ 只路由 1 只 |
| 5 | Callback @mention 在代码块里 | 不触发 A2A | ✅ 已正确（strip fenced blocks） |

### 测试命令

```bash
# F27 实现后运行
pnpm --filter @cat-cafe/api test -- --grep "A2A"
pnpm --filter @cat-cafe/api test:redis -- --grep "A2A"
```

---

## 附录: Thread 取证数据

```
Thread: thread_mln54grb12u8v28h
Title: @布偶 @缅因 @暹罗 猫猫们看看f24...
Messages: 60
Participants: opus, codex, gemini
Created: 2026-02-14 18:42 PST
Last Active: 2026-02-14 22:38 PST
Outcome: 铲屎官强制重启服务器
```
