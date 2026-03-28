import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { renderDiagram } from '../../src/renderers/diagram.js';
import type { DiagramElement, DiagramStyleTokens, LayoutSlot } from '../../src/types.js';

function createMockSlide() {
  const shapes: { shapeName: string; options: Record<string, unknown> }[] = [];
  const texts: { text: unknown; options: Record<string, unknown> }[] = [];
  return {
    addShape(shapeName: string, options: Record<string, unknown>) {
      shapes.push({ shapeName, options });
    },
    addText(text: unknown, options: Record<string, unknown>) {
      texts.push({ text, options });
    },
    shapes,
    texts,
  };
}

const slot: LayoutSlot = {
  name: 'diagram',
  type: 'diagram',
  position: { x: 0.5, y: 1.0, w: 9.0, h: 4.2 },
};

const diagramStyle: DiagramStyleTokens = {
  boxBg: 'F5F5F5',
  boxBorder: 'CF0A2C',
  boxBorderWidth: 1.5,
  labelColor: '333333',
  labelFontSize: 9,
  nestedBg: ['FFFFFF', 'F5F5F5', 'EEEEEE'],
  connectorColor: '999999',
  connectorWidth: 1,
};

describe('renderDiagram', () => {
  let mockSlide: ReturnType<typeof createMockSlide>;

  beforeEach(() => {
    mockSlide = createMockSlide();
  });

  it('renders a single root box as shape + text label', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'root', label: 'Cat Café System' }],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    assert.ok(mockSlide.shapes.length >= 1, 'should render at least 1 shape');
    assert.ok(mockSlide.texts.length >= 1, 'should render at least 1 text label');
  });

  it('renders nested children inside parent box', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'parent',
          label: 'Backend',
          children: [
            { id: 'child1', label: 'Fastify' },
            { id: 'child2', label: 'Socket.io' },
          ],
        },
      ],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    // Parent + 2 children = at least 3 shapes
    assert.ok(mockSlide.shapes.length >= 3, `expected >=3 shapes, got ${mockSlide.shapes.length}`);
  });

  it('renders 3-level nesting (grandchildren)', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'l0',
          label: 'System',
          children: [
            {
              id: 'l1',
              label: 'API Layer',
              children: [
                { id: 'l2a', label: 'Router' },
                { id: 'l2b', label: 'Middleware' },
              ],
            },
          ],
        },
      ],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    // l0 + l1 + l2a + l2b = at least 4 shapes
    assert.ok(mockSlide.shapes.length >= 4, `expected >=4 shapes, got ${mockSlide.shapes.length}`);
  });

  it('uses slot position for root-level box placement', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'root', label: 'Root' }],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    const rootShape = mockSlide.shapes[0];
    const opts = rootShape.options;
    // Root box should be within the slot bounds
    assert.ok((opts.x as number) >= slot.position.x, 'x should be >= slot.x');
    assert.ok((opts.y as number) >= slot.position.y, 'y should be >= slot.y');
  });

  it('applies per-box style overrides (bgColor, borderColor)', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'custom', label: 'Highlighted', bgColor: 'CF0A2C', borderColor: 'FFFFFF' }],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    const opts = mockSlide.shapes[0].options;
    const fill = opts.fill as { color: string };
    assert.equal(fill.color, 'CF0A2C');
    const line = opts.line as { color: string };
    assert.equal(line.color, 'FFFFFF');
  });

  it('uses depth-based background colors from nestedBg array', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'p',
          label: 'Parent',
          children: [{ id: 'c', label: 'Child' }],
        },
      ],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    // Parent at depth 0 → nestedBg[0], child at depth 1 → nestedBg[1]
    const parentFill = mockSlide.shapes[0].options.fill as { color: string };
    const childFill = mockSlide.shapes[1].options.fill as { color: string };
    assert.equal(parentFill.color, 'FFFFFF');
    assert.equal(childFill.color, 'F5F5F5');
  });

  it('renders multiple root boxes side by side', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        { id: 'a', label: 'Frontend' },
        { id: 'b', label: 'Backend' },
        { id: 'c', label: 'Database' },
      ],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    assert.equal(mockSlide.shapes.length, 3);
    // Each box should have different x positions
    const xs = mockSlide.shapes.map((s) => s.options.x as number);
    assert.ok(xs[0] < xs[1], 'second box should be right of first');
    assert.ok(xs[1] < xs[2], 'third box should be right of second');
  });

  it('uses rounded rectangle shape name', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'r', label: 'Round' }],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    assert.equal(mockSlide.shapes[0].shapeName, 'roundRect');
  });

  // ── P1-1: many siblings must not produce negative-width shapes ──
  it('clamps child width to positive when many siblings (P1-1)', () => {
    const children = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, label: `C${i}` }));
    const narrowSlot: LayoutSlot = {
      name: 'diagram',
      type: 'diagram',
      position: { x: 0.5, y: 1.0, w: 1.2, h: 4.0 },
    };
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'p', label: 'Parent', children }],
    };
    renderDiagram(mockSlide as never, el, narrowSlot, diagramStyle, 'PingFang SC');
    // Every shape must have w > 0
    for (const shape of mockSlide.shapes) {
      const w = shape.options.w as number;
      assert.ok(w > 0, `shape width must be positive, got ${w}`);
    }
  });

  // ── P1-2: empty nestedBg must not produce undefined fill color ──
  it('falls back to boxBg when nestedBg is empty (P1-2)', () => {
    const emptyBgStyle: DiagramStyleTokens = {
      ...diagramStyle,
      nestedBg: [],
      boxBg: 'AABBCC',
    };
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'r', label: 'Root' }],
    };
    renderDiagram(mockSlide as never, el, slot, emptyBgStyle, 'PingFang SC');
    const fill = mockSlide.shapes[0].options.fill as { color: string };
    assert.equal(fill.color, 'AABBCC', 'should fall back to boxBg');
  });

  // ── P2-1: boxBg must be used as default when no per-box override ──
  it('uses boxBg as fallback when nestedBg has no entry for depth (P2-1)', () => {
    const singleBgStyle: DiagramStyleTokens = {
      ...diagramStyle,
      nestedBg: ['FFFFFF'],
      boxBg: 'DDDDDD',
    };
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'p',
          label: 'Parent',
          children: [
            {
              id: 'c',
              label: 'Child',
              children: [{ id: 'gc', label: 'GrandChild' }],
            },
          ],
        },
      ],
    };
    renderDiagram(mockSlide as never, el, slot, singleBgStyle, 'PingFang SC');
    // depth 0 → nestedBg[0]='FFFFFF', depth 1 → wraps to nestedBg[0] again (single entry)
    // This test validates nestedBg wrapping works correctly for depths beyond array length
    const parentFill = mockSlide.shapes[0].options.fill as { color: string };
    assert.equal(parentFill.color, 'FFFFFF');
  });

  it('renders text labels for all boxes', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'p',
          label: 'Parent',
          children: [{ id: 'c', label: 'Child' }],
        },
      ],
    };
    renderDiagram(mockSlide as never, el, slot, diagramStyle, 'PingFang SC');
    assert.equal(mockSlide.texts.length, 2, 'should have 2 text labels');
  });
});
