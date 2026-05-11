# Review Request: F192 Phase D — Eval Infrastructure Completion

Review-Target-ID: f192-phase-d
Branch: feat/f192-phase-d-eval-infra

## What

F192 Phase D closes the eval infrastructure gap: 7 new OTel counters (AC-D0), component registry (D1), snapshot store with daily scheduled task (D2), end-to-end verification gates (D3), self-eval contract (D4), top-5 tool eval contracts (D5), monthly digest task (D6), first micro fit digest (D7), digest conclusions in spec (D8), and attribution action-rate meta-loop (D9).

16 files changed, +822 -60 across telemetry instruments, harness-eval modules, tests, eval runner script, and documentation.

## Why

Phase C proved the eval pipeline works for F167 but exposed 6 telemetry gaps (L1/C1/C2 had no counters). Phase D closes those gaps, adds infrastructure for continuous monitoring (daily snapshots, monthly digests), and establishes the meta-eval loop (action-rate tracks whether findings lead to action — if not, the pipeline itself is a sunset candidate).

## Original Requirements

> "我们必须有 tracing...当一个 feat close 了...thread id 可知道...session id 可知道 => 意味着他们的 tool call 上下文完全透明！...可选环节采访猫猫的干活体验是否才是不污染工作上下文且是一个持续性评估的可靠扩展点？"
- 来源：`docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md` + 铲屎官原话 2026-05-06
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 reminder 模板而非专用 scheduled task 类型注册 daily/monthly eval 任务——因为 eval 需要 session cookie（运行时获取），reminder 唤醒猫猫后猫猫自行处理认证更灵活
- Top-5 tool eval contracts 合并为单文件（`top5-tool-eval-contracts.md`）而非每个工具独立文件——5 个 contract 格式完全一致，单文件便于比较和维护
- `computeActionRate` 接受 current findings + prior findings 数组而非直接读 YAML 文件——保持纯函数可测试性，IO 由调用方处理

## Architecture Ownership

Architecture cell: harness-eval
Map delta: none
Why: eval pipeline 是独立的观测/分析模块，不改变任何现有架构 cell 边界。新增的 OTel counters 是对已有 instruments 模块的扩展，不是新的 cell

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **D0 counter 命名一致性**：C2 拆分后 `c2VerdictHintEmitted` / `c2VoidHoldHintEmitted` 的命名与原 `hint_emitted` 的关系——是否需要在 instruments.ts 加注释说明替代关系？
2. **D3 recall gate 阈值**：shadow_miss ratio ≥ 5% 且 count ≥ 3 才触发 finding。这个阈值是否合理？（Phase C 实测 route-serial shadow_miss=0，所以阈值未被真实数据考验过）
3. **D9 action-rate 的 "disappeared" 判定**：prior finding 在 current 中消失视为 acted-on。但也可能是 data 消失（24h TTL）。这个假设是否需要加文档说明？

### 价值 OQ（给 CVO，如有）

无。Phase D scope 在三猫讨论 + CVO 2026-05-08 pivot 中已确认。

## Next Action

请 reviewer 逐 AC 检查实现正确性，特别关注 D0 counter 是否在正确的代码路径上 increment、D3 recall/precision gate 是否覆盖了 Phase B fixtures 的关键模式。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f192-phase-d/codex`
- Start Command: `pnpm review:start`
- Ports: 后端 eval 基础设施，无前端 UI 改动，reviewer 可直接 `pnpm test` 验证

## 自检证据

### Spec 合规

10/10 AC 全部通过（见本轮 quality-gate report）：
- D0: 7 OTel counters implemented + used in source
- D1: Registry YAML with hard/soft/eval per component
- D2: `--store` flag + daily scheduled task registered
- D3: 7 e2e verification tests (recall + precision + integration)
- D4: Self-eval contract with sunset signal
- D5: 5 tool eval contracts in v1 template
- D6: `--digest` flag + monthly scheduled task registered
- D7: First digest at `docs/harness-feedback/digests/2026-05-F167-first-digest.md`
- D8: Digest conclusions in F192 spec (upgrade/streamline/no sunset)
- D9: `computeActionRate()` with 4 unit tests

### 测试结果

```
pnpm test          → 2958 passed, 0 failed (vitest) + 5 passed (node:test)
pnpm lint          → 0 errors
pnpm check         → 0 errors (biome + features + skills + env + guides + followup-tails)
pnpm build         → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-05-11-f192-phase-d-eval-infrastructure.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Discussion: `docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md`
