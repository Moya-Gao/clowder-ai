---
topics: [quality-gate, review-ready, intake, clowder-ai, kimi]
doc_kind: quality-gate-report
created: 2026-04-20
---

## Quality Gate Report — absorb clowder-ai#493

Spec: `cat-cafe#1315`, `clowder-ai#539`  
原始需求: `clowder-ai#539`  
检查时间: 2026-04-20

### 愿景覆盖（Step 0）

| # | 原始需求 | 覆盖情况 | 说明 |
|---|----------|----------|------|
| 1 | 修复 Kimi API-key 模式对 legacy `/coding/` base URL 的稳定 404 | ✅ | 已在 `buildApiKeyEnv()` 增加 runtime normalize，把 `api.kimi.com/coding(/)` 统一改写到 `/coding/v1` |
| 2 | 不扩大 scope，只回收已 merge 社区补丁的真实行为 | ✅ | 仅吸收 upstream 2 个 safe 文件：provider runtime compat + regression test |
| 3 | 把回归锁住，避免后续再把 legacy base URL 放行成 404 | ✅ | 新增专门测试，断言 `KIMI_BASE_URL` 输出为 `/coding/v1` |

### 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | API-key 模式遇到 legacy `https://api.kimi.com/coding/` 时自动规范化为 `/coding/v1` | ✅ | `packages/api/src/domains/cats/services/agents/providers/kimi-config.ts` | `packages/api/test/kimi-agent-service.test.js` |
| 2 | 只在 `api.kimi.com + /coding(/)` 这条兼容路径生效，不动默认 Moonshot URL | ✅ | `packages/api/src/domains/cats/services/agents/providers/kimi-config.ts` | `packages/api/test/kimi-agent-service.test.js` |
| 3 | intake 不得夹带 brand/manual-port 文件或额外架构改造 | ✅ | 本轮 absorb 仅 2 个 safe files | `bash scripts/intake-from-opensource.sh --pr 493 --mode=plan` |

### 设计稿对照（Step 5）

`rg --files designs -g '*.pen' | rg '493|kimi|base-url'` → 无匹配  
对照状态: ➖ 无 UI 改动

### Artifact Hygiene（Step 7.5）

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# 无输出 ✅

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# 无输出 ✅
```

### Intake Guard

```bash
bash scripts/intake-from-opensource.sh --pr 493 --mode=plan
# safe-cherry-pick: 2 files ✅

bash scripts/intake-from-opensource.sh --validate-inbound
# No brand violations detected ✅
```

### 验证命令输出（本轮新鲜证据）

```bash
pnpm --filter @cat-cafe/api build
# exit 0 ✅

node --test packages/api/test/kimi-agent-service.test.js
# 15 passed, 0 failed ✅

pnpm check
# exit 0 ✅

pnpm lint
# exit 0 ✅ (仅既存 warnings，无 errors)

pnpm test
# exit 0 ✅
```

### 备注

- source PR: `clowder-ai#493`
- source issue: `clowder-ai#539`
- intake intent: `cat-cafe#1315`
- absorb branch: `fix/intake-clowder-493`
- 本轮 diff 与 upstream merge commit `290f20122ab7ab71f42cb5e64115fb52ea92dde5` 语义一致：只吸收 `kimi-config.ts` 与 `kimi-agent-service.test.js`
