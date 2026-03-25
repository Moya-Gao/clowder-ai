# Review Request: v0.3.0 Target-Side Fix Intake

## What
- 把 `clowder-ai v0.3.0` 为 release 临时落在 target 侧的两类修补 intake 回 `cat-cafe main`：
  - `ConnectorRouter`：未授权群里，管理员发 `/allow-group` 时允许进入命令层，不再被白名单前置拦截卡死。
  - `pandoc-service.test`：把“runner 必须装 pandoc”的硬编码断言改成环境自适应，只要求 `isPandocAvailable()` 返回 `boolean`，收掉 target CI 上的假红。
- 顺手补了一条 source 侧 sync guard：`scripts/sync-to-opensource.sh --release-tag=...` 现在会先校验 source commit 是否已进入 `origin/main`，避免再次出现“release 用到的 source snapshot 只在 release 分支、不在 main”这种 provenance 断点。
- 给上面三块都补了/扩了回归测试：
  - `packages/api/test/connector-router.test.js`
  - `packages/api/test/pandoc-service.test.js`
  - `scripts/check-env-port-drift.test.mjs`

## Why
- 这轮 `v0.3.0` 发版里，`#235` 上确实有 target-side 临时修补；按我们的规则，这种 shared code / CI parity 不能留在开源仓外面，必须 intake 回家。
- 另外，`v0.3.0` 也刚踩过一次 source provenance 断点：release 用到的 snapshot SHA 当时只在 release 分支，不在 `origin/main`。这不该再靠人工记忆兜底，应该让 sync 脚本在 pre-sync gate 直接 fail fast。

## Original Requirements
> “#235 上为了 release 做的 target-side 修补，接下来要 intake 回 cat-cafe main  
> 这次至少包含 pandoc-service.test 的 CI parity 修复和 ConnectorRouter 的 /allow-group 白名单绕过修复”  
> “来吧 我们来intake回家以及看看我们的 同步 脚本如果有需要优化也可以优化”
- 来源：thread message `0001774413528226-000153-972d60e4`
- **请对照上面的摘录判断交付物是否真的把 target-side 修补收回了 source-of-truth，并且只把该进同步脚本的 guard 放进了同步脚本。**

## Tradeoff
- 我没有把 `clowder-ai` 上的 target-only transform 一起带回家，比如公开 profile / `3004` 端口约定；那类差异继续留在 `sync-to-opensource.sh` 做导出转换，不污染 home truth。
- 这轮把 provenance guard 一起并进来，会让 PR scope 比“只 intake 两个 target 修补”稍大一点；但它解决的是同一次 `v0.3.0` 发布里已经踩到的真问题，不是顺手做的额外优化。

## Open Questions
- 请重点看 `ConnectorRouter` 的放宽边界是不是够窄：现在只给管理员 `/allow-group` 开例外，其他未授权群命令仍然保持原来的 whitelist precheck。
- 请重点看 `scripts/sync-to-opensource.sh` 新增的 `require_release_source_commit_on_main` 是否放在了正确层级：它应该拦 release provenance 断点，但不该影响普通 dry-run / validate 流程。

## Next Action
- 请 `@opus` review 这条 intake 线，重点看 shared code intake、CI parity intake、以及 sync script provenance guard 三块边界。

Review-Target-ID: `fix-v030-intake-target-fixes`
Branch: `fix/v030-intake-target-fixes`
Commits:
- `6b7065dd` `fix(sync): intake v0.3.0 target-side release fixes [砚砚/GPT-5.4🐾]`

## 自检证据

### Spec 合规
- 对齐对象：铲屎官明确要求把 `#235` 的 target-side 修补 intake 回家，并检查同步脚本是否需要补 guard。
- 这轮没有新增用户可见功能；交付边界是 shared code / CI parity 回流到 `cat-cafe main`，以及 release-intended sync 的 provenance fail-fast 护栏。
- 前端浏览器实测：不适用（无前端行为改动）。

### 测试结果
- `pnpm exec node --test scripts/check-env-port-drift.test.mjs` → `52/52 pass`
- `pnpm --filter @cat-cafe/api run build` → `PASS`
- `pnpm --filter @cat-cafe/api exec node --test test/connector-router.test.js` → `30/30 pass`
- `pnpm --filter @cat-cafe/api exec node --test test/pandoc-service.test.js` → `11/11 pass`
- `pnpm check` → `PASS`
- `pnpm gate` → `✅ GATE PASSED`（head `6b7065dd`）

### 相关文档
- Feature Truth Guard: `docs/features/index.json`
- Ops Ref: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
