/**
 * Cat Types and Configurations
 * 三只 AI 猫猫的类型定义和配置
 */

import type { CatId, SessionId } from './ids.js';
import { createCatId } from './ids.js';

/**
 * Cat status in the system
 */
export type CatStatus = 'idle' | 'thinking' | 'working' | 'error' | 'offline';

/**
 * Cat color configuration
 */
export interface CatColor {
  readonly primary: string;
  readonly secondary: string;
}

/**
 * Cat configuration (immutable)
 */
export interface CatConfig {
  readonly id: CatId;
  readonly name: string;
  readonly displayName: string;
  readonly avatar: string;
  readonly color: CatColor;
  readonly mentionPatterns: readonly string[];
}

/**
 * Cat runtime state
 */
export interface CatState {
  readonly id: CatId;
  readonly status: CatStatus;
  readonly currentTask?: string;
  readonly lastActiveAt: Date;
  readonly sessionId?: SessionId;
}

/**
 * Configuration for all three cats
 */
export const CAT_CONFIGS: Record<'opus' | 'codex' | 'gemini', CatConfig> = {
  opus: {
    id: createCatId('opus'),
    name: 'opus',
    displayName: '布偶猫',
    avatar: '/avatars/opus.png',
    color: {
      primary: '#9B7EBD',
      secondary: '#E8DFF5',
    },
    mentionPatterns: ['@opus', '@布偶猫', '@布偶', '@ragdoll'],
  },
  codex: {
    id: createCatId('codex'),
    name: 'codex',
    displayName: '缅因猫',
    avatar: '/avatars/codex.png',
    color: {
      primary: '#5B8C5A',
      secondary: '#D4E6D3',
    },
    mentionPatterns: ['@codex', '@缅因猫', '@缅因', '@maine'],
  },
  gemini: {
    id: createCatId('gemini'),
    name: 'gemini',
    displayName: '暹罗猫',
    avatar: '/avatars/gemini.png',
    color: {
      primary: '#5B9BD5',
      secondary: '#D6E9F8',
    },
    mentionPatterns: ['@gemini', '@暹罗猫', '@暹罗', '@siamese'],
  },
} as const;

/**
 * Find a cat by mention pattern in text
 * @param text - The text to search for mentions
 * @returns The CatConfig if found, undefined otherwise
 */
export function findCatByMention(text: string): CatConfig | undefined {
  const lowerText = text.toLowerCase();

  for (const config of Object.values(CAT_CONFIGS)) {
    for (const pattern of config.mentionPatterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return config;
      }
    }
  }

  return undefined;
}

/**
 * Get all cat IDs
 */
export function getAllCatIds(): readonly CatId[] {
  return Object.values(CAT_CONFIGS).map((config) => config.id);
}
