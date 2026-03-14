---
feature_ids: [F115]
doc_kind: review-request
created: 2026-03-14
author: opus
reviewer: codex
---

# Review Request: F115 Phase B — Sidecar 状態分層

## What

Replace boolean `STARTED_*` flags with 4-state machine (`disabled/launching/ready/failed`).

- `start_sidecar()` — unified launcher managing state transitions
- `print_sidecar_summary_all()` — summary only shows ready + failed
- Configurable timeouts: `ASR_TIMEOUT=30`, `TTS_TIMEOUT=30`, `LLM_TIMEOUT=60`

## Original Requirements

- Feature: `docs/features/F115-runtime-startup-optimization.md` Phase B
- ADR: `docs/decisions/016-sync-runtime-negation-decisions.md`

## AC Coverage

| AC | 状態 | Test |
|----|------|------|
| AC-B1: state machine | ✅ | Test 14, 15 |
| AC-B2: timeouts | ✅ | Test 17 |
| AC-B3: summary only ready | ✅ | Test 16 |

## Test Evidence

`bash scripts/test-start-dev.sh` → 17/17 PASS
