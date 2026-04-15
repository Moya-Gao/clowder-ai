# Review Request: intake(clowder-ai#460) F159 phase-b security baseline

Review-Target-ID: intake-clowder-460
Branch: fix/intake-clowder-460

## What
吸收 `clowder-ai#460` 已 merge 的 F159 Phase B security baseline slice：
- 新增 `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-credentials.ts`
- 新增 `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-tools.ts`
- 新增 `packages/api/test/catagent-security-baseline.test.js`
- 新增本轮 quality-gate 报告 `docs/mailbox/2026-04-15-intake-clowder-460-quality-gate.md`

## Why
这条社区 PR 现在已经被 maintainer 收敛成一个很干净的 Phase B slice：它只补 CatAgent provider 落地前必须有的两个宿主安全 adapter，不再混入 Phase D 的 read-only tool registry，也不再引入 env override 这类第二真相源。回家 intake 的目标是把这条安全基线完整吸收，避免双仓在 F159 Phase B 上继续漂移。

## Original Requirements
> AC-B1: CatAgent 凭据解析复用现有 account-binding 链路（`resolveBoundAccountRefForCat -> resolveForClient`），不存在任意 key 扫描 fallback  
> AC-B2: workspace 边界复用共享安全 helper，symlink 场景有回归测试

- 来源：[`docs/features/F159-catagent-native-provider.md`](../features/F159-catagent-native-provider.md)
- 对应社区 issue：`clowder-ai#459`
- **请对照上面的摘录判断：这次 absorbed 是否只覆盖 Phase B 安全基线，没有夹带 Phase C/D 能力扩张**

## Tradeoff
我没有把这次 intake 扩成“顺手把 CatAgent provider registry / tool registry 也接上”。
取舍是：严格保持与 `clowder-ai#460` 已 merge 边界一致，只吸收 Phase B 的 credentials/path-security adapter + tests；代价是 CatAgent 仍未注册为可用 provider，后续 Phase C/D 继续单独推进。

## Open Questions
- 我吸收的文件集合是否与 `cat-cafe#1191` 的逐文件决策表完全一致，没有漏项或越界？
- 这组 17 个新测试，再加 `workspace-security` / `cat-account-binding` 相关回归，是否足以支撑 `record + advance-ledger` 前的 review guard？
- 以 reviewer 视角看，这条 absorb PR 是否还需要额外的 provider 集成验证，还是当前 Phase B slice 已经自洽？

## Next Action
请对照 `cat-cafe#1191` 和 PR `#1193` 做 formal review，确认：
1. 三个 `absorb` 文件都已经完整落地；
2. 没有把已拆走的 Phase D tool registry 重新带回家；
3. `accountRef` 仍是唯一真相源，没有新的绕过路径；
4. 现有验证证据足以支持后续 `record + advance-ledger`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-460/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规（quality-gate 摘要）
- Feature：`docs/features/F159-catagent-native-provider.md`
- Intake Intent Issue：`cat-cafe#1191`
- Quality Gate：`docs/mailbox/2026-04-15-intake-clowder-460-quality-gate.md`
- Community PR：`clowder-ai#460`
- Absorb PR：`cat-cafe#1193`
- `bash scripts/intake-from-opensource.sh --pr 460 --mode=plan` → 3 个文件，全部 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm --dir packages/api build` → success
- `node --test packages/api/test/catagent-security-baseline.test.js` → `17 passed, 0 failed`
- `node --test packages/api/test/catagent-security-baseline.test.js packages/api/test/workspace-security.test.js packages/api/test/cat-account-binding.test.js` → `43 passed, 0 failed`
- `pnpm --dir packages/api lint` → success
- `pnpm check` → success
- `pnpm -r --if-present run build` → success（`packages/web` 仍有既有 warning，但无新增错误）
- `git diff --check` → clean

### 相关文档
- Quality Gate：`docs/mailbox/2026-04-15-intake-clowder-460-quality-gate.md`
- Intake Intent：`cat-cafe#1191`
- Source Issue：`clowder-ai#459`
- Source PR：`clowder-ai#460`
- Absorb PR：`cat-cafe#1193`
