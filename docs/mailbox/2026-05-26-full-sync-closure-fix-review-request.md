# Review Request: full sync public gate closure fix

Review-Target-ID: fix-full-sync-closure-fix
Branch: fix/full-sync-closure-fix

## What
- 修 5 个 `sync-to-opensource.sh --validate` 暴露出来的 source-owned public gate blocker：
  1. `sync-manifest.yaml` 补导出 `scripts/lib/redis-rdb-first.sh`
  2. `sync-manifest.yaml` 去掉 `target_owned_files` 里会覆盖 managed service wrappers 的 `scripts/services/`
  3. `sync-manifest.yaml` 补导出 `scripts/cleanup-stale-dev-processes.mjs`
  4. `scripts/services/embed-api.py` 追平家里 fallback / health contract
  5. `packages/api/test/services-lifecycle-failure-route.test.js` 隔离宿主机 sidecar env，避免 public gate 假红
- 顺手补 3 组防回归测试：
  - `scripts/check-env-port-drift.test.mjs`：sync closure / target-owned overlap / root helper export
  - `scripts/start-dev-profile-isolation.test.mjs`：embedding startup guard 改读公开运行路径
  - `packages/api/test/services-lifecycle-failure-route.test.js`：failure-route 不再继承宿主机 `CAT_CAFE_SERVICE_*`

## Why
- 我们不是卡在真实 `clowder-ai`，而是卡在 home 仓自己的 `source-owned public gate`。
- 这 5 个坑如果不先回家修掉，继续 real full sync 只会把 `clowder-ai` 当试错场。
- 目标是把 validate 修到绿，然后从干净 `main` 重新跑一遍 validate，再做真实 full sync。

## Original Requirements
> 把这 5 个 sync-pipeline 修复收成正式改动，回到 main
> 从干净 main 再跑一次 sync-to-opensource.sh --validate --yes
> 这次如果还绿，再做真实 full sync 到 clowder-ai 我同意！
- 来源：当前 thread，铲屎官消息 `0001779851965834-000041-c84eb1f6`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题

## Tradeoff
- 这轮只修 validate 暴露出来的 source-side blocker，不直接从 dirty worktree 做 real sync。
- `scripts/services/embed-api.py` 选择追平公开运行链路的真实契约，而不是把测试降级回根目录旧脚本。
- `target_owned_files` 去掉 `scripts/services/` 会让公开仓重新以家里 source 为准；这是有意回到“public is a projection of home”。

## Architecture Ownership
Architecture cell: opensource ops / outbound sync guard
Map delta: none
Why: 这轮只修 sync manifest、public gate closure 和测试隔离，不新增 Store / Queue / Router / Adapter / Dispatcher / Binding 边界。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
- `scripts/services/embed-api.py` 追平 root 版 fallback / health contract，这个方向是否比“改 wrapper 指回 root 脚本”更稳？
- `target_owned_files` 删掉 `scripts/services/` 后，是否还有哪个 service 文件应该继续 target-owned，而不是 source-managed？
- `services-lifecycle-failure-route.test.js` 用 env scrub 解决宿主机 `CAT_CAFE_SERVICE_*` 污染，是否足够保守，有没有误伤真正需要继承的 env？

### 价值 OQ（给 CVO，如有）
无

## Next Action
请做 code review。若放行，我下一步直接把这条 fix 合回 `main`，再从干净 `main` 重跑 `sync-to-opensource.sh --validate --yes`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/fix-full-sync-closure-fix/opus47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 这轮不做功能扩展，只做 `Outbound Sync` Step 5.5 source-side blocker repair
- 根目录工件闸门：working tree / diff 都为空
- 真实 `clowder-ai` 未被触碰；所有验证都停在 temp target public gate

### 测试结果
- `git diff --check` → pass
- `node --test scripts/check-env-port-drift.test.mjs --test-name-pattern 'sync-manifest exports root package operational helper scripts|sync-manifest exports start-dev sourced shell closure|sync-manifest does not protect managed service wrappers as target-owned'` → pass
- `node --test scripts/start-dev-profile-isolation.test.mjs --test-name-pattern 'does not silently fall back to sentence-transformers on Apple Silicon|pins embedding install dependencies away from transformers v5 drift|keeps setup docs aligned with Console-managed embedding service lifecycle'` → pass
- `python3 -m py_compile scripts/services/embed-api.py` → pass
- `sync-to-opensource.sh --validate --yes`（dirty worktree，用来验证这 5 个 fix 是否收口）→ **pass**
  - log anchor: `.cat-cafe/sync-runs/validate-1779834499705.log`
  - 关键收口：`✓ Validate passed`

### 相关文档
- Outbound Sync ref: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
- Skill: `cat-cafe-skills/opensource-ops/SKILL.md`
- Branch/worktree: `/Users/lysander/projects/relay-station/cat-cafe-full-sync-closure-fix`
