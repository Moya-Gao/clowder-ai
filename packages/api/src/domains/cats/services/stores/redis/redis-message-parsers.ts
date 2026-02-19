/**
 * Redis message field parsers — 从 RedisMessageStore 拆出的纯函数
 *
 * F23: 拆分以减少 RedisMessageStore.ts 行数
 */

import type { CatId, MessageContent, RichMessageExtra } from '@cat-cafe/shared';
import type { StoredToolEvent } from '../ports/MessageStore.js';
import type { MessageMetadata } from '../../types.js';

export function safeParseMentions(raw: string | undefined): readonly CatId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function safeParseToolEvents(raw: string | undefined): readonly StoredToolEvent[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function safeParseContentBlocks(raw: string | undefined): readonly MessageContent[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** F22: Parse extra field (contains rich blocks and future extensible data) */
export function safeParseExtra(raw: string | undefined): { rich?: RichMessageExtra } | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      // Validate rich sub-field shape
      if (parsed.rich && typeof parsed.rich === 'object' && parsed.rich.v === 1 && Array.isArray(parsed.rich.blocks)) {
        return { rich: parsed.rich as RichMessageExtra };
      }
      // extra exists but no valid rich — still return the shell
      return undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function safeParseMetadata(raw: string | undefined): MessageMetadata | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof parsed.provider === 'string' &&
      typeof parsed.model === 'string'
    ) {
      return parsed as MessageMetadata;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
