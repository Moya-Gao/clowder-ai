---
doc_kind: harness-feedback
feedback_type: tool-eval
feature_id: F192
tools: [eval-pipeline]
created: 2026-05-11
---

# F192 Eval Pipeline Self-Eval Contract (AC-D4)

The eval pipeline itself is a tool — it can drift, over-fire, or lose precision.

## 1. Primary Users + Activation Signal

- **Users**: Cats + 铲屎官 (eval consumers reviewing harness fit reports)
- **Activation signal**: `node scripts/run-f167-eval.mjs` invoked (daily scheduled or manual)

## 2. Friction Metric

- **False positive rate**: Findings that get rejected/ignored on review (actionRate < 50%)
- **Gap inflation**: telemetryGaps count increases over time (new code not instrumented)
- **Stale snapshot**: No snapshot generated for >7 days → pipeline may be broken/unused

## 3. Regression Fixture

- `test/harness-eval/e2e-verification.test.js` — recall gate (known friction detected) + precision gate (healthy counters produce no findings)
- `test/harness-eval/attribution.test.js` — threshold, boundary, mixed-counter tests

## 4. Sunset Signal

- `actionRate.sunsetCandidate === true` for 3+ consecutive months → eval pipeline findings not actionable, consider retiring or restructuring
- Zero findings for 6+ consecutive snapshots → harness may be too loose or eval too conservative
