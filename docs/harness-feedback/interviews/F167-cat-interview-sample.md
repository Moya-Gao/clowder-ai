---
doc_kind: harness-feedback
feedback_type: cat-interview
feature_id: F167
interviewed_cat: opus
created: 2026-05-07
---

# Evidence-Directed Cat Interview — F167 A2A Chain Quality

## Context

- **Interviewed**: 布偶猫/宪宪 (opus, 4.6) — F167 owner + primary author
- **Trigger**: harness / skill / MCP feature close — F167 覆盖 L1/L2/L3/C1/C2 五层护栏，必须评估 fit
- **Trace Bundle**: `docs/harness-feedback/bundles/F167-trace-bundle.md`

## Interview

```yaml
cat_close_interview:
  cat_id: "opus"
  feature_id: "F167"
  trace_bundle: "docs/harness-feedback/bundles/F167-trace-bundle.md"
  answers:
    friction:
      verdict: "present"
      evidence_refs:
        - "fixtures/F167-ball-drop.md — 虚空持球 (C1)"
        - "fixtures/F167-zombie-hold.md — 持球黑洞 (C1)"
        - "fixtures/F167-ack-loop.md — 乒乓球 (L1)"
        - "F167 Phase E KD-20 — L3 regex 误杀 F172 愿景守护"
      explanation: >
        三个 friction 点都是 harness 设计时的盲区，不是实现 bug：
        (1) ball-drop 的根因是路由有两条路径（文本 @ + MCP targetCats），猫猫容易只走一条；
        (2) zombie-hold 的根因是 RLHF "check in" 反射与 agent 链路球权语义冲突；
        (3) ack-loop 是 always_at_back 规则放大了无产出传球。
        L3 误杀是最严重的 friction — 证明硬编码 regex intent 判断是 KD-8 反模式。
    missed_signal:
      verdict: "present"
      evidence_refs:
        - "F167 Phase B2 — 铲屎官一下午连续发现 6 个球权漏洞"
        - "F167 Phase F — opus-47 同句 hold + 传球矛盾"
      explanation: >
        Phase B2 的 6 个漏洞是铲屎官实时观察发现的，不是猫猫自测发现的。
        说明当时缺少结构化的 ball ownership 回放/检测机制——
        如果有 trace-based friction detection，至少 case 1/3/4 可以在 Phase A 就暴露。
    cvo_alignment:
      verdict: "needed-earlier-input"
      evidence_refs:
        - "thread_mojs4m6a3rqeo644 — 铲屎官'没完没了互相at半天'是 F167 立项动机"
        - "F167 Phase B2 — 铲屎官实时观察 > 猫猫自测"
        - "F167 KD-19 — @landy 从可选升硬条件，铲屎官原话'你们现在会走向最安全的选择就是找我'"
      explanation: >
        铲屎官的不满是 F167 立项的直接触发。Phase B2 的 6 漏洞证明
        铲屎官的实时观察捕获了猫猫自测漏掉的模式——
        如果更早有结构化反馈通道（F192 的 cat interview），
        这些 friction 可能在 Phase A review 时就被提出。
    tool_fit:
      verdict: "hard-to-use"
      evidence_refs:
        - "fixtures/F167-ball-drop.md — hold_ball 调用被忘记"
        - "F167 Phase G KD-23 — hold_ball 并发行为不明确"
        - "F167 Phase J — hold_ball cancel 缺失"
      explanation: >
        hold_ball MCP tool 经历了 3 轮重设计（C1 → G → J）才稳定。
        初始版本缺少：cancel 机制、单 slot 语义、auto-cancel on user message。
        这些都是"工具存在但不好用"的典型 friction，
        不是发现不了（hard-to-discover），而是用起来边界不清（hard-to-use）。
    next_action:
      verdict: "eval-fixture"
      target: "fixtures/F167-*.md — 3 个 trace fixture 作为回归基线"
```

## Summary

F167 的核心 friction 来自 **harness 设计层**（两条路由路径的隐含假设、RLHF 反射与协议语义冲突、regex intent 判断）而非实现层。铲屎官的实时观察是最有效的 friction detection 手段——这正好验证了 F192 的立论：需要结构化的 trace + interview 机制来补充猫猫自测的盲区。
