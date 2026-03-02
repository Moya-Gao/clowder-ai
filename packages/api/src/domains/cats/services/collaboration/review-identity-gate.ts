import type { CatId } from '@cat-cafe/shared';
import { getRoster } from '../../../../config/cat-config-loader.js';

const REVIEW_REQUEST_PATTERNS: ReadonlyArray<RegExp> = [
  /\breview\b/i,
  /\blgtm\b/i,
  /请\s*review/i,
  /帮我看看/i,
  /请 reviewer 看看/i,
];

export interface ShouldRequireReviewIdentityGateInput {
  fromCatId: CatId;
  toCatId: CatId;
  message: string;
}

export interface ReviewIdentityHandshakeResult {
  valid: boolean;
  reason?: string;
}

export function isReviewRequestMessage(message: string): boolean {
  if (!message.trim()) return false;
  return REVIEW_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
}

export function shouldRequireReviewIdentityGate(
  input: ShouldRequireReviewIdentityGateInput,
): boolean {
  if (!isReviewRequestMessage(input.message)) return false;

  const roster = getRoster();
  const from = roster[input.fromCatId as string];
  const to = roster[input.toCatId as string];

  if (!from || !to) return false;
  if (input.fromCatId === input.toCatId) return false;

  const targetIsReviewer = Array.isArray(to.roles) && to.roles.includes('peer-reviewer');
  if (!targetIsReviewer) return false;

  return from.family === to.family;
}

/**
 * 同族 reviewer gate：首行必须是 Identity Check，且句柄必须匹配当前 reviewer。
 */
export function validateReviewIdentityHandshake(
  responseText: string,
  reviewerCatId: CatId,
): ReviewIdentityHandshakeResult {
  const firstLine = responseText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return { valid: false, reason: 'missing identity check line' };
  }

  if (!/^Identity Check:/i.test(firstLine)) {
    return { valid: false, reason: 'missing Identity Check: prefix on first line' };
  }

  const expectedHandle = String(reviewerCatId).toLowerCase();
  const mentionedHandles = new Set<string>();
  for (const match of firstLine.matchAll(/@([A-Za-z0-9][A-Za-z0-9_-]*)/g)) {
    const handle = match[1];
    if (handle) mentionedHandles.add(handle.toLowerCase());
  }
  if (!mentionedHandles.has(expectedHandle)) {
    return {
      valid: false,
      reason: `identity check handle mismatch (expected @${reviewerCatId})`,
    };
  }

  if (!/model\s*=\s*/i.test(firstLine)) {
    return { valid: false, reason: 'identity check line must include model=' };
  }

  return { valid: true };
}
