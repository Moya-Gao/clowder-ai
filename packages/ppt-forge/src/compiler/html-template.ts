/**
 * F144 Phase B — HTML Template Engine
 *
 * Converts a SlideSpec + ThemeTokens into an HTML string with:
 * - 1280×720 fixed viewport container
 * - Elements positioned via slot coordinates (inches → px)
 * - data-ppt-role attributes for DOM Semantic Compiler
 * - Theme CSS custom properties
 */

import { getLayout, getSlot } from '../layouts.js';
import type {
  ChartElement,
  DiagramBox,
  DiagramElement,
  DiagramStyleTokens,
  KPIElement,
  LayoutSlot,
  SlideElement,
  SlideSpec,
  TableElement,
  TextElement,
  ThemeTokens,
} from '../types.js';
import { PX_PER_INCH } from './types.js';

function slotToPx(slot: LayoutSlot): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.round(slot.position.x * PX_PER_INCH),
    top: Math.round(slot.position.y * PX_PER_INCH),
    width: Math.round(slot.position.w * PX_PER_INCH),
    height: Math.round(slot.position.h * PX_PER_INCH),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTextEl(el: TextElement, slot: LayoutSlot, theme: ThemeTokens): string {
  const px = slotToPx(slot);
  const fontSize = el.fontSize ?? 14;
  const fontWeight = el.fontWeight === 'bold' ? '700' : '400';
  const textAlign = el.align ?? 'left';
  const color = theme.brand.colors.text.primary;
  return `<div data-ppt-role="text" data-slot-name="${escapeHtml(el.slotName)}"
     style="position: absolute; left: ${px.left}px; top: ${px.top}px; width: ${px.width}px; height: ${px.height}px;
            font-size: ${fontSize}px; font-weight: ${fontWeight}; text-align: ${textAlign};
            color: #${color}; font-family: '${theme.brand.typography.cjkFont}', ${theme.brand.typography.fallback.cjkFont};
            overflow: hidden; box-sizing: border-box; padding: 4px;">
    ${escapeHtml(el.content)}
  </div>`;
}

