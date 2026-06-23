import { describe, expect, it } from 'vitest';
import { deriveBubbleId } from '@/debug/bubbleIdentity';
import { useChatStore } from '@/stores/chatStore';
import { flatCodexStreamBubbles, installActiveHarness } from './useAgentMessages-codex-tool-text-convergence.helpers';

const THREAD = 'thread-1';

function tool(parent: string, ts: number) {
  return {
    type: 'tool_use' as const,
    catId: 'codex' as const,
    threadId: THREAD,
    toolName: 'shell',
    toolInput: { command: 'rg --files' },
    invocationId: parent,
    timestamp: ts,
  };
}

function persistedTool(id = 'tool-live-carrier') {
  return {
    id,
    type: 'tool_use' as const,
    label: 'command_execution',
    detail: '/bin/zsh -lc "rg -n saga21"',
    timestamp: 1000,
  };
}

function text(parent: string, turn: string, content = '我来查，不靠记忆猜。', ts = 1100) {
  return {
    type: 'text' as const,
    catId: 'codex' as const,
    threadId: THREAD,
    content,
    origin: 'stream' as const,
    invocationId: parent,
    turnInvocationId: turn,
    timestamp: ts,
  };
}

function invocationCreated(parent: string, turn: string, ts = 1050) {
  return {
    type: 'system_info' as const,
    catId: 'codex' as const,
    threadId: THREAD,
    content: JSON.stringify({ type: 'invocation_created', catId: 'codex', invocationId: turn }),
    invocationId: parent,
    turnInvocationId: turn,
    timestamp: ts,
  };
}

