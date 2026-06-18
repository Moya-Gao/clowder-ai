---
feature_ids: [F244]
topics: [review-request, capability-tips, design-gate]
doc_kind: note
created: 2026-06-18
---

# Review Request: F244 Capability Tips System spec

Review-Target-ID: f244
Branch: main

## What

Created and refined `docs/features/F244-capability-tips-system.md` before Design Gate. The spec frames the feature as a waiting-state Knowledge Feed projection, not cosmetic loading copy.

Latest CVO constraint update added:

- Soft: feature/PR template requires 1-2 tips or explicit exemption.
- Hard: feature manifest / guide / skill additions require corresponding tips or exemption.
- Eval: record exposure, clicks, and user follow-up questions to identify unclear capabilities.
- Single source: F244 only projects sourceRefs from F223/L0/F114/F155/F192/etc.; it must not maintain a parallel capability catalog.

## Why

CVO wants waiting time to show how Cat Cafe works: what capabilities exist, when to use magic words, and how new features are discovered. The first user is CVO, but the system must remain source-backed and evaluable.

## Original Requirements（必填）

> "我们想要的不止是猫言语"
> "比如有什么 magic words 什么时候可以用 / 家里有什么功能 / 开发新feature的时候必须补1~2条tips"
> "猫言语只是最后一层皮，真正的价值是把'家里怎么运转'变成用户在自然等待中持续学会的东西"
> "直接立项吧 反正第一个用户就是我啊！"
> "别做成多个真相源头！... 软层...硬层...eval..."

- 来源：当前 thread，2026-06-18 F244 立项讨论
- **请对照上面的摘录判断 spec 是否解决了铲屎官的问题**

## Tradeoff

The spec deliberately avoids a standalone "tips copy library" as the source of truth. It introduces a projection layer with `sourceRef` and contribution governance, at the cost of needing source validation and staleness handling.

## Architecture Ownership（必填）

Architecture cell: hub-action-surface + harness-eval
Map delta: update required
Why: Tips render inside first-party Hub waiting/status surfaces and need adoption/effectiveness tracking; F223 owns capability source registry, F192 owns eval, F244 owns the user-facing waiting-state projection.

Please check:

- Whether `Map delta: update required` is the right boundary, or whether this should be `none` until implementation updates ownership cells.
- Whether the spec accidentally creates a parallel capability source despite `sourceRef` constraints.
- Whether the soft/hard/eval plan is concrete enough before Design Gate.

## Open Questions

### 技术 OQ（给 reviewer）

1. Is the single-source boundary strong enough, especially around seed tips and `CapabilityTip` schema?
2. Are Phase C hard checks scoped correctly, or could they become a noisy quantity gate?
3. Should the spec require generated projection from F223/F155/F114 sources earlier, or is sourceRef validation enough for Phase A?

### 价值 OQ（给 CVO，如有）

无。Design Gate will still need CVO confirmation of UI placement, rhythm, click action, and failure priority after review.

## Next Action

Please review the F244 spec before Design Gate. Expected output: APPROVE / REQUEST-CHANGES with P1/P2 findings and any scope boundary concerns.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f244/opus48`
- Start Command: docs-only spec review; no dev server required
- Ports: none

## 自检证据

### Spec 合规

- `node scripts/check-feature-truth.mjs` — PASS (`features=252 backlog_active=75`)
- `node scripts/audit-feature-doc-template.mjs --features-dir docs/features --output-json /tmp/f244-feature-audit2.json --output-md /tmp/f244-feature-audit2.md` — F244 100%, 0 missing

### 测试结果

- `git diff --check -- docs/features/F244-capability-tips-system.md` — clean
- Full app tests not run: docs-only spec update before Design Gate.

### 相关文档

- Feature: `docs/features/F244-capability-tips-system.md`
- Backlog: `docs/BACKLOG.md`
- Source refs: F223, F114, F155, F192, F227, `cat-cafe-skills/refs/capability-wakeup-index.md`, `cat-cafe-skills/refs/shared-rules.md`
