/**
 * F222 Phase C: Retry burst detection.
 *
 * Detects when a user sends the same or very similar message repeatedly,
 * indicating their request may not have been processed correctly.
 *
 * Similarity: first RETRY_PREFIX_LENGTH characters match.
 * Threshold: ≥ RETRY_BURST_THRESHOLD matching messages in window.
 */

import { RETRY_BURST_THRESHOLD, RETRY_PREFIX_LENGTH } from './FrustrationDetector.js';

export interface RetryBurstResult {
  matched: boolean;
  matchCount: number;
  repeatedPrefix: string;
}

/**
 * Check if the current message has been sent repeatedly in the recent window.
 *
 * @param currentMessage - The message the user just sent
 * @param recentUserMessages - Recent user messages (newest first, from collectAndDetect helper)
 */
export function detectRetryBurst(currentMessage: string, recentUserMessages: string[]): RetryBurstResult {
  if (!currentMessage || recentUserMessages.length === 0) {
    return { matched: false, matchCount: 0, repeatedPrefix: '' };
  }

  const currentPrefix = currentMessage.slice(0, RETRY_PREFIX_LENGTH).trim();
  if (currentPrefix.length < 5) {
    // Too short to be meaningful — skip (e.g., "ok" / "好")
    return { matched: false, matchCount: 0, repeatedPrefix: '' };
  }

  // Count matches in recentUserMessages. In the real integration path,
  // recentUserMessages already includes the current message (detection runs
  // after storedUserMessage.append), so NO +1 needed. Direct count = total.
  let matchCount = 0;
  for (const msg of recentUserMessages) {
    const prefix = msg.slice(0, RETRY_PREFIX_LENGTH).trim();
    if (prefix === currentPrefix) {
      matchCount++;
    }
  }

  return {
    matched: matchCount >= RETRY_BURST_THRESHOLD,
    matchCount,
    repeatedPrefix: currentPrefix,
  };
}
