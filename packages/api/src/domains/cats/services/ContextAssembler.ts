/**
 * Context Assembler
 * 从 messageStore 历史消息组装上下文字符串，prepend 到猫的 prompt 中。
 * 解决跨猫历史不可见问题 (猫咖狼人杀 bug report 的核心修复)。
 *
 * formatMessage() 也被 export route 复用 (聊天记录导出)。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { StoredMessage } from './MessageStore.js';

export interface ContextAssemblerOptions {
  /** Maximum number of recent messages to include (default: 20) */
  maxMessages?: number;
  /** Maximum characters per message content (default: 500) */
  maxContentLength?: number;
}

export interface AssembledContext {
  /** Formatted context string to prepend to prompt */
  contextText: string;
  /** Number of messages included */
  messageCount: number;
}

const DEFAULT_MAX_MESSAGES = 20;
const DEFAULT_MAX_CONTENT_LENGTH = 500;

/**
 * Get display name for a message sender.
 * catId === null → user ("铲屎官"), otherwise look up CAT_CONFIGS.
 */
function getSenderName(catId: string | null): string {
  if (catId === null) return '铲屎官';
  const config = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
  return config?.displayName ?? catId;
}

/** Format timestamp as HH:MM */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Format a single message for display.
 * Shared by context assembly (with truncation) and export (without truncation).
 *
 * @returns `[HH:MM 角色名] 内容`
 */
export function formatMessage(
  msg: StoredMessage,
  options?: { truncate?: number },
): string {
  const time = formatTime(msg.timestamp);
  const sender = getSenderName(msg.catId);
  let content = msg.content;
  if (options?.truncate && content.length > options.truncate) {
    content = content.slice(0, options.truncate) + '...';
  }
  return `[${time} ${sender}] ${content}`;
}

/**
 * Check if a message is a system/error message that should be excluded from context.
 * StoredMessage has no 'type' field — infer from catId + content pattern.
 */
function isSystemMessage(msg: StoredMessage): boolean {
  return msg.catId === null && msg.content.startsWith('Error:');
}

/**
 * Assemble recent thread history into a context string for prompt prepend.
 */
export function assembleContext(
  messages: StoredMessage[],
  options?: ContextAssemblerOptions,
): AssembledContext {
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const maxContentLength = options?.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  // Filter out system/error messages
  const filtered = messages.filter((m) => !isSystemMessage(m));

  if (filtered.length === 0) {
    return { contextText: '', messageCount: 0 };
  }

  // Take the most recent N messages (messages are already chronological from store)
  const recent = filtered.length > maxMessages
    ? filtered.slice(-maxMessages)
    : filtered;

  const lines = recent.map((m) => formatMessage(m, { truncate: maxContentLength }));
  const header = `[对话历史 - 最近 ${recent.length} 条]`;
  const contextText = `${header}\n${lines.join('\n')}\n---`;

  return { contextText, messageCount: recent.length };
}
