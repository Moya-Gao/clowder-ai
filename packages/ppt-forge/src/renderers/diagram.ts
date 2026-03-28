import type { DiagramBox, DiagramElement, DiagramStyleTokens, LayoutSlot } from '../types.js';

interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PptxSlideForDiagram {
  addShape(shapeName: string, options: Record<string, unknown>): void;
  addText(text: unknown, options: Record<string, unknown>): void;
}

const PADDING = 0.12;
const LABEL_HEIGHT = 0.25;
const GAP = 0.1;

/** Resolve background color for a box at a given nesting depth */
function resolveBoxBg(box: DiagramBox, depth: number, style: DiagramStyleTokens): string {
  if (box.bgColor) return box.bgColor;
  if (style.nestedBg.length === 0) return style.boxBg;
  return style.nestedBg[depth % style.nestedBg.length];
}

/** Count the total leaf weight of a box tree (for proportional width allocation) */
function leafWeight(box: DiagramBox): number {
  if (!box.children || box.children.length === 0) return 1;
  return box.children.reduce((sum, c) => sum + leafWeight(c), 0);
}

/** Recursively render a box and its children */
function renderBox(
  slide: PptxSlideForDiagram,
  box: DiagramBox,
  rect: BoxRect,
  depth: number,
  style: DiagramStyleTokens,
  fontFace: string,
): void {
  const bgColor = resolveBoxBg(box, depth, style);
  const borderColor = box.borderColor ?? style.boxBorder;

  // Draw the box shape
  slide.addShape('roundRect', {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    fill: { color: bgColor },
    line: { color: borderColor, width: style.boxBorderWidth },
    rectRadius: 0.05,
  });

  // Draw the label at the top of the box
  const labelFontSize = Math.max(7, style.labelFontSize - depth);
  slide.addText(
    [{ text: box.label, options: { fontFace, fontSize: labelFontSize, color: style.labelColor, bold: true } }],
    {
      x: rect.x + PADDING * 0.5,
      y: rect.y + PADDING * 0.3,
      w: rect.w - PADDING,
      h: LABEL_HEIGHT,
      align: box.children && box.children.length > 0 ? 'left' : 'center',
      valign: 'middle',
      margin: 0,
    },
  );

  // Recursively render children
  if (box.children && box.children.length > 0) {
    const childY = rect.y + LABEL_HEIGHT + PADDING * 0.5;
    const childH = Math.max(0.2, rect.h - LABEL_HEIGHT - PADDING * 1.2);
    const totalWeight = box.children.reduce((s, c) => s + leafWeight(c), 0);
    const availableW = rect.w - PADDING * 2;
    // Adaptive gap: shrink when siblings would cause negative usable width
    const idealTotalGap = GAP * (box.children.length - 1);
    const maxGapBudget = availableW * 0.3; // gaps never exceed 30% of available width
    const actualTotalGap = Math.min(idealTotalGap, maxGapBudget);
    const actualGap = box.children.length > 1 ? actualTotalGap / (box.children.length - 1) : 0;
    const usableW = Math.max(availableW - actualTotalGap, availableW * 0.7);

    let curX = rect.x + PADDING;
    for (const child of box.children) {
      const w = (leafWeight(child) / totalWeight) * usableW;
      renderBox(slide, child, { x: curX, y: childY, w, h: childH }, depth + 1, style, fontFace);
      curX += w + actualGap;
    }
  }
}

/**
 * Render a DiagramElement onto a pptxgenjs slide.
 * Draws nested boxes using addShape('roundRect') + addText labels.
 * Supports up to 3+ levels of nesting with depth-based coloring.
 */
export function renderDiagram(
  slide: PptxSlideForDiagram,
  element: DiagramElement,
  slot: LayoutSlot,
  style: DiagramStyleTokens,
  fontFace: string,
): void {
  const { x, y, w, h } = slot.position;
  const boxes = element.boxes;

  if (boxes.length === 0) return;

  if (boxes.length === 1) {
    // Single root — fill the entire slot
    renderBox(slide, boxes[0], { x, y, w, h }, 0, style, fontFace);
    return;
  }

  // Multiple root boxes — lay out side by side with proportional widths
  const totalWeight = boxes.reduce((s, b) => s + leafWeight(b), 0);
  const idealTotalGap = GAP * (boxes.length - 1);
  const maxGapBudget = w * 0.3;
  const actualTotalGap = Math.min(idealTotalGap, maxGapBudget);
  const actualGap = boxes.length > 1 ? actualTotalGap / (boxes.length - 1) : 0;
  const usableW = Math.max(w - actualTotalGap, w * 0.7);

  let curX = x;
  for (const box of boxes) {
    const bw = (leafWeight(box) / totalWeight) * usableW;
    renderBox(slide, box, { x: curX, y, w: bw, h }, 0, style, fontFace);
    curX += bw + actualGap;
  }
}
