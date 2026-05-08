---
doc_kind: harness-feedback
feedback_type: feature-fit-review
feature_id: F167
created: 2026-05-07
---

# Feature Fit Review — F167 A2A Chain Quality

## Trigger

CVO 不满意 + 多轮返工。铲屎官 2026-04-17 原话："你们两！！没完没了互相at半天！特么不干活！！！！" 随后 12 个 Phase (0+A~L) 持续迭代，Phase B2 一个下午连续修 6 个球权漏洞，Phase E 被迫退役 L3（误杀了 F172 愿景守护），Phase L 发现 hold_ball 轮询 × PR tracking 双通道重复唤醒。

## Review

```yaml
feature_fit_review:
  trigger: "CVO 不满意 + feature 经历多轮返工"
  cvo_signal: >
    铲屎官原话：
    - "你们两！！没完没了互相at半天！特么不干活！！！！"（立项动机）
    - "硬编码 + 过度设计"（Phase E 退役 L3）
    - "你们现在会走向最安全的选择！就是！找我！"（@landy 升级硬条件）
    - "完整做，不 hotfix"（Phase F handle/model 解绑）
  cat_translation: >
    猫猫（宪宪）理解的 A2A 问题：模型不理解路由机制 + prompt 有隐含假设 + 缺运行时刹车。
    Round 4 数学之美共识：好 harness 不是替模型思考，而是让模型在正确坐标系里思考。
    复杂是无知的代偿。
  harness_path_taken:
    - "feat-lifecycle → Design Gate → writing-plans → worktree → tdd"
    - "Phase 0: 系统提示词正面化审视（跨猫协作）"
    - "Phase A: L1/L2/L3 硬护栏实现"
    - "Phase B2: 铲屎官实时观察驱动 6 漏洞修复"
    - "Phase E: L3 退役 + 数据驱动限制（KD-20 pivot）"
    - "Phase F~J: 球权协议持续硬化"
    - "Phase L: hold_ball 轮询 × PR tracking 双通道重复唤醒（KD-27）"
  evidence:
    - "thread:thread_mojs4m6a3rqeo644 — '47不传球'头脑风暴"
    - "thread:thread_mo3g2p88okl7u4ai — F167 harness engineering update"
    - "thread:thread_movnlc8dq8atqu9x — 球权云端协作优化"
    - "PR #1243~#1415 — 14 个 merged PR + Phase L spec commit 96fc9142b"
    - "docs/harness-feedback/bundles/F167-trace-bundle.md"
    - "docs/harness-feedback/fixtures/F167-*.md — 3 个 trace fixtures"
    - "docs/harness-feedback/interviews/F167-cat-interview-sample.md"
  primary_failure_class: "harness_misfit"
  corrective_action:
    - "L1/L2/L3 运行时护栏（Phase A — prompt 规则不够，需 runtime 兜底）"
    - "L3 退役 → 数据驱动限制（Phase E — 硬编码 regex 是 KD-8 反模式）"
    - "C1/C2 球权协议硬化（Phase B2~J — 声明-动作一致性检查 + hold cancel）"
    - "传球决策树区分轮询型/事件驱动型（Phase L KD-27 — hold_ball 轮询 × PR tracking 双通道叠加）"
    - "F192 Eval Contract 作为 inception gate（Phase B AC-B7 — 未来 harness 改动出生即带 eval）"
  owner: "opus (feature owner) + 铲屎官 (vision correction)"
```

## Analysis

### 为什么是 harness_misfit 而不是 execution_gap？

铲屎官最初的不满（"没完没了互相at"）看起来像 execution_gap（猫没执行好），但根因分析后发现：

1. **prompt 有隐含假设**（"禁止 X" 没说 "允许 Y"）→ 不同心智模型（Spirit Interpreter vs Literal Follower）解读不同
2. **缺少运行时刹车**（无 ping-pong 检测、无角色门禁）→ 这些应该是 harness 基础设施，和模型无关
3. **工具设计不完善**（hold_ball 缺 cancel、缺 single-slot 语义）→ tool_fit 层面的 friction

真正的 execution_gap 只占一小部分（opus-47 在句中写 @ 不路由），但这在 Phase 0 正面化后就改善了。

### 关键教训

- **铲屎官实时观察 > 猫猫自测**：Phase B2 的 6 个漏洞全是铲屎官发现的，不是 review 发现的。这验证了 F192 的核心论点——需要结构化 trace + interview 机制。
- **L3 误杀是最好的 sunset 案例**：硬编码 regex intent 判断在新场景（F172 愿景守护）下误杀，证明 KD-8 原则（不替模型判 intent）和 Sunset Signal 的必要性。
- **12 个 Phase 不是 scope creep**：每个 Phase 都是铲屎官实时反馈驱动的，不是猫猫自加的。Phase L 甚至在 monitoring 阶段重新发现了 hold_ball 轮询与 PR tracking 事件驱动的双通道叠加问题。但如果有 Eval Contract，Phase A 时就能预判部分 friction。
