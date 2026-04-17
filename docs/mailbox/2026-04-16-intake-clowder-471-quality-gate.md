---
topics: [quality-gate, review-ready, intake, clowder-ai, google, gateway, gemini]
doc_kind: quality-gate-report
created: 2026-04-16
---

## Quality Gate Report — intake clowder-ai#471

Spec: `cat-cafe#1226`  
原始需求: 当前 thread 对话（2026-04-16），`clowder-ai#470`  
检查时间: 2026-04-16

### 愿景覆盖（Step 0）

| # | 原始需求 | 覆盖情况 | 说明 |
|---|----------|----------|------|
| 1 | `google` client 允许绑定第三方 gateway 账号，不再被后端硬阻断 | ✅ | `account-resolver.ts` 允许 `google + api_key + 第三方 gateway`，并保留 fail-closed 校验 |
| 2 | 官方 Google endpoint 仍然必须走 builtin OAuth，不能把官方 API key 通道一起放开 | ✅ | API 和 Web 同步拦截 `generativelanguage.googleapis.com` / `*.googleapis.com` |
| 3 | intake 必须走逐文件 absorb，不得把 PR 说成“记录完就回家了” | ✅ | 已创建 Intake Intent Issue `cat-cafe#1226`，只吸收 5 个 `safe-cherry-pick` 文件并在隔离 worktree 完成 red→green、自检和 brand guard |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | API 允许 `google` 绑定第三方 gateway `api_key` 账号 | ✅ | `packages/api/src/config/account-resolver.ts` | `packages/api/test/cats-routes-runtime-crud.test.js` |
| 2 | 官方 Google endpoint 继续拒绝 `api_key` gateway 走法 | ✅ | 同上 | 同上 |
| 3 | 畸形 `baseUrl` 必须 fail-closed，不得直接抛异常打穿校验 | ✅ | 同上 | 同上 |
| 4 | Hub 账号过滤与后端规则一致，只显示 builtin + 合法第三方 gateway | ✅ | `packages/web/src/components/hub-cat-editor.model.ts`, `packages/web/src/components/hub-cat-editor.sections.tsx` | `packages/web/src/components/__tests__/hub-cat-editor.test.tsx` |
| 5 | Web 不依赖上游一定导出 `builtinAccountFamilyForClient`，避免运行时炸掉 | ✅ | `packages/web/src/components/hub-cat-editor.model.ts` | `packages/web/src/components/__tests__/hub-cat-editor.test.tsx` |

### 设计稿对照（Step 5）

`rg --files designs -g '*.pen' | rg 'google|gemini|gateway|account|hub-cat-editor|F127'` → 无匹配  
对照状态: ➖ 无 Pencil 设计稿变更

### Artifact Hygiene（Step 7.5）

仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### 工具落点检查

- intake 修改全部落在 worktree `fix/intake-clowder-471`，主 worktree 未污染 ✅
- `bash scripts/intake-from-opensource.sh --pr 471 --mode=plan` → 5 个文件，全部分类为 `safe-cherry-pick` ✅
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- `git diff --name-only origin/main...HEAD` 仅包含 `cat-cafe#1226` 决策表中的 5 个文件 ✅
- full gate 红灯落在 `packages/api/test/memory/f163-experiment-logger.test.js`，本次 diff 未触及 `packages/api/src/domains/memory/**` 或该测试文件 ⚠️

### 验证命令输出（本轮新鲜证据）

```bash
bash scripts/intake-from-opensource.sh --pr 471 --mode=plan
pnpm --filter @cat-cafe/api build
node --test packages/api/test/cats-routes-runtime-crud.test.js \
  --test-name-pattern "allows third-party gateway bindings for google client|rejects official Google endpoints|rejects malformed third-party gateway baseUrl"
(cd packages/web && pnpm exec vitest run src/components/__tests__/hub-cat-editor.test.tsx \
  -t "allows google to use builtin auth plus third-party gateway accounts only|shows third-party google gateways")
bash scripts/intake-from-opensource.sh --validate-inbound
pnpm gate
git diff --check
```

结果：

- `intake-from-opensource --pr 471 --mode=plan` → 5 个文件，全部 `safe-cherry-pick` ✅
- API targeted regression set → 3 条新增/改写用例通过 ✅
- Web targeted regression set → 2 条过滤逻辑用例通过 ✅
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected` ✅
- `pnpm gate` → build / typecheck / targeted intake surface均通过；在全量测试阶段被 `packages/api/test/memory/f163-experiment-logger.test.js` 的 F163 断言挡住，错误为 `parsedFlags.authorityBoost: 'shadow' !== 'off'`。该失败不在本次 absorbed 文件集合内 ⚠️
- `git diff --check` → clean ✅

### 备注

- Source PR: `clowder-ai#471`
- Source issue: `clowder-ai#470`
- Source merge commit: `be4ee8f2e2769be7f428d1e48dd6eca865d29dd4`
- Intake branch: `fix/intake-clowder-471`
- Absorb PR: `cat-cafe#1228`
- 当前状态：代码层 review-ready；full gate 仍需 reviewer 知晓有一条与本次 intake 无关的 F163 suite 红灯
