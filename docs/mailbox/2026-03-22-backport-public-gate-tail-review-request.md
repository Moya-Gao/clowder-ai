# Review Request: Backport Public Gate Tail Fixes

Review-Target-ID: backport-public-gate-tail
Branch: fix/backport-public-gate-tail

## What
- 把 `clowder-ai#167/#168` 里会被下次 full sync 覆盖的 managed-file 修复回补到家里 `main` 候选分支。
- 具体包括：
  - `packages/api/package.json` 的 `test:public --test-concurrency=1`
  - fake CLI path helper 与 Claude/Gemini/OpenCode/Image upload 相关测试隔离
  - `invoke-single-cat` / `cli-spawn` / `process-liveness-probe` / `security-boundary` 等 CI 稳定性修复
  - 被 `test:public` 排除、但同样属于 sync-managed 的 `integration/wiring` / `thread-wiring` 修补

## Why
- 这些文件都不是 `target_owned`，也没有 public transform 保护。
- 如果只留在 `clowder-ai`，下次 full sync 会把这些 CI 稳定性修复覆盖掉。
- 我们刚把 public gate 前移到 source 侧，source-owned gate 必须和真实 target CI 一致，不能继续“source 说绿、target 再补洞”。

## Original Requirements
> 如果留在开源仓的，你们要记得得加那个过滤器里面？有差异的如果不加那个过滤器下次全量同步会同步没的。  
> 下一步应该做的是一次“开源仓剩余 patch 分流盘点”  
> 把 #167/#168 里剩下的改动按 source-owned vs public-only 清一遍，再决定哪些要回家补 PR
- 来源：当前 thread（2026-03-22，铲屎官）
- 请对照上面的摘录判断这批 backport 是否只收“必须回家”的 managed-file 修复，没有把 public-only 差异误带回家。

## Tradeoff
- 没有回带 `README.md`、`SETUP.md`、`cat-config.json`、`runtime-worktree.sh` 的 opensource wrapper、品牌/默认端口等 public-only 差异。
- 代价是家里和开源仓仍会保留一批有意差异；收益是 source 与 public-only 责任边界清楚，不再把开源默认值倒灌回家。

## Open Questions
1. 这批文件里是否还有应该继续留在 `clowder-ai`、不该回家的测试/脚本差异？
2. `integration/wiring.test.js` / `integration/thread-wiring.test.js` 当前被 `test:public` 排除，但仍属 sync-managed；现在一起回带是否合适？
3. `security-boundary.test.js` 这次修成了“子进程显式去掉 `REDIS_URL` 污染”，是否足够精准，还是应该在更上层统一收紧测试子进程 env？

## Next Action
- 请按“哪些该回家、哪些不能回家”这条边界严格 review。
- 如果放行，我会开 PR 合回家里的 `main`，然后把这批 managed-file 修复从“开源仓独有”变成 source-owned 真相。

## 自检证据

### Spec 合规
- 目标：把 `#167/#168` 中会被 full sync 覆盖的 managed-file 修复回带到 source，让 source-owned public gate 与真实 target CI 收敛。
- 边界：public-only 文档、品牌、wrapper 注入、transform 产物不回带。

### 测试结果
- `pnpm --dir packages/api run test:public` → `4761 passed, 0 failed`
- `pnpm check` → 通过
- 定向回归：
  - `CI=1 node --test test/install-script-env.test.js` → `11 passed, 0 failed`
  - `CI=1 node --test test/security-boundary.test.js` → `1 passed, 0 failed`

### 相关文档
- Lesson: `docs/lessons-learned.md`（LL-035 与后续 full-sync hardening）
- SOP: `docs/SOP.md`
- PR context: `clowder-ai#167`, `clowder-ai#168`, `cat-cafe#652`
