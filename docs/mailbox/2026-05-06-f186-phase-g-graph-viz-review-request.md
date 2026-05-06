# Review Request: F186 Phase G — Knowledge Graph Visualization

Review-Target-ID: f186-graph-viz
Branch: feat/f186-graph-viz

## What

Upgraded CollectionGraph from static circular layout to force-directed (velocity Verlet simulation). Added hover tooltip, private/redacted node opacity, preserved drill-down click.

- `CollectionGraph.tsx`: replaced `layoutNodes()` (circle) with `forceLayout()` (80-iteration force simulation: charge repulsion + link springs + center gravity). Extracted `applyRepulsion`/`applySprings` helpers. Added `renderGraphNode` for a11y + complexity. Switched to uncontrolled input via ref.
- `CollectionGraph.test.tsx`: 4 new tests — node rendering after fetch, tooltip on hover, private node opacity 0.5, drill-down re-fetch.

## Why

铲屎官要求 GBrain 风格的图形化节点关系可视化。现有卡片/列表视图不能直观展示 anchor 间的拓扑关系。Force-directed layout 让节点自然分布，连接的节点靠近、无关的远离。

## Original Requirements（必填）

> "如果我想要 GBrain 那样的图形化节点关系可视化 我们现在能做吗？"
> — 铲屎官，当前会话
> "当然！我们的f186 有这个吧！没有的话记得先修改feat md commit push 然后开worktree"

- 来源：当前会话对话（F186 close 后重开 Phase G）
- Feature spec: `docs/features/F186-library-memory-architecture.md` Phase G + AC-G1/G2/G3
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

放弃 d3-force 外部依赖，自实现 ~50 行力模拟。原因：npm registry 网络故障 + YAGNI（小图 5-20 节点不需要完整物理引擎）。

## Open Questions

1. **视觉验证缺失**：由于系统 EMFILE 限制，无法在 worktree 启动 Next.js dev server。4 项单元测试覆盖全部 AC，但力导向布局的视觉效果未经浏览器确认。**请 reviewer 务必在沙盒中启动服务验证 Graph tab 渲染效果。**
2. 力模拟参数（repulsion=3000, spring length=120, damping=0.8, iterations=80）是否需要调优？
3. SVG `<g>` 元素用 `role="treeitem"` 是否合适？

## Next Action

请完整 review 代码 + 在浏览器中验证 Graph tab 的力导向渲染效果。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f186-graph-viz/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer 沙盒自动分配（参见 review:start 输出）

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-G1: Hub Memory Graph tab 力导向图 | ✅ | forceLayout() 实现 + test "renders graph nodes" |
| AC-G2: 点击 drill-down + hover 详情 | ✅ | test "drill-down" + test "tooltip on hover" |
| AC-G3: Collection 着色 + private 半透明 | ✅ | SENSITIVITY_COLOR mapping + test "reduced opacity" |

### 测试结果

```
pnpm --filter @cat-cafe/web test  # 380 files, 2826 passed, 0 failed
tsc --noEmit                      # 0 errors
biome check                       # 0 errors on changed files
```

### 相关文档

- Feature: `docs/features/F186-library-memory-architecture.md`
- Plan: `docs/plans/2026-05-06-f186-phase-g-knowledge-graph-visualization.md`
