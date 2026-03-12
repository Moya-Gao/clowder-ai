import type { GameEvent } from '@cat-cafe/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventFlow } from '../EventFlow';

Object.assign(globalThis as Record<string, unknown>, { React });

function makeEvent(overrides: Partial<GameEvent> & { eventId: string }): GameEvent {
  return {
    round: 1,
    phase: 'day_discuss',
    type: 'speech',
    scope: 'public',
    payload: { senderName: 'P2 宪宪', content: '我觉得P3很可疑' },
    timestamp: Date.now(),
    ...overrides,
  };
}

function render(events: GameEvent[]): string {
  return renderToStaticMarkup(React.createElement(EventFlow, { events }));
}

describe('EventFlow', () => {
  it('renders system events with bell icon', () => {
    const events = [makeEvent({ eventId: 'e1', type: 'death', payload: { message: 'P4 号玩家死亡' } })];
    const html = render(events);
    expect(html).toContain('data-testid="system-event"');
    expect(html).toContain('P4 号玩家死亡');
    expect(html).toContain('🔔');
  });

  it('renders chat bubbles for speech events', () => {
    const events = [
      makeEvent({ eventId: 'e2', type: 'speech', payload: { senderName: 'P2 宪宪', content: '我觉得P3很可疑' } }),
    ];
    const html = render(events);
    expect(html).toContain('data-testid="chat-bubble"');
    expect(html).toContain('P2 宪宪');
    expect(html).toContain('我觉得P3很可疑');
  });

  it('renders multiple events', () => {
    const events = [
      makeEvent({ eventId: 'e1', type: 'phase_change', payload: { message: '进入白天讨论' } }),
      makeEvent({ eventId: 'e2', type: 'speech', payload: { senderName: 'P1', content: '大家好' } }),
      makeEvent({ eventId: 'e3', type: 'speech', payload: { senderName: 'P3', content: '我是好人' } }),
    ];
    const html = render(events);
    expect(html).toContain('进入白天讨论');
    expect(html).toContain('大家好');
    expect(html).toContain('我是好人');
  });

  it('renders empty state when no events', () => {
    const html = render([]);
    expect(html).toContain('data-testid="event-flow"');
    expect(html).not.toContain('data-testid="chat-bubble"');
  });
});
