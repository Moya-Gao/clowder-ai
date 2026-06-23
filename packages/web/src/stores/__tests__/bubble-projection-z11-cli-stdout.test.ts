/**
 * F194 Phase Z11 — CLI Output stdout consistency (铲屎官 R15, 2026-05-16).
 *
 * Bug: when projection merges a stream record + a post_message callback into one
 * canonical bubble (Z8 KD-27), bubble origin becomes `callback`. ChatMessage.tsx:122
 * only feeds content to `toCliEvents` when `origin === 'stream'`, so the merged
 * (callback-origin) bubble's CLI Output loses its stdout — only tools remain.
 * 铲屎官 wants CLI Output behavior IDENTICAL whether or not there's a post_msg.
 *
 * Z11 initial fix kept Z8 merge and exposed cliStdout/speechContent. Runtime
 * evidence later showed this still violates the user's expected model:
 * post_message speech is its own bubble, while stream-origin CLI work logs stay
 * in the CLI bubble. Projection must therefore split callback-origin speech
 * records from stream-origin work-log records even when they share the same turn.
 */
import { describe, expect, it } from 'vitest';
import { projectCanonicalBubbles } from '../bubble-projection';
import type { ChatMessage } from '../chat-types';

describe('F194 Phase Z11 — projection keeps post_message speech separate from CLI work logs (AC-Z29)', () => {
  it('stream + callback same turn → two bubbles: CLI work log + post_message speech', () => {
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
    expect(messages).toHaveLength(2);
    const streamBubble = messages[0]!;
    const callbackBubble = messages[1]!;
    expect(streamBubble.origin).toBe('stream');
    expect(streamBubble.content).toBe('Confirmed — branch at 47c91e45c, single fix commit');
    expect(streamBubble.toolEvents?.length).toBe(1);
    expect(streamBubble.extra?.stream?.cliStdout).toBeUndefined();
    expect(streamBubble.extra?.stream?.speechContent).toBeUndefined();
    expect(callbackBubble.origin).toBe('callback');
    expect(callbackBubble.content).toBe('@codex Review continuity confirmed to 47c91e45 — APPROVE.');
    expect(callbackBubble.toolEvents).toBeUndefined();
  });

  it('streaming pure stream (no callback) → cliStdout/speechContent NOT set while work log is still live', () => {
    const records: ChatMessage[] = [
      {
        id: 'rec-stream-only',
        type: 'assistant',
        catId: 'opus',
        content: '接球。先 runtime preflight + 看最近 commits',
        timestamp: 1000,
        origin: 'stream',
        isStreaming: true,
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

  it('terminal single stream record with tools exposes speechContent so hydrate does not swallow body into CLI stdout', () => {
    const body =
      '准确结论：PR #2506 没漏 OpenCode native，但 AGY 当前仍应该保留 user payload 里的长 A2A fallback anchors。';
    const records: ChatMessage[] = [
      {
        id: '0001782172361930-000003-e6781bc9',
        type: 'assistant',
        catId: 'spark',
        content: body,
        timestamp: 1782172361930,
        origin: 'stream',
        isStreaming: false,
        toolEvents: [
          { id: 'tool-1782172361000-a', type: 'tool_use', label: 'command_execution', timestamp: 1782172361000 },
        ],
        extra: {
          stream: {
            invocationId: '644cc20f-1bfd-460f-b0ba-059972225cc1',
            turnInvocationId: '478f4a66-bade-4128-a2b0-ccfebe1d4722',
          },
        },
      },
    ];

    const { messages } = projectCanonicalBubbles({ records });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.origin).toBe('stream');
    expect(messages[0]!.content).toBe(body);
    expect(messages[0]!.extra?.stream?.speechContent).toBe(body);
    expect(messages[0]!.extra?.stream?.cliStdout).toBe('');
  });

  it('parent-only terminal stream record stays CLI work log until it is turn-bound', () => {
    const records: ChatMessage[] = [
      {
        id: 'parent-only-stream',
        type: 'assistant',
        catId: 'codex',
        content: 'legacy parent-only work log',
        timestamp: 1000,
        origin: 'stream',
        isStreaming: false,
        toolEvents: [{ id: 't1', type: 'tool_use', label: 'rg', timestamp: 1000 }],
        extra: { stream: { invocationId: 'parent-only-invocation' } },
      },
    ];

    const { messages } = projectCanonicalBubbles({ records });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe('legacy parent-only work log');
    expect(messages[0]!.extra?.stream?.speechContent).toBeUndefined();
    expect(messages[0]!.extra?.stream?.cliStdout).toBeUndefined();
  });

  it('multiple terminal stream work-log records do not masquerade as final speech', () => {
    const parent = 'inv-terminal-worklog';
    const turn = 'turn-terminal-worklog';
    const records: ChatMessage[] = [
      {
        id: 'work-1',
        type: 'assistant',
        catId: 'codex',
        content: 'inspecting files',
        timestamp: 1000,
        origin: 'stream',
        toolEvents: [{ id: 't1', type: 'tool_use', label: 'rg', timestamp: 1000 }],
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
      {
        id: 'work-2',
        type: 'assistant',
        catId: 'codex',
        content: 'running tests',
        timestamp: 1500,
        origin: 'stream',
        toolEvents: [{ id: 't2', type: 'tool_use', label: 'vitest', timestamp: 1500 }],
        extra: { stream: { invocationId: parent, turnInvocationId: turn } },
      },
    ];

    const { messages } = projectCanonicalBubbles({ records });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.origin).toBe('stream');
    expect(messages[0]!.content).toBe('inspecting files\n\nrunning tests');
    expect(messages[0]!.toolEvents?.map((event) => event.id)).toEqual(['t1', 't2']);
    expect(messages[0]!.extra?.stream?.speechContent).toBeUndefined();
    expect(messages[0]!.extra?.stream?.cliStdout).toBeUndefined();
  });

  it('re-projecting a previously split terminal stream strips stale speech metadata when more records arrive', () => {
    const parent = 'inv-reproject';
    const turn = 'turn-reproject';
    const firstRecord: ChatMessage = {
      id: 'work-1',
      type: 'assistant',
      catId: 'codex',
      content: 'first terminal-looking chunk',
      timestamp: 1000,
      origin: 'stream',
      isStreaming: false,
      toolEvents: [{ id: 't1', type: 'tool_use', label: 'rg', timestamp: 1000 }],
      extra: { stream: { invocationId: parent, turnInvocationId: turn } },
    };

    const [singleProjected] = projectCanonicalBubbles({ records: [firstRecord] }).messages;
    expect(singleProjected?.extra?.stream?.speechContent).toBe('first terminal-looking chunk');
    expect(singleProjected?.extra?.stream?.cliStdout).toBe('');

    const { messages } = projectCanonicalBubbles({
      records: [
        singleProjected!,
        {
          id: 'work-2',
          type: 'assistant',
          catId: 'codex',
          content: 'later work-log chunk',
          timestamp: 1500,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [{ id: 't2', type: 'tool_use', label: 'vitest', timestamp: 1500 }],
          extra: { stream: { invocationId: parent, turnInvocationId: turn } },
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe('first terminal-looking chunk\n\nlater work-log chunk');
    expect(messages[0]!.extra?.stream?.speechContent).toBeUndefined();
    expect(messages[0]!.extra?.stream?.cliStdout).toBeUndefined();
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

  it('multiple stream records + callback → stream parts merge, callback remains separate', () => {
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
    expect(messages).toHaveLength(2);
    expect(messages[0]!.origin).toBe('stream');
    expect(messages[0]!.content).toBe('first stream chunk\n\nsecond stream chunk');
    expect(messages[1]!.origin).toBe('callback');
    expect(messages[1]!.content).toBe('final speech');
  });

  it('exact-key callback drain preserves already-projected terminal stream speech', () => {
    const parent = 'inv-final-drain';
    const turn = 'turn-final-drain';
    const body = '最终结论：正文已经是 final stream speech，不应回流到 CLI stdout。';
    const [terminalStream] = projectCanonicalBubbles({
      records: [
        {
          id: 'same-final-id',
          type: 'assistant',
          catId: 'codex',
          content: body,
          timestamp: 1000,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [{ id: 't-final', type: 'tool_use', label: 'rg', timestamp: 1000 }],
          extra: { stream: { invocationId: parent, turnInvocationId: turn } },
        },
      ],
    }).messages;

    expect(terminalStream?.extra?.stream?.speechContent).toBe(body);
    expect(terminalStream?.extra?.stream?.cliStdout).toBe('');

    const { messages } = projectCanonicalBubbles({
      records: [
        terminalStream!,
        {
          id: 'same-final-id',
          type: 'assistant',
          catId: 'codex',
          content: body,
          timestamp: 1100,
          origin: 'callback',
          isStreaming: false,
          extra: { stream: { invocationId: parent, turnInvocationId: turn } },
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe(body);
    expect(messages[0]!.extra?.stream?.speechContent).toBe(body);
    expect(messages[0]!.extra?.stream?.cliStdout).toBe('');
  });
});
