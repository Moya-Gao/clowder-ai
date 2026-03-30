# Review Request: fix: account resolution uses runtime root, not thread.projectPath

Review-Target-ID: fix-account-resolution-runtime-root
Branch: fix/account-resolution-use-runtime-root
PR: #865

## What

`invoke-single-cat.ts` L668 used `workingProjectRoot ?? resolveActiveProjectRoot(process.cwd())`
for account resolution. When a Hub-created thread has `projectPath` pointing to the dev worktree
(`cat-cafe/`), `workingProjectRoot` is set — so the fallback to `process.cwd()` never fires.
The dev catalog lacks runtime-only custom accounts → "failed to resolve bound account".

**Fix**: Always use `resolveActiveProjectRoot(process.cwd())` for account resolution.
`workingProjectRoot` is still used for shared-state preflight and cat working directory.

**1 source file + 1 test file changed:**

| File | Change |
|------|--------|
| `invoke-single-cat.ts` L668 | Removed `workingProjectRoot ??` prefix |
| `invoke-single-cat.test.js` | New test: divergent thread.projectPath vs runtime root |

## Why

金渐层 discovered and reported this in `docs/bug-report/2026-03-29-worktree-projectpath-account-resolution/`.
Every custom account added via runtime API fails when invoked from a Hub-created thread because
all Hub threads set `projectPath` to the dev worktree, not the runtime root.

铲屎官's request: "配置一个非你们三只大猫官方的plan的账号太难了。整一下吧"

This is a companion fix to PR #863 (OPENCODE_CONFIG_DIR) — together they make custom accounts work.

## Original Requirements（必填）
> [19:01 铲屎官] @opus 是的你需要修一下
> 金渐层 bug report: thread.projectPath 导致 account 解析读错 catalog
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Test

New test creates two temp directories:
- `runtimeRoot` — has custom account via `createProviderProfile()`
- `devRoot` — empty catalog (no custom accounts)

Sets `thread.projectPath = devRoot`, `process.cwd() = runtimeRoot`.
Verifies invocation reaches `done` without "bound account not found" error.

## 自检证据

### Spec 合规
- 根因：thread.projectPath 指向 dev worktree，account 只在 runtime catalog ✅
- 修复：account resolution 始终用 process.cwd()（runtime root）✅
- workingProjectRoot 仍用于 preflight/cat cwd（不影响现有功能）✅
- 方案 D（金渐层推荐的统一 account 真相源）✅

### 测试结果
```
invoke-single-cat.test.js (divergent): 1 passed, 0 failed
invoke-single-cat.test.js (full): 65 passed, 4 failed (pre-existing)
pnpm gate: PASSED (SHA 8551ac65)
```

## Next Action

请 review `invoke-single-cat.ts` L668 的单行改动 + 新测试。
重点关注 `workingProjectRoot` 的其他使用处（L551, L558）是否受影响（不应受影响——它们用于 preflight，不用于 account resolution）。
