import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileDiagramToSvg, measureTextWidth } from '../../src/renderers/diagram-svg.js';
import { renderSvgToSlide } from '../../src/renderers/svg-to-shapes.js';
import type { DiagramElement, DiagramStyleTokens, LayoutSlot } from '../../src/types.js';

const slot: LayoutSlot = {
  name: 'diagram',
  type: 'diagram',
  position: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 },
};

const style: DiagramStyleTokens = {
  boxBg: 'F5F5F5',
  boxBorder: 'D4D4D4',
  boxBorderWidth: 1.5,
  labelColor: '333333',
  labelFontSize: 9,
  nestedBg: ['FFFFFF', 'F5F5F5', 'EEEEEE'],
  connectorColor: '999999',
  connectorWidth: 1,
  highlightBorder: 'C7020E',
};

// ── measureTextWidth ───────────────────────────────────────

describe('measureTextWidth', () => {
  it('measures CJK text wider than Latin text at same font size', () => {
    const cjk = measureTextWidth('架构设计', 12);
    const latin = measureTextWidth('arch', 12);
    assert.ok(cjk > latin, `CJK (${cjk}) should be wider than Latin (${latin})`);
  });

  it('returns 0 for empty string', () => {
    assert.equal(measureTextWidth('', 12), 0);
  });

  it('CJK 4 chars at 9pt ≈ 0.5 inches', () => {
    const w = measureTextWidth('架构设计', 9);
    assert.ok(w > 0.4 && w < 0.6, `Expected ~0.5, got ${w}`);
  });
});

// ── compileDiagramToSvg ────────────────────────────────────

describe('compileDiagramToSvg', () => {
  it('returns empty string for empty boxes', () => {
    const el: DiagramElement = { type: 'diagram', slotName: 'diagram', boxes: [] };
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    assert.equal(svg, '');
  });

  it('produces valid SVG with viewBox for single root box', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [{ id: 'root', label: 'Cat Café 系统' }],
    };
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    assert.ok(svg.includes('<svg'), 'should contain <svg');
    assert.ok(svg.includes('viewBox="0 0 9.4 4.4"'), 'viewBox matches slot');
    assert.ok(svg.includes('</svg>'), 'should close svg');
    assert.ok(svg.includes('<rect'), 'should have rect');
    assert.ok(svg.includes('Cat Caf'), 'should have label text');
  });

  it('renders nested children with separate rects and labels', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'parent',
          label: '后端架构',
          children: [
            { id: 'c1', label: 'Fastify' },
            { id: 'c2', label: 'Socket.io' },
          ],
        },
      ],
    };
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const rects = (svg.match(/<rect /g) ?? []).length;
    const texts = (svg.match(/<text /g) ?? []).length;
    assert.ok(rects >= 3, `Expected ≥3 rects (parent+2 children), got ${rects}`);
    assert.ok(texts >= 3, `Expected ≥3 texts, got ${texts}`);
  });

  it('handles 3-layer deep nesting (the CJK killer case)', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'judgment',
          label: '对等判断层',
          children: [
            {
              id: 'claude',
              label: '布偶猫 Claude',
              children: [
                { id: 'c1', label: '架构设计' },
                { id: 'c2', label: '后端开发' },
                { id: 'c3', label: 'MCP 集成' },
              ],
            },
            {
              id: 'gpt',
              label: '缅因猫 GPT',
              children: [
                { id: 'g1', label: 'Review' },
                { id: 'g2', label: '安全审计' },
                { id: 'g3', label: '测试覆盖' },
              ],
            },
          ],
        },
        {
          id: 'exec',
          label: '结构化执行层',
          children: [
            {
              id: 'dispatch',
              label: '统一调度',
              children: [
                { id: 'd1', label: 'InvocationQueue' },
                { id: 'd2', label: 'Slot 并发' },
              ],
            },
            {
              id: 'session',
              label: 'Session Strategy',
              children: [
                { id: 's1', label: 'handoff 交接' },
                { id: 's2', label: 'compress 压缩' },
              ],
            },
          ],
        },
      ],
    };
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');

    // All leaf labels should appear in the SVG
    for (const label of ['架构设计', '后端开发', 'MCP 集成', 'Review', '安全审计', 'InvocationQueue', 'handoff 交接']) {
      assert.ok(svg.includes(label), `Missing label: ${label}`);
    }

    // Nav bars and accent bars must use highlightBorder (Huawei red), NOT boxBorder (gray)
    assert.ok(svg.includes('fill="#C7020E"'), 'nav bars should use highlightBorder red C7020E');
    // Regression guard: if code mistakenly reads boxBorder (D4D4D4), nav bars turn gray
    const navFills = [...svg.matchAll(/<rect[^>]+width="0\.55"[^>]+fill="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(navFills.length > 0, 'should have nav bar rects (width=0.55)');
    for (const f of navFills) {
      assert.ok(f !== '#D4D4D4', `nav bar fill must not be boxBorder gray, got ${f}`);
    }

    // Card/container rects should be reasonably wide (decorative accents like 4px bars can be thin)
    const rectWidths = [...svg.matchAll(/(?<!-)width="([^"]+)"/g)].map((m) => Number.parseFloat(m[1]));
    const cardWidths = rectWidths.filter((rw) => rw > 0.1);
    assert.ok(cardWidths.length >= 4, `Should have at least 4 card-sized rects, got ${cardWidths.length}`);
    for (const cw of cardWidths) {
      assert.ok(cw > 0.5, `Card rect ${cw}" too narrow for CJK readability`);
    }
  });

  it('unwraps single wrapper root and routes to layered grid', () => {
    // Regression: boxes=[singleRoot(children=rows)] must still produce layered layout
    const el = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'wrapper',
          label: 'System Architecture',
          children: [
            {
              id: 'layer1',
              label: 'Layer A',
              children: [
                { id: 'a1', label: 'Card 1', children: [{ id: 'l1', label: 'Leaf' }] },
                { id: 'a2', label: 'Card 2', children: [{ id: 'l2', label: 'Leaf' }] },
              ],
            },
            {
              id: 'layer2',
              label: 'Layer B',
              children: [
                { id: 'b1', label: 'Card 3', children: [{ id: 'l3', label: 'Leaf' }] },
                { id: 'b2', label: 'Card 4', children: [{ id: 'l4', label: 'Leaf' }] },
              ],
            },
          ],
        },
      ],
    };
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    // Layered layout marker: nav bar text for layer labels
    assert.ok(svg.includes('Layer A'), 'should contain layer A label');
    assert.ok(svg.includes('Layer B'), 'should contain layer B label');
    // Should NOT contain the wrapper root label as a visible nav bar
    // (wrapper is unwrapped, not rendered)
    assert.ok(!svg.includes('System Architecture'), 'wrapper root should be unwrapped, not rendered');
    // All leaf labels present via bullet items
    assert.ok(svg.includes('Card 1'), 'should contain Card 1');
    assert.ok(svg.includes('Card 4'), 'should contain Card 4');
  });
});

