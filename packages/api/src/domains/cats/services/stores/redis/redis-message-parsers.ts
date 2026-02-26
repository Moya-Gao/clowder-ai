/**
 * Redis message field parsers — 从 RedisMessageStore 拆出的纯函数
 *
 * F23: 拆分以减少 RedisMessageStore.ts 行数
 */

import type { CatId, ConnectorSource, MessageContent, RichMessageExtra } from '@cat-cafe/shared';
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

/** F22: Parse extra field (contains rich blocks + stream metadata) */
export function safeParseExtra(
  raw: string | undefined,
): { rich?: RichMessageExtra; stream?: { invocationId: string } } | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;

    const result: { rich?: RichMessageExtra; stream?: { invocationId: string } } = {};
    let hasField = false;

    // Validate rich sub-field shape
    if (parsed.rich && typeof parsed.rich === 'object' && parsed.rich.v === 1 && Array.isArray(parsed.rich.blocks)) {
      result.rich = parsed.rich as RichMessageExtra;
      hasField = true;
    }

    // Validate stream sub-field shape (#80: draft dedup key)
    if (parsed.stream && typeof parsed.stream === 'object' && typeof parsed.stream.invocationId === 'string') {
      result.stream = { invocationId: parsed.stream.invocationId };
      hasField = true;
    }

    return hasField ? result : undefined;
  } catch {
    return undefined;
  }
}

/** F97: Parse connector source field */
export function safeParseConnectorSource(raw: string | undefined): ConnectorSource | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof parsed.connector === 'string' &&
      typeof parsed.label === 'string' &&
      typeof parsed.icon === 'string'
    ) {
      return parsed as ConnectorSource;
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
