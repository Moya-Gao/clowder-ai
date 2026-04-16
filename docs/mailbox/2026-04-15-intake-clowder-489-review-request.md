# Review Request: intake(clowder-ai#489) inline @mention observability

Review-Target-ID: intake-clowder-489
Branch: fix/intake-clowder-489

## What
吸收 `clowder-ai#489` 已 merge 的 F153 Phase C slice：
- 新增 `packages/api/src/domains/cats/services/agents/routing/a2a-shadow-detection.ts`
- 在 `a2a-mentions.ts` 导出 strict 边界常量，并 re-export shadow detection 入口
- 在 `route-serial.ts` 接入 8+1 A2A observability counters、shadow miss、routedSet overlap、feedback/hint fault metrics
- 在 `instruments.ts` 注册 inline-action / line-start counters
- 新增 `packages/api/test/mention-observability.test.js`
- 同步 `docs/features/F153-observability-infra.md` 的 Phase C 和本轮 quality-gate 报告

## Why
这条社区 PR 已经在 `clowder-ai` merge，且 maintainer 双猫结论是 `absorbed`。回家 intake 的目标不是“记一笔 ledger 就算完”，而是把 inline @mention observability 的真实行为、回归测试和 F153 真相源一起带回家，避免双仓在 A2A 观测语义上继续漂移。

## Original Requirements
> 1. **8+1 A2A counters** — `inline_action.checked/detected/shadow_miss/feedback_written/feedback_write_failed/hint_emitted/hint_emit_failed/routed_set_skip` + `line_start.detected`  
> 2. **Shadow detection** — strict/relaxed 双层启发式，区分 `strict hit / shadow miss / narrative mention`

- 来源：[`docs/features/F153-observability-infra.md`](../features/F153-observability-infra.md)
- 对应社区 issue：`clowder-ai#479`
- **请对照上面的摘录判断：这次 absorbed 是否完整覆盖了 F153 Phase C，而不是只带回部分文件或部分语义**

## Tradeoff
我没有借这次 intake 顺手改写 `route-serial` 的整体结构，也没有把 counters 合并成 attribute-driven 单一 instrument。
取舍是：严格保持 `clowder-ai#489` 已 merge 的 Phase C 语义边界，只把 reviewer 已经放行的社区 slice 准确吸收；代价是 `route-serial` 的存量肥胖和 metrics consolidation 继续留在后续 cleanup，而不是混在这次 absorbed 里扩大 diff。

## Open Questions
- 我吸收的文件集合是否与 `cat-cafe#1200` 的逐文件决策表完全一致，没有漏项或越界？
- reviewer 视角下，`strict / shadow / narrative` 三级分类是否已经在我们家当前基线上被完整复现，没有被局部手工 port 弄丢边界条件？
- 现有验证证据是否足以支持后续 `record + advance-ledger`，还是还需要补更大的测试面？

## Next Action
请对照 `cat-cafe#1200` 和 PR `#1202` 做 formal review，确认：
1. 5 个 `absorb` 文件都已完整落地；
2. `docs/features/F153-observability-infra.md` 已同步记录 Phase C，不存在“代码 merged、feature 真相源没记”的半状态；
3. `mention-observability.test.js` + 相关回归集足以证明 absorb 不是假完成；
4. 可以进入后续 `record + advance-ledger`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-489/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Feature：`docs/features/F153-observability-infra.md`
- Intake Intent Issue：`cat-cafe#1200`
- Quality Gate：`docs/mailbox/2026-04-15-intake-clowder-489-quality-gate.md`
- Community PR：`clowder-ai#489`
- Absorb PR：`cat-cafe#1202`
- `bash scripts/intake-from-opensource.sh --pr 489 --mode=plan` → 5 个文件，全部 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm check` → success
- `pnpm --dir packages/api lint` → success
- `pnpm --dir packages/api build` → success
- `cd packages/api && bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/mention-observability.test.js test/a2a-mentions.test.js test/route-strategies.test.js` → `168 passed, 0 failed`
- `git diff --check` → clean

### 相关文档
- Quality Gate：`docs/mailbox/2026-04-15-intake-clowder-489-quality-gate.md`
- Intake Intent：`cat-cafe#1200`
- Source Issue：`clowder-ai#479`
- Source PR：`clowder-ai#489`
- Absorb PR：`cat-cafe#1202`
