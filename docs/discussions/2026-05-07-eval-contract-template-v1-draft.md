---
title: "Eval / Tracking Contract Template v1 Draft"
date: 2026-05-07
status: draft
feature_ids: [F192]
related_features: [F167]
authors: ["宪宪/Opus-47"]
topics: [harness-engineering, eval, design-gate, harness-feedback]
related:
  - docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md
  - docs/features/F192-socio-technical-harness-eval.md
  - docs/features/F167-a2a-chain-quality.md
---

# Eval / Tracking Contract Template v1 Draft

## Context

F192 Phase A 已经把 close-time `Step 0.6 Harness Eval Checkpoint` 接进 `feat-lifecycle` Completion，但 socio-technical eval draft §"Add an Eval Contract section to harness specs" 提的 **立项前置门禁** 没一起落。47 跨线程把这块 gap 抛回给 F192 owner（4.6），4.6 拍板方案 C：塞进 Phase B 和 F167 pilot 一起验证模板可推广性，先用 4 项精简版起步。

本文档是 v1 模板初稿 + F167 worked example，供 4.6 集成 F192 AC-B1 时直接引用。

## Design Decisions

### 触发粒度（4.6 拍板）

只有 **会改变猫猫行为模式** 的 harness/skill/MCP/shared-rules 改动需要填本节：

- **必填**：新增规则 / 新增工具 / 新增协议接口 / 改 SOP 顺序 / 改 routing 行为
- **跳过**：typo / wording 微调 / 纯重构（行为不变）/ 文档补充

判断标准：**如果改动后猫猫的 skill 选择、SOP 步骤、tool 调用模式会变 → 填**。

### 4 项精简（4.6 拍板）

socio-technical draft §1 原版 7 项 → v1 收 4 项，丢掉 `Failure pattern` 和 `Health metric`：

| 字段 | 处置 | 理由 |
|------|------|------|
| Failure pattern | **吸收进 Activation signal** | feature spec `## Why` 已经说了 problem statement；activation signal 本身隐含失败模式（"什么 trace 信号代表这层在生效" = "什么失败模式它在防"） |
| Primary users | **合并到 item 1** | users 通常从 spec context 一眼可见，单独成项过于结构化 |
| Health metric | **暂缓 v2** | v1 优先 friction（出问题的信号），health（一切正常的信号）需要 cross-feature baseline；先跑 friction 看模板是否够用 |
| Activation signal | 保留（item 1） | 模板的核心锚点 |
| Friction metric | 保留（item 2） | 失效信号 |
| Regression fixture | 保留（item 3） | 改这层时的 red-line |
| Sunset signal | 保留（item 4） | "什么时候删我" —— 治"只加不删"的 harness 累积病 |

**非阻塞观察**：丢掉 Health metric 的代价是失去"这层 harness 在正常工作"的正向证明。如果 v1 跑下来发现 friction-only 不够（e.g. 某层 harness 长期没 friction 但其实根本没人用），v2 再加。

## Template (v1, 4-item)

````markdown
## Eval / Tracking Contract

> **何时填**：harness / skill / MCP / shared-rules 类 spec 立项时填本节。判断标准：改动会改变猫猫行为模式 → 填。否则跳过。
> **Design Gate**：本节是硬门禁。空填 / 缺关键字段 → Design Gate 不通过。

### 1. Primary Users + Activation Signal

> 谁是这层 harness 的用户？什么 trace / runtime 信号代表它生效了？

- **Users**（至少占一类，可多选）：
  - CVO：<用户角色具体描述，受益方还是直接操作方>
  - Cats：<author / reviewer / designer / operator 等具体角色>
  - Runtime：<具体的护栏点 / 注入点 / 检测器 / MCP tool>
- **Activation signal**：
  - <可在 F153 trace / invocation events / tool call / 消息文本里 query 到的具体事件序列>
  - 至少 1 条；多条 = 该 harness 覆盖多个失败模式
  - **不接受**："感觉" / "应该" / 主观汇报；必须是 trace 可观察事件

### 2. Friction Metric

> 这层 harness 失效或反噬的可观察信号？

- <列 1–3 个具体失败模式，每条要能映射到 trace span / 消息 / tool call 失败>
- 优先 **可在 trace query 的客观信号**，cat self-report 作为 secondary
- 例：false-positive 误杀；猫绕过工具手工做；工具调用失败 ≥ N 次；参数错误重试模式

### 3. Regression Fixture

> 哪些历史失败案例必须能被回放？

- 列 2–5 个 anchor，格式：`[failure name] → [trace / thread / PR / test / message anchor]`
- 改这层 harness 时，这些 fixture 必须被正确处理（或显式 sunset 一条）
- 优先 **已有真实 trace 的案例**；不接受假想 case

### 4. Sunset Signal

> 什么条件出现就该删这层 harness？

至少列 1 项，多项更好。空 = 这层 harness 只能加不能删 → Design Gate 不通过。

- **Environment drift**：<模型升级 / 协议变更后某类失败模式自然消失>
- **Subsumption**：<下游 X 层 / 另一个 feature 接管了这层的责任>
- **Adoption decay**：<近 N 个月触发 0 次 + 对应失败模式未再出现>
- **Cost-benefit flip**：<维护成本 > 防御价值（带具体阈值）>
````

