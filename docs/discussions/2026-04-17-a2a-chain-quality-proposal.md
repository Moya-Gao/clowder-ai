---
title: "A2A Chain Quality — 乒乓球熔断 + 虚空传球检测"
date: 2026-04-17
author: 布偶猫 (opus/claude-opus-4-6)
type: proposal
related: [F064, F027, F122]
status: draft
topics: [a2a, collaboration, harness-engineering]
---

# A2A Chain Quality — 乒乓球熔断 + 虚空传球检测

> **提案人**: 布偶猫 (Opus 4.6) | **日期**: 2026-04-17
> **起因**: 铲屎官定期审视 harness engineering 后的结论
> **建议**: 新立 Feature（F064 已 done，本提案解决 F064 的反向问题）

## 1. 问题陈述

F064 解决了 A2A 协作的**漏传球**（该 @ 没 @，铲屎官被迫当路由器）。现在暴露的是三个反向问题：

### 1.1 乒乓球（Ping-Pong）

同一对猫 A↔B 反复 @，每轮都是协调性废话（"ack""对齐""好的明白了"），无实际产出。

**证据**: 2026-04-17 截图中 GPT-5.4 与 Opus-4.7 连续 4 轮对话全是 contributor gate 结果确认，没有一轮有 tool_use 或代码产出。

**现有护栏为什么没拦住**:
- `MAX_A2A_DEPTH = 15`：全局上限太宽松，同一对猫弹 7 次才到一半
- WorklistRegistry 明确允许 re-queue（注释写着 "e.g. A→B→A review ping-pong"）
- 无 pair-level bounce 计数

### 1.2 虚空传球（Phantom Ball-Passing）

猫说"我来做 X，你不需要动"，但同时 @ 对方。对方收到球后遵从"你不需要动"的指令不动，结果：
- 说"我来做"的猫以为球传走了
- 收到球的猫以为自己不该动
- 活没干，球在地上

**根因**: `feedback_always_at_back`（"必须 @ 回砚砚"）是为防链路锁死加的补丁，与"你不用动"产生语义矛盾。补丁反噬。

### 1.3 Parallel 模式豁免洞

`SystemPromptBuilder.ts:517` 只在 `mode !== 'parallel'` 时注入出口检查。但缅因猫静态 prompt 仍有"讨论完 → @ 对应猫"指令，两条规则打架。Parallel 里的 @ 被 `route-parallel.ts` 存下来但不链式调度，最终只是文本噪声。

## 2. 与 F064 的关系

| 维度 | F064（已 done） | 本提案 |
|------|---------|--------|
| **解决方向** | 漏传球（该 @ 没 @） | 过度传球（不该 @ 还在 @） |
| **核心机制** | 出口检查提示 + write-side 反馈 | 乒乓球熔断 + 虚空传球检测 |
| **护栏类型** | 提示层（依赖模型遵守） | harness 硬护栏（不依赖模型遵守） |
| **scope** | 已闭合 | 新问题 |

**建议**: 新立 Feature，不重开 F064。原因：F064 scope 明确为"链条终止盲区"，愿景守护已签收。本提案方向相反，应独立跟踪。

## 3. 三猫共识（2026-04-17 讨论）

| 参与者 | 核心观点 |
|--------|---------|
| **布偶猫 (Opus 4.6)** | 根因是 `feedback_always_at_back` 补丁反噬；需要从规则层升级到语义层门禁；出口分类器（work/handoff/ack/null） |
| **缅因猫 (GPT-5.4)** | parallel 硬禁 @，serial handoff 必须带 Next Action；出口检查只覆盖"漏传球"没覆盖"假传球"；按 process evolution 提案格式做 |
| **铲屎官观察** | 小猫们（国产模型）也容易无限互 @；Opus 4.7 + 砚砚 = 两只砚砚在打乒乓球；@ 解析有时该命中没命中也是链路断裂原因 |

## 4. @ 解析现状速查（代码审计结论）

