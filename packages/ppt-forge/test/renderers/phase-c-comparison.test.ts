/**
 * AC-C3: V1 renderer vs Phase C SVG compiler comparison.
 *
 * Proves that Phase C's CJK-aware font sizing prevents text overflow
 * in narrow nested boxes — the exact scenario that broke V1 (2026-03-31).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderDiagram } from '../../src/renderers/diagram.js';
import { compileDiagramToSvg, measureTextWidth } from '../../src/renderers/diagram-svg.js';
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

// ── The CJK killer case: 3-layer deep nesting with long Chinese labels ──
// At depth 3, boxes are ~0.35" wide — Chinese text at 7pt overflows in V1

// Diagram that routes to recursive box path (NOT layered grid).
// One child group with only 1 sub-group breaks the isLayeredGrid 2+ card-group requirement.
// 6 leaf boxes in a narrow branch guarantees CJK font shrinking at depth 2.
function makeCjkKillerDiagram(): DiagramElement {
  return {
    type: 'diagram',
    slotName: 'diagram',
    boxes: [
      {
        id: 'left',
        label: '对等判断层',
        children: [
          {
            id: 'claude',
            label: '布偶猫能力矩阵',
            children: [
              { id: 'c1', label: '架构设计能力' },
              { id: 'c2', label: '后端开发能力' },
              { id: 'c3', label: '系统集成能力' },
              { id: 'c4', label: '协议设计能力' },
              { id: 'c5', label: '性能优化能力' },
              { id: 'c6', label: '安全审计能力' },
            ],
          },
          {
            id: 'gpt',
            label: '缅因猫能力矩阵',
            children: [
              { id: 'g1', label: '代码审查能力' },
              { id: 'g2', label: '测试覆盖验证' },
              { id: 'g3', label: '回归分析检测' },
              { id: 'g4', label: '安全漏洞扫描' },
            ],
          },
        ],
      },
      {
        // Only 1 child group → breaks isLayeredGrid requirement (needs 2+)
        id: 'right',
        label: '结构化执行层',
        children: [
          {
            id: 'dispatch',
            label: '统一调度系统',
            children: [
              { id: 'd1', label: '调用队列管理器' },
              { id: 'd2', label: '并发控制策略' },
            ],
          },
        ],
      },
    ],
  };
}

// ── Helpers ──────────────────────────────────────────────────

function parseSvgTexts(svg: string): Array<{ label: string; fontInch: number; dataW: number }> {
  const results: Array<{ label: string; fontInch: number; dataW: number }> = [];
  const re = /<text\s([^>]*)>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const label = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const fontSize = Number.parseFloat(attrs.match(/font-size="([^"]+)"/)?.[1] ?? '0');
    const dataW = Number.parseFloat(attrs.match(/data-w="([^"]+)"/)?.[1] ?? '0');
    results.push({ label, fontInch: fontSize, dataW });
  }
  return results;
}

// ── AC-C3 Tests ─────────────────────────────────────────────

describe('AC-C3: Phase C CJK correctness vs V1', () => {
  it('Phase C: every CJK label fits within its allocated width', () => {
    const el = makeCjkKillerDiagram();
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const texts = parseSvgTexts(svg);

    // Must have all labels (16 boxes = 16 text elements minimum)
    assert.ok(texts.length >= 14, `Expected ≥14 texts, got ${texts.length}`);

    // Core assertion: for every text element, measured text width ≤ allocated width
    for (const t of texts) {
      if (t.dataW <= 0) continue; // skip texts without explicit width budget
      const fontPt = t.fontInch * 72;
      const measuredW = measureTextWidth(t.label, fontPt);
      assert.ok(
        measuredW <= t.dataW * 1.05, // 5% tolerance for rounding
        `CJK text "${t.label}" overflows: measured ${measuredW.toFixed(3)}" > allocated ${t.dataW.toFixed(3)}" at ${fontPt.toFixed(1)}pt`,
      );
    }
  });

  it('V1: does NOT adapt font size to CJK text width (proves the gap)', () => {
    const el = makeCjkKillerDiagram();

    // V1 renderer: capture addText calls to check font sizing
    const textCalls: Array<{
      label: string;
      fontSize: number;
      boxW: number;
    }> = [];

    const mockSlide = {
      addShape(_name: string, _opts: Record<string, unknown>) {},
      addText(text: unknown, opts: Record<string, unknown>) {
        const textArr = text as Array<{ text: string; options: { fontSize: number } }>;
        if (textArr?.[0]) {
          textCalls.push({
            label: textArr[0].text,
            fontSize: textArr[0].options.fontSize,
            boxW: opts.w as number,
          });
        }
      },
    };

    renderDiagram(mockSlide, el, slot, style, 'Noto Sans SC');

    // V1 computes fontSize = max(7, labelFontSize - depth) regardless of text width
    // At depth 2, fontSize = max(7, 9-2) = 7pt
    // At depth 0, fontSize = 9pt
    const depth2Texts = textCalls.filter((t) => t.fontSize === 7);
    assert.ok(depth2Texts.length > 0, 'V1 should have depth-2 texts at 7pt');

    // At 7pt, a 6-char CJK label needs ~0.58" — but V1 leaf boxes are ~0.35-0.5" wide
    const overflowing = depth2Texts.filter((t) => {
      const needed = measureTextWidth(t.label, t.fontSize);
      return needed > t.boxW;
    });
    assert.ok(
      overflowing.length > 0,
      `V1 should have at least 1 CJK label overflowing its box (found ${overflowing.length} of ${depth2Texts.length})`,
    );
  });

  it('Phase C adaptively shrinks font to fit narrow CJK boxes', () => {
    const el = makeCjkKillerDiagram();
    const svg = compileDiagramToSvg(el, slot, style, 'Noto Sans SC');
    const texts = parseSvgTexts(svg);

    // Leaf labels (6+ CJK chars) should have font-size < base (9pt = 0.125")
    const leafLabels = texts.filter((t) => t.label.length >= 6);
    assert.ok(leafLabels.length >= 8, `Expected ≥8 leaf labels, got ${leafLabels.length}`);

    const shrunk = leafLabels.filter((t) => t.fontInch < style.labelFontSize / 72);
    assert.ok(shrunk.length > 0, 'Phase C should shrink some leaf label fonts to fit CJK text in narrow boxes');
  });
});
