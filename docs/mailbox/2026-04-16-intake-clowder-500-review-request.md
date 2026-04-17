# Review Request: intake(clowder-ai#500) F159 phase-c minimal native provider

Review-Target-ID: intake-clowder-500
Branch: fix/intake-clowder-500

## What
吸收 `clowder-ai#500` 已 merge 的 F159 Phase C minimal native provider slice：

- 新增 `packages/api/src/domains/cats/services/agents/providers/catagent/CatAgentService.ts`
- 新增 `packages/api/test/catagent-provider.test.js`
- 新增 `packages/shared/src/types/client-routing.ts`
- 新增 `packages/shared/test/client-routing.test.js`
- 更新 api/shared/web 三侧的 `catagent` client wiring、account family 映射、editor/protocol 枚举
- 新增本轮 quality-gate 报告 `docs/mailbox/2026-04-16-intake-clowder-500-quality-gate.md`

## Why
这条社区 PR 是我们 F159 的 Phase C 核心交付：把 Phase B prework 真正接成一个最小可用的 native provider，同时保持 opt-in、无 tools、无 SDK 依赖。回家 intake 的目标不是机械抄文件，而是把这条已经在 maintainer review 里收敛过的 provider slice、边界约束和回归测试一起准确吸收，避免双仓在 CatAgent provider 语义上继续漂移。

## Original Requirements
> AC-C1: opt-in 注册，不改默认路由  
> AC-C2: 单轮文本 e2e，产出 `session_init/text/done + usage`  
> AC-C3: abort/timeout/error 无悬挂  
> AC-C4: 不开放 write/exec/跨线程工具

- 来源：[`docs/features/F159-catagent-native-provider.md`](../features/F159-catagent-native-provider.md)
- 对应社区 issue：`clowder-ai#498`
- Intake Intent Issue：`cat-cafe#1222`
- **请重点判断：这次 absorbed 是否完整覆盖了 Phase C 最小 provider 范围，同时没有把“不该在这轮抽象”的通用 native-provider 框架一起夹带进来**

## Tradeoff
本轮 intake 不是 14 个文件无脑照搬：

- **12 个文件**直接吸收，与上游 merge commit `ecf5a055` **byte-identical**
- **2 个文件**因目标仓已有更近的 house-side 漂移，改成 hand-merge replay semantic delta：
  - `packages/api/src/index.ts`
  - `packages/shared/src/types/index.ts`

这样做的代价是 reviewer 需要额外看这两个 hand-merge 文件是否保留了上游 intent；好处是不会把家里更近的 provider wiring / shared exports 意外回退掉。

## Open Questions
- `cat-cafe#1222` 的 14 个 `absorb` 决策，是否与最终 PR 内容完全一致，没有漏项或越界？
- `packages/api/src/index.ts` 和 `packages/shared/src/types/index.ts` 的 hand-merge，是否与上游 intent 语义等价，同时没有回退家里已有逻辑？
- CatAgent provider wiring 是否仍然保持 opt-in，且 Phase C 不发送 `tools`？
- `client-routing.ts` 这层共享 helper 是否恰好收敛了 family / builtin-account / protocol 映射，而没有过度抽象成通用 provider 框架？

## Next Action
请对照 `cat-cafe#1222` 和本 PR 做 formal GitHub review，确认：

1. 14 个 `absorb` 文件已经完整落地；
2. 12 个 direct absorb + 2 个 hand-merge 的执行说明属实；
3. Phase C provider 行为满足 AC-C1~C4，没有夹带 tools / write / exec；
4. 现有验证证据足以支持后续 `record + advance-ledger`。

## 自检证据

### Spec 合规（quality-gate 摘要）
- Feature：`docs/features/F159-catagent-native-provider.md`
- Intake Intent Issue：`cat-cafe#1222`
- Quality Gate：`docs/mailbox/2026-04-16-intake-clowder-500-quality-gate.md`
- Community PR：`clowder-ai#500`
- Source issue：`clowder-ai#498`
- `bash scripts/intake-from-opensource.sh --pr 500 --mode=plan` → 14 个文件，计划层面全部 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm --filter @cat-cafe/shared build` → success
- `pnpm --filter @cat-cafe/api build` → success
- `pnpm --filter @cat-cafe/web build` → success（仅现存 web warnings）
- `node --test packages/api/test/catagent-provider.test.js` → `10 passed, 0 failed`
- `node --test packages/api/test/catagent-phase-b-completion.test.js` → `36 passed, 0 failed`
- `node --test packages/api/test/catagent-security-baseline.test.js` → `17 passed, 0 failed`
- `node --test packages/shared/test/client-routing.test.js` → `2 passed, 0 failed`
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/hub-cat-editor.test.tsx` → `35 passed, 0 failed`
- `pnpm lint` → success（仅现存 web warnings）
- `pnpm check` → success
- `git diff --check` → clean

### 相关文档
- Quality Gate：`docs/mailbox/2026-04-16-intake-clowder-500-quality-gate.md`
- Intake Intent：`cat-cafe#1222`
- Source Issue：`clowder-ai#498`
- Source PR：`clowder-ai#500`
