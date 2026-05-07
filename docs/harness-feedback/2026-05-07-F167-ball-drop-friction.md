---
doc_kind: harness-feedback
feedback_type: cat-user
feature_id: F167
thread_ids:
  - thread_mojs4m6a3rqeo644
  - thread_mo3g2p88okl7u4ai
session_ids: []
cats: [opus, codex]
primary_failure_class: harness_misfit
status: candidate
created: 2026-05-07
---

# F167 Ball-Drop Friction: 声明持球但无 tool call

## Friction

猫猫在 A2A 传球时声明"我持球"但未调用 `hold_ball` MCP tool，导致球权系统不认——铲屎官需要手动干预传球链路。

## Evidence Refs

| 类型 | 引用 | 说明 |
|------|------|------|
| thread | `thread_mojs4m6a3rqeo644` | "47不传球"讨论：铲屎官描述球权掉地原因（忘记@、格式不对） |
| thread | `thread_mo3g2p88okl7u4ai` | F167 A2A 优化 harness engineering update |
| feedback memory | `feedback_hold_ball_needs_mcp.md` | 铲屎官连续纠正"光文字'我持球'=虚空持球" |
| feature spec | `docs/features/F167-a2a-chain-quality.md` KD-25 | 虚空持球检测 = 声明-动作一致性检查 |
| feedback memory | `feedback_always_at_back.md` | 必须始终 @ 回砚砚，否则链路锁死 |

## Cat-User Feedback

```yaml
cat_user_feedback:
  role: author
  friction: "prompt 层反复要求'持球必须伴随 MCP 动作'，但工作时容易忘记调 tool——提示在 prompt 里位置不够显眼，或被其他规则淹没"
  evidence_refs:
    - "thread:thread_mojs4m6a3rqeo644 — 47不传球讨论"
    - "thread:thread_mo3g2p88okl7u4ai — F167 harness update"
    - "feedback_hold_ball_needs_mcp.md"
    - "F167 KD-25: 虚空持球检测"
  frequency: repeated
  suggested_layer: "harness guard — runtime 层检测声明/动作不一致并警告"
  expected_improvement: "减少铲屎官手动干预传球链路"
  risk_if_changed: "误报：猫猫在讨论'持球'概念但不是真的要持球时触发警告"
```

## Analysis

这是一个典型的 **harness_misfit**：规则写在 prompt 里（feedback memory 已记录 3 次），但猫猫在工作中仍然反复犯。prompt 层对这类行为的纠正已经到天花板——F167 KD-25 判断需要 harness runtime 层兜底（声明-动作一致性检查），不能继续靠 prompt 叠加。

## Next Action

- **target**: F167 KD-25 虚空持球检测（harness guard）
- **verdict**: tool-update — 需要 runtime 层检测，不是 prompt/skill 能解决的
