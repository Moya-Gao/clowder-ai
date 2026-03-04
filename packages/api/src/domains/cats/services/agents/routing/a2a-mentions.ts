/**
 * A2A Mention Detection
 * 从猫回复文本中检测对其他猫的 @mention。
 *
 * 规则 (缅因猫 P1-3 + F27 multi-mention):
 * 1. 剥离围栏代码块 (```...```) 后再解析
 * 2. 仅匹配行首 mention（可带前导空白）
 * 3. 长匹配优先 + token boundary，避免 `@opus-45` 误命中 `@opus`
 * 4. 过滤自调用
 * 5. F27: 返回所有匹配的猫 (上限 MAX_A2A_MENTION_TARGETS)
 * 6. 只在猫回复完整结束后解析 (由调用方保证)
 */

import { catRegistry, CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';

/** Max A2A chain depth, configurable via env (read at call time for hot-reload) */
export function getMaxA2ADepth(): number {
  return Number(process.env['MAX_A2A_DEPTH']) || 15;
}

/** Max number of distinct cats a single message can @mention (F27 safety limit) */
const MAX_A2A_MENTION_TARGETS = 2;
const TOKEN_BOUNDARY_RE = /[\s,.:;!?()\[\]{}<>，。！？、：；（）【】《》「」『』〈〉]/;
// If the next char looks like part of a handle token, treat it as NOT a boundary.
// This avoids prefix-matching `@opus-45` as `@opus`, while still allowing `@opus请看`.
const HANDLE_CONTINUATION_RE = /[a-z0-9_.-]/;
const CJK_ACTION_KEYWORDS = ['确认', '处理', '修复', '请', '帮', '决策', '看一下'] as const;
const ASCII_ACTION_KEYWORDS = ['review', 'check', 'fix', 'merge'] as const;
const ASCII_TOKEN_CHAR_RE = /[a-z0-9_]/;

interface MentionPatternEntry {
  readonly catId: CatId;
  readonly pattern: string;
}

export type MentionSuppressionReason = 'no_action' | 'cross_paragraph';

export interface SuppressedA2AMention {
  readonly catId: CatId;
  readonly reason: MentionSuppressionReason;
}

export interface A2AMentionAnalysis {
  readonly mentions: CatId[];
  readonly suppressed: SuppressedA2AMention[];
}

export type MentionActionabilityMode = 'strict' | 'relaxed';

export interface A2AMentionParseOptions {
  /** strict = same paragraph only, relaxed = allow one blank line gap */
  readonly mode?: MentionActionabilityMode;
}

/**
 * Parse A2A @mentions from cat response text.
 * F27: Returns all matched CatIds (up to MAX_A2A_MENTION_TARGETS).
 */
export function parseA2AMentions(
  text: string,
  currentCatId: CatId,
  options: A2AMentionParseOptions = {},
): CatId[] {
  return analyzeA2AMentions(text, currentCatId, options).mentions;
}

export function analyzeA2AMentions(
  text: string,
  currentCatId: CatId,
  options: A2AMentionParseOptions = {},
): A2AMentionAnalysis {
  if (!text) return { mentions: [], suppressed: [] };
  const mode = options.mode ?? 'strict';

  // 1. Strip fenced code blocks
  const stripped = text.replace(/```[\s\S]*?```/g, '');

  // F32-a: prefer catRegistry, fallback to static CAT_CONFIGS
  const allConfigs = Object.keys(catRegistry.getAllConfigs()).length > 0
    ? catRegistry.getAllConfigs()
    : CAT_CONFIGS;

  // 2. Build patterns and sort longest-first to avoid prefix collisions
  const entries: MentionPatternEntry[] = [];
  for (const [id, config] of Object.entries(allConfigs)) {
    if (id === currentCatId) continue; // 4. Filter self
    for (const pattern of config.mentionPatterns) {
      entries.push({ catId: id as CatId, pattern: pattern.toLowerCase() });
    }
  }
  entries.sort((a, b) => b.pattern.length - a.pattern.length);

  // 3. Line-start matching with token boundary (one winning pattern per line)
  const found: CatId[] = [];
  const suppressed = new Map<CatId, MentionSuppressionReason>();
  const seen = new Set<string>();
  const wholeMessage = stripped.toLowerCase();
  const wholeMessageHasActionability = hasActionability(wholeMessage);
  const lines = stripped.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex]!;
    if (found.length >= MAX_A2A_MENTION_TARGETS) break; // 5. Safety limit

    const leadingWs = rawLine.match(/^\s*/)?.[0].length ?? 0;
    const normalized = rawLine.slice(leadingWs).toLowerCase();
    if (!normalized.startsWith('@')) {
      continue;
    }

    for (const entry of entries) {
      if (!normalized.startsWith(entry.pattern)) continue;
      const charAfter = normalized[entry.pattern.length];
      const isBoundary = !charAfter || TOKEN_BOUNDARY_RE.test(charAfter) || !HANDLE_CONTINUATION_RE.test(charAfter);
      if (!isBoundary) continue;
      const paragraph = getParagraph(lines, lineIndex).toLowerCase();
      const actionable = hasActionability(paragraph) || (
        mode === 'relaxed' && hasActionabilityInAdjacentParagraph(lines, lineIndex)
      );
      if (!actionable) {
        if (!seen.has(entry.catId) && !suppressed.has(entry.catId)) {
          suppressed.set(entry.catId, wholeMessageHasActionability ? 'cross_paragraph' : 'no_action');
        }
        break;
      }
      // If this target was previously recorded as suppressed on another line,
      // a later actionable mention should win and clear stale suppression.
      suppressed.delete(entry.catId);
      if (!seen.has(entry.catId)) {
        seen.add(entry.catId);
        found.push(entry.catId);
      }
      break; // longest-match-first: lock one winner for this line
    }
  }

  return {
    mentions: found,
    suppressed: Array.from(suppressed, ([catId, reason]) => ({ catId, reason })),
  };
}

