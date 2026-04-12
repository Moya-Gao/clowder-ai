export { buildCompiledDeck } from './compiled-builder.js';
export type {
  DeckGateResult,
  DensityGateResult,
  DensityReport,
  TwoPhaseDeckResult,
  TwoPhaseResult,
} from './density-analyzer.js';
export {
  analyzeDensity,
  compareTwoPhase,
  densityGate,
  gateCompiledDeck,
  gateTwoPhaseDeck,
} from './density-analyzer.js';
export { compileDom } from './dom-compiler.js';
export type { RenderStrategy, RouteInput, RouteOutput, SemanticProvider } from './element-router.js';
export { buildRoutedSlide, routeElements } from './element-router.js';
export type { FlatExtractOptions, FlatExtractResult, SemanticZone } from './flat-dom-compiler.js';
export { closeFlatBrowser, flatExtract, flatExtractDeck, toCompiledSlide } from './flat-dom-compiler.js';
export { renderSlideToHtml } from './html-template.js';
export type { EvaluatedNode } from './layout-evaluator.js';
export { closeBrowser, evaluateDeck, evaluateLayout } from './layout-evaluator.js';
export type { CompileOptions, CompileResult } from './pipeline.js';
export { compileAndBuild } from './pipeline.js';
export type {
  CompiledContent,
  CompiledDeck,
  CompiledElement,
  CompiledSlide,
  CompiledStyle,
  CompiledTableCell,
  CompiledTableRow,
  PptRole,
  TextRun,
} from './types.js';
export { PX_PER_INCH, SCREENSHOT_SCALE } from './types.js';
