import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RightStatusPanel, type RightStatusPanelProps } from '@/components/RightStatusPanel';

function render(props: RightStatusPanelProps): string {
  return renderToStaticMarkup(React.createElement(RightStatusPanel, props));
}

describe('RightStatusPanel', () => {
  it('renders status title, mode, cats, and metrics', () => {
    const html = render({
      intentMode: 'execute',
      targetCats: ['opus', 'codex'],
      catStatuses: {
        opus: 'streaming',
        codex: 'done',
      },
      catInvocations: {},
      threadId: 'test-thread',
      messageSummary: {
        total: 12,
        assistant: 7,
        system: 3,
        evidence: 2,
        followup: 1,
      },
      taskSummary: {
        total: 5,
        done: 2,
      },
    });

    expect(html).toContain('状态栏');
    expect(html).toContain('当前模式');
    expect(html).toContain('执行');
    expect(html).toContain('布偶猫');
    expect(html).toContain('缅因猫');
    expect(html).toContain('12');
    expect(html).toContain('5');
  });

  it('falls back to three cats when no target cats are provided', () => {
    const html = render({
      intentMode: null,
      targetCats: [],
      catStatuses: {},
      catInvocations: {},
      threadId: 'test-thread',
      messageSummary: {
        total: 0,
        assistant: 0,
        system: 0,
        evidence: 0,
        followup: 0,
      },
      taskSummary: {
        total: 0,
        done: 0,
      },
    });

    expect(html).toContain('布偶猫');
    expect(html).toContain('缅因猫');
    expect(html).toContain('暹罗猫');
    expect(html).toContain('空闲');
  });

  it('renders copyable invocation and session ids in recent invocations', () => {
    const invocationId = 'inv-1234567890abcdef';
    const sessionId = 'sess-1234567890abcdef';
    const html = render({
      intentMode: 'execute',
      targetCats: ['codex'],
      catStatuses: { codex: 'streaming' },
      catInvocations: {
        codex: {
          invocationId,
          sessionId,
          startedAt: Date.now(),
        },
      },
      threadId: 'thread-123',
      messageSummary: {
        total: 1,
        assistant: 1,
        system: 0,
        evidence: 0,
        followup: 0,
      },
      taskSummary: {
        total: 0,
        done: 0,
      },
    });

    expect(html).toContain('最近调用');
    // IDs are now behind a collapsible toggle (default collapsed in SSR)
    expect(html).toContain('▸ IDs');
    // The cat name and invocation section still render
    expect(html).toContain('缅因猫');
  });
});
