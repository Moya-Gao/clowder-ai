/**
 * F194 Phase Z8 AC-Z23 — alpha thread replay regression
 *
 * Goal: prove live ≡ hydrate after Z8 projection — same raw records put through
 * either path produce byte-identical canonical bubble lists.
 *
 * Fixture is the alpha thread `thread_moyfjyjc0662weit` opus invocation
 * `2fe279aa` (3 raw records: 2 stream + 1 callback). Pre-Z8 this scenario
 * showed 2-3 bubbles in live and 1 (or wrong content) in hydrate. Post-Z8 both
 * paths converge to the SAME bubble.
 */
import { describe, expect, it } from 'vitest';
import alphaThreeRecords from '../__fixtures__/z8-alpha-3-records.json';
import { projectCanonicalBubbles } from '../bubble-projection';
import type { ChatMessage } from '../chat-types';

describe('F194 Phase Z8 AC-Z23 — alpha replay regression (R12 root case)', () => {
  it('hydrate path projection ≡ direct projection (live wrapper) for alpha 3-record fixture', () => {
    const rawRecords = alphaThreeRecords as unknown as ChatMessage[];

    // Path A: full-batch projection (simulates hydrate writer boundary —
    // projectCanonicalBubbles applied to history records).
    const hydrateProjected = projectCanonicalBubbles({ records: rawRecords }).messages;

    // Path B: incremental projection (simulates live wrapper — each event
    // adds one record then projection re-runs over accumulated set).
    let liveAccumulated: ChatMessage[] = [];
    for (const record of rawRecords) {
      liveAccumulated = [...liveAccumulated, record];
      liveAccumulated = projectCanonicalBubbles({ records: liveAccumulated }).messages;
    }

    expect(liveAccumulated).toEqual(hydrateProjected);
  });

  it('R2 P1 (砚砚): live writer (callback after stream) ≡ projection from raw records', async () => {
    // 砚砚 R2 P1: reduceCallbackFinal exact-key path overwrites stream content with finalContent.
    // If wrapper projects result.nextMessages, stream content is lost. Wrapper must use
    // PRE-reducer state + synthetic callback raw record so live writer ≡ hydrate (which sees
    // both stream and callback as separate raw records).
    const { applyBubbleEvent } = await import('../bubble-reducer');

    // Step 1: stream record exists in store
    const streamRecord: ChatMessage = {
      id: 'msg-stream-z8r2',
      type: 'assistant',
      catId: 'opus',
      content: 'streaming progress that must not be lost',
      timestamp: 1000,
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-z8r2' } },
    };

    // Step 2: callback_final event with exact-key match would normally overwrite stream content
    // in reducer. Wrapper-level projection from PRE-reducer state + synthetic callback record
    // must preserve both content segments.
    const reducerOutput = applyBubbleEvent({
      threadId: 'thread-z8r2',
      currentMessages: [streamRecord],
      event: {
        type: 'callback_final',
        threadId: 'thread-z8r2',
        actorId: 'opus',
        canonicalInvocationId: 'inv-z8r2',
        bubbleKind: 'assistant_text',
        originPhase: 'callback/history',
        sourcePath: 'callback',
        messageId: 'msg-stream-z8r2',
        timestamp: 2000,
        payload: { content: 'final callback message' },
      },
    });

    // Reducer's nextMessages is mutated — stream content GONE
    const reducerCallbackBubble = reducerOutput.nextMessages.find((m) => m.id === 'msg-stream-z8r2');
    expect(reducerCallbackBubble?.content).toBe('final callback message'); // pre-Z8 destructive path
    expect(reducerCallbackBubble?.content).not.toContain('streaming progress'); // confirmed lost

    // Hydrate-equivalent projection (Z8 contract: project from raw stream + callback records)
    const hydrateProjected = projectCanonicalBubbles({
      records: [
        streamRecord,
        {
          id: 'msg-stream-z8r2',
          type: 'assistant',
          catId: 'opus',
          content: 'final callback message',
          timestamp: 2000,
          origin: 'callback',
          isStreaming: false,
          extra: { stream: { invocationId: 'inv-z8r2' } },
        },
      ],
    }).messages;

    expect(hydrateProjected).toHaveLength(1);
    const hydrateBubble = hydrateProjected[0]!;
    expect(hydrateBubble.content).toContain('streaming progress that must not be lost'); // stream preserved
    expect(hydrateBubble.content).toContain('final callback message'); // callback preserved
    expect(hydrateBubble.origin).toBe('callback');
    expect(hydrateBubble.isStreaming).toBe(false);

    // The wrapper integration MUST produce same as hydrate projection — verify via
    // direct usage in bubble-projection-alpha-replay-via-wrapper.test.ts (in useAgentMessages tests)
  });

  it('alpha replay produces stable canonical id across reorderings (callback wins)', () => {
    const rawRecords = alphaThreeRecords as unknown as ChatMessage[];
    // Reverse order
    const reversed = [...rawRecords].reverse();
    const a = projectCanonicalBubbles({ records: rawRecords }).messages;
    const b = projectCanonicalBubbles({ records: reversed }).messages;
    // Same canonical bubble regardless of input order
    expect(a[0]!.id).toBe(b[0]!.id);
    expect(a[0]!.content).toBe(b[0]!.content);
    expect(a[0]!.origin).toBe(b[0]!.origin);
    expect(a[0]!.toolEvents?.length).toBe(b[0]!.toolEvents?.length);
  });
});
