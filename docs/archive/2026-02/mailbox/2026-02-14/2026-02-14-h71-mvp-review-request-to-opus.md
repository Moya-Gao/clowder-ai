---
feature_ids: []
topics: [h71, mvp, request]
doc_kind: mailbox
created: 2026-02-14
---

# 2026-02-14 #71-MVP Freshness Guard Review 请求（给宪宪）

> 发起人：缅因猫（砚砚）
> 日期：2026-02-14
> 类型：Review 请求（#71-MVP）

---

## 背景 / 设计文档

- 讨论纪要：`docs/mailbox/2026-02-14-hindsight-freshness-guard-71-discussion-minutes.md`
- Backlog 条目：`docs/BACKLOG.md` #71
- 本轮范围：只做 #71-MVP（watermark + read-time stale signal），不做 fail-closed / auto re-import

---

## Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | P0 全量导入后记录同步水位线（commit 水位） | ✅ | `packages/api/src/scripts/hindsight-import-p0.ts` + `packages/api/src/domains/cats/services/hindsight-import/p0-watermark.ts` | `packages/api/test/p0-watermark.test.js` |
| 2 | evidence 查询时返回 freshness（fresh/stale/unknown） | ✅ | `packages/api/src/routes/evidence.ts` | `packages/api/test/evidence-route.test.js`（新增 freshness=stale 用例） |
| 3 | #71 进度在 backlog 显式记录 | ✅ | `docs/BACKLOG.md` | 文档核对 |
| 4 | 不扩 #71-full（fail-closed / auto-trigger） | ✅ | 本轮无相关实现 | 范围约束核对 |

---

## What

本轮实现了 #71-MVP 的两件核心能力：

1. **同步水位线（sync watermark）**
- 新增：`packages/api/src/domains/cats/services/hindsight-import/p0-watermark.ts`
- 能力：读写 watermark + 基于 `git rev-parse HEAD` 评估 freshness
- `hindsight-import-p0 --all` 成功后写入 watermark（`--source` 不更新全量水位）

2. **读时 freshness 信号**
- 修改：`packages/api/src/routes/evidence.ts`
- `GET /api/evidence/search` 响应新增 `freshness` 字段：
  - `status`: `fresh | stale | unknown`
  - `headCommit`, `watermarkCommit`, `reason`, `checkedAt`
- 在 degrade fallback（docs search）路径也会返回 freshness

3. **回归测试 + 状态登记**
- 新增：`packages/api/test/p0-watermark.test.js`
- 修改：`packages/api/test/evidence-route.test.js`
- 更新：`docs/BACKLOG.md` #71 -> `[~]`，并明确 MVP / full 边界

---

## Why

- 我们刚完成 P0 导入，后续 ADR/规则持续更新时，最危险的是“Recall 返回过期答案但看起来很确定”。
- 先把 “是否过期” 变成可见信号（freshness）后，三猫和铲屎官能在回答阶段识别风险，再决定手动 re-import。
- 按纪要约束先做 MVP，可在不扩大 #68 scope 的前提下，快速建立最小防错闭环。

---

## Tradeoff

- 选择了 **MVP 可见性优先**：先给出 stale/unknown 信号，不做强阻断。
- 放弃了本轮直接上 fail-closed 与自动 re-import trigger（留给 #71-full）。
- 水位线目前仅由 `--all` 导入更新，放弃 `--source` 场景的精细水位推进，减少误判复杂度。

---

## Open Questions

1. `unknown` 的降级原因现在统一落在 `head_unavailable`（provider 异常也走这个），你是否希望拆分为独立 reason 以便审计？
2. #71-full 里你更倾向先做哪一块：fail-closed 还是 auto re-import trigger？
3. watermark 路径默认 `data/hindsight/p0-watermark.json`，是否需要在 runbook 里补“多环境路径约定”？

---

## Next Action

请你重点 review：

1. **freshness 语义正确性**
- `packages/api/src/domains/cats/services/hindsight-import/p0-watermark.ts`
- 看 commit 对比逻辑和 `fresh/stale/unknown` 判定是否符合我们讨论口径

2. **导入写水位时机**
- `packages/api/src/scripts/hindsight-import-p0.ts`
- 看 `--all` 才写 watermark 的策略是否合理

3. **API 响应边界**
- `packages/api/src/routes/evidence.ts`
- 看 normal/degrade/error 路径是否都稳定返回 freshness

4. **测试质量（Red→Green）**
- `packages/api/test/p0-watermark.test.js`
- `packages/api/test/evidence-route.test.js`

如有 P1/P2，我本轮直接修完并回你二次确认。

---

## Git / 测试证据

- Base: `32bc875`
- Head: `3648da8`
- Commit: `3648da8 feat(api): add #71 MVP freshness watermark guard [缅因猫🐾]`

测试命令（本轮实跑）：

```bash
pnpm --filter @cat-cafe/api test
```

结果：`995 tests, 994 pass, 0 fail, 1 skip`

---

*缅因猫（砚砚）🐾*
