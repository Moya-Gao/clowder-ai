/**
 * Transcription corrector for voice input.
 *
 * ASR engines frequently misrecognize project-specific terms
 * (e.g. "MCP" → "ICP", "Fastify" → "法式的").  This module
 * provides a three-layer pipeline:
 *   1. Term dictionary replacement (case-insensitive)
 *   2. Chinese filler-word removal
 *   3. Whitespace collapse + trim
 */

import terms from './voice-terms.json';

/* ------------------------------------------------------------------ */
/*  1. Term dictionary                                                 */
/* ------------------------------------------------------------------ */

const termEntries: ReadonlyArray<[RegExp, string]> = Object.entries(
  terms as Record<string, string>,
).map(([pattern, replacement]) => [
  new RegExp(escapeRegExp(pattern), 'gi'),
  replacement,
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace known misrecognized terms with their correct forms.
 * Matching is case-insensitive; unknown terms pass through unchanged.
 */
export function applyTermDictionary(text: string): string {
  let result = text;
  for (const [re, replacement] of termEntries) {
    result = result.replace(re, replacement);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  2. Filler removal                                                  */
/* ------------------------------------------------------------------ */

/**
 * Chinese filler / hedge words that add no semantic value in a
 * technical instruction context.
 */
const FILLERS = [
  '就是说',
  '然后呢',
  '对对对',
  '那个',
  '就是',
  '嗯',
  '啊',
];

const fillerPattern = new RegExp(
  FILLERS.map(escapeRegExp).join('|'),
  'g',
);

/**
 * Remove common Chinese filler words, then collapse consecutive
 * whitespace and trim.
 */
export function removeFillers(text: string): string {
  return text
    .replace(fillerPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/*  3. Full pipeline                                                   */
/* ------------------------------------------------------------------ */

/**
 * End-to-end correction: term dictionary → filler removal.
 */
export function correctTranscription(text: string): string {
  return removeFillers(applyTermDictionary(text));
}
