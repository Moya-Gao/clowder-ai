/**
 * A2A Mention Detection
 * 从猫回复文本中检测对其他猫的 @mention。
 *
 * 规则 (缅因猫 P1-3):
 * 1. 剥离围栏代码块 (```...```) 后再解析
 * 2. 行首匹配 (^\s*@猫名, 多行模式)
 * 3. 过滤自调用
 * 4. 单目标 (每条回复只取第一个有效 mention)
 * 5. 只在猫回复完整结束后解析 (由调用方保证)
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';

/** Max A2A chain depth, configurable via env (read at call time for hot-reload) */
export function getMaxA2ADepth(): number {
  return Number(process.env['MAX_A2A_DEPTH']) || 15;
}

/**
 * Parse A2A @mentions from cat response text.
 * Returns at most one CatId (single target).
 */
export function parseA2AMentions(text: string, currentCatId: CatId): CatId[] {
  if (!text) return [];

  // 1. Strip fenced code blocks
  const stripped = text.replace(/```[\s\S]*?```/g, '');

  // 2. Line-start matching across all cats
  for (const [id, config] of Object.entries(CAT_CONFIGS)) {
    if (id === currentCatId) continue; // 3. Filter self

    for (const pattern of config.mentionPatterns) {
      // mentionPatterns already include @ prefix (e.g. '@opus', '@布偶猫')
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`^\\s*${escaped}`, 'mi').test(stripped)) {
        return [id as CatId]; // 4. Single target — return first match
      }
    }
  }

  return [];
}
