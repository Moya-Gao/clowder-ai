/**
 * F122B AC-B8: ThreadExecutionBar shows per-cat active status with elapsed time.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '@/stores/chatStore';
import { ThreadExecutionBar } from '../ThreadExecutionBar';

describe('ThreadExecutionBar (F122B AC-B8)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useChatStore.setState({
      activeInvocations: {},
      hasActiveInvocation: false,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it('renders nothing when no active invocations', () => {
    act(() => root.render(React.createElement(ThreadExecutionBar)));
    expect(container.textContent).toBe('');
  });

  it('renders active cat with elapsed time', () => {
    useChatStore.setState({
      activeInvocations: {
        'inv-1': { catId: 'opus', mode: 'execute', startedAt: Date.now() - 5000 },
      },
      hasActiveInvocation: true,
    });
    act(() => root.render(React.createElement(ThreadExecutionBar)));

    const text = container.textContent ?? '';
    expect(text).toContain('执行中');
    expect(text).toContain('opus');
    // Should show elapsed time (at least 0:0X)
    expect(text).toMatch(/0:0[0-9]/);
  });

  it('renders multiple active cats', () => {
    useChatStore.setState({
      activeInvocations: {
        'inv-1': { catId: 'opus', mode: 'execute', startedAt: Date.now() - 30000 },
        'inv-2': { catId: 'codex', mode: 'execute', startedAt: Date.now() - 10000 },
      },
      hasActiveInvocation: true,
    });
    act(() => root.render(React.createElement(ThreadExecutionBar)));

    const text = container.textContent ?? '';
    expect(text).toContain('opus');
    expect(text).toContain('codex');
  });

  it('deduplicates same cat from multiple invocations', () => {
    useChatStore.setState({
      activeInvocations: {
        'inv-1': { catId: 'opus', mode: 'execute', startedAt: Date.now() },
        'inv-2': { catId: 'opus', mode: 'execute', startedAt: Date.now() },
      },
      hasActiveInvocation: true,
    });
    act(() => root.render(React.createElement(ThreadExecutionBar)));

    const text = container.textContent ?? '';
    // opus should appear only once despite 2 invocations
    const opusCount = (text.match(/opus/g) ?? []).length;
    expect(opusCount).toBe(1);
  });

  it('background thread invocation has startedAt after thread switch (R1 P1-1)', () => {
    // Simulate: invocation added to background thread via addThreadActiveInvocation
    const fiveSecondsAgo = Date.now() - 5000;
    useChatStore.setState({
      currentThreadId: 'thread-bg',
      activeInvocations: {
        'inv-bg': { catId: 'codex', mode: 'execute', startedAt: fiveSecondsAgo },
      },
      hasActiveInvocation: true,
    });
    act(() => root.render(React.createElement(ThreadExecutionBar)));

    const text = container.textContent ?? '';
    expect(text).toContain('codex');
    // Should show elapsed time > 0 (not stuck at 0:00)
    expect(text).not.toContain('0:00');
  });
});
