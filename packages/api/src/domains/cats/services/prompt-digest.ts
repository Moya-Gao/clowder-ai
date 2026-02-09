/**
 * Prompt Digest
 * 生成 prompt 的摘要信息，用于审计日志。
 *
 * 设计原则：
 * - 不存储完整 prompt（隐私 + 体积）
 * - 保留足够信息用于调试（长度、首尾、hash）
 * - hash 可用于比对是否同一 prompt
 */

import { createHash } from 'node:crypto';

export interface PromptDigest {
  /** 原始 prompt 长度 */
  length: number;
  /** 首 100 字符 */
  head: string;
  /** 末 100 字符 (如果长度 > 200) */
  tail?: string;
  /** SHA256 hash 前 16 位 (可用于比对) */
  hash: string;
}

/**
 * Create a digest of the prompt for audit logging.
 * Does not store the full prompt for privacy reasons.
 */
export function createPromptDigest(prompt: string): PromptDigest {
  const hash = createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  const head = prompt.slice(0, 100);
  const tail = prompt.length > 200 ? prompt.slice(-100) : undefined;

  return {
    length: prompt.length,
    head,
    ...(tail ? { tail } : {}),
    hash,
  };
}
