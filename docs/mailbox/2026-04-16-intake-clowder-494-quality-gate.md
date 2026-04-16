---
topics: [quality-gate, review-ready, intake, clowder-ai, f159, catagent, audit-bridge]
doc_kind: quality-gate-report
created: 2026-04-16
---

## Quality Gate Report — intake clowder-ai#494

Spec: `docs/features/F159-catagent-native-provider.md`, `cat-cafe#1211`  
原始需求: `docs/features/F159-catagent-native-provider.md`（AC-B3 / AC-B4）  
检查时间: 2026-04-16

### 愿景覆盖（Step 0）

| # | 原始需求 | 覆盖情况 | 说明 |
|---|----------|----------|------|
| 1 | AC-B3: 工具参数注入防护必须在 host/provider integration layer 落地，并有针对性测试 | ✅ | 本次只吸收 `catagent-tool-guard.ts` + 36 条回归测试中的 AC-B3 部分；没有把 Phase D tool registry 一起带回家 |
| 2 | AC-B4: provider 的 `done/error/usage` 终态审计必须在现有链路中可验证 | ✅ | 本次吸收 `catagent-event-bridge.ts` 作为 prework helper，并通过 `AgentMessage` 语义对齐现有 audit chain；明确保持 “Phase B prework” 口径，不虚报 runtime integration 已完成 |
| 3 | intake 必须逐 file 吸收，不能 merge 社区 PR 后只 record ledger 就算回家 | ✅ | 已创建 Intake Intent Issue `cat-cafe#1211`，3 个文件逐项标为 `absorb`，没有空行；在隔离 worktree 完成验证与 brand guard |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | Anthropic Messages API usage 归一化为 `TokenUsage`，语义与现有 `claude-ndjson-parser.ts` 保持一致 | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-event-bridge.ts` | `packages/api/test/catagent-phase-b-completion.test.js` |
| 2 | 只有 terminal stop reasons 才能产出 `done`，避免过早触发审计闭环 | ✅ | 同上 | `packages/api/test/catagent-phase-b-completion.test.js` |
| 3 | error 路径必须稳定产出 `error + done`，不留下 dangling session | ✅ | 同上 | `packages/api/test/catagent-phase-b-completion.test.js` |
| 4 | ToolSchema 输入必须拒绝 undeclared fields / required 缺失 / type mismatch | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-tool-guard.ts` | `packages/api/test/catagent-phase-b-completion.test.js` |
| 5 | shell-safe argv 构建必须强制 `--` separator 并拒绝 flag injection | ✅ | 同上 | `packages/api/test/catagent-phase-b-completion.test.js` |
| 6 | 本次 absorbed 只覆盖 helper + tests，不夹带 Phase C/D runtime 扩张 | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/*`, `packages/api/test/catagent-phase-b-completion.test.js` | 逐文件决策表 + diff 对照 |

### 设计稿对照（Step 5）

`rg --files designs -g '*.pen' | rg 'F159|catagent|provider|security'` → 无匹配  
对照状态: ➖ 无 UI 改动

### Artifact Hygiene（Step 7.5）

仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### 工具落点检查

- intake 修改全部落在 worktree `fix/intake-clowder-494`，主 worktree 未污染 ✅
- `diff -u` 对照 `../clowder-ai` merge 后版本 → 3 个 absorb 文件完全一致 ✅
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- Intake Intent Issue: `cat-cafe#1211` ✅

### 验证命令输出（本轮新鲜证据）

```bash
bash scripts/intake-from-opensource.sh --pr 494 --mode=plan
pnpm --dir packages/api build
node --test packages/api/test/catagent-phase-b-completion.test.js
node --test packages/api/test/catagent-security-baseline.test.js
pnpm lint
pnpm check
pnpm -r --if-present run build
bash scripts/intake-from-opensource.sh --validate-inbound
git diff --check
```

结果：

- `intake-from-opensource --pr 494 --mode=plan` → 3 个文件，全部分类为 `safe-cherry-pick` ✅
- `pnpm --dir packages/api build` → success ✅
- `node --test packages/api/test/catagent-phase-b-completion.test.js` → `36 passed, 0 failed` ✅
- `node --test packages/api/test/catagent-security-baseline.test.js` → `17 passed, 0 failed` ✅
- `pnpm lint` → success；`packages/web` 仅有现存 hardcoded-color warnings，无新增 error，exit 0 ✅
- `pnpm check` → success ✅
- `pnpm -r --if-present run build` → success；`packages/web` 仅有现存 warning，exit 0 ✅
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- `git diff --check` → clean ✅

### 备注

- Source PR: `clowder-ai#494`
- Source issue: `clowder-ai#491`
- Source merge commit: `588b3ee73d189d47151d9d02170643e6cf6eb996`
- Absorb PR: `cat-cafe#1212`
- Intake branch: `fix/intake-clowder-494`
- 当前状态：review-ready。下一步需 reviewer 对照 `cat-cafe#1211` 检查 3 个 `absorb` 文件、prework scope 和验证范围，然后才能进入 `record + advance-ledger`
