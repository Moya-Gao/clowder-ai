---
feature_ids: [F222]
related_features: [F192, F128]
topics: [frustration, auto-issue, friction-detection, eval]
doc_kind: spec
created: 2026-06-03
---

# F222: Frustration Auto-Issue — 把负体验变成结构化反馈

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Architecture Ownership

Architecture cell: harness-eval
Map delta: none（复用 F128 propose_thread pattern + F192 signal pipeline）

## Why

用户遇到问题时（CLI 报错 / A2A 超时 / 猫反复给错答案），大部分人默默扛或放弃。这些负体验是最有价值的 eval 信号，但目前完全流失。

铲屎官原话（2026-06-02）："比如用户很愤怒了，这种时候介入一下，独立通知，然后采集日志，生成本地的 issue 让用户预览，用户就可以一键提单。"

类似 F128 创建 thread，但触发条件是摩擦信号。

## Current State / 现状基线

N/A（全新能力）。当前用户遇到问题只有两条路：自己解决，或在聊天里手动描述。没有结构化的"问题采集→一键提交"通道。

## What

### Phase A: 摩擦检测 + Auto-Issue 生成

**触发信号**：
- 用户重复说"不对""错了""怎么回事"（文本情绪/关键词）
- CLI 报错 / 工具调用连续失败（exit code / error log）
- @ 了猫但超时没回复（A2A timeout）
- 短时间内连续 cancel 多个工具调用（Permission Cancel 频率突增）
- 用户反复 retry 同一操作

**产出**：
```yaml
kind: auto_issue
trigger: frustration_detected / cli_error / a2a_timeout / cancel_burst
context:
  thread_id: xxx
  recent_messages: [最近 5 条对话]
  error_logs: [如有]
  tool_call_history: [最近 3 个 tool call + approve/cancel]
  cat_involved: opus
user_description: "（用户可编辑的一句话描述）"
status: draft  # 用户预览后才提交
```

**用户体验**："我注意到刚才可能出了问题。我帮你整理了日志和上下文，你看看描述对不对？确认后一键提交。"

## Eval / Tracking Contract

### 1. Primary Users + Activation Signal
- **Users**: 铲屎官（问题报告者）+ 猫猫（接单修复者）
- **Activation**: 摩擦信号触发 → 弹 issue 预览卡

### 2. Friction Metric
- 误触发率（没问题也弹）
- 用户跳过率（弹了但用户不理）
- 提交后未处理率

### 3. Regression Fixture
- CLI 报错 → 触发 auto-issue 采集日志 → 用户看到预览
- 连续 3 次 cancel → 触发 → 用户看到预览
- 正常对话（无摩擦）→ 不触发

### 4. Sunset Signal
- 如果触发率很低（用户很少遇到问题）→ 可能系统已经足够好
- 如果用户跳过率 >80% → 触发条件可能太松，需要收紧
- 如果被 code-as-harness 的 harness fix 能力替代（问题自动修掉了不需要报告）→ sunset

## Acceptance Criteria

### Phase A ✅
- [x] AC-A1: 摩擦信号检测（至少支持 CLI 报错 + 连续 cancel 两种触发）
- [x] AC-A2: Auto-issue 卡片生成（rich block，含上下文采集 + 用户可编辑描述）
- [x] AC-A3: 用户确认后 issue 持久化（可被 eval:task-outcome 消费）
- [x] AC-A4: 用户跳过 → 不产生 issue，但 cancel/error 事件仍被 Permission Cancel 记录

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-04 | Phase A follow-up merged (PR #2082): auto-issue card status hydration keeps confirmed/skipped state visible after refresh |

## Dependencies

- F192 Phase G eval:task-outcome（Auto-Issue 确认事件作为 Phase G v1 信号源）
- code-as-harness skill（共享摩擦检测 trigger 逻辑，但 Auto-Issue 侧重"采集+报告"而非"诊断+修复"）

## Links

- [eval:task-outcome 终态计划](../discussions/2026-06-03-eval-task-outcome-plan.md)
- [OQ-4 §4.5c Frustration Auto-Issue](../discussions/2026-06-01-oq4-harness-self-evolution-synthesis.md)
- [F192 审计 §7.5](../discussions/2026-06-01-f192-eval-coverage-audit.md)
- [Demo 剧本](../content/drafts/demo-script-code-as-harness.md)
