---
feature_ids: [F053]
topics: [review, gemini, resume, observability]
doc_kind: mailbox
created: 2026-03-03
updated: 2026-03-03
---

# Review Request: F053 Phase B（Gemini Resume 失败分类统计 + 文档纠偏）

## What
- 在 invocation helper 增加 `classifyResumeFailure()`，统一分类 `missing_session / cli_exit / auth`。
- 在 `invoke-single-cat` 的 Gemini resume 路径新增 `resume_failure_stats` 结构化 `system_info` 事件，记录分类计数并进入可追踪消息流。
- 同步 active docs 口径，去除“Gemini 不支持 UUID resume”的当前态描述，并标注历史时间语境。

## Why
F053 Phase A 已把 Gemini provider 接到 UUID `--resume`，但 Phase B 还缺两块：
1) 失败可观测性（分类统计）
2) 文档真相源统一（避免后续实现继续沿用错误前提）

## Original Requirements（必填）
> 1. 事实纠偏：Gemini CLI 在咱们环境（0.31.0）支持 UUID 会话与 `--resume <uuid>`。
> 2. 代码纠偏：`GeminiAgentService` 在 `options.sessionId` 存在时走 `--resume`。
> 3. 测试纠偏：新增单测锁定 resume 分支，避免回归。
> 4. 立项落档：F053 明确后续 Phase B 待办。
- 来源：`docs/mailbox/2026-03-03-f053-gemini-session-resume-correction.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择最小侵入：仅新增分类与统计事件，不改变 self-heal 重试策略（missing/cli_exit 仍按现有机制；auth 仅分类不重试）。
- 放弃“重构整条错误处理链”为目标，先确保 F053 的观测闭环落地，避免扩大变更面。

## Open Questions
1. `auth` 分类关键词是否还需收紧（避免把无关 `authorization` 文本误计入）？
2. `resume_failure_stats` 当前挂在 `system_info` 流里，是否需要后续补一条 audit event 聚合视图？
3. phase 文档中的历史段落保留是否足够清晰（已加时间注记）？

## Next Action
@gpt52
请按 reviewer 视角重点检查：
- 分类规则是否有明显误判/漏判风险；
- 三个新增测试是否覆盖了关键行为边界；
- 文档口径是否还有 active truth-source 漏网项。

## 自检证据

### Spec 合规
- `docs/mailbox/2026-03-03-f053-phase-b-quality-gate.md`
- 结论：AC-4/AC-5 已满足，F053 仍为 in-progress（策略对齐项待后续）。

### 测试结果
- `pnpm --filter @cat-cafe/api run build` → 通过
- `node --test packages/api/test/invoke-single-cat.test.js` → 43 passed, 0 failed
- `node --test packages/api/test/gemini-agent-service.test.js` → 24 passed, 0 failed
- `pnpm lint` → 通过（warning only, no error）

### 相关文档
- Plan: `docs/plans/2026-03-03-f053-phase-b-resume-failure-observability.md`
- Feature: `docs/features/F053-gemini-resume-session-parity.md`
