/**
 * F144 Phase B — Compiled Builder
 *
 * Takes CompiledDeck (with pre-computed inch rects from DOM compiler)
 * and produces a pptxgenjs Presentation. No layout calculation here —
 * all positions come from the CompiledElement tree.
 */

import PptxGenJSDefault from 'pptxgenjs';

// Handle CJS/ESM interop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS: any = (PptxGenJSDefault as any).default ?? PptxGenJSDefault;

import { buildSlideMasters } from '../master-builder.js';
import type { ThemeTokens } from '../types.js';
import type { ChartData, CompiledDeck, CompiledElement } from './types.js';

/** Structural type for pptxgenjs Slide */
interface PptxSlide {
  addText(text: unknown, options: unknown): void;
  addTable(rows: unknown, options: unknown): void;
  addShape(shapeName: string, options: unknown): void;
  addChart(chartType: unknown, data: unknown, options: unknown): void;
  addNotes(notes: string): void;
}

/** Structural type for pptxgenjs Presentation */
interface PptxPresentation {
  layout: string;
  title: string;
  author: string;
  subject: string;
  charts: Record<string, string>;
  defineSlideMaster(opts: Record<string, unknown>): void;
  addSlide(opts: { masterName: string }): PptxSlide;
  write(opts: { outputType: string }): Promise<Buffer>;
  writeFile(opts: { fileName: string }): Promise<string>;
}

function renderCompiledText(slide: PptxSlide, el: CompiledElement): void {
  if (el.content.type !== 'text') return;
  const runs = el.content.runs.map((r) => ({
    text: r.text,
    options: {
      fontSize: r.fontSize,
      fontFace: r.fontFamily,
      color: r.color,
      bold: r.bold ?? false,
      italic: r.italic ?? false,
    },
  }));
  slide.addText(runs, {
    x: el.rect.x,
    y: el.rect.y,
    w: el.rect.w,
    h: el.rect.h,
    valign: 'top',
    wrap: true,
  });
}

function renderCompiledShape(slide: PptxSlide, el: CompiledElement): void {
  if (el.content.type !== 'shape') return;
  const opts: Record<string, unknown> = {
    x: el.rect.x,
    y: el.rect.y,
    w: el.rect.w,
    h: el.rect.h,
    fill: { color: el.content.fill },
    rectRadius: el.style.borderRadius ? el.style.borderRadius / 72 : 0.05,
  };
  if (el.style.borderColor) {
    opts.line = { color: el.style.borderColor, width: el.style.borderWidth ?? 1 };
  }
  slide.addShape('roundRect', opts);

  // Render label text on top of shape
  if (el.content.runs?.length) {
    const runs = el.content.runs.map((r) => ({
      text: r.text,
      options: {
        fontSize: r.fontSize,
        fontFace: r.fontFamily,
        color: r.color,
        bold: r.bold ?? false,
      },
    }));
    slide.addText(runs, {
      x: el.rect.x,
      y: el.rect.y,
      w: el.rect.w,
      h: el.rect.h,
      valign: 'middle',
      align: 'center',
      wrap: true,
    });
  }
}

function renderCompiledTable(slide: PptxSlide, el: CompiledElement, fontFace: string): void {
  if (el.content.type !== 'table') return;
  const { headers, rows } = el.content;
  const tableRows: unknown[][] = [];

  // Header row
  if (headers.length > 0) {
    tableRows.push(
      headers.map((h) => ({
        text: h,
        options: { bold: true, color: 'FFFFFF', fill: { color: 'CF0A2C' } },
      })),
    );
  }

  // Data rows
  for (const row of rows) {
    tableRows.push(
      row.cells.map((c) => ({
        text: c.text,
        options: {
          ...(c.bgColor ? { fill: { color: c.bgColor } } : {}),
          ...(c.fontColor ? { color: c.fontColor } : {}),
          ...(c.bold ? { bold: true } : {}),
        },
      })),
    );
  }

  slide.addTable(tableRows, {
    x: el.rect.x,
    y: el.rect.y,
    w: el.rect.w,
    h: el.rect.h,
    fontSize: 9,
    fontFace,
    border: { type: 'solid', pt: 0.5, color: 'E0E0E0' },
    autoPage: false,
  });
}

