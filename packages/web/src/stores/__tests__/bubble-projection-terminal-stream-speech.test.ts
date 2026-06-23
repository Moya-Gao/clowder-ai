import { describe, expect, it } from 'vitest';
import { projectCanonicalBubbles } from '../bubble-projection';

describe('F194 Saga21 R5 — terminal stream speech boundaries', () => {
  it('local coalesced stream carrier stays CLI stdout instead of terminal speech', () => {
    const content = 'inspecting files\n\nrunning tests\n\nfinal note from the same live carrier';
    const { messages } = projectCanonicalBubbles({
      records: [
        {
          id: 'msg-turn-live-codex-assistant_text',
          type: 'assistant',
          catId: 'codex',
          content,
          timestamp: 1000,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [{ id: 'tool-live-1', type: 'tool_use', label: 'rg', timestamp: 1000 }],
          extra: {
            stream: {
              invocationId: 'inv-live-parent',
              turnInvocationId: 'turn-live',
            },
          },
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe(content);
    expect(messages[0]!.extra?.stream?.speechContent).toBeUndefined();
    expect(messages[0]!.extra?.stream?.cliStdout).toBeUndefined();
  });

  it('terminal speech sentinel is preserved even when callback text changes', () => {
    const parent = 'inv-final-drain-changed';
    const turn = 'turn-final-drain-changed';
    const streamBody = 'draft final answer from stream';
    const callbackBody = 'polished final answer from callback';

    const [terminalStream] = projectCanonicalBubbles({
      records: [
        {
          id: 'same-final-id-changed',
          type: 'assistant',
          catId: 'codex',
          content: streamBody,
          timestamp: 1000,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [{ id: 'tool-final', type: 'tool_use', label: 'rg', timestamp: 1000 }],
          extra: { stream: { invocationId: parent, turnInvocationId: turn } },
        },
      ],
    }).messages;

    expect(terminalStream?.extra?.stream?.speechContent).toBe(streamBody);
    expect(terminalStream?.extra?.stream?.cliStdout).toBe('');

    const { messages } = projectCanonicalBubbles({
      records: [
        terminalStream!,
        {
          id: 'same-final-id-changed',
          type: 'assistant',
          catId: 'codex',
          content: callbackBody,
          timestamp: 1100,
          origin: 'callback',
          isStreaming: false,
          extra: { stream: { invocationId: parent, turnInvocationId: turn } },
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe(callbackBody);
    expect(messages[0]!.toolEvents?.map((event) => event.id)).toEqual(['tool-final']);
    expect(messages[0]!.extra?.stream?.speechContent).toBe(callbackBody);
    expect(messages[0]!.extra?.stream?.cliStdout).toBe('');
  });
});
