---
feature_id: F186
doc_kind: implementation-plan
phase: G
created: 2026-05-06
status: draft
topics: [library-memory, knowledge-graph, visualization]
---

# F186 Phase G: Knowledge Graph Visualization — Implementation Plan

**Feature:** F186 — `docs/features/F186-library-memory-architecture.md`
**Goal:** Upgrade the existing Graph tab from static circular SVG to a GBrain-style force-directed interactive knowledge graph
**Acceptance Criteria:**
- AC-G1: Hub Memory 面板 Graph tab 渲染力导向图（节点=anchor, 边=typed edge）
- AC-G2: 点击节点展开子图（drill-down depth+1），hover 显示 anchor 详情（title/collection/sensitivity）
- AC-G3: 节点颜色按 Collection 区分；private 节点半透明+锁图标；边标签显示关系类型
**Architecture:** Replace the static circular `layoutNodes()` in CollectionGraph.tsx with a d3-force simulation. Keep SVG rendering (already exists). Add a tooltip component for hover details and drag handlers for node interaction.
**Tech Stack:** d3-force (simulation only, ~15KB), React hooks for simulation loop, existing SVG/Tailwind
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## What we're NOT building

- No zoom/pan (YAGNI for initial graph sizes)
- No 3D rendering
- No separate graph page — stays as existing Graph tab in MemoryHub
- No new API endpoints — `/api/library/graph` already returns everything needed

## Terminal Schema

The existing `GraphResult` / `GraphNode` / `GraphEdge` interfaces stay unchanged. The only new type:

```typescript
interface SimNode extends GraphNode {
  x: number;
  y: number;
  fx?: number | null;  // fixed position for drag
  fy?: number | null;
}
```

---

### Task 1: Add d3-force dependency

**Files:**
- Modify: `packages/web/package.json`

**Step 1:** Install d3-force + types

```bash
cd packages/web && pnpm add d3-force && pnpm add -D @types/d3-force
```

**Step 2:** Verify install

```bash
pnpm ls d3-force
```

**Step 3: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "deps(web): add d3-force for knowledge graph visualization"
```

---

### Task 2: Write failing test for force-directed graph rendering

**Files:**
- Create: `packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx`

**Step 1: Write the failing test**

Test that the graph renders nodes as circles positioned by force simulation (not fixed circular layout), that hover shows tooltip, and that clicking a node triggers navigation.

```typescript
import { render, screen, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { CollectionGraph } from '../CollectionGraph';

const mockGraph = {
  nodes: [
    { anchor: 'a1', collectionId: 'project:cafe', sensitivity: 'internal', kind: 'spec', title: 'Memory Arch', redacted: false },
    { anchor: 'a2', collectionId: 'world:lexander', sensitivity: 'private', kind: 'lore', title: 'Dragon Lore', redacted: true },
    { anchor: 'a3', collectionId: 'project:cafe', sensitivity: 'internal', kind: 'decision', title: 'ADR-033', redacted: false },
  ],
  edges: [
    { from: 'a1', to: 'a2', relation: 'related_to', crossCollection: true, edgeSensitivity: 'private', provenance: 'frontmatter', redacted: false },
    { from: 'a1', to: 'a3', relation: 'evolved_from', crossCollection: false, edgeSensitivity: 'internal', provenance: 'frontmatter', redacted: false },
  ],
  center: 'a1',
  depth: 1,
};

const server = setupServer(
  http.get('/api/library/graph', () => HttpResponse.json(mockGraph)),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CollectionGraph', () => {
  it('renders force-directed graph with nodes after fetch', async () => {
    render(<CollectionGraph />);
    const input = screen.getByTestId('graph-anchor-input');
    const btn = screen.getByTestId('graph-fetch-btn');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a1' } });
      fireEvent.click(btn);
    });
    // Wait for graph to render
    const svg = await screen.findByTestId('graph-svg');
    expect(svg).toBeTruthy();
    // All 3 nodes should be rendered
    expect(screen.getByTestId('graph-node-a1')).toBeTruthy();
    expect(screen.getByTestId('graph-node-a2')).toBeTruthy();
    expect(screen.getByTestId('graph-node-a3')).toBeTruthy();
  });

  it('shows tooltip on hover with node details', async () => {
    render(<CollectionGraph />);
    const input = screen.getByTestId('graph-anchor-input');
    const btn = screen.getByTestId('graph-fetch-btn');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a1' } });
      fireEvent.click(btn);
    });
    await screen.findByTestId('graph-svg');
    const node = screen.getByTestId('graph-node-a1');
    fireEvent.mouseEnter(node);
    const tooltip = screen.getByTestId('graph-tooltip');
    expect(tooltip.textContent).toContain('Memory Arch');
    expect(tooltip.textContent).toContain('project:cafe');
    expect(tooltip.textContent).toContain('internal');
  });

  it('renders private nodes with reduced opacity and lock', async () => {
    render(<CollectionGraph />);
    const input = screen.getByTestId('graph-anchor-input');
    const btn = screen.getByTestId('graph-fetch-btn');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a1' } });
      fireEvent.click(btn);
    });
    await screen.findByTestId('graph-svg');
    const privateNode = screen.getByTestId('graph-node-a2');
    expect(privateNode.getAttribute('opacity')).toBe('0.5');
  });

  it('navigates on node click (drill-down)', async () => {
    let fetchCount = 0;
    server.use(
      http.get('/api/library/graph', () => {
        fetchCount++;
        return HttpResponse.json(mockGraph);
      }),
    );
    render(<CollectionGraph />);
    const input = screen.getByTestId('graph-anchor-input');
    const btn = screen.getByTestId('graph-fetch-btn');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a1' } });
      fireEvent.click(btn);
    });
    await screen.findByTestId('graph-svg');
    await act(async () => {
      fireEvent.click(screen.getByTestId('graph-node-a3'));
    });
    // Should have fetched twice: initial + drill-down
    expect(fetchCount).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @cat-cafe/web test -- --run src/components/memory/__tests__/CollectionGraph.test.tsx
