---
topics: [quality-gate, review-ready, intake, clowder-ai, f159, catagent, native-provider]
doc_kind: quality-gate-report
created: 2026-04-16
---

## Quality Gate Report — intake clowder-ai#500

Spec: `docs/features/F159-catagent-native-provider.md`, `cat-cafe#1222`  
原始需求: `docs/features/F159-catagent-native-provider.md`（AC-C1 / AC-C2 / AC-C3 / AC-C4）  
检查时间: 2026-04-16

### 愿景覆盖（Step 0）

| # | 原始需求 | 覆盖情况 | 说明 |
|---|----------|----------|------|
| 1 | AC-C1: `catagent` 作为 opt-in provider 注册，不改变默认 provider 路由 | ✅ | `packages/api/src/index.ts` 仅新增 `case 'catagent'`，没有改默认分流；前后端只是在已有 client/account editor 中加入显式选项 |
| 2 | AC-C2: 最小单轮文本路径可打通，产出 `session_init -> text -> done` 和 usage | ✅ | 吸收 `CatAgentService.ts`、`catagent-event-bridge` 复用路径和 Phase C provider tests；未夹带额外 runtime 扩张 |
| 3 | AC-C3: abort / timeout / error 必须稳定收口，不留下悬挂 session | ✅ | `packages/api/test/catagent-provider.test.js` 覆盖 model 解析失败、credential 失败、HTTP error、network error、AbortSignal 等路径 |
| 4 | AC-C4: Phase C 不开放 write/exec/跨线程工具 | ✅ | provider request body 不发送 `tools`；测试显式断言 `capturedBody.tools === undefined` |
| 5 | intake 必须逐 file 吸收，不能 merge 社区 PR 后只 record ledger 就算回家 | ✅ | 已创建 Intake Intent Issue `cat-cafe#1222`，14 个文件逐项标为 `absorb`；在隔离 worktree 完成验证、brand guard 和 drift 检查 |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 新增 `catagent` client/provider wiring，保持 opt-in | ✅ | `packages/shared/src/types/cat.ts`, `packages/api/src/index.ts`, `packages/api/src/config/cat-config-loader.ts`, `packages/api/src/routes/cats.ts`, `packages/web/src/components/hub-cat-editor.model.ts` | `packages/api/test/catagent-provider.test.js`, `packages/web/src/components/__tests__/hub-cat-editor.test.tsx` |
| 2 | 复用 Anthropic account family，不新造 credentials 体系 | ✅ | `packages/api/src/config/account-resolver.ts`, `packages/shared/src/types/client-routing.ts`, `packages/web/src/components/hub-cat-editor.protocols.ts` | `packages/shared/test/client-routing.test.js`, `packages/web/src/components/__tests__/hub-cat-editor.test.tsx` |
| 3 | 单轮 native provider 调用走 raw `fetch`，不引 SDK | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/CatAgentService.ts` | `packages/api/test/catagent-provider.test.js` |
| 4 | 最小 provider slice 不携带 tools 字段 | ✅ | 同上 | `packages/api/test/catagent-provider.test.js` |
| 5 | account family / builtin-account / protocol 映射收敛为一处 helper，不过度抽象成通用 native-provider 框架 | ✅ | `packages/shared/src/types/client-routing.ts` + 前后端复用 | `packages/shared/test/client-routing.test.js`, `packages/web/src/components/__tests__/hub-cat-editor.test.tsx` |

### 执行差异说明（target-side drift）

- Source PR: `clowder-ai#500`
- Source issue: `clowder-ai#498`
- Source merge commit: `ecf5a05505f988e4a0d3d743b39265c71c46a675`

逐文件吸收结果：

- **12 个文件**与上游 merge commit **byte-identical** ✅
- **2 个文件**因家里目标仓已有后续漂移，采用 **hand-merge replay semantic delta**，而不是盲目覆盖：
  - `packages/api/src/index.ts`
  - `packages/shared/src/types/index.ts`

原因：

- `packages/api/src/index.ts` 在家里已有较新的 provider wiring；直接覆盖会回退 Antigravity 相关逻辑
- `packages/shared/src/types/index.ts` 在家里已有额外共享类型导出；直接覆盖会移除现存 exports，造成 build 断裂

处置：

- 先恢复这两个文件到 `HEAD`
- 再只补回 `clowder-ai#500` 的最小语义增量
- 重新 build + test 验证功能等价

### 设计稿对照（Step 5）

`rg --files designs -g '*.pen' | rg 'F159|catagent|provider'` → 无匹配  
对照状态: ➖ 无 UI 设计稿依赖；仅为 editor 枚举项和 provider wiring 变更

### Artifact Hygiene（Step 7.5）

仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### 工具落点检查

- intake 修改全部落在 worktree `fix/intake-clowder-500`，主 worktree 未污染 ✅
- `bash scripts/intake-from-opensource.sh --pr 500 --mode=plan` → 14 个文件，全部分类为 `safe-cherry-pick` ✅
- 复核后确认：其中 12 个文件直接吸收，2 个文件因 target-side drift 改为 hand-merge，但保持上游语义 ✅
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- Intake Intent Issue: `cat-cafe#1222` ✅

### 验证命令输出（本轮新鲜证据）

```bash
bash scripts/intake-from-opensource.sh --pr 500 --mode=plan
bash scripts/intake-from-opensource.sh --validate-inbound
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/web build
node --test packages/api/test/catagent-provider.test.js
node --test packages/api/test/catagent-phase-b-completion.test.js
node --test packages/api/test/catagent-security-baseline.test.js
node --test packages/shared/test/client-routing.test.js
pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/hub-cat-editor.test.tsx
pnpm lint
pnpm check
git diff --check
```

结果：

- `intake-from-opensource --pr 500 --mode=plan` → 14 个文件，计划层面全部判为 `safe-cherry-pick` ✅
- `intake-from-opensource --validate-inbound` → `✓ No brand violations detected` ✅
- `pnpm --filter @cat-cafe/shared build` → success ✅
- `pnpm --filter @cat-cafe/api build` → success ✅
- `pnpm --filter @cat-cafe/web build` → success；仅现存 web warnings，exit 0 ✅
- `node --test packages/api/test/catagent-provider.test.js` → `10 passed, 0 failed` ✅
- `node --test packages/api/test/catagent-phase-b-completion.test.js` → `36 passed, 0 failed` ✅
- `node --test packages/api/test/catagent-security-baseline.test.js` → `17 passed, 0 failed` ✅
- `node --test packages/shared/test/client-routing.test.js` → `2 passed, 0 failed` ✅
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/hub-cat-editor.test.tsx` → `35 passed, 0 failed` ✅
- `pnpm lint` → success；`packages/web` 仅有现存 hardcoded-color warnings，无新增 error，exit 0 ✅
- `pnpm check` → success ✅
- `git diff --check` → clean ✅

### 备注

- Source PR: `clowder-ai#500`
- Source issue: `clowder-ai#498`
- Source merge commit: `ecf5a05505f988e4a0d3d743b39265c71c46a675`
- Intake branch: `fix/intake-clowder-500`
- 当前状态：review-ready。下一步需 reviewer 对照 `cat-cafe#1222` 检查 14 个 `absorb` 文件与 2 个 hand-merge 的语义等价性，然后才能进入 `record + advance-ledger`
