## Quality Gate Report

Spec: `docs/features/F159-catagent-native-provider.md`
原始需求: `clowder-ai#515` + `docs/features/F159-catagent-native-provider.md`
检查时间: 2026-04-20 US/Pacific

### 愿景覆盖（Step 0）
| # | 原始需求 | AC 覆盖？ | 实现？ |
|---|---------|-----------|--------|
| 1 | read-only tools 仅限 `read_file` / `list_files` / `search_content`，且必须复用宿主层安全 helper | AC-D1 | ✅ |
| 2 | provider 内部支持 `tool_use -> tool_result -> re-call API` 的 agentic loop | AC-D2 | ✅ |
| 3 | 维持 ADR-001 边界：不开放 write/edit/delete、shell/exec、outbound side-effect tools | F159 spec + ADR-001 | ✅ |
| 4 | error-path 仍要稳定落 `error + done + usage`，不能把终态审计链搞丢 | AC-B4 / AC-D2 | ✅ |

### 功能验收
| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | CatAgent 从单轮 text-only 升到 Phase D read-only tools + loop | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/CatAgentService.ts` | `packages/api/test/catagent-phase-d.test.js` |
| 2 | 新增 `catagent-read-tools.ts` 三个只读工具 | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-read-tools.ts` | `packages/api/test/catagent-phase-d.test.js` |
| 3 | `workspace-security` 修复 symlink alias denylist bypass | ✅ | `packages/api/src/domains/workspace/workspace-security.ts` | `packages/api/test/workspace-security.test.js`, `packages/api/test/catagent-security-baseline.test.js`, `packages/api/test/catagent-phase-d.test.js` |
| 4 | 首轮 API error 保留零 usage，守住 Phase C 契约 | ✅ | `packages/api/src/domains/cats/services/agents/providers/catagent/CatAgentService.ts` | `packages/api/test/catagent-phase-d.test.js` |

### Intake Guard
- Intake Intent Issue: `cat-cafe#1308`
- `bash scripts/intake-from-opensource.sh --pr 516 --mode=plan` → `4 safe-cherry-pick / 0 manual / 0 public-only`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- `git diff --check origin/main...HEAD` → clean

### 设计稿对照（Step 5）
- `find designs -name '*.pen' | rg 'F159|catagent|provider'` → 无匹配
- 本次仅后端 / 安全层 / API 测试改动，无前端 UI 对照项

### Artifact Hygiene（Step 7.5）
- `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无输出 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无输出 ✅

### 验证命令输出（本次真实运行）
- `pnpm --filter @cat-cafe/api build` → success ✅
- `bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/catagent-phase-d.test.js test/catagent-provider.test.js test/catagent-security-baseline.test.js test/catagent-phase-b-completion.test.js test/workspace-security.test.js` → `112 passed, 0 failed` ✅
- `pnpm --filter @cat-cafe/api test` → `8936 passed, 0 failed, 1 skipped` ✅
- `pnpm lint` → success（仅 existing warnings，无 new errors）✅
- `pnpm build` → success（仅 existing Next/VAD warnings）✅
- `pnpm check` → blocked by pre-existing unrelated formatter drift in `packages/api/test/f148-phase-g.test.js`（不在 `origin/main...HEAD` diff 内）⚠️

### 结论
- 这次 intake 变更面与 `clowder-ai#516` 逐文件对齐，无 manual-port / brand contamination 风险。
- 主要功能、共享安全层修复、以及上轮 review 挡住的 error-path usage regression 都在家里复现并有测试保护。
- 当前唯一未绿项是 repository-wide `pnpm check` 的既有 baseline 格式漂移，和本次 intake diff 无关；其余针对本次吸收的验证证据已满足提 review 条件。
