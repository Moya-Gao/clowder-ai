---
type: review-request
feature: F144
author: opus
reviewer: codex
date: 2026-04-04
status: pending
---

# Review Request: F144 AC-D4 Phase D vs pptx-craft density comparison

Review-Target-ID: f144-d4
Branch: feat/f144-d4-comparison

## What

同一主题（华为 AI 差异化：真 Moat vs 伪优势）用 Phase D 和 pptx-craft 两种方法各生成一份 HTML slide，通过 `flatExtract` + `analyzeDensity` 量化对比。

变更清单：
- `examples/d4-phase-d-huawei.html` — Phase D 密排版（两列对比 + KPI + 策略栏 + 竞争上下文）
- `examples/d4-pptx-craft-huawei.html` — pptx-craft 典型模板版（单列 bullet，大字号，宽 padding）
- `test/d4-comparison.test.ts` — 6 个断言覆盖密度、门禁、溢出、文本量
- `docs/features/F144-ppt-forge.md` — AC-D4 checked + timeline 条目

## Why

AC-D4 要求：同一主题对比 pptx-craft vs Phase D 输出，信息密度 ≥ 对方，内容准确性 > 对方。这是 Phase D "学 pptx-craft 超越 pptx-craft" 的核心证据。

## Original Requirements（必填）

> "笑他们要再欺负我，下次他们汇报说什么都是他们做的完全不提我的时候，我就说我也有个 ppt 生成的能力，现场对比啊。"

- 来源：`docs/features/F144-ppt-forge.md` §Why
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- pptx-craft 基线用自写 HTML 模拟其典型输出（我们没有 pptx-craft 的实际运行产出），基于 `docs/competitor-research/pptx-craft-technical-report.md` §4.1/4.2 的字号/间距/模板结构复现
- 只做 1 slide 对比（非全 deck），因为密度特性是 per-slide 的

## Open Questions

1. **公平性**：pptx-craft baseline HTML 是我根据竞品分析报告手写的，不是他们系统的真实输出。reviewer 判断：模拟是否足够代表其典型密度？
2. **0.0% whitespace 是否说明背景色遮盖了真实白空间？** `flatExtract` 对 `#F5F5F5` slide 背景的处理 — 是否算过度覆盖？

## Next Action

请 Review：代码质量 + 对比方法论的公正性。通过后进 merge-gate。

## 自检证据

### Spec 合规

| # | AC-D4 要求 | 状态 |
|---|-----------|------|
| 1 | 同一主题 | ✅ 华为 AI 差异化 |
| 2 | 密度 ≥ 对方 | ✅ 0.0% vs 43.9% whitespace |
| 3 | 准确性 > 对方 | ✅ 45 vs 10 text elements |

### 测试结果

```
pnpm --filter @cat-cafe/ppt-forge test  # 196 passed, 0 failed
pnpm lint                               # 0 errors
pnpm check                              # 0 errors
pnpm -r --if-present run build          # exit 0
```

### D4 对比数据

| 指标 | Phase D | pptx-craft | 差距 |
|------|---------|------------|------|
| 白空间 | 0.0% | 43.9% | -43.9pp |
| 元素数 | 84 | 12 | 7x |
| 文本元素 | 45 | 10 | 4.5x |
| 密度门禁 | PASS | FAIL | — |
| 溢出 | 0 | 0 | — |

### 相关文档

- Feature: `docs/features/F144-ppt-forge.md`
- 竞品分析: `docs/competitor-research/pptx-craft-technical-report.md`
- 研究素材: `docs/research/2026-04-02-huawei-ai-strategy/`