// ── svg-to-shapes (renderSvgToSlide) ───────────────────────

describe('renderSvgToSlide', () => {
  function createMockSlide() {
    const shapes: { name: string; opts: Record<string, unknown> }[] = [];
    const texts: { text: unknown; opts: Record<string, unknown> }[] = [];
    return {
      addShape(name: string, opts: Record<string, unknown>) {
        shapes.push({ name, opts });
      },
      addText(text: unknown, opts: Record<string, unknown>) {
        texts.push({ text, opts });
      },
      shapes,
      texts,
    };
  }

  it('converts SVG rects and texts to pptxgenjs calls with offset', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.4 4.4">
<rect x="0" y="0" width="9.4" height="4.4" fill="#F5F5F5" stroke="#CF0A2C" stroke-width="0.02" />
<text x="4.7" y="0.2" font-family="Noto Sans SC, sans-serif" font-size="0.125" fill="#333333" font-weight="bold" text-anchor="middle">Root Box</text>
</svg>`;

    const mock = createMockSlide();
    renderSvgToSlide(mock as never, svg, { x: 0.3, y: 0.9 });

    assert.equal(mock.shapes.length, 1, 'should render 1 shape');
    assert.equal(mock.texts.length, 1, 'should render 1 text');

    // Check offset is applied
    const shape = mock.shapes[0].opts;
    assert.equal(shape.x, 0.3); // 0 + 0.3
    assert.equal(shape.y, 0.9); // 0 + 0.9
    assert.equal(shape.w, 9.4);
  });

  it('end-to-end: compile + render produces valid pptxgenjs calls', () => {
    const el: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'root',
          label: '多猫协作架构',
          children: [
            { id: 'a', label: '对等判断' },
            { id: 'b', label: '结构化执行' },
          ],
        },
      ],
    };

    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const mock = createMockSlide();
    renderSvgToSlide(mock as never, svg, { x: slot.position.x, y: slot.position.y });

    assert.ok(mock.shapes.length >= 3, `Expected ≥3 shapes, got ${mock.shapes.length}`);
    assert.ok(mock.texts.length >= 3, `Expected ≥3 texts, got ${mock.texts.length}`);

    // All shapes should have positive dimensions
    for (const s of mock.shapes) {
      assert.ok((s.opts.w as number) > 0, 'shape width > 0');
      assert.ok((s.opts.h as number) > 0, 'shape height > 0');
    }
  });
});