describe('Codex active path — terminal stream and residue boundaries', () => {
  const harness = installActiveHarness();

  it('[final persisted turn + parent-only carrier] drops covered local CLI residue without losing tools', () => {
    const PARENT = 'parent-live-covered-carrier';
    const TURN = 'turn-live-covered-canonical';
    const toolEvent = persistedTool();

    useChatStore.setState({
      messages: [
        {
          id: deriveBubbleId(PARENT, 'codex', () => 'unused'),
          type: 'assistant',
          catId: 'codex',
          content: '',
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT } },
          timestamp: 900,
        },
        {
          id: '0001782195000000-000001-saga21',
          type: 'assistant',
          catId: 'codex',
          content: '最终判断写在同一个 bubble 里。',
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT, turnInvocationId: TURN } },
          timestamp: 1200,
        },
      ],
    });

    harness.render();
    harness.send(text(PARENT, TURN, '最终判断写在同一个 bubble 里。', 1300));
    harness.send({
      type: 'done',
      catId: 'codex',
      threadId: THREAD,
      invocationId: PARENT,
      turnInvocationId: TURN,
      isFinal: true,
    });

    const streamBubbles = flatCodexStreamBubbles();
    expect(streamBubbles).toHaveLength(1);
    expect(streamBubbles[0]!.id).toBe('0001782195000000-000001-saga21');
    expect(streamBubbles[0]!.content).toContain('最终判断写在同一个 bubble 里');
    expect(streamBubbles[0]!.toolEvents).toEqual([toolEvent]);
  });

  it('[final text + tools] projects live terminal stream text as body before hydration', () => {
    const PARENT = 'parent-live-final-text';
    const TURN = 'turn-live-final-text';
    const body = '最终结论：正文应该留在正文区，CLI Output 只展示工具。';

    harness.render();
    harness.send(invocationCreated(PARENT, TURN));
    harness.send(tool(PARENT, 1000));
    harness.send({ ...text(PARENT, TURN, body, 1100), isFinal: true });

    const streamBubbles = flatCodexStreamBubbles();
    expect(streamBubbles).toHaveLength(1);
    expect(streamBubbles[0]!.content).toBe(body);
    expect(streamBubbles[0]!.isStreaming).toBe(false);
    expect(streamBubbles[0]!.toolEvents?.length ?? 0).toBeGreaterThan(0);
    expect(streamBubbles[0]!.extra?.stream?.speechContent).toBe(body);
    expect(streamBubbles[0]!.extra?.stream?.cliStdout).toBe('');
  });

  it('[coalesced stream chunks + tools] keeps accumulated live work log out of terminal speech', () => {
    const PARENT = 'parent-live-coalesced-text';
    const TURN = 'turn-live-coalesced-text';
    const workLog = '先看文件输出\n';
    const finalChunk = '最终结论：只有最后 chunk 不足以代表整条 bubble。';

    harness.render();
    harness.send(invocationCreated(PARENT, TURN));
    harness.send(tool(PARENT, 1000));
    harness.send(text(PARENT, TURN, workLog, 1050));
    harness.send({ ...text(PARENT, TURN, finalChunk, 1100), isFinal: true });

    const streamBubbles = flatCodexStreamBubbles();
    expect(streamBubbles).toHaveLength(1);
    expect(streamBubbles[0]!.content).toBe(`${workLog}${finalChunk}`);
    expect(streamBubbles[0]!.isStreaming).toBe(false);
    expect(streamBubbles[0]!.toolEvents?.length ?? 0).toBeGreaterThan(0);
    expect(streamBubbles[0]!.extra?.stream?.speechContent).toBeUndefined();
    expect(streamBubbles[0]!.extra?.stream?.cliStdout).toBeUndefined();
  });

  it('[same parent, different user turn] keeps earlier parent-only carrier even when later turn repeats it', () => {
    const PARENT = 'parent-cross-turn-cleanup';
    const LATER_TURN = 'turn-cross-turn-later';
    const toolEvent = persistedTool('tool-cross-turn');
    const repeatedText = 'same command output';
    const residueId = deriveBubbleId(PARENT, 'codex', () => 'unused');

    useChatStore.setState({
      messages: [
        {
          id: residueId,
          type: 'assistant',
          catId: 'codex',
          content: repeatedText,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT } },
          timestamp: 900,
        },
        {
          id: 'user-between-turns',
          type: 'user',
          content: 'next turn',
          timestamp: 1000,
        },
        {
          id: '0001782196000000-000001-cross-turn',
          type: 'assistant',
          catId: 'codex',
          content: repeatedText,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT, turnInvocationId: LATER_TURN } },
          timestamp: 1200,
        },
      ],
    });

    harness.render();
    harness.send(text(PARENT, LATER_TURN, repeatedText, 1300));

    const streamBubbles = flatCodexStreamBubbles();
    expect(streamBubbles).toHaveLength(2);
    expect(streamBubbles.find((message) => message.id === residueId)).toBeDefined();
    expect(streamBubbles.find((message) => message.extra?.stream?.turnInvocationId === LATER_TURN)).toBeDefined();
  });

  it('[same parent, A2A routing boundary] keeps earlier parent-only carrier even when later turn repeats it', () => {
    const PARENT = 'parent-cross-a2a-routing-cleanup';
    const LATER_TURN = 'turn-cross-a2a-routing-later';
    const toolEvent = persistedTool('tool-cross-a2a-routing');
    const repeatedText = 'same A2A command output';
    const residueId = deriveBubbleId(PARENT, 'codex', () => 'unused');

    useChatStore.setState({
      messages: [
        {
          id: residueId,
          type: 'assistant',
          catId: 'codex',
          content: repeatedText,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT } },
          timestamp: 900,
        },
        {
          id: 'a2a-boundary-between-codex-turns',
          type: 'system',
          variant: 'info',
          content: 'codex -> opus47 -> codex',
          timestamp: 1000,
          extra: {
            systemKind: 'a2a_routing',
            a2aRouting: {
              fromCatId: 'codex',
              targetCatId: 'opus47',
              invocationId: PARENT,
            },
          },
        },
        {
          id: '0001782197000000-000001-cross-a2a-routing',
          type: 'assistant',
          catId: 'codex',
          content: repeatedText,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT, turnInvocationId: LATER_TURN } },
          timestamp: 1200,
        },
      ],
    });

    harness.render();
    harness.send(text(PARENT, LATER_TURN, repeatedText, 1300));

    const streamBubbles = flatCodexStreamBubbles();
    expect(streamBubbles).toHaveLength(2);
    expect(streamBubbles.find((message) => message.id === residueId)).toBeDefined();
    expect(streamBubbles.find((message) => message.extra?.stream?.turnInvocationId === LATER_TURN)).toBeDefined();
  });

  it('[same parent, other-cat assistant boundary] keeps earlier parent-only carrier even when later turn repeats it', () => {
    const PARENT = 'parent-cross-other-cat-cleanup';
    const LATER_TURN = 'turn-cross-other-cat-later';
    const toolEvent = persistedTool('tool-cross-other-cat');
    const repeatedText = 'same other-cat chain output';
    const residueId = deriveBubbleId(PARENT, 'codex', () => 'unused');

    useChatStore.setState({
      messages: [
        {
          id: residueId,
          type: 'assistant',
          catId: 'codex',
          content: repeatedText,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT } },
          timestamp: 900,
        },
        {
          id: '0001782198000000-000001-opus47-boundary',
          type: 'assistant',
          catId: 'opus47',
          content: 'another cat answered in the same A2A parent chain',
          origin: 'stream',
          isStreaming: false,
          extra: {
            stream: {
              invocationId: PARENT,
              turnInvocationId: 'turn-cross-other-cat-opus47',
            },
          },
          timestamp: 1000,
        },
        {
          id: '0001782199000000-000001-cross-other-cat',
          type: 'assistant',
          catId: 'codex',
          content: repeatedText,
          origin: 'stream',
          isStreaming: false,
          toolEvents: [toolEvent],
          extra: { stream: { invocationId: PARENT, turnInvocationId: LATER_TURN } },
          timestamp: 1200,
        },
      ],
    });

    harness.render();
    harness.send(text(PARENT, LATER_TURN, repeatedText, 1300));

    const streamBubbles = flatCodexStreamBubbles();
    expect(streamBubbles).toHaveLength(2);
    expect(streamBubbles.find((message) => message.id === residueId)).toBeDefined();
    expect(streamBubbles.find((message) => message.extra?.stream?.turnInvocationId === LATER_TURN)).toBeDefined();
  });
});