```

Expected: FAIL (current implementation lacks tooltip, opacity on private nodes)

---

### Task 3: Implement force-directed CollectionGraph

**Files:**
- Modify: `packages/web/src/components/memory/CollectionGraph.tsx`

**Step 1: Rewrite CollectionGraph with force simulation**

Replace the static `layoutNodes()` with a `useForceSimulation` hook using d3-force. Add hover tooltip, drag handlers, private node opacity.

Key changes:
1. Import `forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide` from d3-force
2. Create `SimNode` type extending `GraphNode` with `x/y/fx/fy`
3. `useEffect` to run simulation on graph data change, update positions via `useState`
4. Add `onMouseEnter/onMouseLeave` on node `<g>` for tooltip
5. Add `onMouseDown` + drag handlers for node dragging (set `fx/fy`)
6. Private/redacted nodes get `opacity={0.5}` on the `<g>` wrapper
7. Add tooltip `<div>` positioned absolutely near hovered node

**Step 2: Run tests to verify GREEN**

```bash
pnpm --filter @cat-cafe/web test -- --run src/components/memory/__tests__/CollectionGraph.test.tsx
```

Expected: PASS

**Step 3: Run full web test suite for regression**

```bash
pnpm --filter @cat-cafe/web test -- --run
```

Expected: all pass

**Step 4: Commit**

```bash
git add packages/web/src/components/memory/CollectionGraph.tsx packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx
git commit -m "feat(F186): force-directed knowledge graph visualization (Phase G)"
```

---

### Task 4: Visual verification in browser

**Step 1:** Start dev server in worktree

```bash
pnpm dev:direct
```

**Step 2:** Open Hub → Memory → Graph tab

**Step 3:** Enter an anchor, verify:
- Nodes spread out with force-directed layout (not static circle)
- Hover shows tooltip with title/collection/sensitivity
- Click navigates to new center
- Private nodes are semi-transparent with lock
- Edge labels show relation type
- Colors match collection

**Step 4:** Screenshot for review evidence

**Step 5: Commit any visual polish if needed**