**路由规则** (`a2a-mentions.ts`):
- 行首 @句柄 → 路由（无需动作词）
- 句中 @句柄 → **不路由**，只进 write-side 反馈（下次注入 `[路由提醒]`）
- 代码块内 → 剥离不解析
- 自己 @ 自己 → 过滤
- 每条消息最多路由 2 只猫（`MAX_A2A_MENTION_TARGETS = 2`）

**常见链路断裂原因**:
1. 句中 @ 不路由（"Ready for @codex review" → 没换行）
2. Parallel 模式 @ 全是废话（存但不调度）
3. mentionPatterns 未注册的句柄不匹配

**常见链路过载原因**:
1. 无 pair-level bounce 计数（同一对猫可弹到 depth 15）
2. 无"协调废话"vs"实际产出"区分
3. `feedback_always_at_back` 强制 @ 回 + 虚空传球 = 死循环

## 5. 升级方案（分层）

### L1 — 乒乓球熔断（~80 行代码，立竿见影）

**改动**: `WorklistRegistry`（canonical enqueue 点）

> **Review 修正 (GPT-5.4 P1)**: 原方案用 raw pair count 会误杀正常 review 循环 (A→B→A→B)。
> 改为**连续 same-pair streak**：中间插入其他猫或 user 消息即 reset。
> 落点从 route-serial.ts 移到 WorklistRegistry canonical push，覆盖 callback-a2a-trigger 路径。

```
WorklistEntry 新增:
  lastA2APairs: string[]  // 最近 N 次 A2A 的 pair key 序列

WorklistRegistry.push (canonical enqueue) 中:
  const pairKey = [fromCat, toCat].sort().join('↔');
  const streak = countTrailingStreak(lastA2APairs, pairKey);
  if (streak >= 4) → 终止 + emit 系统消息 "🏓 乒乓球熔断"
  if (streak >= 2) → 注入警告 "你们已经连续弹 {streak} 轮了"
  lastA2APairs.push(pairKey);
```

**边界保护**:
- 正常 review re-submit (A→B→A→B) 允许 3 次 streak，第 4 次才熔断
- 链中间插入第三只猫 (A→B→C→B) 会 reset A↔B streak
- user 消息进 queue 也 reset streak（已有 fairness gate 保证）
- callback-a2a-trigger 走同一个 WorklistRegistry.push → 无旁路

**为什么有效**: harness 侧硬护栏，不依赖模型遵守 prompt。对国产猫同样有效。

### L2 — Parallel @ mention 降噪（prompt + harness 双层）

> **Review 修正 (GPT-5.4 P2)**: 原方案 prompt-only 不够，route-parallel 仍解析并持久化 mention。

**改动**: `SystemPromptBuilder.ts` + `route-parallel.ts`

1. **Prompt 层**: parallel 模式注入 "独立思考禁止 @句柄，引用队友写名字不写 @"
2. **Harness 层**: route-parallel 解析到的 mentions 标记为 `suppressedInParallel`，不写入消息元数据的 routedMentions 字段，UI 展示为灰色纯文本而非可点击路由标记
3. 清理缅因猫静态 prompt 里与 parallel 模式矛盾的"讨论完 → @ 对应猫"指令

### L3 — 虚空传球检测（~30 行）

**改动**: `route-serial.ts` write-side detection

在行首 @mention 被解析后，检测同一响应文本是否包含否定动作模式（"你不需要""不用动""等我""我来""我静默执行"）。如果矛盾 → emit 警告 + 可选拦截。

### L4 — 协调废话熔断（需更多设计）

追踪连续 A2A hop 是否有 tool_use。连续 2 轮无 tool_use 且无 code block → 注入"连续协调性回复无产出，请执行或收尾"。

### L5 — feedback_always_at_back 降级

当前: "必须始终 @ 回砚砚"（硬规则）。
建议: 降级为 "有实际交付物时 @ 回"。纯 ack 不需要 @ 回。配合 L1 的 bounce 检测一起调整。

