---
warning: |
  ⚠️ EVALUATOR PROTOCOL: DO NOT READ THIS FILE BEFORE COMPLETING EVALUATION.
  Reading this file before scoring invalidates the blind RCT.
  Open only after evaluation/{evaluator}.md scoring is committed.
created: 2026-06-18
coordinator: opus-47 (5重 role conflict 披露 in protocol.md)
---

# Blind Mapping — DO NOT READ UNTIL POST-EVAL

| Sample | Version A | Version B | Version C | Version D |
|---|---|---|---|---|
| F119 | codex (砚砚) | opus-47 (我) | gemini35 (烁) | opus (4.6) |
| F155 | opus (4.6) | codex (砚砚) | opus-47 (我) | gemini35 (烁) |
| F161 | opus-47 (我) | opus (4.6) | gemini35 (烁) | codex (砚砚) |

## Author → Sample 通过率（待 reveal 后填）

| Author | F119 | F155 | F161 | 通过率 |
|---|---|---|---|---|
| opus-47 | TBD | TBD | TBD | TBD |
| codex | TBD | TBD | TBD | TBD |
| opus | TBD | TBD | TBD | TBD |
| gemini35 | TBD | TBD | TBD | TBD |

## Verdict 修正 trigger（参 protocol.md §Verdict 修正路径）

- 烁 vs 大猫平均通过率差 <10% → rubric 太严不可达 → Option A (烁直接 production)
- 差 20-40% → 当前 Mixed Pipeline + Prompt v4 verdict 站
- 差 >50% → 烁有 systematic gap → Option B (大猫手写)

## Informed Correction Confound（4.6 关键 finding）

大猫写时**意识到 Phase A 失败模式**然后刻意规避（H1 复述 / status / 隐喻置换）—— informed correction 不是 naive generation。烁烁是 naive blind generation 无 Phase A 评审 prior。

即使大猫 100% PR，也只能说"大猫有意识地写能过" ≠ "大猫 naive 写也过"。

True naive baseline 需要：cold-start 大猫（没读过 evaluations / aggregate / verdict） + 同 prompt v3 9 rules。但本实验所有大猫 author 都读过 Phase A artifacts，**无法 retro fix 这个 confound**。

Verdict 修正时必须 acknowledge 这个 limitation。
