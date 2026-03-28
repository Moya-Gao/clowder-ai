export { buildCompiledDeck } from './compiled-builder.js';
export { compileDom } from './dom-compiler.js';
export { renderSlideToHtml } from './html-template.js';
export type { EvaluatedNode } from './layout-evaluator.js';
export { closeBrowser, evaluateDeck, evaluateLayout } from './layout-evaluator.js';
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
export { PX_PER_INCH } from './types.js';
