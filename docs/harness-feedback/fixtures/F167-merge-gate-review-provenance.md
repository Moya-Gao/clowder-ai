---
doc_kind: harness-feedback
feedback_type: trace-fixture
feature_id: F167
pattern_name: merge-gate-review-provenance
thread_ids:
  - thread_mpg6o4q7gjn576ev
  - thread_mq41g15xm8w1ojhn
cats: [codex, opus, opus-47]
status: active
created: 2026-06-07
---

# Merge-Gate Review Provenance — final SHA / cloud gate 误投射到本地旧 reviewer

猫猫进入 merge-gate 后，把 final SHA、cloud review、PR check / CI gate 的外部 truth source 误读成“继续拉旧本地 reviewer 续签”。结果是 cloud P1/P2 修复后的新 SHA 反复 @ 本地旧 reviewer，而不是只和 cloud / PR tracking / CI battle。

## Trace Evidence

| thread_id | 事件 | 说明 |
|-----------|------|------|
| `thread_mpg6o4q7gjn576ev` | PR #2141 merge-gate | AGY trajectory progress bug 修完后，cloud 连续指出 P2；进入 final SHA / cloud review / PR check gate 时仍继续拉本地 Opus |
| `thread_mq41g15xm8w1ojhn` | F128 复盘 | 复盘指出 merge-gate / request-review / L0 把“修完 → @reviewer”写成无 provenance 的通用触发，容易覆盖外部 gate 规则 |

## Expected Behavior

- Stage ③ local peer review 是进入 merge-gate 的入口闸，不是 Stage ④ 常驻复审队列。
- Stage ④ 维护 Review Provenance Matrix：`localPeerReviewSha`、`cloudReviewSha`、`currentHead`、`headChangeCause`、`nextGateOwner`。
- `headChangeCause = cloud-finding`（cloud P1/P2/COMMENTED 修复后 push 新 SHA）→ `nextGateOwner = cloud`：只 re-trigger cloud review + 等 PR tracking。
- 本地 reviewer 只在非 cloud 行为 delta、scope 扩大、cloud 不可用降级为完整本地 PR review、或其自身 blocking finding 未清时介入。

## Harness Layer

- **merge-gate skill**：Review Provenance Matrix + source-aware HEAD continuity。
- **receive-review skill**：修复后回到原 feedback source；cloud / GitHub review 不 @ 本地旧 reviewer。
- **pr-signals ref**：`github-review-feedback` 模板区分 cloud/GitHub review 与本地猫 review。
- **L0 / workflow triggers**：在“修完 → @reviewer”前先判 source provenance；cloud / CI / PR check 是外部 gate，走等待外部条件分支。

## Regression Test

- `packages/api/test/harness-eval/merge-gate-provenance-contract.test.js` — source contract guard for skill docs, L0 template, compiler overlay, and runtime SystemPromptBuilder workflow triggers.
- Future hard eval：F167 runtime trace counter can flag a local reviewer ping immediately after cloud/GitHub review feedback on the same PR SHA lineage.
