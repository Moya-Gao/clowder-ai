---
topics: [quality-gate, review-ready, intake, clowder-ai, acp]
doc_kind: quality-gate-report
created: 2026-04-09
---

## Quality Gate Report — intake clowder-ai#400

Spec: `clowder-ai#400`, `clowder-ai#401`, `cat-cafe#1022`  
原始需求: 当前 thread 对话（2026-04-09）  
检查时间: 2026-04-09

### 愿景覆盖（Step 0）

| # | 原始需求 | 覆盖情况 | 说明 |
|---|----------|----------|------|
| 1 | bug 要尽快修，不等社区 contributor 慢慢补 | ✅ | 直接往社区 PR 分支补推 lint fixup，批准 workflow run，补 maintainer review，推动 `clowder-ai#400` 合入 |
| 2 | intake 回家要走我们自己的 skills 流程 | ✅ | 已创建 Intake Intent Issue `cat-cafe#1022`，开独立 worktree，做 red→green 回归测试，推 intake 分支并记录 ledger |
| 3 | 最后让布偶猫检查 intake 流程是否完整 | ✅ | 本轮输出 review-ready 文档包，下一棒明确交给 `@opus` 检查流程闭环 |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | Windows 下 `AcpClient` 默认 spawn 路径不能直接撞裸 `gemini.cmd`，要走 shim / Git Bash / `cmd.exe` fallback | ✅ | `packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.ts` | `packages/api/test/acp/acp-client-windows-spawn.test.js` |
| 2 | 注入 `spawnFn` 的测试路径不能被 Windows fallback 污染 | ✅ | `packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.ts` | `packages/api/test/acp/acp-client.test.js` |
| 3 | intake 必须把 upstream 的这条回归测试一起带回家 | ✅ | `packages/api/test/acp/acp-client-windows-spawn.test.js` | `packages/api/test/acp/acp-client-windows-spawn.test.js` |
| 4 | 社区 PR 合入后，家里的 intake ledger 要有 `#400 -> absorbed` 记录 | ✅ | `docs/ops/opensource-intake-ledger.json` | `bash scripts/intake-from-opensource.sh --record --pr 400 --decision absorbed` |

### 设计稿对照（Step 5）

`rg --files designs -g '*.pen' | rg 'acp|spawn|windows'` → 无匹配  
对照状态: ➖ 无 UI 改动

### Artifact Hygiene（Step 7.5）

仓库根目录未跟踪媒体文件: 无 ✅

### 工具落点检查

- external fixup 在临时 clone `/tmp/clowder-ai-pr400` 完成，并已 push 到 contributor 分支 ✅
- source intake 修改全部落在 worktree `feat/intake-clowder-400`，主 worktree 未污染 ✅
- `docs/ops/opensource-intake-ledger.json` 已记录 `clowder-ai#400 -> absorbed`，但 auto-advance 被更早的未登记社区 PR `#394` / `#399` 阻塞 ⚠️

### 验证命令输出（本轮新鲜证据）

```bash
# clowder-ai PR 分支验证（/tmp/clowder-ai-pr400）
pnpm check
pnpm --filter @cat-cafe/api run build
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  node --test test/acp/acp-client-windows-spawn.test.js test/acp/acp-client.test.js

# cat-cafe intake worktree 验证
pnpm --filter @cat-cafe/api run build
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  node --test test/acp/acp-client-windows-spawn.test.js test/acp/acp-client.test.js test/cli-spawn-win.test.js
bash scripts/intake-from-opensource.sh --validate-inbound
bash scripts/intake-from-opensource.sh --record --pr 400 --decision absorbed
pnpm check
```

结果：

- `clowder-ai` 侧 `pnpm check` / API build / ACP focused tests 全绿 ✅
- `cat-cafe` 侧 API build ✅
- `cat-cafe` focused regression set → `54 passed, 0 failed` ✅
- Inbound Brand Guard ✅
- `clowder-ai#400` 已 merge，merge commit: `0735883f5233de252346e3e0cde53ae75e36a3e2` ✅
- `clowder-ai#401` 已 auto-close ✅
- `docs/ops/opensource-intake-ledger.json` 已记录 `#400 -> absorbed` ✅
- auto-advance ledger ❌：被更早的未登记社区 PR `clowder-ai#399` / `clowder-ai#394` 阻塞
- `pnpm check`（source 仓）❌：`docs/features/index.json is stale`，这是 `origin/main` 现存基线问题，和本轮 ACP intake diff 无直接关系

### 备注

- source intake branch: `feat/intake-clowder-400`
- source commit: `7590ecdf9e19fe065c83de4fe4cb8eca25e6826f`
- Intake Intent Issue: `cat-cafe#1022`
- 下一步不是 force overwrite ledger，而是请 `@opus` 检查这次 intake 流程是否已经满足 review-ready，及旧债 `#394/#399` 应否单独补记
