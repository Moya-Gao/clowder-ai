/**
 * A2A Mention Detection
 * 从猫回复文本中检测对其他猫的 @mention。
 *
 * 规则 (缅因猫 P1-3 + F27 multi-mention):
 * 1. 剥离围栏代码块 (```...```) 后再解析
 * 2. 行首匹配 (^\s*@猫名, 多行模式)
 * 3. 过滤自调用
 * 4. F27: 返回所有匹配的猫 (上限 MAX_A2A_MENTION_TARGETS)
 * 5. 只在猫回复完整结束后解析 (由调用方保证)
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';

/** Max A2A chain depth, configurable via env (read at call time for hot-reload) */
export function getMaxA2ADepth(): number {
  return Number(process.env['MAX_A2A_DEPTH']) || 15;
}

/** Max number of distinct cats a single message can @mention (F27 safety limit) */
const MAX_A2A_MENTION_TARGETS = 2;

/**
 * Parse A2A @mentions from cat response text.
 * F27: Returns all matched CatIds (up to MAX_A2A_MENTION_TARGETS).
 */
export function parseA2AMentions(text: string, currentCatId: CatId): CatId[] {
  if (!text) return [];

  // 1. Strip fenced code blocks
  const stripped = text.replace(/```[\s\S]*?```/g, '');

  // 2. Line-start matching across all cats
  const found: CatId[] = [];

  for (const [id, config] of Object.entries(CAT_CONFIGS)) {
    if (id === currentCatId) continue; // 3. Filter self
    if (found.length >= MAX_A2A_MENTION_TARGETS) break; // 4. Safety limit

    for (const pattern of config.mentionPatterns) {
      // mentionPatterns already include @ prefix (e.g. '@opus', '@布偶猫')
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`^\\s*${escaped}`, 'mi').test(stripped)) {
        if (!found.includes(id as CatId)) {
          found.push(id as CatId);
        }
        break; // One match per cat is enough
      }
    }
  }

  return found;
}
