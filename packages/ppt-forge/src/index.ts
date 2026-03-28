export { generateBlueprint, suggestLayout } from './blueprint-gen.js';
export { validateResearch, validateStoryline } from './gates.js';
export { getLayout, getSlot, LAYOUT_CATALOG } from './layouts.js';
export { buildSlideMasters, intentToMaster, MASTER_NAMES } from './master-builder.js';
export type { PipelineInput, PipelineResult } from './pipeline.js';
export { runPipeline } from './pipeline.js';
export { renderChart } from './renderers/chart.js';
export { renderKPI } from './renderers/kpi.js';
export { renderTable } from './renderers/table.js';
export { renderText } from './renderers/text.js';
export { buildDeck } from './slide-builder.js';
export type {
  BubbleChartData,
  CategoricalChartData,
  ChartData,
  ChartElement,
  DeckBlueprint,
  DeckMeta,
  KPIElement,
  LayoutCatalogEntry,
  LayoutSlot,
  NarrativeSection,
  NarrativeSlide,
  ResearchDataPoint,
  ResearchFinding,
  ResearchOutput,
  ResearchSource,
  SlideElement,
  SlideSpec,
  StorylineOutput,
  TableElement,
  TextElement,
  // ImageElement — not exported: Phase A does not support images (fail-closed)
  ThemeTokens,
  XYChartData,
} from './types.js';
export {
  estimateWordCount,
  sanitizeHex,
  validateHexColor,
  validateSlotExists,
  validateWordCount,
} from './validators.js';
