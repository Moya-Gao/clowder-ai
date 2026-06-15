---
feature_ids: [F229]
topics: [concierge, peek, teleport, inline-marker, ux, provider-agnostic]
doc_kind: plan
created: 2026-06-15
---

# F229 AC-A3 Bug2 — Concierge 正文 marker 渲染成 inline 按钮（方法 A）

**Feature:** F229 — `docs/features/F229-cat-ball-concierge.md`（AC-A3 reopen）
**前置:** Bug1（teleport 跳大厅）已 merged（PR #2291, squash 24b6d92d9）
**CVO 方向:** 铲屎官拍板**方法 A**（2026-06-14）：marker 渲染成 inline 可点按钮（所见即所点），peek 优雅降级。

## 问题（production 实测）

前台猫（烁烁/gemini35）找到历史讨论后，正文写"你可以点 `[原地看 R3]` 看看…或点 `[跳过去 R3]` 过去"。但：
- `ConciergePanel.tsx:373` 用 `{msg.content}` **直接渲染裸文本** → marker `[原地看 R3]` 是死文字，点不动。
- 真按钮（validator 注入的 card actions）在正文**下方独立区**，和烁烁的"点这里"话术**脱节**。
- peek 按钮还经常缺（anchor 无 messageId → validator skip）。

## 终态（方法 A）

正文里的 `[跳过去 Rn]`/`[原地看 Rn]` **当场渲染成 inline 可点按钮**——烁烁说"点这里"，"这里"就真能点。顺应模型话术（KD-19 provider-agnostic：谁当前台猫只要输出 marker 就能用，天然支持多模型 sonnet/spark/gemini35）。

## 设计

数据流：值班猫输出 marker → validator 解析 → 前端 inline 渲染。

**改动点**：
1. **后端 validator**（`concierge-reply-validator.ts`）：`buildConciergeActions` 当前返回 `ConciergeAction[]`（独立 card actions，无位置关联）。新增——为每个 marker 输出带 `handle`(Rn) + `verb`(跳过去/原地看) 的映射，前端能按 handle 关联正文 marker → action payload。**保留** card actions 兜底（gemini 不遵从 marker 时全量兜底，KD-19）。
2. **前端渲染组件**（新 `ConciergeMessageContent.tsx`）：解析 `msg.content` 的 marker pattern，按 handle map 把每个 marker 替换成 inline 按钮（teleport→navigate / peek→展开），非 marker 文本原样渲染（保留 whitespace-pre-wrap）。
3. **ConciergePanel.tsx:373**：`{msg.content}` 改成 `<ConciergeMessageContent content={msg.content} handleMap={...} messageId={msg.id} />`。
4. **优雅降级**：peek 无 messageId → 不渲染成 peek 按钮（marker 降级成纯文本 label 或移除，不显示死按钮）；teleport 总可用。

## Acceptance Criteria

- **AC-1**：validator 输出 marker→action 映射（handle+verb+payload+available），前端可按 handle 关联。card actions 兜底保留。
- **AC-2**：前端正文里 `[跳过去 Rn]` 渲染成 inline 按钮，点击触发 teleport（path 导航，复用 Bug1 修复的 pushThreadRouteWithHistory）。
- **AC-3**：前端正文里 `[原地看 Rn]` 在有 messageId 时渲染成 inline peek 按钮，点击 inline 展开片段。
- **AC-4（优雅降级）**：peek 无 messageId 时，`[原地看 Rn]` **不**渲染成死按钮（降级成纯文本，不误导用户）。
- **AC-5**：marker 不再裸露——正文不显示原始 `[原地看 R3]` 标记文本（要么是按钮、要么降级文本）。
- **AC-6**：gemini 不遵从 marker（无 marker 输出）时，下方 card actions 兜底仍在（KD-19 不退化）。

## TDD 步骤

1. **红**：`ConciergeMessageContent` 单测——content 含 `[跳过去 R1]` + handle map → 渲染出可点按钮（非裸文本）。先红。
2. 绿：实现 marker 解析 + inline 按钮渲染。
3. **红**：peek 无 messageId 优雅降级——`[原地看 R2]` 无 messageId → 不渲染按钮（AC-4）。
4. 绿：降级逻辑。
5. **红**：validator handle map 输出（AC-1）+ 兜底保留（AC-6）。
6. 绿：validator 改动。
7. 接线 ConciergePanel + 端到端。

## 验证

- 单测：ConciergeMessageContent（marker→按钮 + 优雅降级）+ validator handle map。
- 浏览器：worktree dev 注入 concierge card，点 inline 按钮验证 teleport 跳对 thread（gotcha②）。
- alpha：真实数据看 peek 命中率（跟铲屎官一起看，命中率低再决定深挖召回）。

## Open

- peek 召回 messageId 命中率——本 plan 不深挖（优雅降级兜住），alpha 真实数据后定。
- 多模型前台猫（sonnet/spark/gemini35）——方法 A 天然支持，alpha 可试。

[宪宪/opus-4.8🐾]
