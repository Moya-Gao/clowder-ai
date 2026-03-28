/**
 * F144 PPT Forge — Blueprint V2 Types (Terminal Schema)
 *
 * Absorbs GPT Pro review + 砚砚 confirmation:
 * - slideId replaces pageNum as stable primary key
 * - sections[] for deck-level structure
 * - renderBudget for capacity-aware layout
 * - ChartData discriminated union (categorical/xy/bubble)
 * - transition structured enum
 */

// ── Deck Blueprint ──────────────────────────────────────

export interface DeckBlueprint {
  version: '1.0';
  meta: DeckMeta;
  sections: SectionSpec[];
  slides: SlideSpec[];
  assets: AssetRef[];
}

export interface DeckMeta {
  title: string;
  subtitle?: string;
  author: string;
  createdAt: string;
  researchRef: string;
  storylineRef: string;
  themeRef: string;
  framework: NarrativeFramework;
  targetAudience: AudienceType;
}

export type NarrativeFramework = 'pyramid' | 'scq' | 'problem-solution';

export type AudienceType = 'corporate-executive' | 'technical-deep-dive' | 'keynote-public' | 'internal-team';

export interface SectionSpec {
  sectionId: string;
  title: string;
  slideIds: string[];
}

// ── Slide ────────────────────────────────────────────────

export interface SlideSpec {
  slideId: string;
  sectionId?: string;
  intent: SlideIntent;
  purpose: string;
  layoutId: string;
  elements: SlideElement[];
  speakerNotes?: string;
  evidenceRefs?: EvidenceRef[];
  transition?: TransitionSpec;
  renderBudget: RenderBudget;
}

export type SlideIntent =
  | 'cover'
  | 'agenda'
  | 'section-break'
  | 'key-statement'
  | 'content'
  | 'data-insight'
  | 'comparison'
  | 'timeline'
  | 'evidence'
  | 'summary'
  | 'closing'
  | 'appendix';

export interface TransitionSpec {
  type: TransitionType;
  fromSlideId?: string;
}

export type TransitionType = 'supports' | 'contrasts' | 'zooms-in' | 'answers' | 'summarizes';

export interface RenderBudget {
  /** Active in Phase A: CJK-aware word count warning via estimateWordCount() */
  maxWords: number;
  /** Phase B reserved — informational only, not enforced by export layer.
   *  pptxgenjs has no text measurement API; real enforcement requires
   *  post-render measurement (e.g. OOXML extents or headless PPT). */
  minFontPt?: number;
  /** Phase B reserved — informational only. See minFontPt rationale. */
  overflowPolicy?: 'split-slide' | 'shrink' | 'truncate';
}

// ── Elements ─────────────────────────────────────────────

export type SlideElement = TextElement | ChartElement | ImageElement | TableElement | KPIElement;

export interface TextElement {
  type: 'text';
  slotName: string;
  content: string;
  fontSize?: number;
  fontWeight?: 'regular' | 'bold';
  align?: 'left' | 'center' | 'right';
}

export interface ChartElement {
  type: 'chart';
  slotName: string;
  chartType: ChartType;
  data: ChartData;
  hints?: Record<string, unknown>;
}

export type ChartType = 'area' | 'bar' | 'bar3d' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter';

export type ChartData = CategoricalChartData | XYChartData | BubbleChartData;

export interface CategoricalChartData {
  chartProfile: 'categorical';
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
}

export interface XYChartData {
  chartProfile: 'xy';
  series: {
    name: string;
    points: { x: number; y: number; label?: string }[];
  }[];
}

export interface BubbleChartData {
  chartProfile: 'bubble';
  series: {
    name: string;
    points: { x: number; y: number; size: number; label?: string }[];
  }[];
}

export interface ImageElement {
  type: 'image';
  slotName: string;
  assetId: string;
  alt: string;
  sizing?: { type: 'contain' | 'cover' | 'crop'; w: number; h: number };
}

