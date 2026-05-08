---
doc_kind: harness-feedback
feedback_type: trace-fixture
feature_id: F167
pattern_name: ball-drop
thread_ids:
  - thread_mojs4m6a3rqeo644
  - thread_mo3g2p88okl7u4ai
cats: [opus-47, codex]
status: active
created: 2026-05-07
---

# Ball Drop — 声明持球/传球但无对应 tool call 或行首 @

猫猫在 A2A 协作中声明"球权在 @xxx"或"我持球"，但实际既没发 MCP `targetCats` 也没写行首 @（或反之），导致球权系统不认——铲屎官需手动干预。

## Trace Evidence

| thread_id | 事件 | 说明 |
|-----------|------|------|
| `thread_mojs4m6a3rqeo644` | 铲屎官发起"47不传球"头脑风暴 | 描述两类球权掉地：1. 忘记 @ 猫猫；2. `球权在 @codex blabla` 格式不对（@ 不在行首） |
| `thread_mo3g2p88okl7u4ai` | F167 A2A harness engineering update | 多轮迭代中多次观察到声明-动作脱钩 |
| PR #1289 | 砚砚 5 线程截图 | P1 evidence：void-pass/say-but-not-do 实例 |

## Expected Behavior

- 猫猫声明传球 → 必须同时有行首 `@句柄` 或 MCP `targetCats` 非空
- 猫猫声明持球 → 必须调用 `cat_cafe_hold_ball` MCP tool
- 两条路由路径（文本 @ + MCP targetCats）一致，不矛盾

## Harness Layer

- **C1 hold_ball**：`cat_cafe_hold_ball` MCP 工具，区分结构化持球声明与纯文本描述
- **C2 forced-pass guard**：exit check 检测输出含协作信号但未路由
- **Routing 旁路检测**：`routing-syntax-hint`（行首 @ 语法检测）/ `verdict-no-pass-hint`（verdict 无 @ 出口检测）触发时标记文本 @ 与 MCP targetCats 不一致

## Regression Test

- `callback-hold-ball-route.test.js` — hold_ball → 后续路由正确
- `callback-hold-ball-counter.test.js` — maxHoldsPerWindow 限制
- `route-serial-verdict-hint.test.js` — C2 verdict 检测 + 路由提示注入
- F167 spec KD-25 — 虚空持球检测 = 声明-动作一致性检查
