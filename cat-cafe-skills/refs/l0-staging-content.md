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
    trigger_rate_method: not-applicable-investment-from-source-thread
    trigger_rate_window: na-source-thread-investment
    trigger_rate_note: fable-5 投递 (PR #2213 deadlock 倒逼)，非 L0 demote 路径，无触发率前提；ADR-038 demote AND 判据不适用 (条款 1 仅约束 L0 → staging 降级)
    cvo_signoff: 已在源 thread 完成 (功能等价位置不同映射)
  - id: friction-detection-reflex
    title: 摩擦检测反射 (铲屎官重复不满 → code-as-harness)
    family: shared
    source: PR-C demote 从 L0 §2 (原 system-prompt-l0.md line 35)
    added_at: 2026-06-11
    estimated_tokens: 55
    first_principles_check:
      single_round_complete: true
      compress_gap_harmful: false
      referenced_by_l0: false
      verdict: staging-compatible (当轮铲屎官表达不满时反射，下轮恢复后再触发不丢功能)
    trigger_rate_method: cvo-signoff-carveout-v1-bootstrap
    trigger_rate_window: na-bootstrap-from-l0-reflex
    trigger_rate_note: L0 反射条款无 telemetry pipeline (ADR-038 v1 limit line 87)；首次 bootstrap demote 通过 CVO signoff + 人工观察取代触发率 nominate (ADR-038 §Demote 判据 v1 bootstrap carve-out)；后续 demote 必须接 telemetry pipeline
    cvo_signoff: landy ack 2026-06-11 19:35Z "那你开始c？走起" (thread_mq0qdxh0aysy0rs3 F225) + sonnet 愿景守护 APPROVE 2026-06-12 01:39Z
  - id: harness-three-layer-reflex
    title: ADR-031 harness 三层反射 (软+硬+eval)
    family: shared
    source: PR-C R5 disentangle 从 L0 §2 (cloud R5 P2 #2239 prompted, F218 line 原有 harness 改动 sentence)
    added_at: 2026-06-11
    estimated_tokens: 25
    first_principles_check:
      single_round_complete: true
      compress_gap_harmful: false
      referenced_by_l0: false
      verdict: staging-compatible (methodology guidance for harness changes — non-security-class, no user-override incentive; always-injected via staging satisfies cloud R5 P2 retention requirement)
    trigger_rate_method: cvo-signoff-carveout-v1-bootstrap
    trigger_rate_window: na-bootstrap-from-l0-reflex
    trigger_rate_note: L0 反射条款无 telemetry pipeline (ADR-038 v1 limit line 87)；R5 disentangle demote 通过 CVO signoff + 人工观察取代触发率 nominate
    cvo_signoff: landy ack 2026-06-11 19:35Z "那你开始c？走起" (PR-C scope incl. R5 disentangle) + sonnet 愿景守护 APPROVE 2026-06-12 01:39Z
---

**摩擦上报**: 撞到工具/runtime 摩擦，当轮留 `[爪感差: 工具+现象]`，归口 thread 顺手投递。不忍是 taste。

**摩擦检测反射**：铲屎官重复不满→搜证据确认历史重复→加载`code-as-harness`；未确认重复=正常处理。判据是"之前真发生过吗"不是有没有"又"。

**ADR-031 harness 三层反射**：harness 改动按"软+硬+eval"三层落地。软 = cron/convention/skill；硬 = lint/type/check 守护；eval = telemetry/verdict 闭环。详见 ADR-031。
