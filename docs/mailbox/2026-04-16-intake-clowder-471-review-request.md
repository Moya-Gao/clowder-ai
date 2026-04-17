# Review Request: intake(clowder-ai#471) google third-party gateway bindings

Review-Target-ID: intake-clowder-471
Branch: fix/intake-clowder-471

## What
吸收 `clowder-ai#471` 已 merge 的 Google 第三方 gateway 账号绑定支持：
- 更新 `packages/api/src/config/account-resolver.ts`
- 更新 `packages/api/test/cats-routes-runtime-crud.test.js`
- 更新 `packages/web/src/components/hub-cat-editor.model.ts`
- 更新 `packages/web/src/components/hub-cat-editor.sections.tsx`
- 更新 `packages/web/src/components/__tests__/hub-cat-editor.test.tsx`
- 新增本轮 quality-gate 报告 `docs/mailbox/2026-04-16-intake-clowder-471-quality-gate.md`

## Why
社区 PR 已经把这件事收敛成一个明确 slice：`google` 允许走第三方 gateway 账号，但官方 Google endpoint 仍然保持 builtin-only。我们这次回家 intake 的目标是把这条已 merge 能力完整吸收，并把之前 review 阶段确认过的三个 blocker 一起收口：API contract test、Web 账号过滤、`baseUrl` 防御性校验。

## Original Requirements
> `google` client 必须支持第三方 gateway `api_key` 账号；  
> 官方 Google endpoint 继续只允许 builtin OAuth；  
> intake 必须以逐文件 absorb 为准，不能把“记录”当“吸收完成”。

- 来源：`cat-cafe#1226`
- 对应社区 issue：`clowder-ai#470`
- 对应社区 PR：`clowder-ai#471`
- **请对照上面的摘录判断：这次 absorbed 是否只覆盖 5 个意图文件，没有漏掉 Web 对齐，也没有顺手扩 scope**

## Tradeoff
我没有把这次 intake 顺手扩成 Vertex AI / 新 provider 架构设计。取舍是：严格保持与 `clowder-ai#471` 已 merge 边界一致，只吸收“Google 第三方 gateway 绑定”这一条能力；代价是 Vertex AI 仍然是独立议题，后续单独立项。

## Open Questions
- 我吸收的文件集合是否与 `cat-cafe#1226` 的逐文件决策表完全一致，没有漏项或越界？
- API / Web 两侧现在是否已经真正同构，不会再出现“后端放开、前端锁死”的半成品状态？
- `pnpm gate` 被 `packages/api/test/memory/f163-experiment-logger.test.js` 挡住；以 reviewer 视角看，这条与本次 intake 无关的 F163 suite 红灯是否足以阻塞 `record + advance-ledger`，还是可以按“外部红灯”处理？

## Next Action
请对照 `cat-cafe#1226` 和 PR `#1228` 做 formal review，确认：
1. 5 个 `absorb` 文件都已经完整落地；
2. API 和 Web 对 `google` 第三方 gateway 的规则一致；
3. 官方 Google endpoint 仍然没有被误放开；
4. mailbox 里的质量证据足以支撑后续 `record + advance-ledger`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-471/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规（quality-gate 摘要）
- Intake Intent Issue：`cat-cafe#1226`
- Quality Gate：`docs/mailbox/2026-04-16-intake-clowder-471-quality-gate.md`
- Community PR：`clowder-ai#471`
- Absorb PR：`cat-cafe#1228`
- `bash scripts/intake-from-opensource.sh --pr 471 --mode=plan` → 5 个文件，全部 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm --filter @cat-cafe/api build` → success
- API targeted tests → success
- Web targeted tests → success
- `bash scripts/intake-from-opensource.sh --validate-inbound` → success
- `pnpm gate` → 被 `packages/api/test/memory/f163-experiment-logger.test.js` 挡住；本次 intake diff 未触及该测试和 `packages/api/src/domains/memory/**`
- `git diff --check` → clean

### 相关文档
- Quality Gate：`docs/mailbox/2026-04-16-intake-clowder-471-quality-gate.md`
- Intake Intent：`cat-cafe#1226`
- Source Issue：`clowder-ai#470`
- Source PR：`clowder-ai#471`
- Absorb PR：`cat-cafe#1228`
