/**
 * F122 AC-A4: QueuePanel shows processing entries with distinct styling
 * - Processing entries are visible (not filtered out)
 * - Processing entries show "处理中" indicator
 * - Processing entries do NOT have steer/remove/move controls
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueEntry } from '@/stores/chat-types';
import { useChatStore } from '@/stores/chatStore';
import { QueuePanel } from '../QueuePanel';

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, json: async () => ({}) })),
}));

const NOW = Date.now();

const QUEUED_ENTRY: QueueEntry = {
  id: 'q1',
  threadId: 'thread-1',
  userId: 'u1',
  content: 'queued message',
  messageId: 'm1',
  mergedMessageIds: [],
  source: 'user',
  targetCats: ['opus'],
  intent: 'execute',
  status: 'queued',
  createdAt: NOW,
};

const PROCESSING_ENTRY: QueueEntry = {
  ...QUEUED_ENTRY,
  id: 'q-proc',
  content: 'processing message',
  status: 'processing',
};

describe('QueuePanel processing state (F122 AC-A4)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useChatStore.setState({
      messages: [],
      queue: [],
      queuePaused: false,
      currentThreadId: 'thread-1',
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('renders processing entries as visible', () => {
    useChatStore.setState({ queue: [PROCESSING_ENTRY] });
    act(() => {
      root.render(React.createElement(QueuePanel, { threadId: 'thread-1' }));
    });

    // Processing entry content must be visible
    expect(container.innerHTML).toContain('processing message');
  });

  it('shows "处理中" indicator for processing entries', () => {
    useChatStore.setState({ queue: [PROCESSING_ENTRY] });
    act(() => {
      root.render(React.createElement(QueuePanel, { threadId: 'thread-1' }));
    });

    expect(container.innerHTML).toContain('处理中');
  });

  it('does NOT show steer/remove controls for processing entries', () => {
    useChatStore.setState({ queue: [PROCESSING_ENTRY] });
    act(() => {
      root.render(React.createElement(QueuePanel, { threadId: 'thread-1' }));
    });

    // No steer button
    expect(container.querySelector('[data-testid="steer-q-proc"]')).toBeNull();
    // No remove button (aria-label="撤回")
    expect(container.querySelector('[aria-label="撤回"]')).toBeNull();
    // No move buttons
    expect(container.querySelector('[aria-label="Move up"]')).toBeNull();
    expect(container.querySelector('[aria-label="Move down"]')).toBeNull();
  });

  it('renders both queued and processing entries together', () => {
    useChatStore.setState({ queue: [PROCESSING_ENTRY, QUEUED_ENTRY] });
    act(() => {
      root.render(React.createElement(QueuePanel, { threadId: 'thread-1' }));
    });

    const html = container.innerHTML;
    // Both entries visible
    expect(html).toContain('processing message');
    expect(html).toContain('queued message');
    // Processing has indicator, queued has steer
    expect(html).toContain('处理中');
    expect(container.querySelector('[data-testid="steer-q1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="steer-q-proc"]')).toBeNull();
  });
});
