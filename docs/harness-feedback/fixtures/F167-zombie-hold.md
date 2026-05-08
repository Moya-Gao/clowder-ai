---
doc_kind: harness-feedback
feedback_type: trace-fixture
feature_id: F167
pattern_name: zombie-hold
thread_ids:
  - thread_movnlc8dq8atqu9x
  - thread_mo3g2p88okl7u4ai
cats: [codex, opus]
status: active
created: 2026-05-07
---

# Zombie Hold — 持球不放，RLHF "check in" 反射变球权黑洞

猫猫调用 `hold_ball` 后长期不释放（不接/不退/不升），或在已有结构化异步回调（如 PR tracking）的场景仍选择 hold_ball，导致球权链路停滞。

## Trace Evidence

| thread_id | 事件 | 说明 |
|-----------|------|------|
| `thread_movnlc8dq8atqu9x` | 铲屎官考题："挂了 PR tracking 还选择 hold ball 导致什么问题？" | PR tracking 自带球权流转语义（回调 = 传球），叠加 hold_ball = 球权重复锁定，后续回调触发时语义矛盾 |
| `thread_mo3g2p88okl7u4ai` | 砚砚自我剖析 | "Hold 不是对外协议状态。要么静默执行，要么接/退/升。" RLHF "check in" 反射在 agent 链路里变成球权黑洞 |

## Expected Behavior

- hold_ball 是临时状态，必须在合理时间内转为接/退/升三选一
- 已有结构化异步回调（PR tracking、scheduled task）时，不应同时 hold_ball
- `maxHoldsPerWindow`（默认 3 / ~1h rolling）超限 → 系统警告"用 hold 替代正常传球"

## Harness Layer

- **C1 hold_ball**：`maxHoldsPerWindow` 限流 + cancel route 机制
- **shared-rules §10**：球权协议三选一（接/退/升），禁止"收球说你等着"
- **exit check**：输出结尾必须有明确球权声明（接/退/升/@landy）

## Regression Test

- `callback-hold-ball-counter.test.js` — maxHoldsPerWindow 超限检测
- `hold-ball-cancel.test.js` — hold_ball 取消路由
- `hold-ball-cancel-route.test.js` — cancel 后路由恢复
- `callback-hold-ball-route-scheduling.test.js` — hold + 调度交互
- 砚砚原话 "Hold 不是对外协议状态"（F167 Phase B2 设计动机）
