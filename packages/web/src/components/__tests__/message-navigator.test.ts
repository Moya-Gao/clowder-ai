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

function render(messages: ChatMessageData[]): string {
  return renderToStaticMarkup(React.createElement(MessageNavigator, { messages }));
}

describe('MessageNavigator', () => {
  it('returns null when fewer than 2 nav items', () => {
    const html = render([makeMsg('m1', 'user')]);
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

    // Should have exactly 3 buttons (m1=user, m3=assistant, m5=assistant)
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons.length).toBe(3);
  });

  it('filters out system messages from navigation', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'system'),
      makeMsg('m3', 'assistant', 'opus'),
    ];
    const html = render(msgs);

    // 2 nav items: user + assistant
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons.length).toBe(2);
  });

  it('applies cat-specific dot colors', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'assistant', 'opus'),
    ];
    const html = render(msgs);

    expect(html).toContain('bg-owner-primary');
    expect(html).toContain('bg-opus-primary');
  });

  it('includes accessibility labels', () => {
    const msgs = [
      makeMsg('m1', 'user'),
      makeMsg('m2', 'assistant', 'codex'),
    ];
    const html = render(msgs);

    expect(html).toContain('跳转到 铲屎官 的消息');
    expect(html).toContain('跳转到 缅因猫 的消息');
  });
});
