---
title: "A2A Chain Quality — 乒乓球熔断 + 虚空传球检测 + 角色护栏"
date: 2026-04-17
author: 布偶猫 (opus/claude-opus-4-6)
type: proposal
related: [F064, F027, F122]
status: reviewed-ready
feature_ids: [F167]
topics: [a2a, collaboration, harness-engineering]
---

# A2A Chain Quality — 乒乓球熔断 + 虚空传球检测 + 角色护栏

> **提案人**: 布偶猫 (Opus 4.6) | **日期**: 2026-04-17
> **起因**: 铲屎官定期审视 harness engineering 后的结论
> **建议**: 新立 Feature（F064 已 done，本提案解决 F064 的反向问题）
> **Review 状态**: GPT-5.4 ✅ 放行（3 P1 已修正）| Codex ✅ 退回→修正后放行（3 P1 同源已修正）

## 1. 问题全景（2026-04-17 一下午的发现）

F064 解决了"漏传球"（该 @ 没 @）。今天暴露了**六个**反向/关联问题：

### 1.1 乒乓球（Ping-Pong）
同一对猫 A↔B 反复 @，每轮都是协调性废话无实际产出。
**证据**: GPT-5.4 + Opus-4.7 连续 4 轮 contributor gate 确认，零 tool_use。

### 1.2 虚空传球（Phantom Ball-Passing）
猫说"我来做 X，你不需要动"但同时 @ 对方 → 球在地上没人捡。
**根因**: 规则层强制下一棒（`feedback_always_at_back` 等）+ 无语义门控 = 补丁反噬。

### 1.3 Parallel 模式豁免洞
出口检查只在 `mode !== 'parallel'` 注入，但缅因猫静态 prompt 仍有"讨论完 → @ 对应猫"。parallel 里的 @ 被存但不调度，纯噪声。

### 1.4 @ 格式认知缺失（Transport 世界模型）
猫以为"提到猫名" = "完成调度"，但实际只有**行首 @句柄**才触发路由。句中 @、错误句柄、非 MCP 路径的 @ 全部无效。
**证据**: 4.7 写"等 @gemini push"（句中 @，不路由）+ "让链静默"（以为已传球），gemini 根本没收到。

### 1.5 角色不适配 Handoff（Role-Unaware Routing）
猫把球传给能力不匹配的队友。路由层只看"catId 是否 available"，**不看角色适配**。
**证据**: 4.7 让暹罗猫(designer, "禁止写代码！") polish SystemNoticeBar.tsx。@ 格式错反而救了家——如果格式对了，系统会照发。
**GPT-5.4 审计确认**: AgentRouter.ts:604 和 callbacks.ts:402 均不检查角色能力。

### 1.6 规则字面执行 + 例外判断弱（"小笨猫"综合征）
不是某一只猫的问题，是**所有判断力弱的模型**的共性：
- SOP 过度遵守（小 enhance 开完整 feat）
- 规则过度字面化（"不碰 runtime" = "不能读日志"）
- 提到名字 ≠ 完成调度，但模型分不清

**铲屎官洞察**: 解决 4.7 的问题 = 解决所有小笨猫（glm/kimi/minimax/qwen）的问题。这是 **provider-agnostic 基础设施**。

## 2. 与 F064 的关系

| 维度 | F064（已 done） | 本提案 |
|------|---------|--------|
| **方向** | 漏传球（该 @ 没 @） | 过度/假/错误传球 |
| **护栏类型** | 提示层（依赖模型遵守） | harness 硬护栏（不依赖模型） |
| **受益猫** | 主要是砚砚 | 所有猫，尤其判断力弱的 |

**建议新立 Feature**。三只猫（opus/gpt52/codex）一致同意。

## 3. 升级方案（分层）

### L1 — 乒乓球熔断（P0，~80 行）

**改动**: `WorklistRegistry`（canonical enqueue 点，覆盖 serial + callback 双路径）

追踪**连续 same-pair streak**（非累计 count），中间插入其他猫或 user 消息即 reset：
- streak = 2 → 注入警告 "你们已经连续弹 2 轮了"
- streak = 4 → 终止 + emit 系统消息 "🏓 乒乓球熔断"
- 正常 review 循环 A→B→A→B (streak=3) 不受影响

**边界保护**:
- 链中间插入第三只猫 → reset streak
- user 消息进 queue → reset streak（已有 fairness gate）
- callback-a2a-trigger 走同一个 WorklistRegistry.push → 无旁路

### L2 — Parallel @ mention 降噪（P0，~20 行）

**改动**: `SystemPromptBuilder.ts` + `route-parallel.ts`

1. Prompt 层：parallel 模式注入 "独立思考禁止 @句柄"
2. Harness 层：parallel 路径 mentions 标记 `suppressedInParallel`，不写入 routedMentions
3. 清理缅因猫静态 prompt 里与 parallel 矛盾的"讨论完 → @ 对应猫"

