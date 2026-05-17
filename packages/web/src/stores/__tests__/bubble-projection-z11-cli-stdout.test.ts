/**
 * F194 Phase Z11 — CLI Output stdout consistency (铲屎官 R15, 2026-05-16).
 *
 * Bug: when projection merges a stream record + a post_message callback into one
 * canonical bubble (Z8 KD-27), bubble origin becomes `callback`. ChatMessage.tsx:122
 * only feeds content to `toCliEvents` when `origin === 'stream'`, so the merged
 * (callback-origin) bubble's CLI Output loses its stdout — only tools remain.
 * 铲屎官 wants CLI Output behavior IDENTICAL whether or not there's a post_msg.
 *
 * Fix (chosen option A — keep Z8 merge, restore consistency): projection exposes
 *   - extra.stream.cliStdout: stream-origin content portion (→ CLI Output stdout)
 *   - extra.stream.speechContent: callback-origin content portion (→ main body)
 * ONLY when a group has BOTH stream and callback records. content concat stays
 * unchanged so R12/R13/search/hydrate are untouched.
 */
import { describe, expect, it } from 'vitest';
import { projectCanonicalBubbles } from '../bubble-projection';
import type { ChatMessage } from '../chat-types';

describe('F194 Phase Z11 — projection exposes cliStdout + speechContent on merge (AC-Z29)', () => {
  it('stream + callback same turn → merged bubble carries cliStdout (stream) + speechContent (callback)', () => {
    const parent = 'inv-z11-parent';
    const turn = 'turn-z11';
    const records: ChatMessage[] = [
      {
        id: 'rec-stream',
        type: 'assistant',
        catId: 'opus',
        content: 'Confirmed — branch at 47c91e45c, single fix commit',
        timestamp: 1000,
        origin: 'stream',
        isStreaming: true,
        toolEvents: [{ id: 't1', type: 'tool_use', label: 'bash', timestamp: 1000 }],
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
      {
        id: 'rec-callback',
        type: 'assistant',
        catId: 'opus',
        content: '@codex Review continuity confirmed to 47c91e45 — APPROVE.',
        timestamp: 2000,
        origin: 'callback',
        isStreaming: false,
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
    ];

    const { messages } = projectCanonicalBubbles({ records });
    expect(messages).toHaveLength(1);
    const b = messages[0]!;
    expect(b.origin).toBe('callback');
    // content concat unchanged (R12/R13/search/hydrate contract preserved)
    expect(b.content).toContain('Confirmed — branch at 47c91e45c');
    expect(b.content).toContain('@codex Review continuity confirmed');
    // Z11: stream portion exposed for CLI Output stdout
    expect(b.extra?.stream?.cliStdout).toBe('Confirmed — branch at 47c91e45c, single fix commit');
    // Z11: callback portion exposed for main body (the post_msg speech)
    expect(b.extra?.stream?.speechContent).toBe('@codex Review continuity confirmed to 47c91e45 — APPROVE.');
    // tools preserved
    expect(b.toolEvents?.length).toBe(1);
  });

  it('pure stream (no callback) → cliStdout/speechContent NOT set (rendering unchanged)', () => {
    const records: ChatMessage[] = [
      {
        id: 'rec-stream-only',
        type: 'assistant',
        catId: 'opus',
        content: '接球。先 runtime preflight + 看最近 commits',
        timestamp: 1000,
        origin: 'stream',
        isStreaming: false,
        toolEvents: [{ id: 't1', type: 'tool_use', label: 'bash', timestamp: 1000 }],
        extra: { stream: { invocationId: 'inv-pure-stream', turnInvocationId: 'turn-pure-stream' } },
      },
    ];
    const { messages } = projectCanonicalBubbles({ records });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.origin).toBe('stream');
    expect(messages[0]!.extra?.stream?.cliStdout).toBeUndefined();
    expect(messages[0]!.extra?.stream?.speechContent).toBeUndefined();
  });

  it('pure callback (no stream) → cliStdout/speechContent NOT set', () => {
    const records: ChatMessage[] = [
      {
        id: 'rec-cb-only',
        type: 'assistant',
        catId: 'opus',
        content: 'standalone post_message speech',
        timestamp: 1000,
        origin: 'callback',
        isStreaming: false,
        extra: { stream: { invocationId: 'inv-cb', turnInvocationId: 'turn-cb' } },
      },
    ];
    const { messages } = projectCanonicalBubbles({ records });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.origin).toBe('callback');
    expect(messages[0]!.extra?.stream?.cliStdout).toBeUndefined();
    expect(messages[0]!.extra?.stream?.speechContent).toBeUndefined();
  });

  it('multiple stream records + callback → cliStdout concats all stream parts', () => {
    const parent = 'inv-multi';
    const turn = 'turn-multi';
    const records: ChatMessage[] = [
      {
        id: 's1',
        type: 'assistant',
        catId: 'codex',
        content: 'first stream chunk',
        timestamp: 1000,
        origin: 'stream',
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
      {
        id: 's2',
        type: 'assistant',
        catId: 'codex',
        content: 'second stream chunk',
        timestamp: 1500,
        origin: 'stream',
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
      {
        id: 'cb',
        type: 'assistant',
        catId: 'codex',
        content: 'final speech',
        timestamp: 2000,
        origin: 'callback',
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
    ];
    const { messages } = projectCanonicalBubbles({ records });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.extra?.stream?.cliStdout).toBe('first stream chunk\n\nsecond stream chunk');
    expect(messages[0]!.extra?.stream?.speechContent).toBe('final speech');
  });
});
