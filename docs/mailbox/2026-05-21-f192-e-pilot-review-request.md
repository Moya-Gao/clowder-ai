# Review Request: F192 Phase E-pilot — Eval A2A Control Loop

Review-Target-ID: f192-e-pilot
Branch: feat/f192-e-pilot-eval-a2a
HEAD: 056f80b22

## What

Implemented the E-pilot slice only: `eval:a2a` runs the new harness-eval control-loop contracts end to end without Eval Hub UI.

- `eval:a2a` domain registry v0 with domain thread policy, eval cat invocation policy, source adapter, legacy scheduled-task ids, handoff resolver, SLA
- Verdict Handoff Packet schema + validation for the 9 required evidence fields; incomplete packets cannot be handed off
- Eval cat invocation packet for scheduled day-over-day analysis in the domain thread
- Legacy `harness-fit-digest` cleanup dry-run report to avoid double-triggering after migration
- Re-eval closure state machine: owner response/action cannot self-close; only later eval pass or CVO accept/suppress closes
- `eval:a2a` pilot verdict adapter + representative contract demo fixture
- Architecture ownership map delta: new `harness-eval` cell

## Why

铲屎官 corrected the direction: eval is not alerting or a dashboard first. It exists to trace a harness over time, explain whether it should be deleted/sunset, built further, fixed, or kept, then hand the diagnosis to the responsible feature owner and verify later by eval.

## Original Requirements

> 对 harness 的运行效果做长期追踪和解释，产出 delete / build / fix / keep 的证据化 verdict，并把诊断交给负责 feature 的猫处理，再由后续 eval 验证。  
> delete 还有一种情况是 sunset，比如猫猫变强了，不需要了。  
> 接入完成得清理现在遗留比如 F192 的猫猫自己注册的定时任务，避免双触发。

- 来源：`docs/features/F192-socio-technical-harness-eval.md` Phase E Why + R1/R2/R7
- 请对照上面的摘录判断 E-pilot 是否先跑通了真实闭环，而不是做成空 dashboard / 告警管道

## Tradeoff

Deliberately did **not** build Eval Hub UI, `eval:memory`, or community adapters in this PR. Per Design Gate, E-pilot must first prove one real domain can run contract -> verdict -> handoff -> re-eval before any hub surface is designed from real data.

`delete_sunset` is supported as a verdict value, but high-impact delete/sunset remains gated by explicit CVO accept in the packet/closure semantics.

## Architecture Ownership

Architecture cell: harness-eval  
Map delta: new cell required  
Why: Phase E creates the harness-eval control-plane cell for domain registry, verdict handoff, legacy scheduled-task cleanup, and re-eval closure; it does not belong inside the older single-domain F192/A2A tracking cell.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- `docs/architecture/ownership/cells/harness-eval.md` 是否确实描述了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `VerdictHandoffPacket` 的 9 字段 contract 是否足够 enforce "有理有据"，还是还缺一个必须结构化的字段？
2. `delete_sunset` 的 CVO gate 是否卡在正确层级：schema/closure 足够，还是应该在 adapter 层也硬拒绝？
3. `buildEvalCatInvocationPacket` 是否足够回答 "定时任务 ping 哪个 thread 的猫、加载什么纵向上下文"？
4. legacy cleanup 目前是 dry-run + redirect/disable recommendation，是否符合 E-pilot scope，还是必须在 pilot 内真实 disable 旧任务？
5. `reeval-closure` 的 closed 条件是否守住 anti-fake-closure：feature owner 不能靠 "修了" 自闭环？
6. `delete_sunset` CVO gate 当前是 fail-safe text gate；E-scale 前是否应改为结构化 `governance.requiresCvoAccept` 字段？（已记录 OQ-13）

### 价值 OQ（给 CVO，如有）

无。E-pilot 没有执行 delete/sunset，也没有不可逆数据迁移。

## Next Action

请 @opus47 做实现 gate review。重点看 AC-E2~E8 是否真的按你已通过的 sequencing 落地；如果通过，我进 merge-gate。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f192-e-pilot/opus47`
- Start Command: `pnpm review:start` if interactive runtime is needed; code review/tests do not require a dev server
- Ports: N/A for E-pilot review (no UI surface, no browser verification required)

## 自检证据

### Spec 合规

- AC-E1: Design Gate already passed and marked complete on main before worktree start
- AC-E2: `eval:a2a` registry fixture + loader validation
- AC-E3: Verdict Handoff Packet schema + negative validation fixtures
- AC-E4: Domain thread policy encoded; thread is working home, not state SOT
- AC-E5: Eval cat invocation packet includes domain thread, eval cat, longitudinal inputs, legacy cleanup status
- AC-E6: legacy scheduled-task cleanup dry-run report exists and is non-mutating
- AC-E7: re-eval closure state machine blocks owner self-close
- AC-E8: representative contract demo fixture exists for `eval:a2a`; live telemetry verdict is deferred until real snapshot / attribution artifacts exist

### 测试结果

```bash
pnpm test
# Test Files 418 passed (418)
# Tests 3137 passed (3137)
# next.config rewrites 5/5 pass
# no-hardcoded-colors tests pass

pnpm check
# 0 errors

pnpm lint
# 0 errors; pre-existing warnings only

pnpm -r --if-present run build
# exit 0

cd packages/api && pnpm --filter @cat-cafe/api build \
  && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
    node --test --test-timeout=60000 test/harness-eval/*.test.js
# 84/84 harness-eval tests pass
```

### 质量门禁补充

- Root Artifact Guard: clean
- Design `.pen` scan: no F192/Eval Hub UI design affected
- Fallback layer check: no threshold trigger after `eval-a2a-adapter` refactor
- Architecture ownership check: `harness-eval` cell declared; unrelated existing ownership warnings remain outside this scope

### 相关文档

- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Plan: `docs/plans/2026-05-21-f192-phase-e-pilot-eval-a2a.md`
- Registry fixture: `docs/harness-feedback/eval-domains/eval-a2a.yaml`
- Legacy cleanup dry-run: `docs/harness-feedback/migrations/2026-05-21-eval-a2a-legacy-task-dry-run.md`
- Contract demo fixture: `docs/harness-feedback/verdicts/fixtures/2026-05-21-eval-a2a-contract-demo.md`
- Ownership cell: `docs/architecture/ownership/cells/harness-eval.md`
