---
feature_ids: [F148, F193]
topics: [prompt, context, cross-thread, routing, briefing, incident]
doc_kind: bug-report
created: 2026-05-29
severity: P0
status: investigating
related_features: [F148, F193, F192, F200]
---

# Incident Report: Cross-thread context contaminated PR #1942 merge thread

> 报告人：铲屎官  
> 调查猫：缅因猫/砚砚（@gpt52）  
> 当前线程：`thread_mp6b68w9w0wt1boc`  
> 外来线程：`thread_mpr44buzrj1m793o`  
> 事故窗口：2026-05-29 16:14 UTC - 16:37 UTC

## 1. 摘要

在 PR `#1942` 的 merge / cloud review 收尾线程里，当前 invocation 原本一直在做
F192 Phase F 的 merge-gate。随后当前线程里突然出现一段完全不属于本任务的闲聊
上下文，内容围绕：

- `R8`
- `披着专业外衣的不太光彩偏好`
- `@codex`
- 多猫 round-chat 传球

我随后错误地把这段外来上下文当成当前线程的有效 handoff，回了一条：

```text
最后一条明确写的是 @codex，不是 @gpt52。这球不在我这儿……
```

这不是单纯的“我读错了球”。现在已经有证据表明：**外线程内容确实进入了当前线程
后续 invocation 的 prompt**。

因此这是一次 **thread isolation / prompt integrity** 事故。虽然没有数据删改，但它
突破了“当前线程只应消费当前线程 live context”的边界，足以改变 agent 的下一步行为，
所以按 P0 记录。

## 2. 影响

- PR `#1942` merge-gate 流程被打断。
- 当前线程短时间偏离到无关话题，出现错误 A2A 路由。
- 当前线程的 prompt integrity 被破坏：非当前任务的上下文进入后续 prompt。
- 当前线程里的人类与猫都无法再仅凭聊天历史判断“这段上下文是不是本线程真球”。
- 截止本报告写入时，没有发现因此产生的错误代码提交或错误 merge。

## 3. 已确认的事实

### 3.1 外线程内容真的进入了当前线程 prompt

Prompt capture 证明了这一点：

- `/Users/lysander/.cat-cafe/prompt-captures/payloads/331fce47-2c62-4fdb-b6ff-cfb3a0b9e46b.json.gz`
  - `catId=codex`
  - `threadId=thread_mp6b68w9w0wt1boc`
  - prompt 同时包含：
    - `Direct message from 缅因猫 GPT-5.4(gpt52)`
    - `披着专业外衣的不太光彩偏好`
    - `R8`
- `/Users/lysander/.cat-cafe/prompt-captures/payloads/5528a17a-c96a-448a-8f7c-57e4ea18caac.json.gz`
  - `catId=antig-opus`
  - `threadId=thread_mp6b68w9w0wt1boc`
  - 同样包含 `披着专业外衣的不太光彩偏好` 和 `R8`

这说明污染不是 UI 幻觉，也不是只存在于消息存储里，而是已经进入 agent 真正收到的
prompt。

### 3.2 这段外来内容原本属于另一条 thread

Redis AOF 里可确认该 round-chat 内容属于：

- `thread_mpr44buzrj1m793o`

并且 AOF 中能看到该线程的原始内容，例如：

- `@codex ... "披着专业外衣的不太光彩偏好" ... R8`
- `47 这题点名问的是你`

所以这段内容并非“当前线程里早就有，只是我忘了”，而是有明确外来源 thread。

### 3.3 污染不是“同一个 invocation 跑到 80% 时被异步插入”

从 prompt capture 与代码路径看，更像下面这条链：

1. 某一轮里，当前线程出现错误 route / 错误 recall。
2. 外线程内容被拉进当前线程的上下文组装面。
3. 下一轮 invocation 重新 assemble prompt 时，把这段内容写进了
   `[导航]` / `[对话历史增量]` 一类上下文包。
4. 后续猫收到的是**已经被污染的新 prompt**。

也就是说，这是 **next-invocation prompt assembly contamination**，不是
mid-invocation live injection。

## 4. 代码证据

当前 prompt 组装流程的关键事实：

1. `assembleIncrementalContext()` 会把 `navigationHeader` 和
   `[对话历史增量 ...]` 包直接拼进 prompt  
   - `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts`

2. warm path 会直接产出：

```text
[导航]
...
[对话历史增量 - 未发送过 N 条]
...
[/对话历史]
```

3. smart-window path 也会产出：

```text
[导航]
[对话历史增量 - 智能窗口: ...]
...
[/对话历史]
```

4. `formatNavigationHeader()` 负责生成：
   - `传球`
   - `原文`
   - `真相源`
   - `下一步`
   - `packages/api/src/domains/cats/services/agents/routing/navigation-context.ts`

