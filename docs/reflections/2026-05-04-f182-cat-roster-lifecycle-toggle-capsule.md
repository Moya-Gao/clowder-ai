---
capsule_id: "F182-2026-05-04"
context: "Cat Roster Lifecycle Toggle — 全链路降级反馈，4 Phase 完整交付"
feature_ids: [F182]
doc_kind: capsule
created: 2026-05-04
---

## What Worked

- **6-cat 竞技赛交付**：Phase A-D 由大赛优胜方（Sonnet-4.6）连续实施，单 PR 四 Phase 完整落地，速度快且无 rebase 冲突
- **`createdBy` vs `params.triggerUserId` 最终厘清**：Phase D 的 scheduledTasks 用户隔离因 `createdBy` 是 catId 而非 userId 经历了多轮修复，云端 review 最终找到根因；`deriveScheduleActor` 的字段语义彻底澄清，避免后续重踩
- **Resolver 纯函数设计**（KD-8）：≤40 行硬约束逼出了干净的设计，alternatives 排序和 dedupe 全在纯比较函数里，无副作用
- **5-入口闸思路**（KD-4）：砚砚 P1-1 纠正——`targetCats` 结构化字段直进 enqueueA2ATargets 才是真正的 disable 绕过路径，不止文本 @ parser
- **串行 review（本地→云端）**：遵循 SOP 避免了 race + 双线程并发执行

## What Failed

- **`createdBy` 语义误判**：初始实现用 `d.createdBy === userId` 做 scheduledTasks 隔离；mocks 里刚好写了 `createdBy: 'user-a'` 所以测试绿灯；但生产数据里 `createdBy` 是 catId（'opus'/'user'），导致云端 review 还要多一轮修复
- **`setup-cat-registry.js` 缺失**：`schedule-route.test.js` 和 `cat-target-resolver.test.js` 都漏了这行 import，导致 8 个前置测试 FAIL 被误当成新错误——实际是已存在的 infra 缺口
- **`p.slice(1)` 无条件 strip**：`cat-target-resolver.ts` 的 mentionPattern 处理对非 `@` 开头的 pattern（如 `'codex'`）执行了 `.slice(1)` = `'odex'`，导致匹配失效；条件判断不难，没及时防住
- **hold_ball 配额**：Rolling 1h 3次限额在多轮修复期间耗尽多次，每次需要升级 @landy；多轮云端 review cycle 会消耗配额，应在 quality-gate 阶段做更彻底的本地验证

## Trigger Missed

- **写代码前应更仔细验证 scheduledTask schema**：`params.triggerUserId` 这个字段在 `deriveScheduleActor` 里设置，但没有在 Phase D 实施前充分读源码确认字段语义——用了 `createdBy` 凭直觉
- **test helper 缺失的早期扫描**：test 文件开头应该先检查依赖的 helper imports，避免"测试绿灯但依赖不完整"的假阳性状态
- **云端 review 触发时机的精确判断**：每次 P1/P2 修复后都需要 re-trigger，多轮循环需要在本地做更充分的 pre-check（如手动 grep `params.triggerUserId` 全文）再 push

## Doc Links

- Feature spec: `docs/features/F182-cat-roster-lifecycle-toggle.md`
- 竞技赛讨论: `docs/discussions/2026-04-30-f182-contest/README.md`
- `deriveScheduleActor` 源码: `packages/api/src/domains/cats/services/agents/routing/deriveScheduleActor.ts`
- disable-impact endpoint: `packages/api/src/routes/disable-impact.ts`
- cat-target-resolver: `packages/api/src/domains/cats/services/agents/routing/cat-target-resolver.ts`

## Rule Update Target

- `docs/lessons-learned.md`：补一条"scheduledTask userId 隔离字段"——`createdBy` = catId（actor），`params.triggerUserId` = userId（用户标识），不可混用；验证时必须 grep `deriveScheduleActor` 确认字段写入位置
- `shared-rules.md`：test helper imports 扫描建议——新 test 文件写完后，grep `catRegistry`/`taskStore` 使用点，确认所需的 `setup-*.js` helper 已 import
