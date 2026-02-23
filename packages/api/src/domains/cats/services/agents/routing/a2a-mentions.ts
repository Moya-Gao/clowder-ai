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

interface MentionPatternEntry {
  readonly catId: CatId;
  readonly pattern: string;
}

/**
 * Parse A2A @mentions from cat response text.
 * F27: Returns all matched CatIds (up to MAX_A2A_MENTION_TARGETS).
 */
export function parseA2AMentions(text: string, currentCatId: CatId): CatId[] {
  if (!text) return [];

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
  const seen = new Set<string>();
  const lines = stripped.split(/\r?\n/);
  for (const rawLine of lines) {
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

  return found;
}
