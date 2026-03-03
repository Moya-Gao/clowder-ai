import type { CatId } from '@cat-cafe/shared';
import { getRoster, loadCatConfig, toFlatConfigs } from '../../../../config/cat-config-loader.js';

const REVIEW_REQUEST_PATTERNS: ReadonlyArray<RegExp> = [
  /(^|\n)\s*@\S+\s+review\b/i,
  /请\s*review/i,
  /review\s*请求/i,
  /\breview\s*request\b/i,
  /\bplease\s+review\b/i,
  /\breview\s*(?:pls|please)\b/i,
  /请\s*lgtm/i,
  /求\s*lgtm/i,
  /帮我看看/i,
  /请 reviewer 看看/i,
];

const REVIEW_REQUEST_TAIL_PATTERNS: ReadonlyArray<RegExp> = [
  /^review\b/i,
  /^请\s*review\b/i,
  /^review\s*请求/i,
  /^review\s*request\b/i,
  /^please\s+review\b/i,
  /^review\s*(?:pls|please)\b/i,
  /^请\s*lgtm\b/i,
  /^求\s*lgtm\b/i,
  /^帮我看看/i,
  /^请\s*reviewer\s*看看/i,
];

let cachedMentionPatternsByCatId: Record<string, readonly string[]> | null = null;

function getMentionPatternsByCatId(): Record<string, readonly string[]> {
  if (cachedMentionPatternsByCatId) return cachedMentionPatternsByCatId;
  try {
    const configs = toFlatConfigs(loadCatConfig());
    cachedMentionPatternsByCatId = Object.fromEntries(
      Object.entries(configs).map(([catId, cfg]) => [
        catId.toLowerCase(),
        Array.from(new Set(cfg.mentionPatterns.map((p) => p.toLowerCase()))),
      ]),
    );
  } catch {
    cachedMentionPatternsByCatId = {};
  }
  return cachedMentionPatternsByCatId;
}

function getTargetMentions(catId: CatId): readonly string[] {
  const normalized = String(catId).toLowerCase();
  const byCat = getMentionPatternsByCatId();
  return byCat[normalized] ?? [`@${normalized}`];
}

function hasMentionBoundary(ch: string | undefined): boolean {
  if (!ch) return true;
  return /\s|[,:;.!?，。：；！？]/.test(ch);
}

function extractTargetLineTail(line: string, targetMentions: readonly string[]): string | null {
  const normalized = line.trimStart().toLowerCase();
  for (const mention of targetMentions) {
    if (!normalized.startsWith(mention)) continue;
    const next = normalized.charAt(mention.length);
    if (!hasMentionBoundary(next)) continue;
    const tail = normalized.slice(mention.length).trimStart();
    // Normalize separators right after mention (e.g. "@gpt52: 请 review")
    // so tail matching is robust to punctuation styles.
    return tail.replace(/^[,.:;!?，。：；！？]+/, '').trimStart();
  }
  return null;
}

function isTargetedReviewRequest(message: string, targetCatId: CatId): boolean {
  if (!message.trim()) return false;
  const targetMentions = getTargetMentions(targetCatId);
  for (const line of message.split(/\r?\n/)) {
    const tail = extractTargetLineTail(line, targetMentions);
    if (tail == null || tail.length === 0) continue;
    if (REVIEW_REQUEST_TAIL_PATTERNS.some((pattern) => pattern.test(tail))) return true;
  }
  return false;
}

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
  if (!isTargetedReviewRequest(input.message, input.toCatId)) return false;

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
