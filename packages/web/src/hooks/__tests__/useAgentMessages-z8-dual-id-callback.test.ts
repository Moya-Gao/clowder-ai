/**
 * F194 Phase Z8 cloud R3 P1 (codex) — dual-id callback-final preservation.
 *
 * Bug: `applyBubbleEventWithRecovery` looks up the pre-reducer stream record
 * with `m.extra?.stream?.invocationId === canonicalInvocationId`. In F194 Phase
 * Z3 dual-id case, the stream row stores `{ invocationId: parent, turnInvocationId: turn }`,
 * but the incoming event carries `canonicalInvocationId = turn`. Direct
 * `extra.stream.invocationId` comparison misses → no synthetic stream record
 * appended → reducer's destructive callback overwrite drops stream content.
 *
 * Fix: use `getBubbleInvocationId(m)` for the lookup so turn-priority matches
 * the event's `canonicalInvocationId` (also turn-priority via
 * `bubble-event-adapter.ts` line 107 `canonicalInvocationId = turnId ?? chainId`).
 */
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/stores/chat-types';
import { applyBubbleEventWithRecovery } from '../useAgentMessages';

describe('F194 Phase Z8 cloud R3 P1 — applyBubbleEventWithRecovery dual-id callback preservation', () => {
  it('callback_final with turn id preserves stream content when stream row has dual id { invocationId: parent, turnInvocationId: turn }', () => {
    // Phase Z3 dual-id contract: same-parent multi-turn-same-cat broadcast
    // stamps stream record with both ids. Wrapper must match using stable key
    // (turn priority), not raw extra.stream.invocationId (which is parent).
    const parentId = 'parent-chain-z3dual';
    const turnId = 'turn-opus-1-z3dual';

    const streamRecord: ChatMessage = {
      id: 'msg-stream-dual',
      type: 'assistant',
      catId: 'opus',
      content: 'streaming progress that MUST be preserved across callback-final',
      timestamp: 1000,
      isStreaming: true,
      origin: 'stream',
      // Dual id: parent + turn (turn ≠ parent — typical multi-turn case)
      extra: { stream: { invocationId: parentId, turnInvocationId: turnId } },
    };

    const result = applyBubbleEventWithRecovery({
      threadId: 'thread-z3dual',
      currentMessages: [streamRecord],
      event: {
        type: 'callback_final',
        threadId: 'thread-z3dual',
        actorId: 'opus',
        // canonicalInvocationId = turn (per adapter: turnId ?? chainId)
        canonicalInvocationId: turnId,
        // chainInvocationId set when parent ≠ turn (per adapter line 113)
        chainInvocationId: parentId,
        bubbleKind: 'assistant_text',
        originPhase: 'callback/history',
        sourcePath: 'callback',
        messageId: 'msg-stream-dual',
        timestamp: 2000,
        payload: { content: 'final callback message' },
      },
    });

    // Z8 contract: projection collapses stream + callback into one canonical bubble.
    const bubbles = result.nextMessages.filter((m) => m.type === 'assistant');
    expect(bubbles).toHaveLength(1);
    const bubble = bubbles[0]!;

    // Both stream AND callback content must be present (concat by ts asc).
    // Pre-fix bug: stream content silently dropped (lookup mismatch → no synthetic
    // record appended → reducer's destructive overwrite wins).
    expect(bubble.content).toContain('streaming progress that MUST be preserved');
    expect(bubble.content).toContain('final callback message');
  });

  it('callback_final with legacy single-id stream row still preserves content (regression guard)', () => {
    // Legacy non-dual case: extra.stream.invocationId only, no turnInvocationId.
    // Both the old lookup and the new stable-key lookup must work here.
    const invId = 'inv-legacy-single';

    const streamRecord: ChatMessage = {
      id: 'msg-stream-legacy',
      type: 'assistant',
      catId: 'opus',
      content: 'legacy streaming content',
      timestamp: 1000,
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: invId } },
    };

    const result = applyBubbleEventWithRecovery({
      threadId: 'thread-legacy',
      currentMessages: [streamRecord],
      event: {
        type: 'callback_final',
        threadId: 'thread-legacy',
        actorId: 'opus',
        canonicalInvocationId: invId,
        bubbleKind: 'assistant_text',
        originPhase: 'callback/history',
        sourcePath: 'callback',
        messageId: 'msg-stream-legacy',
        timestamp: 2000,
        payload: { content: 'legacy callback message' },
      },
    });

    const bubbles = result.nextMessages.filter((m) => m.type === 'assistant');
    expect(bubbles).toHaveLength(1);
    const bubble = bubbles[0]!;
    expect(bubble.content).toContain('legacy streaming content');
    expect(bubble.content).toContain('legacy callback message');
  });
});
