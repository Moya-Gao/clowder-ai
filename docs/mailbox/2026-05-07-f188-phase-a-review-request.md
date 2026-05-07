# Review Request: F188 Phase A — 运行期维护入口

Review-Target-ID: f188
Branch: feat/f188-library-stewardship

## What

添加 Memory 索引全量重建的运行期入口（4 commits）：

1. **RebuildJobTracker** — 内存态 job 状态追踪器（pending/running/done/error），拒绝并发重建（409）
2. **IndexBuilder.rebuild() onProgress** — 可选回调报告阶段进度（scanning→indexing→cleanup→embedding→done）
3. **POST/GET /api/evidence/rebuild** — localhost-only 异步 rebuild API（fire-and-forget + poll status）
4. **RebuildButton UI** — Hub Memory 面板"重建索引"按钮，进度条 + 结果/错误状态展示

## Why

F186 建好了 Library Memory 架构，但索引只在启动时重建。铲屎官说"全量重建索引！我们现在好像是启动的时候才会？"——需要运行期入口让猫猫/铲屎官随时触发。KD-3 明确要最小状态表，不是完整 Durable Job Ledger。

## Original Requirements（必填）

> "全量重建索引！我们现在好像是启动的时候才会？"
> "Memory Health Dashboard 感觉很鸡肋，开发完成到现在好像没啥用到"
> 知识进来没有管道、索引坏了没人知道、graph 连接稀疏

- 来源：`docs/features/F188-library-stewardship.md` Why 节
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 用 in-memory Map 而非 SQLite 表存 job 状态（KD-3 约束：最小化，done/error 后 GC 靠 Map 自然淘汰）
- 进度按阶段报告（scanning/indexing/cleanup/embedding）而非按文件——更简洁，对 UI 更有意义
- fire-and-forget async IIFE 而非 worker thread——rebuild 时间短（<30s），不需要跨进程隔离

## Open Questions

1. RebuildJobTracker 的 done/error job 目前不主动清理（Map 上限约 100 个 job 才需要考虑 GC）——Phase B Health Dashboard 是否需要历史记录？
2. IndexBuilder 进度百分比是硬编码的阶段边界（0→15→30→40→55→70→80→100），后续是否需要按文件数动态计算？

## Next Action

请 review 代码质量 + 架构合理性，关注：
- RebuildJobTracker 的并发控制是否完备
- 路由 localhost-only 守卫是否足够
- RebuildButton 状态机是否覆盖所有 edge case

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f188/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（review:start 默认端口）

## 自检证据

### Spec 合规

| AC | 描述 | 状态 |
|----|------|------|
| AC-A1 | POST /api/evidence/rebuild | `evidence.ts:368-402` |
| AC-A2 | GET /api/evidence/rebuild/:taskId | `evidence.ts:405-416` |
| AC-A3 | Hub "重建索引" button + progress | `RebuildButton.tsx` |
| AC-A4 | Non-blocking reads during rebuild | async fire-and-forget |

### 测试结果

```
pnpm test → 10273 pass, 1 fail (pre-existing windows-portable-redis-lifecycle.test.js)
pnpm lint → 0 errors
pnpm check → 0 biome errors (feature-index stale warning is pre-existing on main)
pnpm -r --if-present run build → exit 0
```

### 新增测试

- `rebuild-job-tracker.test.js`: 10 tests (create/get/update/complete/fail/concurrent/recovery)
- `index-builder-progress.test.js`: 2 tests (progress callback + backward compat)
- `evidence-rebuild-route.test.js`: 5 tests (POST/GET/concurrent/503/404)
- `index-status.test.ts`: 4 new tests (parseRebuildJob running/done/error/missing)

### 相关文档

- Feature: `docs/features/F188-library-stewardship.md`
- Plan: `docs/plans/2026-05-06-f188-library-stewardship-phase-a.md`
