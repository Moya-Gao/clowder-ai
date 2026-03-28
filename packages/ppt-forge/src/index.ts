export { buildDeck } from './slide-builder.js';
export { getLayout, getSlot, LAYOUT_CATALOG } from './layouts.js';
export { buildSlideMasters, intentToMaster, MASTER_NAMES } from './master-builder.js';
export { validateHexColor, sanitizeHex, validateSlotExists, validateWordCount, estimateWordCount } from './validators.js';
export { renderText } from './renderers/text.js';
export { renderTable } from './renderers/table.js';
export { renderChart } from './renderers/chart.js';
export { renderKPI } from './renderers/kpi.js';

export type {
  DeckBlueprint,
  DeckMeta,
  SlideSpec,
  SlideElement,
  TextElement,
  ChartElement,
  TableElement,
  KPIElement,
  // ImageElement — not exported: Phase A does not support images (fail-closed)
  ThemeTokens,
  LayoutCatalogEntry,
  LayoutSlot,
  ChartData,
  CategoricalChartData,
  XYChartData,
  BubbleChartData,
} from './types.js';
