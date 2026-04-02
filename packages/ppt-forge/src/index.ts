export { generateBlueprint, suggestLayout } from './blueprint-gen.js';
export type {
  CompiledContent,
  CompiledDeck,
  CompiledElement,
  CompiledSlide,
  CompiledStyle,
  CompiledTableCell,
  CompiledTableRow,
  EvaluatedNode,
  PptRole,
  TextRun,
} from './compiler/index.js';
export { closeBrowser, compileAndBuild, PX_PER_INCH } from './compiler/index.js';
export { validateResearch, validateStoryline } from './gates.js';
export { getLayout, getSlot, LAYOUT_CATALOG } from './layouts.js';
export { buildSlideMasters, intentToMaster, MASTER_NAMES } from './master-builder.js';
export type { PipelineInput, PipelineResult } from './pipeline.js';
export { runPipeline } from './pipeline.js';
export { renderChart } from './renderers/chart.js';
export { compileLayeredGrid, isLayeredGrid } from './renderers/diagram-layered.js';
export { compileDiagramToSvg, measureTextWidth } from './renderers/diagram-svg.js';
export { renderKPI } from './renderers/kpi.js';
export { renderSvgToSlide } from './renderers/svg-to-shapes.js';
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