export interface TableElement {
  type: 'table';
  slotName: string;
  headers: string[];
  rows: TableRow[];
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableCell {
  text: string;
  bgColor?: string;
  fontColor?: string;
  fontBold?: boolean;
}

export interface KPIElement {
  type: 'kpi';
  slotName: string;
  number: string;
  label: string;
  trend?: 'up' | 'down' | 'flat';
  trendColor?: string;
}

// ── Evidence ─────────────────────────────────────────────

export interface EvidenceRef {
  conclusionId: string;
  source: string;
  type: 'fact' | 'inference' | 'recommendation';
  summary: string;
}

// ── Assets ───────────────────────────────────────────────

export interface AssetRef {
  assetId: string;
  type: 'image' | 'icon' | 'logo' | 'svg';
  path: string;
  base64?: string;
  license?: string;
}

// ── Theme ────────────────────────────────────────────────

export interface ThemeTokens {
  version: '1.0';
  name: string;
  description: string;
  brand: BrandTokens;
  slide: SlideSemanticTokens;
  slideNumber: {
    color: string;
    fontSize: number;
    position: { x: string; y: string };
  };
}

export interface BrandTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceAlt: string;
    white: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
      onPrimary: string;
    };
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
    cjkFont: string;
    headingWeight: string;
    bodyWeight: string;
    fallback: {
      headingFont: string;
      bodyFont: string;
      monoFont: string;
      cjkFont: string;
    };
  };
  spacing: {
    unit: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

export interface SlideSemanticTokens {
  cover: SlideStyleTokens;
  section: SlideStyleTokens;
  content: SlideStyleTokens;
  kpi: KPIStyleTokens;
  chart: ChartStyleTokens;
  table: TableStyleTokens;
  closing: SlideStyleTokens;
}

export interface SlideStyleTokens {
  bg: string;
  titleColor: string;
  titleFontSize: number;
  subtitleColor?: string;
  subtitleFontSize?: number;
  labelColor?: string;
  labelFontSize?: number;
  bodyColor?: string;
  bodyFontSize?: number;
}

export interface KPIStyleTokens {
  numberColor: string;
  numberFontSize: number;
  labelColor: string;
  labelFontSize: number;
  trendUp: string;
  trendDown: string;
  trendFlat: string;
}

export interface ChartStyleTokens {
  palette: string[];
  gridColor: string;
  gridSize: number;
  axisLabelColor: string;
  axisLabelSize: number;
  dataLabelColor: string;
  dataLabelSize: number;
  bgColor: string;
}

export interface TableStyleTokens {
  headerBg: string;
  headerColor: string;
  rowBg: string;
  rowAltBg: string;
  rowColor: string;
  borderColor: string;
}

// ── Layout ───────────────────────────────────────────────

export interface LayoutCatalogEntry {
  layoutId: string;
  description: string;
  slots: LayoutSlot[];
}

export interface LayoutSlot {
  name: string;
  type: 'title' | 'subtitle' | 'body' | 'chart' | 'image' | 'table' | 'icon' | 'kpi-number' | 'kpi-label' | 'caption';
  position: { x: number; y: number; w: number; h: number };
}

// ── Research Layer Output ────────────────────────────────

export interface ResearchOutput {
  topic: string;
  generatedAt: string;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  dataPoints: ResearchDataPoint[];
}

export interface ResearchSource {
  id: string;
  title: string;
  url?: string;
  type: 'web' | 'paper' | 'report';
}

export interface ResearchFinding {
  id: string;
  claim: string;
  sourceIds: string[];
  confidence: 'fact' | 'inference' | 'recommendation';
}

export interface ResearchDataPoint {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  sourceId: string;
}

// ── Narrative Layer Output ───────────────────────────────

export interface StorylineOutput {
  framework: NarrativeFramework;
  centralMessage: string;
  sections: NarrativeSection[];
}

export interface NarrativeSection {
  sectionId: string;
  title: string;
  purpose: string;
  slides: NarrativeSlide[];
}

export interface NarrativeSlide {
  slideId: string;
  intent: SlideIntent;
  keyMessage: string;
  supportingPoints: string[];
  suggestedDataViz?: 'chart' | 'table' | 'kpi' | 'text-only';
}
