# Review Request: F192 Phase C — Runtime Harness Eval Infrastructure

Review-Target-ID: f192-phase-c
Branch: feat/f192-phase-c-runtime-eval

## What

F192 Phase C 的 4 条核心 AC 实现：

1. **AC-C1 Telemetry Adapter** — F153 四个公开 API 的 adapter 层（types + parser + fetch），12 个 contract test
2. **AC-C2 F167 Runtime Eval Snapshot** — 4 组件 health 聚合（L1/C1/C2/route-serial），telemetry gap 标注，11 个 unit test + 真实运行时数据产出
3. **AC-C3 Attribution Finding** — 7-class attribution matrix（friction ratio + observability gap 检测），8 个 unit test + 6 个真实 finding
4. **AC-C4 Phase B Reclassification** — 已在 spec 更新 `59866af8b` 完成

新增文件 12 个（3 ts 源码 + 3 test + 3 fixture + 1 runner script + 2 live eval output）。

## Why

F192 的基础设施——eval pipeline 从 F153 消费运行时 telemetry，对 harness 做"观测→归因→行动"循环。Phase C 搭骨架跑通端到端，Phase D 扩展（Component Registry / Snapshot Store / Self-Eval 等 8 条 AC）。

## Original Requirements（必填）

> "f192 的基础设施根本没做呀！""一个 harness 需要有硬/软/eval，eval 去观测 harness 跑的如何→归因→抽象→解决"
> "7 条 AC 是终态蓝图。Phase C 不需要一口气做完全部 7 条，选 3-4 条核心的先把骨架搭起来，剩下的留给 Phase D。"

- 来源：KD-5 (CVO 2026-05-08)，KD-6 (CVO 2026-05-10)
- `docs/features/F192-socio-technical-harness-eval.md` → Key Decisions 节
- **请对照上面的摘录判断：eval pipeline 是否真正从 telemetry 产出了"观测→归因"的端到端结果**

## Tradeoff

- **选择 Prometheus key 显式映射表**（vs 自动转换）：OTel instrument 用 `.` 分隔（`cat_cafe.a2a.inline_action.checked`），Prometheus 转 `_`，导致 `inline_action` 中的下划线无法自动区分。选择 9 key mapping table，代价是新增 counter 需手动加映射，好处是零歧义。
- **overall confidence = worst across components**：L1 永远 no-data（无 counter），所以 overall 永远 no-data。这是诚实反映——route-serial 单独 confidence=high，但整体观测能力确实有缺口。Phase D 可加 per-component confidence 聚合策略。

## Architecture Ownership（必填）

Architecture cell: none (cross-cutting eval tool)
Map delta: none
Why: eval pipeline 是 enrichment 工具，消费 F153 公开 API，不引入新的 ownership cell

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Prometheus key mapping 完整性**：当前只映射了 9 个 A2A counter。F153 instruments.ts 有更多 counter，但 F167 eval 只关心 A2A 相关的。请确认映射是否遗漏了 F167 需要的 counter。
2. **Attribution 阈值**：friction ratio > 5% 且 count >= 3 才产出 finding。这个阈值合理吗？过于宽松会漏报，过于严格会噪音。
3. **Authority boundary**：F192 只消费 F153 的 4 个公开 HTTP API，不 import F153 内部类型。请确认 adapter 层没有越界。

### 价值 OQ（给 CVO，如有）

无——技术选择已在三猫讨论 + CVO 确认的 4-AC 骨架框架内，回滚成本低。

## Next Action

请 review 代码质量 + 架构边界 + 端到端 eval 输出合理性。特别关注：
- adapter 是否正确消费了 F153 API 响应格式（OQ-1）
- attribution 的 7-class matrix 分类逻辑是否合理
- live eval output（`docs/harness-feedback/`）是否真实反映 F167 harness 状态

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192-phase-c/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 无前端改动，review 只需读代码 + 跑测试。如需启动服务验证 runner script，使用沙盒默认端口（3201/3202）

## 自检证据

### Spec 合规

Quality gate passed (2026-05-11 02:00):
- AC-C1 ✅ telemetry-adapter.ts + 12 contract tests
- AC-C2 ✅ f167-eval.ts + 11 tests + live YAML output
- AC-C3 ✅ attribution.ts + 8 tests + 6 live findings
- AC-C4 ✅ spec reclassification in `59866af8b`
- Fallback layer check: 3 files flagged (false positives: ?? accumulators, || CLI defaults)
- Artifact hygiene: clean
- Architecture ownership: none (cross-cutting tool)

### 测试结果

```
pnpm --filter @cat-cafe/api test      # 10611 passed, 0 failed, 3 skipped
pnpm check                            # 0 errors
pnpm lint                             # 0 new errors (warnings pre-existing)
pnpm -r --if-present run build        # exit 0
node --test harness-eval/*.test.js    # 31 passed, 0 failed
```

### 相关文档

- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Plan: `docs/plans/2026-05-10-f192-phase-c-runtime-eval.md`
- Eval contract reference: `docs/harness-feedback/tool-evals/a2a-tools-eval-contract.md`
- Live output: `docs/harness-feedback/snapshots/2026-05-11-F167-eval.yaml`, `docs/harness-feedback/attributions/2026-05-11-F167-attribution.yaml`
