---
feature_ids: [F053]
topics: [gemini, session, resume, parity, reliability]
doc_kind: feature-spec
created: 2026-03-03
updated: 2026-03-03
---

# F053: Gemini Session/Resume 语义对齐

> **Status**: done
> **Owner**: 缅因猫
> **Priority**: P1
> **依赖**: F033（Session Chain 策略）
> **Updated**: 2026-03-03（Phase A + Phase B 全部落地）

## 愿景

> **一句话**：Gemini 在咱们系统里也必须是“有 session、可 resume”的一等公民，不再走一次性降级路径。

## Why（纠偏原因）

我们之前长期把 Gemini CLI 当成“不支持 UUID resume”的提供方，这个前提已经被本机实测推翻（2026-03-03）：

1. `gemini --list-sessions` 明确列出 UUID 形态会话 ID。
2. 会话文件 `~/.gemini/tmp/<project>/chats/session-*.json` 顶层有 `sessionId`，且为 UUID。
3. `gemini --resume <uuid> -p ... -o stream-json` 在当前环境（Gemini CLI 0.31.0）可成功恢复并输出结果。

旧前提导致了不必要的实现降级：`GeminiAgentService` 里曾显式注释“resume 不支持 UUID”，并忽略 `options.sessionId`。

## What（本 Feature 做什么）

### Phase A（已完成）

1. **Provider 能力纠偏**：`GeminiAgentService` 在 `options.sessionId` 存在时，改为调用 `--resume <sessionId>`。
2. **测试补齐**：新增单测，验证 `sessionId` 传入时 CLI 参数包含 `--resume`。
3. **Roadmap 立项**：将 Gemini session/resume 对齐显式立为 F053，避免后续讨论继续沿用错误前提。

### Phase B（进行中）

1. [x] **系统文档同步**：清理 active docs 中“Gemini 不支持 UUID resume”的陈旧描述并标注历史上下文。
2. [x] **观测与告警**：补充 Gemini resume 失败分类（missing session / cli exit / auth）统计（`resume_failure_stats`）。
3. [x] **策略对齐**：将 Gemini 纳入和 Claude/Codex 一致的 session strategy（`sessionChain: true` 启用，系统提示词改为仅注入一次，session chain 记录正常创建）。

## Acceptance Criteria

- [x] AC-1: `GeminiAgentService` 在 `sessionId` 存在时使用 `--resume <sessionId>`。
- [x] AC-2: `GeminiAgentService` 单测覆盖 resume 参数分支。
- [x] AC-3: 维持无 `sessionId` 时的原有 headless 调用分支。
- [x] AC-4: active docs 清除“Gemini 不支持 UUID resume”旧说法并统一口径（历史文档保留时间上下文）。
- [x] AC-5: 补充 resume 失败观测项并输出到可追踪日志（`resume_failure_stats`）。

## 需求点 Checklist

| ID | 需求点 | AC 编号 | 验证方式 | 状态 |
|----|--------|---------|----------|------|
| R1 | “Gemini 也要走 resume/session 概念” | AC-1, AC-3 | provider 行为 + 集成回归 | [x] |
| R2 | “先拨乱反正，别再按错误前提实现” | AC-2, AC-4 | 单测 + 文档检查 | [x] |
| R3 | “后续策略和另外两猫一致化” | AC-5 | 观测项 + strategy 讨论记录 | [x] |

## Tradeoff

- 选择“直接启用 resume + 保留失败自愈重试”，而不是继续只靠 prompt prepend 维持上下文。
- 启用 resume 后，旧会话失效场景会更显性（会出现 missing-session 错误），但这是可恢复且可观测的正确失败。

## Open Questions

1. Gemini CLI 在不同版本下 missing-session 错误文案是否稳定，是否需要扩展匹配规则？
2. `gemini --resume` 在某些工作目录切换场景下是否会受 project bucket 影响（需补充跨目录用例）？
3. Antigravity adapter 是否要纳入同一 session 语义，还是保持独立“外部会话”模型？

## Test Evidence（Phase A）

- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/gemini-agent-service.test.js`
- 结果：24 passed, 0 failed（含新增 `passes --resume when sessionId is provided`）

## Test Evidence（Phase B）

- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/invoke-single-cat.test.js --test-name-pattern "resume failure"`
- 结果：43 passed, 0 failed（含分类与 `resume_failure_stats` 新增用例）

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-03 | 本机取证确认 Gemini CLI 支持 UUID session + `--resume` |
| 2026-03-03 | Gemini provider 改为在 `sessionId` 存在时使用 `--resume` |
| 2026-03-03 | F053 立项，进入 Phase A/B 执行 |
| 2026-03-03 | Phase B.1/B.2 落地：文档口径同步 + resume 失败分类统计上线 |
| 2026-03-03 | Phase B.3 落地：`sessionChain: true` 启用，系统提示词注入策略与 Claude/Codex 对齐 |
