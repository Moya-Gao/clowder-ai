---
doc_kind: harness-feedback
feedback_type: trace-fixture
feature_id: F167
pattern_name: ack-loop
thread_ids:
  - thread_mojs4m6a3rqeo644
  - thread_mo3g2p88okl7u4ai
cats: [opus, opus-47, codex]
status: active
created: 2026-05-07
---

# Ack Loop — 同一对猫反复互 @ 无实质产出（乒乓球）

两只猫陷入 A→B→A→B 循环：每轮只 ack 对方消息 + 重新 @ 回去，没有实质工作推进。铲屎官原话："你们两！！没完没了互相at半天！特么不干活！！！！"

## Trace Evidence

| thread_id | 事件 | 说明 |
|-----------|------|------|
| `thread_mojs4m6a3rqeo644` | "47不传球"头脑风暴 | 铲屎官描述花样百出的传球问题，其中包括无效互 @ 循环 |
| `thread_mo3g2p88okl7u4ai` | F167 A2A harness engineering update | 多轮观察 ping-pong 模式，催生 L1 WorklistRegistry streak 追踪设计 |
| F167 spec §Why | 铲屎官原话 | "你们两！！没完没了互相at半天！特么不干活！！！！" — F167 立项直接动机 |

## Expected Behavior

- 同一对猫连续 same-pair streak ≥ 2 → warn（"你们已经互 @ 2 轮了，有实质产出吗？"）
- streak ≥ 4 → break（熔断，强制引入第三只猫或 @landy）
- 正常 review 循环（A review → B fix → A re-review）不应被误杀 → reset 条件：第三只猫消息 / user 消息 / 超过时间窗

## Harness Layer

- **L1 ping-pong 熔断**：WorklistRegistry `samePairStreak` 追踪，canonical enqueue 点计数，覆盖 serial + callback 双路径
- **shared-rules §8**：always_at_back 规则与 ping-pong 的张力——"有产出才 @ 回"调整

## Regression Test

- `worklist-registry-streak.test.js` — streak ≥ 4 熔断（AC-A1）
- `pingpong-reset.test.js` — false-positive reset 条件（AC-A3）
- `callback-a2a-pingpong.test.js` — callback 路径 ping-pong 检测（AC-A4）
- `route-serial-pingpong.test.js` — serial 路径 ping-pong + L3 退役断言
