---
doc_kind: harness-feedback
feedback_type: tool-eval
feature_id: F167
tools: [hold_ball, route-serial, exit-check, worklist-registry]
created: 2026-05-07
---

# A2A Tools Eval Contracts

F167 A2A Chain Quality 的四个核心运行时组件的 eval contract。每个组件按 v1 4-item 模板填。

---

## hold_ball (C1)

`cat_cafe_hold_ball` MCP tool — 猫猫显式声明持球，区分结构化状态与纯文本描述。

### 1. Primary Users + Activation Signal

- **Users**: Cats（所有猫，作为 A2A 传球链路的参与者）
- **Activation signal**: `cat_cafe_hold_ball` tool call 被调用（trace 中可 query `toolName=cat_cafe_hold_ball`）；区分于纯文本"我持球"

### 2. Friction Metric

- **滥用率**: `maxHoldsPerWindow`（默认 3/~1h rolling）超限次数 — 猫用 hold 替代正常传球
- **zombie hold 率**: hold 后超过合理时间（如 30min）未接/退/升 — RLHF hold 反射
- **与异步回调冲突**: 已挂 PR tracking / scheduled task 时仍 hold_ball — 语义重复锁定

### 3. Regression Fixture

- `callback-hold-ball-counter.test.js` — maxHoldsPerWindow 限流
- `callback-hold-ball-route.test.js` — hold → 路由行为
- `callback-hold-ball-route-scheduling.test.js` — hold + 调度交互
- `hold-ball-cancel.test.js` — cancel 机制（Phase J）
- `hold-ball-cancel-route.test.js` — cancel 后路由恢复

### 4. Sunset Signal

- **Model absorbs**: 未来模型原生理解球权语义（不需要显式 tool call 来区分声明/执行）→ hold_ball 降级为 optional hint
- **Protocol simplification**: 路由协议收敛为单一路径（MCP only 或 text only）→ hold_ball 的"声明-动作一致性"约束简化
- **Adoption decay**: 近 6 个月 hold_ball 调用 0 次 + 无 zombie hold 观察 → 可废弃

---

## route-serial (L3 → data-driven)

串行 A2A handoff 路由 + cat-config.restrictions 数据驱动能力限制（L3 硬编码 regex 已退役 KD-20）。

### 1. Primary Users + Activation Signal

- **Users**: Runtime（路由引擎，per-invocation 执行）; Cats（被 restrictions 保护免做不适配任务）
- **Activation signal**: route-serial handoff 事件 + restrictions 双端 prompt 注入（发送方队友名册含 restrictions / 目标猫 self-awareness 含 restrictions）

### 2. Friction Metric

- **旁路率**: handoff 文本有 @ 但 MCP `targetCats` 为空（或反之）→ `routing-syntax-hint`（route-serial.ts 行首 @ 语法检测）或 `verdict-no-pass-hint`（verdict 无 @ 出口检测）触发
- **restrictions 误杀率**: restrictions prompt 注入后猫仍被要求做限制外任务（或猫不敢接本该接的任务）
- **handoff 循环率**: same-pair handoff 连续发生（虽然 L1 会熔断，但 route-serial 应记录 handoff 模式供分析）

### 3. Regression Fixture

- `route-serial-pingpong.test.js` — serial 路径 ping-pong + L3 退役断言（`a2a_role_rejected` must NOT fire）
- `route-serial-a2a-tracker.test.js` — handoff tracking
- `route-serial-verdict-hint.test.js` — verdict 检测 + 路由提示
- `a2a-routing-persist.test.js` — 路由状态持久化

### 4. Sunset Signal

- **Protocol unification**: F193 跨线程通信统一后，serial/callback/parallel 三模式可能重构 → route-serial 当前形态可能被吸收
- **Model improvement**: 模型升级后不再需要 restrictions prompt 注入（模型自动从 cat-config 推断能力边界）→ restrictions 双端注入可废弃
- **Adoption decay**: 近 6 个月无 `routing-syntax-hint` / `verdict-no-pass-hint` 触发 + 无 restrictions 误杀 → restrictions 注入可从 mandatory 降为 optional

---

## exit-check (C2)

invocation 输出结尾的球权 + 路由 consistency 检查。含 forced-pass guard（检测 verdict 无 @）和 @landy 硬条件出口。

### 1. Primary Users + Activation Signal

- **Users**: Runtime（per-invocation 输出后注入提示）; CVO（@landy 硬条件出口保护）
- **Activation signal**: exit check 触发路由提示注入 — invocation 输出含 verdict 关键词但末尾无行首 @（C2 forced-pass）; 不可逆/愿景级/僵局场景未 @landy（KD-19）

### 2. Friction Metric

- **C2 over-fire**: 纯信息查询被强制要求 @（边界：信息回答 vs 协作传球的判定漂移）
- **@landy under-fire**: 应该升级铲屎官但没触发（e.g. 不可逆操作被猫自决）
- **hint 被忽略率**: exit check 注入了路由提示但猫下一轮仍未 @ 任何人

### 3. Regression Fixture

- `route-serial-verdict-hint.test.js` — verdict 检测 + hint 注入
- `system-prompt-builder.test.js` — SystemPromptBuilder 中 exit check 段完整性
- 铲屎官 5 线程实测（Phase B2 case 5）— forced-pass 真实案例

### 4. Sunset Signal

- **Model absorbs**: 模型升级后 prompt 层球权规则被自然吸收 → exit check hint 可降级为只在异常时触发，不是每轮注入
- **F181 trace-based detection**: Prompt X-Ray 上线后，verdict-without-@ 可在 trace 层检测，不需要 prompt 注入 → C2 forced-pass prompt 段废弃
- **Adoption decay**: 近 6 个月 verdict-without-@ 触发 0 次 → forced-pass guard 可降级

---

## WorklistRegistry (L1)

A2A 乒乓球熔断 — canonical enqueue 点追踪 same-pair streak，覆盖 serial + callback 双路径。

### 1. Primary Users + Activation Signal

- **Users**: Runtime（基础设施级，per-enqueue 自动执行）; CVO（受益于 ping-pong 自动制止）
- **Activation signal**: `samePairStreak` 计数 ≥ 2（warn）/ ≥ 4（break）; reset 条件：第三只猫消息 / user 消息 / 超时

### 2. Friction Metric

- **false-positive 误杀率**: 正常 review 循环 A→B→A→B (streak=3) 被误杀 → reset 条件是否正确触发
- **break 后恢复延迟**: 熔断后需要多久才能恢复正常协作（引入第三只猫 / 铲屎官介入的响应时间）
- **bypass 率**: streak 达到 warn 但猫忽略警告继续 ping-pong

### 3. Regression Fixture

- `worklist-registry-streak.test.js` — streak ≥ 4 熔断（AC-A1）
- `pingpong-reset.test.js` — false-positive reset 条件（AC-A3）
- `callback-a2a-pingpong.test.js` — callback 路径 ping-pong（AC-A4）
- `route-serial-pingpong.test.js` — serial 路径 ping-pong

### 4. Sunset Signal

- **L1 是基础设施保留**: ping-pong 是 multi-agent 系统的基本 failure mode，与模型升级无关 → **不 sunset，只调参**
- **阈值调整**: 如果模型升级后 streak ≥ 4 长期不触发，可将 warn 阈值从 2 提到 3，break 从 4 提到 6
- **Adoption decay**: 近 12 个月（注意更长窗口）streak ≥ 4 触发 0 次 + 实战观察未出现 → break 降级为只 warn