/** Map chartType string to pptxgenjs charts enum value */
function resolveChartType(chartType: string, charts: Record<string, string>): string {
  const map: Record<string, string> = {
    bar: charts.BAR,
    bar3d: charts.BAR3D,
    line: charts.LINE,
    pie: charts.PIE,
    doughnut: charts.DOUGHNUT,
    area: charts.AREA,
    radar: charts.RADAR,
    scatter: charts.SCATTER,
  };
  return map[chartType] ?? charts.BAR;
}

function renderCompiledChart(
  slide: PptxSlide,
  el: CompiledElement,
  charts: Record<string, string>,
  fontFace: string,
): void {
  if (el.content.type !== 'chart') return;
  const { chartType, data } = el.content;
  const pptxChartType = resolveChartType(chartType, charts);
  const chartData: ChartData = data;
  if (!chartData?.series?.length) return;

  let series: unknown[];
  if (chartData.chartProfile === 'xy' || chartData.chartProfile === 'scatter') {
    series = chartData.series.map((s) => ({
      name: s.name,
      values: (s.points ?? []).map((p) => [p.x, p.y]),
    }));
  } else if (chartData.chartProfile === 'bubble') {
    series = chartData.series.map((s) => ({
      name: s.name,
      values: (s.points ?? []).map((p) => [p.x, p.y, p.size ?? 1]),
    }));
  } else {
    series = chartData.series.map((s) => ({
      name: s.name,
      labels: chartData.categories ?? [],
      values: (s.values ?? []).map((v) => v ?? 0),
    }));
  }

  slide.addChart(pptxChartType, series, {
    x: el.rect.x,
    y: el.rect.y,
    w: el.rect.w,
    h: el.rect.h,
    showLegend: series.length > 1,
    legendPos: 'b',
    legendFontFace: fontFace,
    catAxisLabelFontFace: fontFace,
    valAxisLabelFontFace: fontFace,
  });
}

function renderCompiledElement(
  slide: PptxSlide,
  el: CompiledElement,
  fontFace: string,
  charts?: Record<string, string>,
): void {
  switch (el.role) {
    case 'text':
      renderCompiledText(slide, el);
      break;
    case 'shape':
      renderCompiledShape(slide, el);
      break;
    case 'group':
      // Groups are structural — render children directly
      if (el.style.fill) {
        slide.addShape('rect', {
          x: el.rect.x,
          y: el.rect.y,
          w: el.rect.w,
          h: el.rect.h,
          fill: { color: el.style.fill },
        });
      }
      if (el.children) {
        for (const child of el.children) {
          renderCompiledElement(slide, child, fontFace, charts);
        }
      }
      break;
    case 'table':
      renderCompiledTable(slide, el, fontFace);
      break;
    case 'chart':
      if (charts) renderCompiledChart(slide, el, charts, fontFace);
      break;
  }
}

/** Build a pptxgenjs Presentation from a CompiledDeck (pre-computed rects). */
export function buildCompiledDeck(deck: CompiledDeck, theme: ThemeTokens): PptxPresentation {
  const pres: PptxPresentation = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = '';
  pres.author = 'Cat Café PPT Forge';
  pres.subject = '';

  buildSlideMasters(pres, theme);

  const fontFace = theme.brand.typography.cjkFont;

  for (const cSlide of deck.slides) {
    const slide = pres.addSlide({ masterName: cSlide.masterName });
    for (const el of cSlide.elements) {
      renderCompiledElement(slide, el, fontFace, pres.charts);
    }
    if (cSlide.speakerNotes) {
      slide.addNotes(cSlide.speakerNotes);
    }
  }

  return pres;
}
