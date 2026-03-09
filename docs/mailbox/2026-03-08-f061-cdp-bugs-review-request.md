# Review Request: F061 CDP Bug Fixes — Premature Termination + Model Switching

## What

1. **Bug-1 fix**: `pollResponse` 的 `stablePollCount` 从 2 提升到 4，新增 stop button DOM 检测作为"仍在生成"信号
2. **Bug-2 fix (AC-9)**: 实现 `switchModel()` + `getCurrentModel()` — CDP 桥现在能自动切换 Antigravity 的模型下拉框

变更文件：
- `AntigravityCdpClient.ts` — `switchModel()`, `getCurrentModel()`, stablePollCount 4, hasStopButton
- `AntigravityAgentService.ts` — 调用 `switchModel()`, MODEL_LABEL_MAP, modelVerified flag
- `cdp-dom-scripts.ts` — GET_CURRENT_MODEL_JS, CLICK_MODEL_SELECTOR_JS, FIND_MODEL_OPTION_JS, hasStopButton 检测
- 测试文件 — 7 new tests (53 total)

## Why

铲屎官实测 @ 孟加拉猫时发现两个 bug：
1. 模型 thinking/image generation 阶段暂停 > 2s，连续 2 个 poll 看到相同文本就误判"说完了"
2. 前端选了 Claude Opus 变体，但 Antigravity 仍用 Gemini（CDP 桥没有模型切换能力）

## Original Requirements（必填）

> "他其实是画完了的！也就是你的cdp设计不能这么粗暴！得和你们自己检查输出那样！得想想他有在干活你就不能说人家什么也没干？以及他的thinking那些你得想想怎么才能丢到thinking 🧠 气泡里"
> "我选择的是opus 但是他还是gemini"
- 来源：2026-03-08 铲屎官消息

## Tradeoff

- Bug-1: stablePollCount=4 意味着需要 4 秒稳定期才返回（之前 2 秒），对快速回复略有延迟。权衡：防误截远比快 2 秒重要
- Bug-2: 模型切换依赖 DOM 选择器（class 名），Antigravity 更新可能破坏。但这和消息注入面临相同风险，已有 fallback

## Open Questions

1. `FIND_MODEL_OPTION_JS` 的 DOM 选择器 (`[class*="px-2"][class*="py-1"][class*="cursor-pointer"]`) 来自 Phase 0 实测，Antigravity 版本更新后可能需要调整
2. stop button 检测的 `aria-label` 是否覆盖所有 Antigravity 版本？需要后续实测验证

## Next Action

请 review 上述变更，重点关注：
- `switchModel()` 的 no-op 检测逻辑是否正确（已用 label 前缀匹配而非精确匹配）
- `hasStopButton` 检测是否和 `hasInlineLoading` 的交互正确
- MODEL_LABEL_MAP 的映射是否完整

## 自检证据

### Spec 合规
- F061 AC-9（多模型切换）: ✅ 实现
- 文件行数: CdpClient 346, AgentService 143, dom-scripts 207 — 全部 < 350
- Biome: clean (0 errors after autofix)

### 测试结果
```
pnpm --filter @cat-cafe/api exec node --test test/antigravity-*.test.js
# 53 passed, 0 failed (7 new tests)
```

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`（Known Bugs 节已更新）
- Bug 文档: F061 Known Bugs section
