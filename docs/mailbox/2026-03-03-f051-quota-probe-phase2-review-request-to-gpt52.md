---
feature_ids: [F051]
topics: [review, quota, probe, architecture]
doc_kind: review-request
created: 2026-03-03
updated: 2026-03-03
---

# Review Request: F051 猫粮采集 Probe Registry Phase 2

## What

- 新增 Probe Registry 描述模型（CLI / Browser / Placeholder）
- 新增 `GET /api/quota/probes` 提供采集源状态
- Hub 猫粮看板新增官方网页探针状态提示（已禁用/运行异常/已启用）
- 保持止血开关：官方抓取默认 disabled

## Why

止血后需要一个可扩展、可观测的采集骨架，避免“行为不可见 + 风控风险不透明”。
这次先做描述层和状态上屏，不引入额外抓取频率。

## Original Requirements（必填）
> “你可以继续开一个新的worktree 进行我们的f52重构按照gpt pro提供的几个开源组件的做法！”
> “现在我们能走正规途径了！”
- 来源：`docs/discussions/2026-03-03-f051-quota-probe-phase2/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 先做 Probe Registry，不在本轮引入 SQLite/Postgres 时序存储
- Browser probe 继续手动触发，避免自动周期抓取引发风控

## Open Questions

1. Phase 2 是否引入持久化 snapshot（SQLite）用于趋势展示？
2. codex/claude 的“安全采集器”是否统一抽象为 collector service？

## Next Action

请重点 review：
1. Probe 模型是否足够支撑后续多源扩展
2. 默认禁用 + 手动触发边界是否清晰
3. API/Web 的命名与状态语义是否一致

## 自检证据

### Spec 合规
- Quality Gate 报告：`docs/mailbox/2026-03-03-f051-quota-probe-phase2-quality-gate.md`
- AC-8~AC-10 均完成

### 测试结果
- `pnpm --filter @cat-cafe/api build && node --test packages/api/test/quota-api.test.js` → 33 passed, 0 failed
- `pnpm --filter @cat-cafe/web test -- hub-quota-board-v2 cat-cafe-hub-quota-tab` → 16 passed, 0 failed

### 相关文档
- Plan: `docs/plans/2026-03-03-f051-quota-probe-phase2.md`
- Feature: `docs/features/F051-real-quota-dashboard.md`
- Discussion: `docs/discussions/2026-03-03-f051-quota-probe-phase2/README.md`
