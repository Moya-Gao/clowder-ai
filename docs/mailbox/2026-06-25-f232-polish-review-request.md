---
feature_ids: [F232]
topics: [artifacts, widget, polish]
doc_kind: review-request
created: 2026-06-25
---

# Review Request: F232 widget artifact type + action labels polish

Review-Target-ID: f232-polish
Branch: feat/f232-polish
PR: #2535

## What

1. `html_widget` / `interactive` rich blocks 收录为 `type='widget'` 产物（shared type + aggregator switch + frontend icon/tint/filter）
2. 按钮文案类型化：`artifactActionLabel()` 纯函数（audio/video → "播放"，其余 → "打开"）
3. Feature doc 更新：OQ-3/OQ-4 marked resolved，KD-7 widget 设计决策，timeline 新条目

## Why

CVO 2026-06-24 确认 html_widget / interactive 应算作产物（OQ-3）；thread 维度归属正确（OQ-4）。按钮文案是 Phase B 遗留的视觉打磨（audio/video 的 action 应该是"播放"不是"打开"）。

## Original Requirements（必填）

> "html_widget / interactive 块算不算'产物'？我感觉很有可能算诶！"
> "relay thread 的产物归属... 我觉得这个是 thread 维度的啊！！"
- 来源：CVO 2026-06-24 thread 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

Widget 内容（HTML/交互组件）存在 RichBlock 里，不在 ThreadArtifactDTO。可选方案是扩展 DTO 带 HTML content，但跨安全边界成本高。选择 classify → fallback（"跳回原消息"），value = listing 让用户能找到 widget，点击定位到原消息。

## Architecture Ownership（必填）

Architecture cell: threads（artifacts 聚合是 thread 子系统）
Map delta: none
Why: 只在现有 aggregator switch 里加两个 case + shared type 加一个 union member，不改 cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 若修改 docs/architecture/ownership/cells/*.md，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
无。变更是纯增量（新 type + 新纯函数），不修改现有行为。

### 价值 OQ（给 CVO，如有）
无——CVO 已在对话中明确拍板。

## Next Action

请 review 代码正确性 + 类型安全 + 测试覆盖。

## Review Sandbox（必填）
- Path: /tmp/cat-cafe-review/f232-polish/{reviewer-handle}
- Start Command: pnpm review:start
- Ports: 自动分配（3201+）

## 自检证据

### Spec 合规
- OQ-3 html_widget/interactive 收录 → ✅ 实现
- OQ-4 thread 归属确认 → ✅ doc 更新
- 按钮文案类型化 → ✅ artifactActionLabel() + ArtifactsPanel 消费

### 测试结果
- pnpm --filter @cat-cafe/api test → aggregator 23/23 pass, 0 failed ✅
- pnpm --filter @cat-cafe/web test → 518 files, 4574 tests pass ✅
- pnpm check → 0 errors ✅（含 capability-tips check）
- pnpm --filter @cat-cafe/shared build → exit 0 ✅

### Dogfood-Your-Slice
Scope verdict: 🆗 可豁免（理由：widget 产物收录是聚合逻辑扩展，需要真实 html_widget rich block 才能端到端验证；按钮文案是纯 UI 文案替换，无数据流变化。测试覆盖了全部新路径。）

### Artifact Hygiene
根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### 相关文档
- Feature: docs/features/F232-thread-artifacts-panel.md
