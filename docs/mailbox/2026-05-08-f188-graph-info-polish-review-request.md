---
title: "F188 Graph 信息可读性修复 Review Request"
doc_kind: mailbox
feature_ids: [F188]
created: 2026-05-08
updated: 2026-05-08
owner: codex
status: review-request
---

# Review Request: F188 Graph 信息可读性修复

Review-Target-ID: f188-graph-info-polish
Branch: fix/f188-graph-info-polish
Commit: f25420860

## What

把 Memory Graph 从“调试用节点图”改成可读的知识图谱界面：

- 节点从固定圆形改成圆角卡片，显示 `anchor + 短标题`，中心节点显示更长标题。
- 新增右侧持久 Inspector，展示选中节点的 anchor/title/kind/collection/sensitivity/关系列表。
- Legend、edge filter、Nodes/Edges/Depth 统计移入侧栏，避免贴底被裁。
- 稀疏图显示边关系名；密集 hub 图使用确定性双列布局，避免 F186 这类中心节点周围堆成一团。
- 修正 Memory nav 在窄屏/Graph 页的换行和按钮可见性。

## Why

F188 Phase C 已把 graph 的连接功能修到可用，但 CVO 验收时明确指出信息不可读和感官不可接受。这个 follow-up 不是再修 edge extraction，而是把 graph 变成人能看懂、愿意看的知识工作台。

## Original Requirements（必填）

> “比如f186 天知道f186是个什么东西！你们这里显示的信息也很让人费解”
> “必须要 人可读性 且！你们的这个画的太丑了 选择的组建丑 字突破了那个椭圆 等等问题”
> “这些其实都是 Graph 信息可读性 以及感官的问题”
> “先修改f188的spec 然后再写代码”

- 来源：当前 thread CVO feedback；已落到 `docs/features/F188-library-stewardship.md` 的 AC-C6a~AC-C6f。
- **请对照上面的摘录判断交付物是否解决了 CVO 的问题。**

## Tradeoff

- 没换 `react-flow` / `d3-force-graph`：当前 SVG 实现足够，换图库会扩大风险和依赖面。
- 没做拖拽/缩放：这次聚焦信息可读性；大图交互可留给后续专门设计。
- 密集图不继续用纯 force layout：F186 这种 hub 图需要可读性优先，所以用确定性双列布局牺牲一点“自然力导向”观感。

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: 只改 Memory Graph 的前端呈现和布局纯函数，不新建 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：

- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `readableHubLayout()` 的阈值（`nodes.length > 10`）和左右双列布局是否足够稳，是否有明显反例。
2. `GraphNodeGlyph` 的宽度估算、标题截断和移动端表现是否仍可能溢出。
3. Inspector 的 selected node / relation 列表是否保持了 drill-down、hover tooltip、键盘 Enter/Space 行为。
4. `MemoryNav` 的 `useEffect` 依赖收敛是否正确：`from` query 只需 mount 时读取，后续用 store thread id fallback。

### 价值 OQ（给 CVO，如有）

无。CVO 已明确方向：Graph 信息可读性和感官质量必须提升；本轮是按已更新 spec 落地。

## Next Action

请 `@opus` 做严格 review。若 0 P1/P2，放行后我继续 merge-gate；如有问题我按 `receive-review` Red→Green 修。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f188-graph-info-polish/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 自动分配；作者浏览器验收使用过 `web=5172`, `api=3172`（仅作证据，不要求复用）。

## 自检证据

### Spec 合规

F188 spec 已新增 AC-C6a~AC-C6f：

- AC-C6a: 节点显示 `anchor + 短标题`，中心/选中节点显示完整 title。
- AC-C6b: 节点不再用固定圆/椭圆承载长文本，文字有稳定截断策略。
- AC-C6c: 点击节点后 Inspector 持久显示核心元信息和关系列表。
- AC-C6d: Legend / filter / stats 在侧栏展示，不被画布挤出 viewport。
- AC-C6e: 稀疏图显示 relation；密集图至少在 Inspector/hover 中解释 relation。
- AC-C6f: `f186` / `F186` 浏览器验收截图证明图居中、信息可读、控件可见、无文字溢出。

### 测试结果

```bash
node scripts/run-with-node-env-test.mjs pnpm exec vitest run \
  src/components/memory/__tests__/CollectionGraph.test.tsx \
  src/components/memory/__tests__/graph-layout.test.ts
# 2 files passed, 10 tests passed

pnpm exec biome check \
  packages/web/src/components/memory/CollectionGraph.tsx \
  packages/web/src/components/memory/CollectionGraphParts.tsx \
  packages/web/src/components/memory/CollectionGraphModel.ts \
  packages/web/src/components/memory/graph-layout.ts \
  packages/web/src/components/memory/MemoryNav.tsx \
  packages/web/src/components/memory/MemoryHub.tsx \
  packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx \
  packages/web/src/components/memory/__tests__/graph-layout.test.ts
# Checked 8 files. No fixes applied.

pnpm --filter @cat-cafe/web exec tsc --noEmit
# exit 0

NODE_ENV=production API_SERVER_PORT=3172 FRONTEND_PORT=5172 pnpm --dir packages/web build
# exit 0; warnings are existing repo-wide lint warnings outside this diff
```

### Browser / Screenshot 证据

- Desktop screenshot: `/tmp/cat-cafe-evidence/f188-graph-info-polish-desktop-final3.png`
- Mobile screenshot: `/tmp/cat-cafe-evidence/f188-graph-info-polish-mobile-final2.png`
- Playwright 验证：
  - `/api/library/graph?anchor=f186&depth=1` → 200
  - `/api/library/graph?anchor=F186&depth=1` → 200
  - desktop/mobile `bodyScrollWidth === viewportWidth`
  - SVG 节点文本无检测到的溢出项

### Quality Gate 摘要

- 文件长度：所有改动文件 < 350 行。
- Root artifact guard：仓库根目录无新增媒体/设计工件。
- Architecture ownership：`pnpm check:architecture-ownership` exit 0；仅报告仓库既有 in-progress feature 缺 Architecture cell warning。
- Fallback layer check：总净变化 -1；脚本仍提示 `CollectionGraph.tsx`，原因是异步 graph 未加载、坐标缺失时的 UI 空值保护，不是新增错误坐标系。

### 相关文档

- Feature: `docs/features/F188-library-stewardship.md`
- Review Target: `f188-graph-info-polish`
