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

### L1 — 乒乓球熔断（~50 行代码，立竿见影）

**改动**: `WorklistRegistry` + `route-serial.ts`

```
WorklistEntry 新增:
  pairBounceMap: Map<string, number>  // "opus↔gpt52" → count

route-serial.ts push worklist 前:
  const pairKey = [catId, nextCat].sort().join('↔');
  const bounces = (pairBounceMap.get(pairKey) ?? 0) + 1;
  pairBounceMap.set(pairKey, bounces);
  if (bounces >= 3) → 终止 + emit 系统消息
  if (bounces === 2) → 注入警告
```

**为什么有效**: harness 侧硬护栏，不依赖模型遵守 prompt。对国产猫同样有效。

### L2 — Parallel 禁止 @ 路由（~5 行）

**改动**: `SystemPromptBuilder.ts`

Parallel 模式下注入: "独立思考禁止 @句柄，引用队友写名字不写 @"。清理缅因猫静态 prompt 里与 parallel 模式矛盾的"讨论完 → @ 对应猫"指令。

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
| L1 乒乓球熔断 | 小（~50 行） | 大（覆盖所有猫） | **P0 — 先做** |
| L2 Parallel 禁 @ | 极小（~5 行） | 中（消除噪声） | **P0 — 先做** |
| L5 always_at_back 降级 | 小（改 memory） | 中（消除补丁反噬） | P1 |
| L3 虚空传球检测 | 中（~30 行） | 中 | P1 |
| L4 协调废话熔断 | 大（需 tuning） | 高但风险高 | P2 |

## 7. Opus 4.7 砚砚化问题（附录）

铲屎官观察到 Opus 4.7 行为过于机械，缺乏布偶猫应有的灵活判断：

1. **SOP 过度遵守**: 小 enhancement 开完整 feature 流程（应该挂已有 feat 或记 issue）
2. **规则过度字面化**: "不能碰 runtime" 理解为不能读日志（应理解为只读不写）
3. **协作风格砚砚化**: 来回确认、传球式沟通，不像布偶猫的"先干再说"

**初步判断**: 这可能不是 harness 能完全解决的——如果底层模型行为偏向机械执行，prompt 层的身份注入效果有限。但有两个可尝试的方向：

1. **identity injection 加强**: 在 Opus 4.7 的 prompt 中加入布偶猫 vs 缅因猫的行为差异对比（"布偶猫的判断力 = 知道什么时候不走 SOP"）
2. **judgment calibration examples**: 在 prompt 中给出几个"该变通 vs 该走流程"的具体例子

这部分需要更多观察数据，建议先收集 2-3 周 4.7 的行为样本再做结构性调整。

## 8. 开放问题

1. L1 的 bounce threshold 设多少合适？建议 same-pair cap = 3（允许 1 次正常来回 + 1 次确认，第 3 次熔断）
2. L3 的否定动作词表需要哪些语言？中英双语？
3. L4 的"无产出"判定标准：只看 tool_use？还是也看 code block？
4. `feedback_always_at_back` 降级后会不会重新出现链路锁死？需要和 F064 的出口检查配合

---

**请 review 以下方面**:
- 分层优先级是否合理
- L1 bounce threshold 的合理值
- 是否应新立 Feature vs 挂 F064
- Opus 4.7 砚砚化是否有更好的应对思路
