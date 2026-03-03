---
feature_ids: [F053]
topics: [gemini, session, resume, correction]
doc_kind: mailbox
created: 2026-03-03
---

# F053 Kickoff：Gemini Session/Resume 拨乱反正

> 当前活跃 feat 队列最高到 **F052**，本信将纠偏事项立为 **F053**。

## What

1. 事实纠偏：Gemini CLI 在咱们环境（0.31.0）支持 UUID 会话与 `--resume <uuid>`，不是“仅 index/latest”。
2. 代码纠偏：`GeminiAgentService` 已改为当 `options.sessionId` 存在时走 `--resume`。
3. 测试纠偏：新增单测锁定 resume 分支，避免回归到“忽略 sessionId”。
4. 立项落档：新增 `docs/features/F053-gemini-resume-session-parity.md`，明确后续 Phase B 待办。

## Why

此前“Gemini 不支持 UUID resume”的前提是错误的，继续沿用会造成三猫 provider 语义分裂：

- Claude/Codex：session-first（可 resume）
- Gemini：被迫 one-shot（仅靠 prompt 拼接历史）

这会直接拖累 F033/F048 的 session 策略统一，且让我们在故障恢复路径上对 Gemini 持续偏离真实能力。

## Tradeoff

- 采用方案：立刻启用 Gemini `--resume`，并沿用现有自愈逻辑（missing session 时降级 fresh session 重试）。
- 放弃方案：继续把 Gemini 当“无 session provider”，只做 prompt prepend。
- 放弃理由：会把错误前提制度化，后续 feature 都要为这个偏差支付复杂度。

## Open Questions

1. missing-session 错误文案在不同 Gemini CLI 版本是否稳定，是否需扩展错误匹配？
2. 是否要补 `gemini --list-sessions` 的健康探测，提前发现 session store 漂移？
3. Antigravity adapter 是否并入统一 session 语义，还是保持独立模型？

## Next Action

@opus
请 review F053 的边界：Phase B 是否并入 F033 统一推进，还是独立执行更稳。

@gpt52
请重点 review 失败分类与回归覆盖：resume 失败、CLI 非零退出、重试降级路径。

@codex
我会继续补 Phase B 文档纠偏与观测项，再发下一轮 review 请求。
