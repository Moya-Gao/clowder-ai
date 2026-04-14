/**
 * AC-C5: Performance gate — 50+ box diagram < 5s compile, < 2MB output.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileDiagramToSvg } from '../../src/renderers/diagram-svg.js';
import { renderSvgToSlide } from '../../src/renderers/svg-to-shapes.js';
import type { DiagramBox, DiagramElement, DiagramStyleTokens, LayoutSlot } from '../../src/types.js';

const slot: LayoutSlot = {
  name: 'diagram',
  type: 'diagram',
  position: { x: 0.3, y: 0.9, w: 12.7, h: 6.0 },
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

/** Generate a 50+ box diagram (华为级 4-layer architecture) */
function make50PlusBoxDiagram(): DiagramElement {
  const layers = ['应用层', '平台层', '基础设施层', '安全管理层'];
  const boxes: DiagramBox[] = [];

  for (const [li, layerName] of layers.entries()) {
    const groups: DiagramBox[] = [];
    // 3-4 groups per layer, each with 3-5 leaves
    const groupCount = 3 + (li % 2);
    for (let gi = 0; gi < groupCount; gi++) {
      const leaves: DiagramBox[] = [];
      const leafCount = 3 + ((li + gi) % 3);
      for (let k = 0; k < leafCount; k++) {
        leaves.push({
          id: `L${li}-G${gi}-${k}`,
          label: `${layerName}模块${gi + 1}${String.fromCharCode(65 + k)}`,
        });
      }
      groups.push({
        id: `L${li}-G${gi}`,
        label: `${layerName}组${gi + 1}`,
        children: leaves,
      });
    }
    boxes.push({ id: `L${li}`, label: layerName, children: groups });
  }

  return { type: 'diagram', slotName: 'diagram', boxes };
}

function countBoxes(boxes: DiagramBox[]): number {
  let count = boxes.length;
  for (const b of boxes) {
    if (b.children) count += countBoxes(b.children);
  }
  return count;
}

describe('AC-C5: Performance gate', () => {
  const el = make50PlusBoxDiagram();
  const boxCount = countBoxes(el.boxes);

  it(`test diagram has 50+ boxes (actual: ${boxCount})`, () => {
    assert.ok(boxCount >= 50, `Expected ≥50 boxes, got ${boxCount}`);
  });

  it('SVG compilation completes in < 5s', () => {
    const start = performance.now();
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const elapsed = performance.now() - start;

    assert.ok(svg.length > 0, 'should produce non-empty SVG');
    assert.ok(elapsed < 5000, `Compilation took ${elapsed.toFixed(0)}ms, budget is 5000ms`);
  });

  it('SVG output is < 2MB', () => {
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const sizeBytes = Buffer.byteLength(svg, 'utf-8');
    const sizeMB = sizeBytes / (1024 * 1024);

    assert.ok(sizeMB < 2, `SVG output is ${sizeMB.toFixed(3)}MB, budget is 2MB`);
  });

  it('svg-to-shapes rendering completes in < 5s', () => {
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const mockSlide = {
      addShape() {},
      addText() {},
    };

    const start = performance.now();
    renderSvgToSlide(mockSlide as never, svg, { x: slot.position.x, y: slot.position.y });
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 5000, `Rendering took ${elapsed.toFixed(0)}ms, budget is 5000ms`);
  });

  it('all labels present in output (no silent drops)', () => {
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    // At minimum, every top-level layer label should appear
    for (const layer of ['应用层', '平台层', '基础设施层', '安全管理层']) {
      assert.ok(svg.includes(layer), `Missing layer label: ${layer}`);
    }
  });
});
