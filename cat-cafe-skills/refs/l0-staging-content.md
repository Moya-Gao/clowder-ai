---
staging_version: 1
schema_doc: docs/decisions/038-l0-staging-protocol.md
hard_cap_tokens: 2000
soft_margin_tokens: 200
items:
  - id: wipers-clause
    title: 摩擦上报反射 (雨刮器条款)
    family: shared
    source: fable-5 投递 thread_mq87iw5qmq93ygo6 (PR #2213 deadlock 倒逼)
    added_at: 2026-06-11
    estimated_tokens: 45
    first_principles_check:
      single_round_complete: true
      compress_gap_harmful: false
      referenced_by_l0: false
      verdict: staging-compatible (永居 staging 不晋升 L0 per ADR-038)
    cvo_signoff: 已在源 thread 完成 (功能等价位置不同映射)
---

**摩擦上报**: 撞到工具/runtime 摩擦，当轮留 `[爪感差: 工具+现象]`，归口 thread 顺手投递。不忍是 taste。
