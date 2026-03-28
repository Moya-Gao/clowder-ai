import type { LayoutSlot } from './types.js';

const HEX_RE = /^[0-9A-Fa-f]{6}$/;

/** Validate hex color per pptxgenjs rules: no #, exactly 6 chars, valid hex */
export function validateHexColor(hex: string): void {
  if (hex.startsWith('#')) {
    throw new Error(`Hex color "${hex}" must not start with # (pptxgenjs iron rule #1)`);
  }
  if (hex.length !== 6) {
    throw new Error(`Hex color "${hex}" must be exactly 6 characters (got ${hex.length})`);
  }
  if (!HEX_RE.test(hex)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
}

/** Strip # from hex if present (convenience for theme loading) */
export function sanitizeHex(hex: string): string {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  validateHexColor(clean);
  return clean;
}

/** Validate that a slot exists in the layout */
export function validateSlotExists(
  slots: LayoutSlot[],
  slotName: string,
): LayoutSlot {
  const slot = slots.find(s => s.name === slotName);
  if (!slot) {
    const available = slots.map(s => s.name).join(', ');
    throw new Error(`Slot "${slotName}" not found. Available: ${available}`);
  }
  return slot;
}

// CJK Unicode ranges: main CJK Unified, extensions, punctuation
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g;

/**
 * Estimate word count for mixed CJK/Latin text.
 * CJK: every 2 characters ≈ 1 word (Chinese avg word length).
 * Latin: whitespace-delimited tokens.
 */
export function estimateWordCount(text: string): number {
  const cjkChars = text.match(CJK_RE)?.length ?? 0;
  const nonCjk = text.replace(CJK_RE, '').trim();
  const latinWords = nonCjk ? nonCjk.split(/\s+/).filter(Boolean).length : 0;
  return latinWords + Math.ceil(cjkChars / 2);
}

/** Check word count against render budget */
export function validateWordCount(
  text: string,
  maxWords: number,
  warnings: string[] = [],
): void {
  const count = estimateWordCount(text);
  if (count > maxWords) {
    warnings.push(
      `Word count ~${count} exceeds budget ${maxWords} (text: "${text.slice(0, 40)}...")`,
    );
  }
}
