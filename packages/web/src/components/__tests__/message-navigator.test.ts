import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MessageNavigator } from '@/components/MessageNavigator';
import type { ChatMessage as ChatMessageData } from '@/stores/chatStore';

function makeMsg(id: string, type: 'user' | 'assistant' | 'system', catId?: string): ChatMessageData {
  return {
    id,
    type,
    content: `Content for ${id}`,
    timestamp: Date.now(),
    ...(catId ? { catId } : {}),
  } as ChatMessageData;
}

const nullRef = { current: null };

function render(messages: ChatMessageData[]): string {
  return renderToStaticMarkup(
    React.createElement(MessageNavigator, { messages, scrollContainerRef: nullRef }),
  );
}

describe('MessageNavigator', () => {
  it('returns null when fewer than 3 nav items', () => {
    const html = render([makeMsg('m1', 'user'), makeMsg('m2', 'assistant', 'opus')]);
    expect(html).toBe('');
  });

  it('renders dots for user and assistant messages only', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'system'),
      makeMsg('m3', 'assistant', 'opus'),
      makeMsg('m4', 'system'),
      makeMsg('m5', 'assistant', 'codex'),
    ];
    const html = render(msgs);

    // 3 buttons: m1=user, m3=assistant, m5=assistant
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons.length).toBe(3);
  });

  it('filters out system messages from navigation', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'system'),
      makeMsg('m3', 'assistant', 'opus'),
      makeMsg('m4', 'assistant', 'codex'),
    ];
    const html = render(msgs);

    // 3 nav items: user + 2 assistants
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons.length).toBe(3);
  });

  it('applies cat-specific dot colors', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'assistant', 'opus'),
      makeMsg('m3', 'assistant', 'codex'),
    ];
    const html = render(msgs);

    expect(html).toContain('bg-owner-primary');
    expect(html).toContain('bg-opus-primary');
  });

  it('includes accessibility labels', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'assistant', 'codex'),
      makeMsg('m3', 'assistant', 'opus'),
    ];
    const html = render(msgs);

    expect(html).toContain('跳转到 铲屎官 的消息');
    expect(html).toContain('跳转到 缅因猫 的消息');
  });

  it('samples at fixed intervals when messages exceed MAX_DOTS (18)', () => {
    // Create 40 user+assistant messages
    const msgs: ChatMessageData[] = [];
    for (let i = 0; i < 40; i++) {
      msgs.push(makeMsg(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', 'opus'));
    }
    const html = render(msgs);

    // Should have exactly 18 dots, not 40
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons.length).toBe(18);
  });

  it('renders viewport indicator track', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'assistant', 'opus'),
      makeMsg('m3', 'assistant', 'codex'),
    ];
    const html = render(msgs);

    // Track rail (thin line) and viewport indicator should be present
    expect(html).toContain('bg-gray-200');
    expect(html).toContain('bg-gray-300/50');
  });
});
