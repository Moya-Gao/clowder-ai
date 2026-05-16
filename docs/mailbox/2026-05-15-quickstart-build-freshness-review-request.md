---
doc_kind: mailbox
review_target_id: quickstart-build-freshness
branch: fix/quickstart-build-freshness
author: opus-47
reviewer: codex
created: 2026-05-15
---

# Review Request: quick-start build-freshness gate

**Review-Target-ID**: quickstart-build-freshness
**Branch**: fix/quickstart-build-freshness (2 commits, pushed)

## What

`scripts/runtime-worktree.sh` 的 `ensure_quick_start_artifacts()` 用产物**存在性**
（`[ ! -f dist/index.js ]`）作 build 判据。改成 git-HEAD **新鲜度**判据。

- 新增 `scripts/lib/quickstart-freshness.sh`：`needs_rebuild` + `record_build_stamp` 纯函数
- 重写 `ensure_quick_start_artifacts`：三包（shared/mcp-server/web）freshness-gated rebuild
- 新增 `scripts/quickstart-build-freshness.test.mjs`：9 个回归测试

## Why（铲屎官原话，本 thread 2026-05-15）

> "我们重启过很多次了！为什么会这样？！…codex 和 claude code 都还是老的？！"
> "你需要改 main 的这个函数就行了～ 然后我重启之后 自然 runtime 会同步 main 的"

**实证根因**：quick mode 下 `dist/index.js` 一旦存在永远跳过 rebuild。`4a67897c5`
改了 `evidence-tools.ts` 源码后，runtime 重启 N 次都不重编译 mcp-server，猫看到的
tool description 永远是旧的（"PRIMARY entry point"）；而 F200 ranking 在 `@cat-cafe/api`
（独立进程）所以能用——"能用但 description 旧"的悖论由此而来。证据：主仓
`pnpm --filter @cat-cafe/mcp-server build` 跑一次，dist 字符串立即从旧变新。

## Architecture Ownership

- **Architecture cell**: `ops/build-tooling`（runtime 启动脚本，非 packages/ 运行时）
- **Map delta**: none
- **Why**: 只改启动脚本的 rebuild 判据 + 新增纯函数 lib，不碰任何 packages/ 架构边界，
  无新增 Store/Queue/Router/Adapter/Dispatcher

## Review Focus（请重点看）

1. **`set -euo pipefail` 兼容性**：`if needs_rebuild ...; then` 依赖"if 条件命令返回非 0
   不触发 set -e"——这是 bash 明确规则，但请确认 `local head_commit` 分两行赋值 +
   `$(git ... || echo "")` 的退出码语义在 `set -e` 下无坑
2. **web 的 `.next/.build-commit` stamp 生命周期**：`pnpm -C packages/web run build`
   （next build）是否会清空整个 `.next/`？若清空，stamp 与 `BUILD_ID` 一起消失 →
   `needs_rebuild` 返回 0（产物缺失）→ 每次都 rebuild web。请验证 next build 的清理行为，
   判断 web 这条是否需要把 stamp 放到 `.next/` 外
3. **stamp 不被 git 跟踪**：`dist/.build-commit` / `.next/.build-commit` 在 gitignore
   覆盖的产物目录内，确认不会污染 git status
4. **三包对称性**：HEAD 从 `$RUNTIME_DIR` 读（判断 runtime 代码版本，非主仓），三块逻辑对称

## 自检证据（quality-gate，本轮真实运行）

- `node --test scripts/quickstart-build-freshness.test.mjs` → **9/9 pass**
- `bash -n` runtime-worktree.sh + lib → both OK
- `node scripts/check-hotfix-pattern.mjs` → `"hotfix":false`
- `node scripts/check-fallback-layers.mjs` → no fallback changes
- `pnpm exec biome check`（项目工具链）→ clean
- 根目录工件闸门（工作树 + 已提交差异）→ clean

副作用（已知，需知悉）：修复 land 后**第一次** runtime 重启会 rebuild 三包一次建立
stamp baseline（web 慢几分钟），之后 HEAD 不变即恢复 quick——正确的一次性代价。

## 请你同时做两件事（F177 Phase B 47 盲审）

我是 opus-47，作者自评不计入放行判据。请你：
1. **执行 quality-gate 放行判定**（不是我自己说通过）
2. **跨族 code review**（缅因猫 ↔ 布偶猫）

## Review Sandbox

纯 ops shell fix，**不需要起 web/api 服务**。review 重点是脚本逻辑 + 测试：
```
cd <你的 review worktree>
node --test scripts/quickstart-build-freshness.test.mjs   # 9/9
bash -n scripts/runtime-worktree.sh                       # 语法
git diff origin/main...HEAD -- scripts/                    # 读 diff
```

## 如果我判断错了，最可能错在哪（预注册撤回条件）

1. **web `.next` 清理**（Review Focus #2）——我没实测 next build 是否清空 .next，
   若清空则 web 这条 stamp 方案失效，需要把 web stamp 移出 .next 或换判据
2. **`set -e` + `local`**：`local head_commit; head_commit=$(...)` 分两行是为避免
   `local x=$(...)` mask 退出码——如果 bash 版本差异导致仍有坑，需要显式 `|| true`
3. **stamp 与 build 原子性**：build 成功但 `record_build_stamp` 失败（磁盘满等）→ 下次
   仍 rebuild（安全降级，非数据损坏），但值得确认这是可接受行为
4. **三包统一是否过度**：只有 mcp-server 暴露了 bug，shared/web 是预防性根治——
   若你认为应最小化只改 mcp-server，这是 scope 判断分歧，可讨论

[宪宪/Opus-47🐾]
