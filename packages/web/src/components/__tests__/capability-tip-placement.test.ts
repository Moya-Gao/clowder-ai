import { describe, expect, it } from 'vitest';
import { getStreamingTipContexts, selectStreamingTipMessageId } from '../capability-tip-placement';

function streamingMessage(id: string, catId: string) {
  return {
    id,
    type: 'assistant',
    catId,
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    origin: 'stream',
    visibility: 'public',
    contentBlocks: null,
    toolEvents: null,
    metadata: null,
    summary: null,
    evidence: null,
    extra: null,
    source: null,
  };
}

describe('F244 streaming capability tip placement', () => {
  it('selects one streaming bubble for the thread-level tip surface', () => {
    expect(
      selectStreamingTipMessageId(
        [streamingMessage('msg-opus', 'opus'), streamingMessage('msg-codex', 'codex')] as never,
        { opus: 'streaming', codex: 'streaming' },
      ),
    ).toBe('msg-codex');
  });

  it('skips stalled streaming bubbles when selecting the single tip surface', () => {
    expect(
      selectStreamingTipMessageId(
        [streamingMessage('msg-opus', 'opus'), streamingMessage('msg-codex', 'codex')] as never,
        { opus: 'streaming', codex: 'suspected_stall' },
      ),
    ).toBe('msg-opus');
  });

  it('uses review contexts for ideate streaming waits', () => {
    expect(getStreamingTipContexts('ideate')).toEqual(['review', 'long_running']);
    expect(getStreamingTipContexts('execute')).toEqual(['thinking', 'long_running']);
  });
});