5. route 层在 smart-window 触发时还会自动写一条 `origin=briefing` 的系统 briefing
   message  
   - `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
   - `packages/api/src/domains/cats/services/agents/routing/format-briefing.ts`

6. 测试已经明确 guard 过一种“envelope poison”：
   - `threadMemory with envelope poison is sanitized`
   - `packages/api/test/f148-assemble-incremental.test.js`

这说明系统已经知道“伪造上下文 envelope”是一个风险面，但这次事故绕过的不是单纯
字符串毒化，而更像是**错误信任了跨线程召回/briefing 输入**。

## 5. Redis / 运行面证据

在
`/Users/lysander/.cat-cafe/redis-dev/appendonlydir/appendonly.aof.46.incr.aof`
里，可以确认几件事：

1. 外来 round-chat 内容属于 `thread_mpr44buzrj1m793o`。
2. 当前事故线程里出现过：
   - `get_thread_context`
   - `search_evidence`
   - 以及含 `@codex` / `R8` / `披着专业外衣的不太光彩偏好` 的内容片段
3. AOF 还出现了当前线程的 briefing/rich-card 风格内容，说明“别 thread 的上下文”
   很可能先被转成了某种 context/briefing surface，再进入后续 prompt。

这组证据支持：

- 不是 runtime 随机把另一条 thread 的 live message 投递进来了。
- 更像是某条 recall / thread-context / briefing 数据通道，把外线程内容提升成了
  当前线程可消费的上下文。

## 6. 直接原因 vs 系统性根因

### 6.1 直接原因

我在看到外来上下文后，没有先做“这是不是当前任务的球”的隔离判断，就把它当成当前
thread 的有效 handoff 接了。

这解释了为什么我会回那条错误的 `@codex` 消息，但**这不是全部根因**。

### 6.2 系统性根因（已确认到这一层）

当前线程后续 invocation 的 prompt 组装，错误地信任/吸收了来自别的 thread 的上下文
片段。

换句话说，**thread isolation 边界在 recall / briefing / incremental context
assembly 之间某处失守了**。

### 6.3 更深一层的精确失守点（仍在调查）

目前还没精确钉死到底是下面哪一层：

1. `search_evidence` 结果被错误升级成当前任务上下文
2. `get_thread_context` 的结果被错误写回当前线程上下文面
3. smart-window / briefing 组装时，没有区分“索引证据”和“当前 live task context”
4. 某个 cross-thread relay / direct-message 保护没正确生效

所以目前的结论是：

- **确认有污染**
- **确认不是 mid-invocation 插入**
- **确认污染发生在 next-invocation prompt 组装链**
- **尚未确认是哪一个具体函数/字段把 foreign context 升格成了 live context**

## 7. 排除项

以下解释现在可以排除：

1. **“只是我自己读错了”**
   - 不成立。prompt capture 已证明外线程内容真的进 prompt。

2. **“是别的 thread 直接 live 发消息过来”**
   - 目前无证据支持。现有证据更像 recall/briefing 污染，不像 live transport 自发串线。

3. **“是在同一个 invocation 中途突然插入的”**
   - 不像。更符合“前一轮产生污染，后一轮重新 assemble prompt 时带入”。

## 8. 为什么这是 P0

这次没有删数据，也没有误 merge，但它仍然是 P0，原因是：

- 它破坏的是 **thread isolation**
- 破坏后直接影响 agent 行为选择
- 破坏后人类与猫都可能把“外线程内容”误认成“当前线程真球”
- 如果不被打断，下一步可能继续产生错误 handoff、错误 review、错误 merge 决策

这是**完整性/隔离性事故**，不是普通的 P2 文案或 recall 误命中。

## 9. 立即处置

1. 暂停 PR `#1942` 的 merge，先保留事故现场与证据链。
2. 把本报告落盘，避免 merge 后丢失调查上下文。
3. 后续 merge / 再审只认：
   - 当前 PR 头 SHA
   - 当前线程明确任务
   - 不再信任未验证的 recall/briefing 碎片

## 10. 后续调查与修复建议

1. **查清污染入口**
   - 钉死 foreign thread 内容是经由：
     - `search_evidence`
     - `get_thread_context`
     - `threadMemorySummary`
     - `anchorSummaries`
     - `briefingContext`
     - 还是其它字段进入 prompt

2. **把“证据”与“任务上下文”分层**
   - recall 结果必须是 candidate/index，不得直接视为当前 live task context

3. **给跨线程来源加硬标签**
   - source kind / source thread / trust level 必须在 prompt 组装前可判别

4. **增加 regression test**
   - 当前线程做 merge-gate 时，外线程 round-chat 命中 search / thread-context
     也不得进入当前 prompt 的 live baton / history envelope

5. **补一次 merge 前 continuity 检查**
   - 等事故 owner 判断清楚后，再决定是恢复原 PR，还是换干净线程/干净 PR 收尾

## 11. 当前结论

这次“上下文串了”不是幻觉，也不是纯操作失误。

**已经确认：外线程内容进入了当前线程后续 invocation 的 prompt。**

我自己的错误，是在看到那段外来上下文后继续接球；系统的错误，是让那段上下文有机会
以“像当前线程真球”的形状进入 prompt。

在精确入口钉死前，这张事故单应视为 open，PR `#1942` 不应直接 merge 收尾。

[砚砚/gpt-5.4🐾]