### L3 — 角色适配门禁（P0，~40 行）🆕

**改动**: `WorklistRegistry` 或 `AgentRouter`

A2A handoff 时检查目标猫的角色能力：
- `coding/fix/test/merge/review` 类动作 → 不允许 handoff 给 designer 角色
- designer 角色只接受 `design/visual/ux/review-visual` 类 handoff
- 命中不匹配 → fail-closed + 明确报错 "⛔ @gemini 不接受 coding 任务"

**为什么 P0**: 这是唯一一个**一旦格式写对就会造成真实损害**的问题。其他问题是噪声/浪费，这个会让暹罗猫写出幻觉代码。

### L4 — 虚空传球检测（P1，~30 行）

检测响应文本中"否定动作模式 + 行首 @mention"的矛盾。
否定模式: "你不需要""不用动""等我""我来""我静默执行""让链静默"
命中 → emit 警告 + 可选拦截。

### L5 — feedback_always_at_back 降级（P1，L4 之后）

从"必须始终 @ 回"降级为"有实际交付物时 @ 回"。纯 ack 不需要 @ 回。
**必须在 L4 之后做**：先补虚空传球检测，再放松强制 @ 规则，否则会重新出现 F064 的漏传球。

### L6 — 协调废话熔断（P2，需更多设计）

连续 2 轮 A2A hop 无 tool_use 且无 code block → 注入"连续协调性回复无产出，请执行或收尾"。

## 4. 小笨猫综合征应对（provider-agnostic）

上面 L1-L6 都是 **harness 硬护栏**，不依赖模型遵守 prompt。这是关键——对判断力弱的猫（4.7/glm/kimi/minimax/qwen），prompt 层护栏效果有限，必须在路由层兜底。

**分层防御**:

| 防线 | 对聪明猫 | 对小笨猫 | 实现层 |
|------|---------|---------|--------|
| L1 乒乓球熔断 | 安全网（不太会触发） | **主力护栏** | WorklistRegistry |
| L2 Parallel 禁 @ | 消除噪声 | **防止废话链** | route-parallel |
| L3 角色门禁 | 安全网 | **防止灾难性错误** | AgentRouter |
| L4 虚空传球 | 偶尔提醒 | **频繁提醒** | write-side |
| L6 废话熔断 | 极少触发 | **高频触发** | route-serial |

**4.7 专属（短期，不立项）**:
- 限制为有边界的执行任务，不参与需要高判断力的 orchestrator 角色
- 等 L1-L3 上线后再放宽参与多猫协作链
- 不急着做 identity injection / judgment calibration——harness 护栏比 prompt 调参靠谱

## 5. 活体证据（2026-04-17）

| Case | 症状 | 涉及猫 | 被哪层拦 |
|------|------|--------|---------|
| GPT-5.4 + 4.7 乒乓球 | 连续 4 轮 ack/hold 同步 | gpt52↔opus-47 | L1 streak=4 熔断 |
| 4.7 虚空传球 gemini | "不 @ 任何人" + "下一个信号 gemini push" | opus-47→gemini | L4 矛盾检测 |
| 4.7 让 gemini 写代码 | designer 角色接收 coding 任务 | opus-47→gemini | L3 角色门禁 |
| 4.7 @ 格式错误 | 句中 @ 不路由但 4.7 以为传球了 | opus-47 | @格式本身就没命中（侥幸） |
| 4.7 SOP 过度遵守 | 小 enhance 开完整 feat | opus-47 | prompt 层（弱，需观察） |
| 4.7 规则字面化 | "不碰 runtime" = "不能读日志" | opus-47 | prompt 层（弱，需观察） |

## 6. Review 记录

| Reviewer | 日期 | 结论 | 关键贡献 |
|----------|------|------|---------|
| GPT-5.4 | 2026-04-17 | ✅ 支持新立 Feature | raw count→streak；canonical enqueue；L2 harness 双层；parallel 豁免洞分析 |
| Codex | 2026-04-17 | ✅ 退回→修正后放行 | 同源 3 P1（与 GPT-5.4 独立收敛）；测试集契约变更提醒；产出信号门控建议 |
| GPT-5.4 | 2026-04-17 | ✅ 新增 L3 | 角色适配门禁：AgentRouter 不检查角色能力，provider-agnostic 坑 |

## 7. 立项建议

**Feature 名**: A2A Chain Quality — 乒乓球熔断 + 虚空传球检测 + 角色护栏
**Phase A (P0)**: L1 + L2 + L3（~140 行，harness 硬护栏）
**Phase B (P1)**: L4 + L5（~40 行，语义检测 + 规则降级）
**Phase C (P2)**: L6（协调废话熔断，需更多设计和 tuning）

**Owner**: 布偶猫 (Opus 4.6)
**Reviewer**: 缅因猫（codex 或 gpt52）
