/**
 * A2A Mention Detection
 * 从猫回复文本中检测对其他猫的 @mention。
 *
 * 规则 (F046 简化 — 行首即路由):
 * 1. 剥离围栏代码块 (```...```) 后再解析
 * 2. 仅匹配行首 mention（可带前导空白）→ 直接路由，无需动作词
 * 3. 长匹配优先 + token boundary，避免 `@opus-45` 误命中 `@opus`
 * 4. 过滤自调用
 * 5. F27: 返回所有匹配的猫 (上限 MAX_A2A_MENTION_TARGETS)
 * 6. 只在猫回复完整结束后解析 (由调用方保证)
 */

import type { CatId } from '@cat-cafe/shared';
import { CAT_CONFIGS, catRegistry } from '@cat-cafe/shared';
import { isCatAvailable } from '../../../../../config/cat-config-loader.js';

/** Max A2A chain depth, configurable via env (read at call time for hot-reload) */
export function getMaxA2ADepth(): number {
  return Number(process.env.MAX_A2A_DEPTH) || 15;
}

/** Max number of distinct cats a single message can @mention (F27 safety limit) */
const MAX_A2A_MENTION_TARGETS = 2;
const TOKEN_BOUNDARY_RE = /[\s,.:;!?()[\]{}<>，。！？、：；（）【】《》「」『』〈〉]/;
// If the next char looks like part of a handle token, treat it as NOT a boundary.
// This avoids prefix-matching `@opus-45` as `@opus`, while still allowing `@opus请看`.
const HANDLE_CONTINUATION_RE = /[a-z0-9_.-]/;

interface MentionPatternEntry {
  readonly catId: CatId;
  readonly pattern: string;
}

/** @deprecated Suppression system removed — line-start mentions always route. Kept for backward compat. */
export type MentionSuppressionReason = 'no_action' | 'cross_paragraph';

/** @deprecated Suppression system removed. Kept for backward compat. */
export interface SuppressedA2AMention {
  readonly catId: CatId;
  readonly reason: MentionSuppressionReason;
}

export interface A2AMentionAnalysis {
  readonly mentions: CatId[];
  /** @deprecated Always empty — suppression system removed. */
  readonly suppressed: SuppressedA2AMention[];
}

/** #417: Inline @mention paired with action words — missed handoff candidate. */
export interface InlineActionMention {
  readonly catId: CatId;
  readonly lineText: string;
}

/** @deprecated Mode is ignored — line-start mentions always route regardless of mode. */
export type MentionActionabilityMode = 'strict' | 'relaxed';

export interface A2AMentionParseOptions {
  /** @deprecated Ignored — line-start mentions always route. Kept for backward compat. */
  readonly mode?: MentionActionabilityMode;
}

/**
 * Parse A2A @mentions from cat response text.
 * F27: Returns all matched CatIds (up to MAX_A2A_MENTION_TARGETS).
 *
 * Line-start @mention = always actionable. No keyword gate.
 */
export function parseA2AMentions(text: string, currentCatId?: CatId, _options: A2AMentionParseOptions = {}): CatId[] {
  return analyzeA2AMentions(text, currentCatId, _options).mentions;
}

export function analyzeA2AMentions(
  text: string,
  currentCatId?: CatId,
  _options: A2AMentionParseOptions = {},
): A2AMentionAnalysis {
  if (!text) return { mentions: [], suppressed: [] };

  // 1. Strip fenced code blocks
  const stripped = text.replace(/```[\s\S]*?```/g, '');

  // F32-a: prefer catRegistry, fallback to static CAT_CONFIGS
  const allConfigs = Object.keys(catRegistry.getAllConfigs()).length > 0 ? catRegistry.getAllConfigs() : CAT_CONFIGS;

  // 2. Build patterns and sort longest-first to avoid prefix collisions
  const entries: MentionPatternEntry[] = [];
  for (const [id, config] of Object.entries(allConfigs)) {
    if (currentCatId && id === currentCatId) continue; // 4. Filter self (skip when cross-thread)
    if (!isCatAvailable(id)) continue;
    for (const pattern of config.mentionPatterns) {
      entries.push({ catId: id as CatId, pattern: pattern.toLowerCase() });
    }
  }
  entries.sort((a, b) => b.pattern.length - a.pattern.length);

  // 3. Line-start matching with token boundary — always actionable (no keyword gate)
  const found: CatId[] = [];
  const seen = new Set<string>();
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
      if (!seen.has(entry.catId)) {
        seen.add(entry.catId);
        found.push(entry.catId);
      }
      break; // longest-match-first: lock one winner for this line
    }
  }

  return { mentions: found, suppressed: [] };
}

/**
 * #417: Detect inline @mentions paired with action words — missed handoff candidates.
 * Used for write-side feedback only, NOT for routing.
 *
 * Conditions (all must hold):
 *  1. @pattern appears mid-line (not at line start)
 *  2. Same line contains an action keyword (请/帮/review/确认/处理/check/fix/merge/ready for/etc.)
 *  3. Not inside a fenced code block or blockquote
 *  4. Target cat was not already routed via line-start mention
 *  5. Not a self-mention
 */
const INLINE_ACTION_RE =
  /(?:请|帮|review|确认|处理|看一?下|check|fix|merge|ready\s+for|交接|接力|你来|你去)/i;

export function detectInlineActionMentions(
  text: string,
  currentCatId?: CatId,
  routedMentions?: CatId[],
): InlineActionMention[] {
  if (!text) return [];

  const stripped = text.replace(/```[\s\S]*?```/g, '');
  const allConfigs =
    Object.keys(catRegistry.getAllConfigs()).length > 0 ? catRegistry.getAllConfigs() : CAT_CONFIGS;

  const entries: MentionPatternEntry[] = [];
  for (const [id, config] of Object.entries(allConfigs)) {
    if (currentCatId && id === currentCatId) continue;
    if (!isCatAvailable(id)) continue;
    for (const pattern of config.mentionPatterns) {
      entries.push({ catId: id as CatId, pattern: pattern.toLowerCase() });
    }
  }
  entries.sort((a, b) => b.pattern.length - a.pattern.length);

  const routedSet = new Set(routedMentions ?? []);
  const found: InlineActionMention[] = [];
  const seen = new Set<string>();

  for (const rawLine of stripped.split(/\r?\n/)) {
    const trimmed = rawLine.trimStart();
    const normalized = trimmed.toLowerCase();
    // Skip line-start @mentions (handled by parseA2AMentions) and blockquotes
    if (normalized.startsWith('@') || normalized.startsWith('>')) continue;

    for (const entry of entries) {
      const idx = normalized.indexOf(entry.pattern);
      if (idx < 0) continue;
      const charAfter = normalized[idx + entry.pattern.length];
      const isBoundary =
        !charAfter || TOKEN_BOUNDARY_RE.test(charAfter) || !HANDLE_CONTINUATION_RE.test(charAfter);
      if (!isBoundary) continue;
      if (routedSet.has(entry.catId)) continue;
      if (!INLINE_ACTION_RE.test(rawLine)) continue;
      if (!seen.has(entry.catId)) {
        seen.add(entry.catId);
        found.push({ catId: entry.catId, lineText: rawLine.trim() });
      }
      break;
    }
  }

  return found;
}
