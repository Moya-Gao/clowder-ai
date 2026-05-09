---
feature_ids: []
topics: [gate, build, web, next, prerender, flaky]
doc_kind: bug-report
created: 2026-05-09
---

# Bug Report: pnpm gate web build prerender failure — `useContext null`

> 日期：2026-05-09
> 报告人：布偶猫 (Opus 4.7)
> 发现场景：F193 Phase D `feat/F193-phase-D-cleanup` merge-gate

## 1. 现象

`pnpm gate` 全量 build 阶段，`packages/web` 在 Next.js 静态页面 prerender (`Generating static pages 18/18`) 阶段 fail：

```
TypeError: Cannot read properties of null (reading 'useContext')
    at t.useContext (.../next/dist/compiled/next-server/app-page.runtime.prod.js:12:109421)
    at d (packages/web/.next/server/chunks/280.js:1:21533)
    ...
Error occurred prerendering page "/". Read more: https://nextjs.org/docs/messages/prerender-error
```

但 **同样的命令在 gate 外直接跑通过**：

```bash
cd packages/web && pnpm run build  # ✅ 18/18 pages prerender 成功
pnpm -r --if-present run build  # ✅ 18/18 pages prerender 成功
pnpm -r --workspace-concurrency=1 --if-present run build  # ✅
```

只有通过 `pnpm gate` (= `bash ./scripts/pre-merge-check.sh`) 调用时失败，且**两个版本（parallel + workspace-concurrency=1）都失败**。

## 2. 期望 vs 实际

| | 期望 | 实际 |
|---|---|---|
| `pnpm gate` web build | full pass | useContext null at prerender (18 pages all error) |
| 直接 `pnpm -r run build` | pass | pass |
| 直接 `cd web && pnpm run build` | pass | pass |
| `bash /tmp/minimal-gate.sh` (set -euo pipefail + same build cmd) | pass | pass |
| `bash ./scripts/pre-merge-check.sh --skip-install --no-rebase` | pass | fail |

## 3. 根因假设

`useContext` 返回 null 经典症状是 **多 React 副本** 或 **跨 React 实例上下文调用**。但 `find node_modules -name 'react' -type d` 只显示一个 `react@18.3.1`（pnpm 唯一拷贝）。

差异点：
- 直接 `pnpm -r --if-present run build` ✅
- `bash ./scripts/pre-merge-check.sh` 完整脚本 ❌

minimal repro `/tmp/test-gate.sh` 抄全 gate 的 `set -euo pipefail` + git status 检查 + same build command → ✅ 通过。意味着 fail 在 gate 脚本的某条命令副作用，但 bisect 困难（200+ lines）。

## 4. 复现

```bash
cd /path/to/cat-cafe-{feature-worktree}
trash packages/web/.next
NODE_ENV=development pnpm gate --skip-install --no-rebase
# Expect: ❌ Build 失败 (next prerender useContext null)
```

origin/main 也复现（不是 Phase D 引入）— 已 bisect 验证。

## 5. 已尝试方向（均无效）

| 尝试 | 结果 |
|---|---|
| `--workspace-concurrency=1` (build 串行) | 直接跑 ✅；gate 内仍 ❌ |
| `env -u NODE_PATH` (排除 runtime worktree NODE_PATH 泄露) | 直接跑 ✅；gate 内仍 ❌ |
| `env -u NODE_ENV` (排除 production prune) | 直接跑 ✅；gate 内仍 ❌ |
| `trash .next` 清理缓存 | 不影响 |
| `bash -c 'set -euo pipefail; pnpm -r ...'` | ✅ 通过 |

## 6. 影响

- F193 Phase D merge-gate 卡 — 但代码层 build/test 都过（直接验证）
- 任何后续 worktree 的 gate 都会撞同样 flake
- 与 `docs/bug-report/2026-05-08-gate-api-mcp-probe-flaky/` 同类（pre-existing gate 环境差异 flake）

## 7. 建议修复方向

需要专项定位（不在 Phase D 内做）：
- bisect gate 脚本，找到导致下游 next build state 改变的具体命令（git? sed? echo with non-ASCII?）
- 检查 next build 子进程的 stdin/stdout 配置是否在 gate context 与 direct 不同
- 验证是否 macOS 子进程组继承差异（参考 LL-055 `process-liveness-probe` 同类问题）

## 8. 不阻塞 F193 Phase D PR

按 F193 Phase A / Phase B / Phase C 的 CVO 先例（pre-existing gate flake 不阻塞 phase PR），本 bug report 提交后 Phase D 继续推进 PR + 云端 review + merge。

## 9. 验证证据（直接 build/test 全绿）

```bash
# Direct package builds
cd packages/web && pnpm run build  # ✅ 18/18 pages
cd packages/api && pnpm run build  # ✅ tsc + tsc copy-marketplace
cd packages/mcp-server && pnpm test  # ✅ 179/179
cd packages/api && env -u CAT_CAFE_RUNTIME_ROOT ... node --test \
  test/system-prompt-builder.test.js test/opencode-mcp-isolation.test.js
# ✅ 113/113

# Direct full chain (matches gate's Step 3 command)
pnpm -r --if-present run build  # ✅ all packages green
```

## 10. 参考

- `docs/bug-report/2026-05-08-gate-api-mcp-probe-flaky/` — 同类 gate flake (api MCP probe)
- LL-055 `process-liveness-probe` — macOS 子进程信号继承差异（可能相关方向）
- F193 Phase D PR — 砚砚 review PASS, 直接 build/test 全绿
