---
doc_kind: review-request
feature_ids: [F188]
created: 2026-05-08
---

# Review Request: F188 Phase B — Library Health Dashboard

Review-Target-ID: f188-phase-b
Branch: feat/f188-phase-b

## What

Memory Health Dashboard 增强：从"有多少东西"升级到"哪里脏了、漏了、坏了"。

新增 5 个 library health 指标：
1. **Stale anchors** (AC-B1) — 引用已删文件的锚点 count + detail list
2. **Search quality** (AC-B2) — zero-hit / low-hit 统计 + recent misses
3. **Orphan edges** (AC-B3/C4) — 悬空图边 count
4. **Replay drift** (AC-B4) — Jaccard 相似度趋势（历史搜索日志对比）
5. **Knowledge Feed** (AC-B5) — pending + needs_review 积压量

变更范围（7 files）：
- `f188-library-health.ts` — 纯函数 computeLibraryHealth（5 个内部函数，~155 行）
- `f163-audit-routes.ts` — 在 GET `/api/f163/health-report` 中 merge library health 指标
- `index.ts` — 注入 markerQueue + docsRoot 到 audit routes
- `LibraryHealthSection.tsx` — 新前端组件（MetricCard + SearchQuality + ReplayDrift + StaleAnchorDetail，89 行）
- `HealthReport.tsx` — 扩展 HealthReportData 接口 + getActionItems 新增 3 条 warning
- `HealthReport.test.ts` — 3 个新测试（stale/orphan/KF warning）
- `f188-library-health.test.js` — 10 个后端测试

## Why

铲屎官原话："Memory Health Dashboard 感觉很鸡肋，开发完成到现在好像没啥用到"。Phase A 建了运行期维护入口（rebuild），Phase B 让 dashboard 真正有诊断价值。

## Original Requirements（必填）

> "Memory Health Dashboard 感觉很鸡肋，开发完成到现在好像没啥用到"
> "全量重建索引！我们现在好像是启动的时候才会？"
> "graph 到底是如何 link 起文档的？只看 frontmatter？还是会看文档里面的 ref？"

- 来源：`docs/features/F188-library-stewardship.md` Why 节（源自 2026-05-06 GBrain teardown 复盘）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择从 f163_logs 计算 replay drift 而非 live replay：避免高成本 replay 执行，Jaccard 对比已有日志数据即可反映趋势
- Search quality 从 payload JSON parse 而非结构化表：复用已有日志格式，不需 schema migration
- 所有 DB 查询 try/catch fallback：optional tables (edges, f163_logs) 可能不存在于所有环境

## Architecture Ownership（必填）

Architecture cell: memory-health (extends existing F163 health-report)
Map delta: none
Why: 扩展已有 health-report 路由，新增纯函数和 UI 组件，不改变架构边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

1. **try/catch 层数**：`f188-library-health.ts` 有 12 个 fallback 层（每个 DB query + JSON parse 都有 catch）。坐标系自检已过——每个 catch 保护不同的 optional table boundary。请 reviewer 确认是否 over-defensive
2. **stale anchors 检测时机 (OQ-2)**：当前在 health-report API 调用时同步计算。如果文件量大可能慢——目前 docs/ 规模下没问题

## Next Action

请 review 代码正确性 + 架构合理性。涉及前端 UI 改动（`LibraryHealthSection.tsx`），需浏览器验证。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f188-phase-b/codex`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 自动分配（3201/3202 起点）

## 自检证据

### Spec 合规

Quality gate 通过（2026-05-08 13:15）：
- 6 个 AC (B1-B5 + C4) 全部 met
- 愿景对照通过：从"鸡肋"到"诊断价值"
- Fallback layer check: 12 layers in f188-library-health.ts — intentional (optional table boundaries)
- Follow-up tail scan: ✅ No follow-up tails detected
- Root artifact hygiene: ✅ clean

### 测试结果

```
Backend: node --test f188-library-health.test.js → 10 pass, 0 fail ✅
Frontend: vitest HealthReport.test.ts → 15 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check (biome) → 0 errors ✅
```

### 相关文档

- Plan: `docs/plans/2026-05-08-F188-phase-B-library-health-dashboard.md`
- Feature: `docs/features/F188-library-stewardship.md`