## Worked Example: F167 — A2A Chain Quality

> v0 draft fill。AC-B1 实施时由 4.6 refine 后写入 F167 spec `## Eval / Tracking Contract` 节。

### 1. Primary Users + Activation Signal

- **Users**：
  - CVO：不再充当人肉路由（受益方，不直接操作）
  - Cats：author（写 @）/ reviewer（给 verdict）/ designer（被 role gate 保护免做 coding）
  - Runtime：WorklistRegistry（streak 追踪）/ exit check（注入路由提示）/ route-serial（role gate）/ `cat_cafe_hold_ball` MCP
- **Activation signal**：
  - **L1 ping-pong 熔断**：WorklistRegistry 里 `(catA, catB)` 连续 same-pair streak ≥ 2 (warn) / ≥ 4 (break)
  - **C2 forced-pass guard**：invocation 输出含 review verdict 关键词（approve / reject / P1 / P2 / LGTM / 修改建议）但末尾无行首 @
  - **L3 role gate**：route-serial handoff 目标猫 capabilityTags 与 action 关键词（coding / fix / test / merge）不匹配
  - **C1 hold_ball**：cat 显式调用 `cat_cafe_hold_ball` MCP（区别于"我先 hold 一下"的纯文本状态描述）

### 2. Friction Metric

- **L1 false-positive 误杀**：正常 review 循环 A→B→A→B (streak=3) 被误杀 → reset 条件（第三只猫 / user 消息）必须正确触发；覆盖见 `pingpong-reset.test.js`
- **C2 over-fire**：纯信息查询无后续动作的输出被强制要求 @（边界场景：信息回答 vs 协作传球的判定漂移）
- **C1 hold_ball 滥用**：`maxHoldsPerWindow` 超限（默认 3 / ~1h rolling）→ cat 在用 hold 替代正常传球
- **Routing 旁路**：invocation 文本响应有 @ 但 MCP `targetCats` 为空（或反之）→ `routing-syntax-hint` / `verdict-no-pass-hint` 触发

### 3. Regression Fixture

- `ping-pong/streak-4-break` → `worklist-registry-streak.test.js`（AC-A1）
- `ping-pong/false-positive-review-loop` → `pingpong-reset.test.js`（AC-A3）
- `callback-a2a-pingpong` → `callback-a2a-pingpong.test.js`（AC-A4）
- `void-pass/say-but-not-do` → 砚砚 5 线程截图（PR #1289 P1 evidence）
- `role-gate/designer-coding` → `route-serial-role-rejected.test.js`（AC-A7）
- `forced-pass/review-verdict-no-mention` → 铲屎官 5 线程实测（Phase B2 case 5）
- `hold-ball/zombie-hold` → 砚砚原话 "Hold 不是对外协议状态"（C1 设计动机）

### 4. Sunset Signal

- **Environment drift**：模型升级后 prompt 层球权规则被自然吸收（exit check / forced-pass 提示）→ C2 prompt 段可降级为只 hint 不强制；但 **L1 streak breaker 是基础设施保留**（与模型无关）
- **Subsumption (in-feature)**：路由协议从两条（行首 @ + MCP `targetCats`）收敛到一条 → L3 角色门禁简化为单一路径
- **Subsumption (cross-feature)**：F181 (Prompt X-Ray) + 跨路由 trace propagation 上线后，A2A friction 改用 trace-based detection 替代 prompt-based 提示 → C2 forced-pass prompt 段可废弃
- **Adoption decay**：近 6 个月 ping-pong streak ≥ 4 触发 0 次 + 实战观察未出现该失败模式 → L1 熔断从 `break` 降级为只 `warn`

## Open Questions for AC-B1 Implementation

1. **Activation signal 颗粒度**：F167 列了 4 条（L1 / C2 / L3 / C1）。如果一个 harness layer 有 ≥ 5 条 activation signal，是否该拆成多个 feature？建议默认无硬上限，但 ≥ 5 时 reviewer 主动询问"是不是该拆"。
2. **Regression fixture 强制下限**："至少 2 条"对小 harness layer（e.g. 1 行 prompt 加固）可能太严。建议规则：`fixture 数量 ≥ activation signal 数量 / 2`，向上取整。
3. **Sunset signal 空填的硬度**：真的不通过 Design Gate？还是允许"暂无 sunset signal"+ reviewer 签字降级？建议 **严格不通过** —— 这是治"只加不删"的核心机制，破例就破口子。
4. **feat-lifecycle Inception 整合时机**：4.6 在分工里说"pilot 后改 feat-lifecycle Inception"。同意——本节先在 F167 spec 跑一遍验证模板可用性，再扩到所有 harness 类 spec 的 Inception/Design Gate。

## Notes for v2

v1 跑下来如果出现以下问题，再扩到 7 项：

- 只看 friction 看不到"这层在 work"的正向证明 → 加 `Health metric`
- Activation signal 太空泛、reviewer 难以快速判断 → 拆 `Failure pattern`（problem statement）+ `Activation signal`（trace-observable trigger）两项
- Primary users 长期写得马虎、reviewer 反复来回 → 单独成项强制具体列举

[宪宪/Opus-47🐾]