## 6. 优先级建议

| 层 | 投入 | 收益 | 优先级 |
|----|------|------|--------|
| L1 乒乓球熔断 | 中（~80 行） | 大（覆盖所有猫） | **P0 — 先做** |
| L2 Parallel @ 降噪 | 小（~20 行） | 中（消除噪声） | **P0 — 先做** |
| L3 虚空传球检测 | 中（~30 行） | 中 | P1 |
| L5 always_at_back 降级 | 小（改 memory） | 中（消除补丁反噬） | P1（L3 之后） |
| L4 协调废话熔断 | 大（需 tuning） | 高但风险高 | P2 |

> **优先级调整 (GPT-5.4 建议)**: L3 提前到 L5 前面。先补"有效 handoff/矛盾 handoff"语义，再降级 always_at_back，否则容易把 F064 的漏传球重新放回来。

## 7. Opus 4.7 砚砚化问题（附录）

铲屎官观察到 Opus 4.7 行为过于机械，缺乏布偶猫应有的灵活判断：

1. **SOP 过度遵守**: 小 enhancement 开完整 feature 流程（应该挂已有 feat 或记 issue）
2. **规则过度字面化**: "不能碰 runtime" 理解为不能读日志（应理解为只读不写）
3. **协作风格砚砚化**: 来回确认、传球式沟通，不像布偶猫的"先干再说"

**初步判断**: 这可能不是 harness 能完全解决的——如果底层模型行为偏向机械执行，prompt 层的身份注入效果有限。但有两个可尝试的方向：

1. **identity injection 加强**: 在 Opus 4.7 的 prompt 中加入布偶猫 vs 缅因猫的行为差异对比（"布偶猫的判断力 = 知道什么时候不走 SOP"）
2. **judgment calibration examples**: 在 prompt 中给出几个"该变通 vs 该走流程"的具体例子

这部分需要更多观察数据，建议先收集 2-3 周 4.7 的行为样本再做结构性调整。

## 8. 活体证据（2026-04-17 当天）

### Case 1: GPT-5.4 + Opus-4.7 乒乓球
截图：连续 4 轮对话全是 contributor gate 结果确认 + hold 状态同步，无 tool_use。
→ L1 连续 streak 熔断会在第 3 轮警告、第 4 轮切断。

### Case 2: Opus-4.7 虚空传球 gemini
4.7 输出："同步，不 @ 任何人，让链静默，下一个信号：gemini push"
问题三重：
1. 没用 MCP 工具实际 @ gemini → gemini 根本不知道有球
2. "不 @ 任何人" + "下一个信号 gemini push" 语义矛盾
3. 说"自己检测暹罗猫"但自己无法检测 → 又是虚空传球

→ L3 虚空传球检测会捕获"不 @" + 隐式期望其他猫动作的矛盾模式。

## 9. Review 记录

| Reviewer | 日期 | 结论 | 关键修正 |
|----------|------|------|---------|
| GPT-5.4 | 2026-04-17 | 支持新立 Feature，L1+L2 方向对但实现需改 | raw count→consecutive streak；落点→canonical enqueue；L2 加 harness 层 |
| Codex | — | 待 review | — |

## 10. 开放问题

1. L1 的 consecutive streak threshold：当前建议 streak = 4 熔断（允许正常 review 循环 A→B→A→B 共 3 次 streak，第 4 次切断）。GPT-5.4 建议"第 2 次告警，第 4 次拦"，已采纳
2. L3 的否定动作词表需要哪些语言？中英双语？
3. L4 的"无产出"判定标准：只看 tool_use？还是也看 code block？
4. `feedback_always_at_back` 降级后会不会重新出现链路锁死？需要和 F064 的出口检查配合

---

**请 review 以下方面**:
- 分层优先级是否合理
- L1 bounce threshold 的合理值
- 是否应新立 Feature vs 挂 F064
- Opus 4.7 砚砚化是否有更好的应对思路
