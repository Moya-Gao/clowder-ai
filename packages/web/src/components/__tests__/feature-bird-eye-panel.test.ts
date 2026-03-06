import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionControlPage } from '@/components/mission-control/MissionControlPage';
import { useMissionControlStore } from '@/stores/missionControlStore';
import {
  createMissionControlMockBackend,
  flush,
  type MissionControlMockBackend,
} from './mission-control-page.test-helpers';

const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('@/components/ThreadSidebar', () => ({
  ThreadSidebar: () => React.createElement('aside', { 'data-testid': 'thread-sidebar' }),
}));

describe('extractFeatureId', () => {
  let extractFeatureId: (tags: readonly string[]) => string;

  beforeAll(async () => {
    const mod = await import('@/components/mission-control/FeatureBirdEyePanel');
    extractFeatureId = mod.extractFeatureId;
  });

  it('extracts from feature:fxxx format (docs-backlog import)', () => {
    expect(extractFeatureId(['source:docs-backlog', 'feature:f058', 'status:spec'])).toBe('F058');
  });

  it('extracts from bare F058 tag', () => {
    expect(extractFeatureId(['F058', 'other-tag'])).toBe('F058');
  });

  it('normalizes case to uppercase', () => {
    expect(extractFeatureId(['feature:f049'])).toBe('F049');
  });

  it('returns Untagged when no feature tag found', () => {
    expect(extractFeatureId(['source:docs-backlog', 'status:spec'])).toBe('Untagged');
  });

  it('returns Untagged for empty tags', () => {
    expect(extractFeatureId([])).toBe('Untagged');
  });
});

describe('MissionControlPage — Feature bird eye panel', () => {
  let container: HTMLDivElement;
  let root: Root;
  let backend: MissionControlMockBackend;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    backend = createMissionControlMockBackend();
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => backend.handleRequest(path, init));
    useMissionControlStore.setState({
      items: [],
      loading: false,
      submitting: false,
      selectedItemId: null,
      selectedPhase: 'coding',
      error: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('groups items by feature:fxxx tag and shows status badges', async () => {
    const now = Date.now();
    backend.setItems([
      {
        id: 'bird-1',
        userId: 'default-user',
        title: 'Phase A',
        summary: 'S',
        priority: 'p1',
        tags: ['source:docs-backlog', 'feature:f058', 'status:spec'],
        status: 'done',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        doneAt: now,
        audit: [],
      },
      {
        id: 'bird-2',
        userId: 'default-user',
        title: 'Phase B',
        summary: 'S',
        priority: 'p1',
        tags: ['source:docs-backlog', 'feature:f058', 'status:spec'],
        status: 'dispatched',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        dispatchedAt: now,
        dispatchedThreadId: 'thread-bird',
        dispatchedThreadPhase: 'coding',
        audit: [],
      },
      {
        id: 'bird-3',
        userId: 'default-user',
        title: 'Other feature',
        summary: 'S',
        priority: 'p2',
        tags: ['source:docs-backlog', 'feature:f049'],
        status: 'open',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        audit: [],
      },
    ]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const birdEye = container.querySelector('[data-testid="mc-feature-bird-eye"]');
    expect(birdEye).not.toBeNull();

    const f058 = container.querySelector('[data-testid="mc-bird-eye-feature-F058"]');
    expect(f058).not.toBeNull();
    expect(f058?.textContent).toContain('F058');
    expect(f058?.textContent).toContain('2 项');

    const f049 = container.querySelector('[data-testid="mc-bird-eye-feature-F049"]');
    expect(f049).not.toBeNull();
    expect(f049?.textContent).toContain('F049');
    expect(f049?.textContent).toContain('1 项');
  });

  it('separates all-done features into collapsible done section', async () => {
    const now = Date.now();
    backend.setItems([
      {
        id: 'active-1',
        userId: 'default-user',
        title: 'Active task',
        summary: 'S',
        priority: 'p1',
        tags: ['feature:f060'],
        status: 'dispatched',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        dispatchedAt: now,
        dispatchedThreadId: 'thread-1',
        dispatchedThreadPhase: 'coding',
        audit: [],
      },
      {
        id: 'done-1',
        userId: 'default-user',
        title: 'Done task A',
        summary: 'S',
        priority: 'p1',
        tags: ['feature:f049'],
        status: 'done',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        doneAt: now,
        audit: [],
      },
      {
        id: 'done-2',
        userId: 'default-user',
        title: 'Done task B',
        summary: 'S',
        priority: 'p2',
        tags: ['feature:f049'],
        status: 'done',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        doneAt: now,
        audit: [],
      },
    ]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    // F060 (active) should be visible directly
    const f060 = container.querySelector('[data-testid="mc-bird-eye-feature-F060"]');
    expect(f060).not.toBeNull();

    // Done section should exist
    const doneSection = container.querySelector('[data-testid="mc-bird-eye-done-section"]');
    expect(doneSection).not.toBeNull();
    expect(doneSection?.textContent).toContain('已完成');
    expect(doneSection?.textContent).toContain('1 个 Feature');

    // F049 (all done) should NOT be visible before expanding
    let f049 = container.querySelector('[data-testid="mc-bird-eye-feature-F049"]');
    expect(f049).toBeNull();

    // Click to expand done section
    const expandBtn = doneSection?.querySelector('button');
    expect(expandBtn).not.toBeNull();
    await act(async () => {
      expandBtn?.click();
    });

    // F049 should now be visible
    f049 = container.querySelector('[data-testid="mc-bird-eye-feature-F049"]');
    expect(f049).not.toBeNull();
    expect(f049?.textContent).toContain('F049');
    expect(f049?.textContent).toContain('2 项');
  });
});
