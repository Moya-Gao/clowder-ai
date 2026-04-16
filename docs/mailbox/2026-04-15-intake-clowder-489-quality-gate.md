---
topics: [quality-gate, review-ready, intake, clowder-ai, f153, observability, a2a]
doc_kind: quality-gate-report
created: 2026-04-15
---

## Quality Gate Report — intake clowder-ai#489

Spec: `docs/features/F153-observability-infra.md`, `cat-cafe#1200`  
原始需求: 当前 thread 对话（2026-04-15）  
检查时间: 2026-04-15

### 愿景覆盖（Step 0）

| # | 原始需求 | 覆盖情况 | 说明 |
|---|----------|----------|------|
| 1 | F153 需要把 inline @mention 检测从“盲飞”变成可观测，能区分 strict hit / shadow miss / narrative noise | ✅ | 本次吸收了 8+1 counters、shadow detection helper 和主链路调用点，并把 Phase C 写回 F153 真相源 |
| 2 | intake 必须逐 file 吸收，不能只 merge 社区 PR 就算回家 | ✅ | 已创建 Intake Intent Issue `cat-cafe#1200`，5 个文件逐项标为 `absorb`，没有空行 |
| 3 | intake 要特别小心，不把开源仓品牌或半成品流程带回家 | ✅ | `--validate-inbound` 通过，且本次只涉及 `packages/api/**` 与 mailbox / feature 文档，没有品牌敏感文件覆盖 |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 导出 strict detection 边界常量，并把 shadow detection 入口接回 `a2a-mentions` | ✅ | `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts` | `packages/api/test/mention-observability.test.js`, `packages/api/test/a2a-mentions.test.js` |
| 2 | 新增 relaxed shadow detection，区分 strict hit / shadow miss / narrative mention，并保持 data minimization | ✅ | `packages/api/src/domains/cats/services/agents/routing/a2a-shadow-detection.ts` | `packages/api/test/mention-observability.test.js` |
| 3 | 在 `route-serial` 补 line-start baseline、inline-action、routedSet、feedback/hint fault counters | ✅ | `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` | `packages/api/test/route-strategies.test.js`, `packages/api/test/mention-observability.test.js` |
| 4 | 注册 8+1 OTel counters 到 telemetry instruments | ✅ | `packages/api/src/infrastructure/telemetry/instruments.ts` | `packages/api/test/mention-observability.test.js` |
| 5 | intake 同步带回回归测试，覆盖 same-line dual mention、strict/shadow coexistence、narrative 过滤 | ✅ | `packages/api/test/mention-observability.test.js` | 同文件 + `packages/api/test/a2a-mentions.test.js` |

### 设计稿对照（Step 5）

`rg --files designs 2>/dev/null | rg 'F153|observability|mention'` → 无匹配  
对照状态: ➖ 无 UI 改动

### Artifact Hygiene（Step 7.5）

仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### 工具落点检查

- intake 修改全部落在 worktree `fix/intake-clowder-489`，主 worktree 未污染 ✅
- `bash scripts/intake-from-opensource.sh --pr 489 --mode=plan` → 5 个文件，全部分类为 `safe-cherry-pick` ✅
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- Intake Intent Issue: `cat-cafe#1200` ✅

### 验证命令输出（本轮新鲜证据）

```bash
bash scripts/intake-from-opensource.sh --validate-inbound
pnpm check
pnpm --dir packages/api lint
pnpm --dir packages/api build
cd packages/api && bash ./scripts/with-test-home.sh \
  node --test --test-timeout=60000 \
    test/mention-observability.test.js \
    test/a2a-mentions.test.js \
    test/route-strategies.test.js
```

结果：

- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- `pnpm check` → success ✅
- `pnpm --dir packages/api lint` → success ✅
- `pnpm --dir packages/api build` → success ✅
- targeted regression set → `168 passed, 0 failed` ✅

### 备注

- Source issue: `clowder-ai#479`
- Source PR: `clowder-ai#489`
- Source merge commit: `dcf980df6b0dfa7156ebf5263a6585ce3917e834`
- Intake branch: `fix/intake-clowder-489`
- 当前状态：review-ready。下一步需 reviewer 对照 `cat-cafe#1200` 检查 5 个 `absorb` 文件都已完整落地，然后才能 `record + advance-ledger`
