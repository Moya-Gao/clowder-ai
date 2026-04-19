# Review Request: v0.8.0 cross-platform build hotfix 回源

Review-Target-ID: v080-cross-platform-build
Branch: fix/v080-cross-platform-build

## What
- 把 `packages/api` 的 build 脚本从 Unix-only 的 `mkdir -p ... && cp ...` 改成跨平台 Node 脚本 `packages/api/scripts/copy-marketplace-catalog-data.mjs`
- 新增 `packages/api/test/build-script-cross-platform.test.js`，锁定 `build` 脚本不得再直用 Unix-only 复制命令
- 补齐新脚本/测试文件的 Biome 风格，让回源补丁可直接过 `pnpm gate`

## Why
- 社区同步 PR `clowder-ai#522` 在 `Test (Windows)` 上红灯，根因是 `@cat-cafe/api build` 在 PowerShell 下执行 `mkdir -p` / `cp` 直接失败
- 我们先在社区 PR 分支上修绿了 CI，但 `sync-to-opensource.sh` full sync 导出固定取 `origin/main`，所以这条修复必须正式回到家里的 `main`，后续 release-intended sync 才能带出去

## Original Requirements（必填）
> "如果你要，我下一步就执行：删旧 clowder-v0.8.0-source、把这次社区 hotfix 回家、然后重跑 release-intended full sync"
>
> "可以"

- 来源：当前 thread（2026-04-19 07:07, 铲屎官批准执行）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 没有继续在 `package.json` 里堆 shell 条件判断；直接抽成 Node 脚本，Windows/macOS/Linux 同一条 build 路径，后续也更容易加断言
- 这次只回源修补 `api build` 的跨平台问题，没有顺手扩展到其他历史 shell 脚本，避免 scope 发散

## Open Questions
1. 这两条 commit（功能 + style）是否足以作为回源 hotfix 直接合入 `main`
2. 新增 contract test 的粒度是否合适，是否足够覆盖这次 Windows 爆点
3. 是否同意这条回源补丁合入后，直接从最新 `origin/main` 重跑 `--release-tag=v0.8.0` full sync

## Next Action
- 请 review `fix/v080-cross-platform-build`
- 如果放行，我直接走 merge-gate 合回 `main`，然后继续 release-intended full sync

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/v080-cross-platform-build/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 这是 release/outbound-sync 路径上的 source-owned hotfix 回源，不涉及新的 feature scope
- 目标明确：让 `packages/api build` 在 Windows 下不再依赖 Unix-only 命令，并确保这条修复能被后续 full sync 带出

### 测试结果
- `pnpm --filter @cat-cafe/api build` ✅
- `node --test packages/api/test/build-script-cross-platform.test.js` ✅
- `pnpm biome check packages/api/scripts/copy-marketplace-catalog-data.mjs packages/api/test/build-script-cross-platform.test.js` ✅
- `pnpm gate` ✅
  - Branch: `fix/v080-cross-platform-build`
  - SHA: `a1c3299a`
  - Base: `origin/main (rebased)`

### 相关文档
- Outbound Sync SOP: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
- Current community sync PR: `clowder-ai#522`