function getParagraph(lines: readonly string[], lineIndex: number): string {
  const { start, end } = getParagraphBounds(lines, lineIndex);
  return lines.slice(start, end + 1).join('\n');
}

function getParagraphBounds(lines: readonly string[], lineIndex: number): { start: number; end: number } {
  let start = lineIndex;
  while (start > 0 && lines[start - 1]!.trim() !== '') start -= 1;

  let end = lineIndex;
  while (end + 1 < lines.length && lines[end + 1]!.trim() !== '') end += 1;

  return { start, end };
}

function hasActionabilityInAdjacentParagraph(lines: readonly string[], lineIndex: number): boolean {
  const { end } = getParagraphBounds(lines, lineIndex);
  let scan = end + 1;
  let blankLineCount = 0;
  while (scan < lines.length && lines[scan]!.trim() === '') {
    blankLineCount += 1;
    scan += 1;
  }
  // Relaxed mode only tolerates one blank line (exactly one paragraph gap).
  if (blankLineCount !== 1 || scan >= lines.length) {
    return false;
  }
  return hasActionability(getParagraph(lines, scan).toLowerCase());
}

function hasActionability(paragraph: string): boolean {
  if (CJK_ACTION_KEYWORDS.some((kw) => paragraph.includes(kw))) {
    return true;
  }
  return ASCII_ACTION_KEYWORDS.some((kw) => containsAsciiToken(paragraph, kw));
}

function containsAsciiToken(text: string, token: string): boolean {
  let index = text.indexOf(token);
  while (index !== -1) {
    const before = index > 0 ? text[index - 1] : '';
    const after = text[index + token.length] ?? '';
    const beforeBoundary = !before || !ASCII_TOKEN_CHAR_RE.test(before);
    const afterBoundary = !after || !ASCII_TOKEN_CHAR_RE.test(after);
    if (beforeBoundary && afterBoundary) {
      return true;
    }
    index = text.indexOf(token, index + 1);
  }
  return false;
}
