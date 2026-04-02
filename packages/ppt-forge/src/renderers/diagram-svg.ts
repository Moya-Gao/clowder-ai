/**
 * SVG Diagram Compiler — Phase C rendering backend for diagram elements.
 *
 * Converts DiagramElement → deterministic SVG string with CJK-aware text layout.
 * The SVG uses inches as coordinate units (matching pptxgenjs), so svg-to-shapes
 * can read coordinates directly without unit conversion.
 */
import type { DiagramBox, DiagramElement, DiagramStyleTokens, LayoutSlot } from '../types.js';
import { compileLayeredGrid, isLayeredGrid } from './diagram-layered.js';

// ── CJK Text Measurement ──────────────────────────────────

const CJK_RANGES: [number, number][] = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Extension A
  [0x3000, 0x303f], // CJK Punctuation
  [0xff00, 0xffef], // Fullwidth Forms
  [0x2e80, 0x2eff], // CJK Radicals
];

function isCJK(code: number): boolean {
  return CJK_RANGES.some(([lo, hi]) => code >= lo && code <= hi);
}

/** Estimate text width in inches given font size in points. */
export function measureTextWidth(text: string, fontSizePt: number): number {
  const emInch = fontSizePt / 72;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (isCJK(code)) {
      width += emInch * 1.0;
    } else if (code === 0x20) {
      width += emInch * 0.3;
    } else {
      width += emInch * 0.55;
    }
  }
  return width;
}

/** Pick the largest font size (in pt) that fits `text` within `maxWidthInch`. */
function fitFontSize(text: string, maxWidthInch: number, basePt: number, minPt: number): number {
  let pt = basePt;
  while (pt > minPt && measureTextWidth(text, pt) > maxWidthInch) {
    pt -= 0.5;
  }
  return Math.max(pt, minPt);
}

// ── SVG Primitives ─────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface SvgRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Layout Constants (inches) ──────────────────────────────

// Depth-dependent spacing: tighter at deeper nesting to maximise leaf-node width for CJK
const PAD_BY_DEPTH = [0.08, 0.04, 0.015, 0.01];
const LABEL_H_BY_DEPTH = [0.22, 0.17, 0.13, 0.1];
const GAP_BY_DEPTH = [0.06, 0.03, 0.015, 0.01];
const MIN_FONT_PT = 4;

function depthVal(table: number[], depth: number): number {
  return table[Math.min(depth, table.length - 1)];
}

// ── Recursive SVG Box Compiler ─────────────────────────────

function leafWeight(box: DiagramBox): number {
  if (!box.children?.length) return 1;
  return box.children.reduce((s, c) => s + leafWeight(c), 0);
}

function resolveBoxBg(box: DiagramBox, depth: number, style: DiagramStyleTokens): string {
  if (box.bgColor) return box.bgColor;
  if (style.nestedBg.length === 0) return style.boxBg;
  return style.nestedBg[depth % style.nestedBg.length];
}

function compileBox(
  box: DiagramBox,
  rect: SvgRect,
  depth: number,
  style: DiagramStyleTokens,
  fontFace: string,
  lines: string[],
): void {
  const pad = depthVal(PAD_BY_DEPTH, depth);
  const labelH = depthVal(LABEL_H_BY_DEPTH, depth);
  const gap = depthVal(GAP_BY_DEPTH, depth);

  const bg = resolveBoxBg(box, depth, style);
  const border = box.borderColor ?? style.boxBorder;
  const baseFontPt = Math.max(MIN_FONT_PT, style.labelFontSize - depth);

  // Usable text width inside the box
  const textMaxW = rect.w - pad * 2;
  const fontPt = fitFontSize(box.label, textMaxW, baseFontPt, MIN_FONT_PT);
  const fontInch = fontPt / 72;

  // Box rect
  lines.push(
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" ` +
      `fill="#${bg}" stroke="#${border}" stroke-width="${style.boxBorderWidth / 72}" />`,
  );

  // Label text — vertically centered in labelH zone
  const textX = rect.x + pad;
  const textY = rect.y + pad * 0.5 + labelH * 0.65;
  const align = box.children?.length ? 'start' : 'middle';
  const anchorX = box.children?.length ? textX : rect.x + rect.w / 2;
  const textW = rect.w - pad * 2;

  lines.push(
    `<text x="${anchorX}" y="${textY}" data-w="${textW.toFixed(3)}" ` +
      `font-family="${escapeXml(fontFace)}, sans-serif" font-size="${fontInch}" ` +
      `fill="#${style.labelColor}" font-weight="bold" text-anchor="${align}"` +
      `>${escapeXml(box.label)}</text>`,
  );

  // Recurse into children
  if (box.children?.length) {
    const childY = rect.y + labelH + pad * 0.3;
    const childH = Math.max(0.15, rect.h - labelH - pad * 1.0);
    const totalWeight = box.children.reduce((s, c) => s + leafWeight(c), 0);
    const availableW = rect.w - pad * 2;
    const idealGap = gap * (box.children.length - 1);
    const maxGapBudget = availableW * 0.25;
    const actualTotalGap = Math.min(idealGap, maxGapBudget);
    const actualGap = box.children.length > 1 ? actualTotalGap / (box.children.length - 1) : 0;
    const usableW = Math.max(availableW - actualTotalGap, availableW * 0.75);

    let curX = rect.x + pad;
    for (const child of box.children) {
      const w = (leafWeight(child) / totalWeight) * usableW;
      compileBox(child, { x: curX, y: childY, w, h: childH }, depth + 1, style, fontFace, lines);
      curX += w + actualGap;
    }
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Compile a DiagramElement into an SVG string.
 * Coordinates are in inches (matching pptxgenjs slot positions).
 * The SVG viewBox covers the slot area; svg-to-shapes adds the slot offset.
 */
export function compileDiagramToSvg(
  element: DiagramElement,
  slot: LayoutSlot,
  style: DiagramStyleTokens,
  fontFace: string,
): string {
  const { w, h } = slot.position;
  const boxes = element.boxes;
  if (boxes.length === 0) return '';

  // Huawei-style layered grid for multi-row architecture diagrams
  // Unwrap single wrapper root (e.g., "System Architecture" → children are the real rows)
  const gridCandidates = boxes.length === 1 && boxes[0].children?.length ? boxes[0].children : boxes;
  if (isLayeredGrid(gridCandidates)) {
    return compileLayeredGrid(gridCandidates, w, h, style, fontFace);
  }

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`);

  if (boxes.length === 1) {
    compileBox(boxes[0], { x: 0, y: 0, w, h }, 0, style, fontFace, lines);
  } else {
    const totalWeight = boxes.reduce((s, b) => s + leafWeight(b), 0);
    const idealGap = GAP_BY_DEPTH[0] * (boxes.length - 1);
    const maxGapBudget = w * 0.25;
    const actualTotalGap = Math.min(idealGap, maxGapBudget);
    const actualGap = boxes.length > 1 ? actualTotalGap / (boxes.length - 1) : 0;
    const usableW = Math.max(w - actualTotalGap, w * 0.75);

    let curX = 0;
    for (const box of boxes) {
      const bw = (leafWeight(box) / totalWeight) * usableW;
      compileBox(box, { x: curX, y: 0, w: bw, h }, 0, style, fontFace, lines);
      curX += bw + actualGap;
    }
  }

  lines.push('</svg>');
  return lines.join('\n');
}
