import PptxGenJSDefault from 'pptxgenjs';

// Handle CJS/ESM interop — tsx may double-wrap the default export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS: any = (PptxGenJSDefault as any).default ?? PptxGenJSDefault;

/** Structural type for pptxgenjs Slide (avoids namespace import issues) */
interface PptxSlide {
  addText(text: unknown, options: unknown): void;
  addTable(rows: unknown, options: unknown): void;
  addChart(chartType: unknown, data: unknown, options: unknown): void;
  addShape(shapeName: string, options: unknown): void;
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

import { getLayout, getSlot } from './layouts.js';
import { buildSlideMasters, intentToMaster } from './master-builder.js';
import { renderChart } from './renderers/chart.js';
import { compileDiagramToSvg } from './renderers/diagram-svg.js';
import { renderKPI } from './renderers/kpi.js';
import { renderSvgToSlide } from './renderers/svg-to-shapes.js';
import { renderTable } from './renderers/table.js';
import { renderText } from './renderers/text.js';
import type {
  ChartElement,
  DeckBlueprint,
  DiagramElement,
  KPIElement,
  SlideElement,
  SlideSpec,
  SlideStyleTokens,
  TableElement,
  TextElement,
  ThemeTokens,
} from './types.js';
import { validateHexColor, validateWordCount } from './validators.js';

/** Collect all hex color values from a nested object, with dot-path keys */
function collectHexFields(obj: Record<string, unknown>, prefix: string, out: [string, string][]): void {
  for (const [key, val] of Object.entries(obj)) {
    const path = `${prefix}.${key}`;
    if (typeof val === 'string' && /^#?[0-9A-Fa-f]{3,8}$/.test(val)) {
      out.push([path, val]);
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] === 'string') out.push([`${path}[${i}]`, val[i] as string]);
      }
    } else if (typeof val === 'object' && val !== null) {
      collectHexFields(val as Record<string, unknown>, path, out);
    }
  }
}

/** Validate all hex colors in theme tokens at build entry — covers brand + slide semantic + chart palette */
function validateThemeColors(theme: ThemeTokens): void {
  const entries: [string, string][] = [];
  collectHexFields(theme.brand.colors as unknown as Record<string, unknown>, 'brand.colors', entries);
  collectHexFields(theme.slide as unknown as Record<string, unknown>, 'slide', entries);
  if (theme.slideNumber?.color) {
    entries.push(['slideNumber.color', theme.slideNumber.color]);
  }
  for (const [name, hex] of entries) {
    try {
      validateHexColor(hex);
    } catch (e) {
      throw new Error(`Theme color "${name}": ${(e as Error).message}`);
    }
  }
}

/** Resolve slide style tokens based on intent */
function resolveSlideStyle(intent: SlideSpec['intent'], theme: ThemeTokens): SlideStyleTokens {
  switch (intent) {
    case 'cover':
      return theme.slide.cover;
    case 'section-break':
      return theme.slide.section;
    case 'closing':
      return theme.slide.closing;
    default:
      return theme.slide.content;
  }
}

/** Dispatch a single element to its renderer */
function renderElement(
  slide: PptxSlide,
  pres: PptxPresentation,
  element: SlideElement,
  slideSpec: SlideSpec,
  theme: ThemeTokens,
  warnings: string[],
): void {
  const layout = getLayout(slideSpec.layoutId);
  const slot = getSlot(slideSpec.layoutId, element.slotName);
  const style = resolveSlideStyle(slideSpec.intent, theme);
  const fontFace = theme.brand.typography.cjkFont;

  switch (element.type) {
    case 'text': {
      const textEl = element as TextElement;
      validateWordCount(textEl.content, slideSpec.renderBudget.maxWords, warnings);
      renderText(slide, textEl, slot, style, fontFace);
      break;
    }
    case 'table': {
      renderTable(slide, element as TableElement, slot, theme.slide.table, fontFace);
      break;
    }
    case 'chart': {
      renderChart(slide, element as ChartElement, slot, theme.slide.chart, pres.charts, fontFace);
      break;
    }
    case 'kpi': {
      renderKPI(slide, element as KPIElement, slot, theme.slide.kpi, fontFace);
      break;
    }
    case 'diagram': {
      const svgStr = compileDiagramToSvg(element as DiagramElement, slot, theme.slide.diagram, fontFace);
      if (svgStr) {
        renderSvgToSlide(slide as never, svgStr, { x: slot.position.x, y: slot.position.y });
      }
      break;
    }
    case 'image': {
      throw new Error(
        `ImageElement "${element.slotName}" is not supported in Phase A. ` +
          `Remove it from the blueprint or wait for Level 2.`,
      );
    }
  }
}

/**
 * Build a complete pptxgenjs presentation from blueprint + theme.
 * Returns the PptxGenJS instance (call .writeFile() or .write() to export).
 */
export function buildDeck(blueprint: DeckBlueprint, theme: ThemeTokens): PptxPresentation {
  // Validate theme colors at entry (P2: wire hex validation to product path)
  validateThemeColors(theme);

  const pres: PptxPresentation = new PptxGenJS();

  // 16:9 widescreen
  pres.layout = 'LAYOUT_WIDE';

  // Metadata
  pres.title = blueprint.meta.title;
  pres.author = blueprint.meta.author;
  pres.subject = blueprint.meta.subtitle ?? '';

  // Register slide masters
  buildSlideMasters(pres, theme);

  const warnings: string[] = [];

  // Build each slide
  for (const slideSpec of blueprint.slides) {
    const masterName = intentToMaster(slideSpec.intent);
    const slide = pres.addSlide({ masterName });

    // Render each element
    for (const element of slideSpec.elements) {
      renderElement(slide, pres, element, slideSpec, theme, warnings);
    }

    // Speaker notes
    if (slideSpec.speakerNotes) {
      slide.addNotes(slideSpec.speakerNotes);
    }
  }

  if (warnings.length > 0) {
    console.warn(`[ppt-forge] ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.warn(`  - ${w}`);
    }
  }

  return pres;
}