function renderTableEl(el: TableElement, slot: LayoutSlot, theme: ThemeTokens): string {
  const px = slotToPx(slot);
  const t = theme.slide.table;
  const headerCells = el.headers
    .map(
      (h) =>
        `<th style="background: #${t.headerBg}; color: #${t.headerColor}; padding: 4px 8px; text-align: left; border: 1px solid #${t.borderColor};">${escapeHtml(h)}</th>`,
    )
    .join('');

  const bodyRows = el.rows
    .map((row, ri) => {
      const bg = ri % 2 === 0 ? t.rowBg : t.rowAltBg;
      const cells = row.cells
        .map((c) => {
          const cellBg = c.bgColor ? `background: #${c.bgColor};` : `background: #${bg};`;
          const cellColor = c.fontColor ? `color: #${c.fontColor};` : `color: #${t.rowColor};`;
          const bold = c.fontBold ? 'font-weight: 700;' : '';
          return `<td style="${cellBg} ${cellColor} ${bold} padding: 4px 8px; border: 1px solid #${t.borderColor};">${escapeHtml(c.text)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<div data-ppt-role="table" data-slot-name="${escapeHtml(el.slotName)}"
     style="position: absolute; left: ${px.left}px; top: ${px.top}px; width: ${px.width}px; height: ${px.height}px;
            overflow: hidden; box-sizing: border-box;">
    <table style="width: 100%; border-collapse: collapse; font-size: 10px;
                  font-family: '${theme.brand.typography.cjkFont}', ${theme.brand.typography.fallback.cjkFont};">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>`;
}

function renderChartEl(el: ChartElement, slot: LayoutSlot, theme: ThemeTokens): string {
  const px = slotToPx(slot);
  const dataJson = escapeHtml(JSON.stringify(el.data));
  return `<div data-ppt-role="chart" data-slot-name="${escapeHtml(el.slotName)}"
     data-chart-type="${el.chartType}" data-chart-data="${dataJson}"
     style="position: absolute; left: ${px.left}px; top: ${px.top}px; width: ${px.width}px; height: ${px.height}px;
            background: #${theme.slide.chart.bgColor}; border: 1px dashed #${theme.slide.chart.gridColor};
            display: flex; align-items: center; justify-content: center;
            font-family: '${theme.brand.typography.cjkFont}', ${theme.brand.typography.fallback.cjkFont};
            color: #${theme.brand.colors.text.muted}; font-size: 12px;">
    [Chart: ${el.chartType}]
  </div>`;
}

function renderKpiEl(el: KPIElement, slot: LayoutSlot, theme: ThemeTokens): string {
  const px = slotToPx(slot);
  const k = theme.slide.kpi;
  const trendColor = el.trend === 'up' ? k.trendUp : el.trend === 'down' ? k.trendDown : k.trendFlat;
  const trendArrow = el.trend === 'up' ? '\u25B2' : el.trend === 'down' ? '\u25BC' : '';
  return `<div data-ppt-role="group" data-slot-name="${escapeHtml(el.slotName)}"
     style="position: absolute; left: ${px.left}px; top: ${px.top}px; width: ${px.width}px; height: ${px.height}px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            box-sizing: border-box; padding: 8px;">
    <div data-ppt-role="text" style="font-size: ${k.numberFontSize}px; font-weight: 700; color: #${k.numberColor};
         font-family: '${theme.brand.typography.cjkFont}', ${theme.brand.typography.fallback.cjkFont};">
      ${escapeHtml(el.number)}${trendArrow ? `<span style="color: #${trendColor}; font-size: 16px; margin-left: 4px;">${trendArrow}</span>` : ''}
    </div>
    <div data-ppt-role="text" style="font-size: ${k.labelFontSize}px; color: #${k.labelColor}; margin-top: 4px;
         font-family: '${theme.brand.typography.cjkFont}', ${theme.brand.typography.fallback.cjkFont};">
      ${escapeHtml(el.label)}
    </div>
  </div>`;
}

/** Count leaf nodes for flex-grow proportional sizing */
function leafWeight(box: DiagramBox): number {
  if (!box.children?.length) return 1;
  return box.children.reduce((sum, c) => sum + leafWeight(c), 0);
}

/** Render a single DiagramBox recursively using CSS flexbox */
function renderDiagramBox(box: DiagramBox, depth: number, d: DiagramStyleTokens, font: string): string {
  const isLeaf = !box.children?.length;
  const bgColor = box.bgColor ?? d.nestedBg[depth % d.nestedBg.length] ?? d.boxBg;
  const borderColor = box.borderColor ?? d.boxBorder;
  const weight = leafWeight(box);

  if (isLeaf) {
    return `<div data-ppt-role="shape" data-box-id="${escapeHtml(box.id)}"
       style="flex: ${weight}; min-width: 40px; min-height: 24px; border-radius: 4px;
              background: #${bgColor}; border: ${d.boxBorderWidth}px solid #${borderColor};
              display: flex; align-items: center; justify-content: center;
              font-size: ${d.labelFontSize}px; color: #${d.labelColor}; padding: 2px 4px;
              font-family: '${font}', sans-serif; box-sizing: border-box; overflow: hidden;">
      ${escapeHtml(box.label)}
    </div>`;
  }

  // Parent box: header bar + flex container for children
  const childrenHtml = box.children!.map((c) => renderDiagramBox(c, depth + 1, d, font)).join('\n      ');

  return `<div data-ppt-role="group" data-box-id="${escapeHtml(box.id)}"
     style="flex: ${weight}; min-width: 60px; border-radius: 4px;
            background: #${bgColor}; border: ${d.boxBorderWidth}px solid #${borderColor};
            display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
    <div data-ppt-role="text" style="background: #${borderColor}; color: #FFFFFF; padding: 2px 6px;
                font-size: ${d.labelFontSize}px; font-weight: 700;
                font-family: '${font}', sans-serif; white-space: nowrap;">
      ${escapeHtml(box.label)}
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 3px; padding: 3px; flex: 1;">
      ${childrenHtml}
    </div>
  </div>`;
}

function renderDiagramEl(el: DiagramElement, slot: LayoutSlot, theme: ThemeTokens): string {
  const px = slotToPx(slot);
  const d = theme.slide.diagram;
  const font = theme.brand.typography.cjkFont;

  const boxesHtml = el.boxes.map((b) => renderDiagramBox(b, 0, d, font)).join('\n    ');

  return `<div data-ppt-role="group" data-slot-name="${escapeHtml(el.slotName)}"
     style="position: absolute; left: ${px.left}px; top: ${px.top}px; width: ${px.width}px; height: ${px.height}px;
            display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; box-sizing: border-box;">
    ${boxesHtml}
  </div>`;
}

function renderElement(el: SlideElement, slideSpec: SlideSpec, theme: ThemeTokens): string {
  const slot = getSlot(slideSpec.layoutId, el.slotName);
  switch (el.type) {
    case 'text':
      return renderTextEl(el, slot, theme);
    case 'table':
      return renderTableEl(el, slot, theme);
    case 'chart':
      return renderChartEl(el, slot, theme);
    case 'kpi':
      return renderKpiEl(el, slot, theme);
    case 'diagram':
      return renderDiagramEl(el, slot, theme);
    case 'image':
      throw new Error('Image elements are not yet supported in V2 engine. Use --engine v1 or remove image elements.');
  }
}

function themeToCustomProperties(theme: ThemeTokens): string {
  const c = theme.brand.colors;
  return `
    --brand-primary: #${c.primary};
    --brand-secondary: #${c.secondary};
    --brand-accent: #${c.accent};
    --brand-bg: #${c.background};
    --brand-surface: #${c.surface};
    --brand-text: #${c.text.primary};
    --brand-text-secondary: #${c.text.secondary};
    --brand-text-muted: #${c.text.muted};
    --brand-white: #${c.white};
  `;
}

/** Render a single SlideSpec to a complete HTML document string (1280×720 viewport). */
export function renderSlideToHtml(slide: SlideSpec, theme: ThemeTokens): string {
  const elementsHtml = slide.elements.map((el) => renderElement(el, slide, theme)).join('\n    ');

  const bgColor = theme.slide.content.bg;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { ${themeToCustomProperties(theme)} }
    body { width: 1280px; height: 720px; overflow: hidden; }
  </style>
</head>
<body>
  <div class="ppt-slide" data-slide-id="${escapeHtml(slide.slideId)}"
       style="position: relative; width: 1280px; height: 720px; background: #${bgColor}; overflow: hidden;">
    ${elementsHtml}
  </div>
</body>
</html>`;
}
