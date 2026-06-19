---
feature_ids: [F188]
topics: [alpha, harness, review-request]
doc_kind: mailbox
created: 2026-06-18
---

# Review Request: fix(alpha): build-freshness gate to alpha:start (ADR-039 parity)

Review-Target-ID: f188-alpha-stale-dist-fix
Branch: feat/F188-alpha-stale-dist-fix
PR: https://github.com/zts212653/cat-cafe/pull/2419

## What

在 `scripts/alpha-worktree.sh` 中添加 `build_alpha_stale_packages()` 函数，并在
`start_alpha_worktree()` 中的 sync + dep-install 之后调用它。

变更内容：
- `scripts/alpha-worktree.sh`：source `lib/quickstart-freshness.sh`，新增
  `build_alpha_stale_packages()` — 针对 shared / api / mcp-server 三个包做 HEAD 键控
  freshness 检查，stale 则重建 + 写入 `.build-commit` stamp；否则跳过（快路径）。
- `scripts/alpha-worktree.test.sh`：3 个新 TDD 测试覆盖
  missing-dist / fresh-stamp / HEAD-moves-after-sync 三种场景。

## Why

F188 Phase K alpha smoke 实测命中此问题：

> Alpha dist was stale on initial start (pre-Phase-K build). Rebuilt @cat-cafe/api in
> alpha worktree, restarted; Phase K code confirmed in dist before smoke. This is a
> harness gap (alpha:start should trigger rebuild), not a Phase K defect.

**根因**：`alpha:start` → `alpha-worktree.sh start` → `./scripts/start-dev.sh --quick`。
`--quick` 在 `start-dev.sh` 中会无条件跳过 `build_packages`。
Sync（ff-only pull from origin/main）把新 TypeScript 源码拉进来，但 `dist/` 停留在
sync 前的状态：

- `@cat-cafe/shared` 由其 `package.json` `"main"` 字段解析到 `dist/index.js`——即便
  API 通过 tsx watch 运行，`import from '@cat-cafe/shared'` 也加载 compiled dist。
- `packages/mcp-server/dist/index.js` 始终通过 node 加载（非 tsx）。

**与 ADR-039 的关系**：runtime 在 c1cba740b 获得了 Invariant 3（build freshness gate），
alpha 一直缺少对等实现。本 PR 补齐这个缺口。

## Original Requirements（必填）

> Alpha dist was stale on initial start (pre-Phase-K build). Rebuilt @cat-cafe/api in
> alpha worktree, restarted; Phase K code confirmed in dist before smoke. This is a
> harness gap (alpha:start should trigger rebuild), not a Phase K defect.
>
> 铲屎官关键 hypothesis：「是不是因为我们这几天改了 pnpm start 的行为？奇怪了 alpha
> 竟然不自动 build？」—— 这是首要调查方向。

- 来源：F188 Phase K close-gate-report alpha_smoke.note（通过 @opus-47 cross-thread 传球）
- **请 reviewer 对照：交付物是否解决了 alpha:start 不自动 build 的问题？**

## Tradeoff

**Option A（采用）：freshness gate，HEAD 键控** — 只在 HEAD 移动（sync 后）时重建，
steady-state 快速（~0.1s stamp 检查）；和 runtime-worktree.sh Invariant 3 保持一致。

**Option B（拒绝）：默认 `QUICK_START=false`** — 每次 alpha:start 都重建，简单粗暴，
但会给每次未变动的 restart 增加 15-30s build 时间；alpha 做为验收环境对性能不如 runtime
敏感，但仍有不必要的摩擦。

**不修 `--quick` flag 传递给 start-dev.sh**：`--quick` 还控制 `.next` cache 清理行为，
不影响构建决策（alpha 用 dev 模式，next dev 不需要 production build），保留不动。

## Architecture Ownership

Architecture cell: infra/scripts — alpha-worktree.sh 启动基础设施
Map delta: none
Why: 新函数封装在现有 alpha 启动流程内部，无新存储/路由/队列，无 API surface 变化。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（应无新的 Store/Queue/Router/Adapter）
- `lib/quickstart-freshness.sh` 的 `needs_rebuild` / `record_build_stamp` 合约是否
  在 alpha 场景下与 runtime-worktree.sh 使用方式对称

## Open Questions

### 技术 OQ（给 reviewer）

1. **api build 重复构建 shared**：`packages/api/package.json` build script 为
   `pnpm --dir ../shared build && tsc && ...`，所以若 shared 先被重建、api 后被重建，
   shared 会重建两次。现有实现复用 runtime 相同模式（视为可接受的轻微冗余）。
   是否有更清洁的方式？（我认为不值得增加复杂度）

2. **non-git alpha 场景**：`needs_rebuild` 在 `head_commit` 为空时短路返回"skip"。
   Alpha 始终是 git worktree，这条路径理论上不触发。是否需要显式 assert？

### 价值 OQ（给 CVO）

无。这是纯基础设施修复，技术路径已三猫收敛（@opus-47 分析 → 宪宪实现），不需要 CVO 判断。

## Next Action

请 reviewer：
1. 验证根因分析和 `shared dist = the actual problem vector` 的推断是否正确
2. 检查 `build_alpha_stale_packages` 调用时机（sync → deps → build → start）是否合理
3. 确认测试场景是否覆盖了预期的 failure modes
4. `pnpm alpha:test` 可跑 alpha-worktree 测试套件（10 tests including 3 new）

## Review Sandbox

纯 shell script 改动，无需启动 API/前端。

```bash
# 标准路径
mkdir -p /tmp/cat-cafe-review/f188-alpha-stale-dist-fix/codex
cd /tmp/cat-cafe-review/f188-alpha-stale-dist-fix/codex
# 检出分支
git clone https://github.com/zts212653/cat-cafe.git . --branch feat/F188-alpha-stale-dist-fix
# 跑测试
bash scripts/alpha-worktree.test.sh
```

Ports: N/A（纯 script 改动）

## 自检证据

### Spec 合规

- [x] 根因已定位（shared dist stale via `@cat-cafe/shared` → dist/index.js）
- [x] 与 ADR-039 Invariant 3 对称（同样使用 quickstart-freshness.sh）
- [x] 不改动 API 路由/端口/生产数据路径
- [x] Redis 6399 未触碰

### 测试结果

```
bash scripts/alpha-worktree.test.sh
PASS: usage documents alpha commands
PASS: alpha env exports are fixed to isolated defaults
PASS: init + sync fast-forward alpha worktree
PASS: ensure_alpha_branch repairs detached worktree
PASS: legacy main-test worktree migrates to alpha location
PASS: resolve_env_source_file falls back to sibling cat-cafe/.env
PASS: is_api_running checks the configured alpha api port
PASS: build_alpha_stale_packages rebuilds all packages when dist is missing
PASS: build_alpha_stale_packages skips rebuild when dist is fresh
PASS: build_alpha_stale_packages rebuilds stale packages when HEAD moved after sync
10 passed, 0 failed
```

```
pnpm biome check . --diagnostic-level=error
Checked 4146 files in 1224ms. No fixes applied.
```

```
pnpm check:scripts-ascii-only
✅ All scripts/services/*.{sh,ps1} are pure ASCII.
```

根目录工件闸门：`OK`（无媒体/设计工件）

### 相关文档

- Feature: F188 Phase K close
- ADR: `docs/decisions/039-runtime-passive-freeze.md`（ADR-039，被 copy 的 invariant 来源）
- lib: `scripts/lib/quickstart-freshness.sh`（共用的 needs_rebuild / record_build_stamp）

---

[宪宪/claude-sonnet-4-6🐾]
