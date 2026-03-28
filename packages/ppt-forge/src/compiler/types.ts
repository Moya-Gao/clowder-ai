/**
 * F144 Phase B — HTML Layout Compiler Terminal Schema
 *
 * These types define the output of the DOM Semantic Compiler:
 * HTML+CSS (Playwright evaluated) → CompiledElement tree → pptxgenjs native objects.
 *
 * Key invariant: all rects are in inches (10" × 5.625" slide).
 * px → inch conversion: 1280×720 viewport ÷ 10"×5.625" = 128 px/inch.
 */

/** 1280px viewport ÷ 10 inch slide width = 128 px per inch */
export const PX_PER_INCH = 128;

// ── Roles ───────────────────────────────────────────────

export type PptRole = 'text' | 'shape' | 'group' | 'table' | 'chart' | 'image';

// ── Text ────────────────────────────────────────────────

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
}

// ── Table ───────────────────────────────────────────────

export interface CompiledTableRow {
  cells: CompiledTableCell[];
}

export interface CompiledTableCell {
  text: string;
  bgColor?: string;
  fontColor?: string;
  bold?: boolean;
}

// ── Chart Data ──────────────────────────────────────────

export interface ChartSeries {
  name: string;
  values?: number[];
  points?: { x: number; y: number; size?: number }[];
}

export interface ChartData {
  chartProfile?: 'categorical' | 'xy' | 'scatter' | 'bubble';
  categories?: string[];
  series: ChartSeries[];
}

// ── Content (discriminated union) ───────────────────────

export type CompiledContent =
  | { type: 'text'; runs: TextRun[] }
  | { type: 'table'; headers: string[]; rows: CompiledTableRow[] }
  | { type: 'chart'; chartType: string; data: ChartData }
  | { type: 'shape'; shapeType: string; fill: string; line?: { color: string; width: number }; runs?: TextRun[] }
  | { type: 'group' };

// ── Style ───────────────────────────────────────────────

export interface CompiledStyle {
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
}

// ── CompiledElement ─────────────────────────────────────

export interface CompiledElement {
  role: PptRole;
  rect: { x: number; y: number; w: number; h: number };
  content: CompiledContent;
  children?: CompiledElement[];
  style: CompiledStyle;
}

// ── Slide + Deck ────────────────────────────────────────

export interface CompiledSlide {
  slideId: string;
  intent: string;
  masterName: string;
  elements: CompiledElement[];
  speakerNotes?: string;
  fontsUsed: string[];
}

export interface CompiledDeck {
  slides: CompiledSlide[];
  fontsUsed: string[];
}
