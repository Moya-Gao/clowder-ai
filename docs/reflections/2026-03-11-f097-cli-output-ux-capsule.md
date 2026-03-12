---
capsule_id: "F097-PhaseA-2026-03-11"
context: "CLI Output Collapsible UX — Phase A 折叠式重构 + 4 轮视觉 hotfix"
feature_ids: [F097]
doc_kind: capsule
created: 2026-03-11
---

## What Worked
- CliOutputBlock 统一接口设计（`CliEvent[]` 时序流）证明有效：Phase A 前端适配层工作正常，Phase B 换数据源时组件零改动
- `toCliEvents.ts` 适配层干净地解耦了数据格式（`toolEvents[]` + `content`）和渲染组件
- 三层折叠交互（CLI 块 → tools 区 → 单个 tool）铲屎官认可，streaming 自动展开 + done 自动收起体验闭环
- `tintedDark()` 品种色混合方案最终效果好：深色基底 + 品种色混入 → 既能看出品种色又保证文字可读
- @mention 彩色徽章 + owner 金色 #F5A623 直觉好，铲屎官没改
- 防御性 `hasCliBlock ? null :` guard 一次解决了文字溢出边缘情况

## What Failed
- **4 轮才稳定视觉**：黑 → 浅紫 → 深紫混合，每轮都是铲屎官截图报 bug 才发现问题。应该第一轮就走 debugging skill + 设计稿对比
- **手画 SVG 而非 lucide 官方**：设计稿明确写了 `iconFontFamily: "lucide"`，仍然自己画 path，效果和设计稿完全不同
- **rgba 透明度没考虑主题差异**：`rgba(accent, 0.10)` 在浅色主题上叠出浅紫色，文字不可见。这是工程问题不是审美问题
- **文字溢出 CLI 块外没自己发现**：push 后没去 runtime 验证，严重 bug 让铲屎官替我发现
- **label 格式 `catId → toolName` 没解析**：useAgentMessages 生成的格式直接透传到 UI，tool 列表变成无意义的 `opus → X` 重复

## Trigger Missed
- 遇到视觉 bug 时应触发 debugging skill（CLAUDE.md 明确要求），但 4 次都跳过了
- push 后应触发"runtime 截图验证"，但每次都跳过直接报告"改完了"
- 改半透明颜色时应触发"主题兼容性检查"（浅色/深色主题下的表现），但没有
- 设计稿已有精确颜色值时，应触发"batch_get 逐属性对照"，而不是凭印象写近似值

## Doc Links
- Feature spec: `docs/features/F097-cli-output-collapsible-ux.md`
- PR: https://github.com/zts212653/cat-cafe/pull/372 (Phase A)
- PR: https://github.com/zts212653/cat-cafe/pull/374 (hotfix batch 1)
- Review request: `docs/mailbox/2026-03-11-f097-cli-output-review-request.md`

## Rule Update Target
- **MEMORY.md 已更新**：debugging skill 是必须的（连犯 5 次+），不许猜颜色值
- **F097 spec 第四轮反思**：完整的 8 项问题表 + 正确流程模板
- **建议新规则**：push 视觉改动后，必须 runtime 截图验证再报告完成（考虑加入 quality-gate）
