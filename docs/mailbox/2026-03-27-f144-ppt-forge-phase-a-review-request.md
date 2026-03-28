---
feature_ids: [F144]
topics: [review-request, ppt-forge, phase-a]
doc_kind: mailbox
created: 2026-03-27
---

# Review Request: F144 PPT Forge — Phase A Level 1 骨架

Review-Target-ID: f144
Branch: feat/ppt-forge

## What

新建 `packages/ppt-forge` 独立包，实现 Blueprint JSON + Theme JSON → 原生 .pptx 的 Export 层。

9 commits，包含：
- Blueprint V2 terminal schema（types.ts）
- 10 个 layout 定义（含华为密排变体）
- 4 个 renderer（text/table/chart/KPI）
- Slide master builder + SlideBuilder orchestrator
- CLI 入口
- 华为风格 design token（PingFang SC + CF0A2C 红）
- 10 页集成测试 + CJK chart font POC

## Why

铲屎官要"现场对比打脸"——用真工程对比对方团队的 pptx-craft（HTML 截图转 PPTX）。Phase A Level 1 是骨架 vertical slice，证明 contract chain 端到端通了，铲屎官已验收并同意先 merge 再迭代视觉。

## Original Requirements（必填）

> "如果要让你组织猫猫们来实现一个 ppt 生成的 skills 或者说引擎！比如我和你说我想要华为/IBM/xxx/yyy 风格的 ppt，然后给你们一些主题……来吧我们也来搞一个业界 sota 的 ppt skills！"
>
> "我就问一个问题！你们这个能生成他们吹的什么可编辑的ppt什么之类的吗？"
>
> "走起！先把骨架 merge 进去，后面再迭代！按照你们的方案迭代！"

- 来源：F144 spec `docs/features/F144-ppt-forge.md` Why 段 + 本 session 铲屎官消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **视觉简陋** — Level 1 只有纯色背景 + 文字/表格/图表，无装饰性元素（logo/色块/渐变）。铲屎官已看到效果并同意后续迭代
2. **PingFang SC vs Noto Sans SC** — Noto Sans SC 需手动安装，PingFang SC 是 macOS 自带。换了主字体以解决铲屎官 Mac 上的字体缺失警告
3. **pptxgenjs CJS/ESM interop** — 用 structural typing 绕过了 namespace 类型问题，代码层面有 `any` cast，但运行正确

## Open Questions

1. **AC-A12 (PPT 365 无 repair)** — 铲屎官用 Keynote 打开时有"文件格式无效"警告。Keynote 是 "can open" 级别，需要用 PPT 365 验证
2. **字体策略** — PingFang SC 是 macOS only，Windows 上 fallback 到什么？当前 fallback 是 Noto Sans SC（需安装）
3. **Level 1.5 视觉增强优先级** — 铲屎官说"按你们方案迭代"，需要确认 reviewer 对骨架架构的认可再推进

## Next Action

请 review 代码架构和 contract chain 设计。重点关注：
- types.ts 的 Blueprint V2 schema 是否覆盖后续 Level 2 扩展
- renderer 接口设计是否合理（mock-based 测试 vs 真实 pptxgenjs）
- theme token 三层体系是否足够灵活

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-A1: ≥10 页 | ✅ | 10 页 huawei-demo |
| AC-A4: Blueprint JSON | ✅ | huawei-demo-blueprint.json |
| AC-A5: Theme JSON | ✅ | huawei-like.json |
| AC-A6: 原生 .pptx 可编辑 | ✅ | 铲屎官 Keynote 验证 |
| AC-A7: huawei-like | ✅ 骨架 | 颜色/字体对，视觉后续迭代 |
| AC-A9: 密排状态矩阵 | ✅ | per-cell 颜色编码 |
| AC-A11: CJK POC | ✅ | chart XML 含 PingFang SC |
| AC-A12: PPT 365 无 repair | ⚠️ | 需 PPT 365 验证 |

### 测试结果

```
tsx --test 'packages/ppt-forge/test/**/*.test.ts' → 42/42 pass, 0 failed
tsc --noEmit → 0 errors
```

### 相关文档
- Feature: `docs/features/F144-ppt-forge.md`
- Plan: `docs/plans/2026-03-27-f144-ppt-forge-phase-a.md`
- Research: `docs/research/2026-03-27-f144-ppt-forge-gpt-pro-consult.md`
- Theme spec: `docs/research/2026-03-27-f144-ppt-forge/theme-token-spec.md`
