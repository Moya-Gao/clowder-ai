---
feature_ids: []
topics: [token, usage, panel]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: 最近调用卡片缺少暹罗猫上下文条且双进度条语义不清

## 1) 报告人
- 报告人：铲屎官
- 发现方式：观察右侧“最近调用”卡片，发现：
  - 暹罗猫没有与另外两只猫一致的上下文占用条
  - 两条进度条无文字说明，难以判断含义
  - token 数字与 CLI resume 页面对比产生口径疑问

## 2) 复现步骤（期望 vs 实际）
1. 在 UI 中触发三猫调用，等待最近调用卡片刷新。
2. 观察每只猫的 token 区域和进度条。

期望：
- 三猫都能在有数据时显示一致的“上下文占用”反馈。
- 两条进度条有明确语义标签，用户无需猜测。

实际：
- 暹罗猫常出现仅数字无上下文条。
- 条形图无标签，用户难区分“缓存命中”与“上下文占用”。

## 3) 根因分析（定位过程）
- `context_health` 的发送依赖 `getContextWindowFallback(model)` 返回窗口大小。
- 当前默认暹罗猫模型为 `gemini-3-pro`，但 fallback 表仅包含 `gemini-2.5-*`，导致窗口大小缺失，进而不发送 `context_health`。
- UI 的 `CatTokenUsage` 对两条 bar 仅展示百分比，没有说明文本，造成语义歧义。

## 4) 修复方案（含取舍）
- 后端：在 `CONTEXT_WINDOW_SIZES` 增加 `gemini-3-pro: 1_000_000`，恢复暹罗猫上下文条生成。
- 前端：在 `CatTokenUsage` 为两条进度条补显式标签：
  - `缓存命中`
  - `上下文占用`

取舍：
- 先修可观测性与一致性，不改 token 归一化计算逻辑（当前 `inputTokens` 为统一口径总输入）。
- 与 CLI resume 的“原始字段”差异通过文档和标签解释，后续若要严格对齐再做字段拆分。

## 5) 验证方式
- API 测试：`context-window-sizes.test.js` 新增 `gemini-3-pro` 用例，Red->Green。
- Web 测试：`cat-token-usage.test.ts` 新增标签断言，Red->Green。
- 手测：触发暹罗猫调用后，最近调用卡片可见“上下文占用”条与标签。
