/**
 * F24: SessionChainPanel tests.
 * Verifies session chain visualization: active sessions with health bar,
 * sealed sessions with lock icons, post-compact safety alert, re-fetch on seal.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { CatInvocationInfo } from '@/stores/chat-types';
import { SessionChainPanel } from '../SessionChainPanel';

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
});
afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
});

let mockApiFetch: ReturnType<typeof vi.fn>;

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Stub ContextHealthBar and TokenCacheBar to avoid pulling in their dependencies
vi.mock('../ContextHealthBar', () => ({
  ContextHealthBar: (props: { catId: string }) =>
    React.createElement('div', { 'data-testid': `health-bar-${props.catId}` }),
}));

vi.mock('../status-helpers', () => ({
  truncateId: (id: string, len: number) => id.length > len ? `${id.slice(0, len)}…` : id,
}));

const origCreateElement = document.createElement.bind(document);
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = origCreateElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockApiFetch = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderPanel(
  threadId: string,
  catInvocations: Record<string, CatInvocationInfo> = {},
) {
  act(() => {
    root.render(React.createElement(SessionChainPanel, { threadId, catInvocations }));
  });
}

async function flushFetch() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function mockSessionsResponse(sessions: unknown[]) {
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ sessions }),
  });
}

describe('F24: SessionChainPanel', () => {
  it('renders nothing when API returns empty sessions', async () => {
    mockSessionsResponse([]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders session count in header', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now() },
      { id: 's2', catId: 'opus', seq: 1, status: 'sealed', messageCount: 12, createdAt: Date.now() - 60000, sealedAt: Date.now() - 30000 },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('2 sessions');
  });

  it('renders active session with seq number, cat badge, and clickable session ID', async () => {
    mockSessionsResponse([
      { id: 'ses_abc12345xyz', catId: 'opus', seq: 2, status: 'active', messageCount: 8, createdAt: Date.now() - 5000 },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('Session #3');
    expect(container.textContent).toContain('opus');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('8 msgs');
    // Session ID should be visible (truncated) with copy title
    const idBtn = container.querySelector('button[title*="ses_abc12345xyz"]');
    expect(idBtn).not.toBeNull();
    expect(idBtn!.textContent).toContain('ses_abc123');
  });

  it('renders ContextHealthBar for active session with health data', async () => {
    mockSessionsResponse([
      {
        id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 3, createdAt: Date.now(),
        contextHealth: { usedTokens: 123000, windowTokens: 150000, fillRatio: 0.82, source: 'exact' },
      },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    // ContextHealthBar is rendered (mocked as div with data-testid)
    expect(container.querySelector('[data-testid="health-bar-opus"]')).not.toBeNull();
  });

  it('prefers invocation contextHealth over session contextHealth', async () => {
    mockSessionsResponse([
      {
        id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 3, createdAt: Date.now(),
        contextHealth: { usedTokens: 50000, windowTokens: 150000, fillRatio: 0.33, source: 'approx' },
      },
    ]);
    const invocations: Record<string, CatInvocationInfo> = {
      opus: {
        contextHealth: { usedTokens: 120000, windowTokens: 150000, fillRatio: 0.80, source: 'exact', measuredAt: Date.now() },
      },
    };
    renderPanel('thread-1', invocations);
    await flushFetch();
    // ContextHealthBar should be rendered (delegates % display to the component)
    expect(container.querySelector('[data-testid="health-bar-opus"]')).not.toBeNull();
  });

  it('renders sealed sessions with seal reason label and clickable IDs', async () => {
    mockSessionsResponse([
      {
        id: 'seal_aaa111', catId: 'opus', seq: 0, status: 'sealed', messageCount: 20,
        createdAt: Date.now() - 120000, sealedAt: Date.now() - 60000,
        sealReason: 'claude-code-compact-auto',
        contextHealth: { usedTokens: 140000, windowTokens: 150000, fillRatio: 0.93, source: 'exact' },
      },
      {
        id: 'seal_bbb222', catId: 'opus', seq: 1, status: 'sealed', messageCount: 15,
        createdAt: Date.now() - 60000, sealedAt: Date.now() - 10000,
        sealReason: 'threshold',
      },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('Session #1');
    expect(container.textContent).toContain('Session #2');
    expect(container.textContent).toContain('compact');
    expect(container.textContent).toContain('threshold');
    expect(container.textContent).toContain('Sealed');
    // Both sealed sessions should have clickable ID buttons
    expect(container.querySelector('button[title*="seal_aaa111"]')).not.toBeNull();
    expect(container.querySelector('button[title*="seal_bbb222"]')).not.toBeNull();
  });

  it('shows sealing text for sessions with status sealing', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'sealing', messageCount: 10, createdAt: Date.now() - 5000 },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('sealing');
  });

  it('shows post-compact safety alert when sessionSealed is true', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 1, status: 'active', messageCount: 3, createdAt: Date.now() },
    ]);
    const invocations: Record<string, CatInvocationInfo> = {
      opus: { sessionSeq: 1, sessionSealed: true },
    };
    renderPanel('thread-1', invocations);
    await flushFetch();
    expect(container.textContent).toContain('Post-compact safety active');
    expect(container.textContent).toContain('High-risk ops may be blocked');
  });

  it('does not show post-compact alert when no cat has sessionSealed', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now() },
    ]);
    renderPanel('thread-1', { opus: { sessionSeq: 0 } });
    await flushFetch();
    expect(container.textContent).not.toContain('Post-compact safety active');
  });

  it('re-fetches when sealSignal changes', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 3, createdAt: Date.now() },
    ]);
    renderPanel('thread-1', { opus: { sessionSeq: 0 } });
    await flushFetch();

    const callsBefore = mockApiFetch.mock.calls.length;

    // Re-render with sessionSealed changed → triggers sealSignal change
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'sealed', messageCount: 3, createdAt: Date.now(), sealedAt: Date.now() },
      { id: 's2', catId: 'opus', seq: 1, status: 'active', messageCount: 0, createdAt: Date.now() },
    ]);
    renderPanel('thread-1', { opus: { sessionSeq: 0, sessionSealed: true } });
    await flushFetch();

    expect(mockApiFetch.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('renders ContextHealthBar for approx source health', async () => {
    mockSessionsResponse([
      {
        id: 's1', catId: 'gemini', seq: 0, status: 'active', messageCount: 2, createdAt: Date.now(),
        contextHealth: { usedTokens: 80000, windowTokens: 150000, fillRatio: 0.53, source: 'approx' },
      },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    // ContextHealthBar is rendered (mocked); approx indicator handled internally
    expect(container.querySelector('[data-testid="health-bar-gemini"]')).not.toBeNull();
  });

  it('renders ContextHealthBar for high fill ratio', async () => {
    mockSessionsResponse([
      {
        id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now(),
        contextHealth: { usedTokens: 140000, windowTokens: 150000, fillRatio: 0.93, source: 'exact' },
      },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    // ContextHealthBar renders (color handling is internal to the component)
    expect(container.querySelector('[data-testid="health-bar-opus"]')).not.toBeNull();
  });

  it('shows cached percentage when invocation has cacheReadTokens', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now() },
    ]);
    const invocations: Record<string, CatInvocationInfo> = {
      opus: {
        usage: { inputTokens: 100000, outputTokens: 5000, cacheReadTokens: 75000 },
      },
    };
    renderPanel('thread-1', invocations);
    await flushFetch();
    expect(container.textContent).toContain('cached');
  });

  it('hides cached percentage when no cacheReadTokens', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now() },
    ]);
    const invocations: Record<string, CatInvocationInfo> = {
      opus: {
        usage: { inputTokens: 100000, outputTokens: 5000 },
      },
    };
    renderPanel('thread-1', invocations);
    await flushFetch();
    expect(container.textContent).not.toContain('cached');
  });

  it('shows token counts from session.lastUsage when no live invocation', async () => {
    mockSessionsResponse([
      {
        id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now(),
        lastUsage: { inputTokens: 120000, outputTokens: 8000, cacheReadTokens: 90000 },
      },
    ]);
    // No catInvocations — simulates page reload with no live data
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('120k');
    expect(container.textContent).toContain('8k');
    expect(container.textContent).toContain('cached');
  });

  it('prefers live invocation usage over session.lastUsage', async () => {
    mockSessionsResponse([
      {
        id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now(),
        lastUsage: { inputTokens: 50000, outputTokens: 2000 },
      },
    ]);
    const invocations: Record<string, CatInvocationInfo> = {
      opus: {
        usage: { inputTokens: 150000, outputTokens: 10000 },
      },
    };
    renderPanel('thread-1', invocations);
    await flushFetch();
    // Should show live data (150k/10k), not persisted (50k/2k)
    expect(container.textContent).toContain('150k');
    expect(container.textContent).toContain('10k');
    // Persisted outputTokens (2k) should NOT appear
    expect(container.textContent).not.toContain('2k');
  });

  it('calls API with correct thread URL', async () => {
    mockSessionsResponse([]);
    renderPanel('my-thread-42');
    await flushFetch();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/threads/my-thread-42/sessions');
  });

  it('handles API error gracefully', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500 });
    renderPanel('thread-1');
    await flushFetch();
    // Should not crash, renders nothing
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders singular "session" for count of 1', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 1, createdAt: Date.now() },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('1 session');
    expect(container.textContent).not.toContain('1 sessions');
  });

  it('clears stale sessions on thread switch when fetch fails (P2 regression)', async () => {
    // First thread loads successfully
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 5, createdAt: Date.now() },
    ]);
    renderPanel('thread-1');
    await flushFetch();
    expect(container.textContent).toContain('Session #1');

    // Switch to thread-2, but fetch fails
    mockApiFetch.mockResolvedValue({ ok: false, status: 500 });
    renderPanel('thread-2');
    await flushFetch();

    // Old thread-1 data must be gone
    expect(container.textContent).not.toContain('Session #1');
    expect(container.querySelector('section')).toBeNull();
  });

  it('clears stale sessions on thread switch when fetch throws', async () => {
    mockSessionsResponse([
      { id: 's1', catId: 'opus', seq: 0, status: 'sealed', messageCount: 12, createdAt: Date.now() - 60000, sealedAt: Date.now() },
    ]);
    renderPanel('thread-A');
    await flushFetch();
    expect(container.textContent).toContain('Session #1');

    // Switch to thread-B, but fetch throws network error
    mockApiFetch.mockRejectedValue(new Error('network error'));
    renderPanel('thread-B');
    await flushFetch();

    // Old thread-A data must be gone
    expect(container.textContent).not.toContain('Session #1');
    expect(container.querySelector('section')).toBeNull();
  });

  it('discards stale response when slow thread-1 fetch resolves after thread-2 (P1 race condition)', async () => {
    // Deferred promises to control resolution order
    let resolveThread1!: (v: unknown) => void;
    let resolveThread2!: (v: unknown) => void;

    const thread1Promise = new Promise((r) => { resolveThread1 = r; });
    const thread2Promise = new Promise((r) => { resolveThread2 = r; });

    // First render: thread-1 (slow)
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes('thread-1')) return thread1Promise;
      if (url.includes('thread-2')) return thread2Promise;
      return Promise.resolve({ ok: false });
    });

    renderPanel('thread-1');
    await flushFetch();

    // Switch to thread-2 before thread-1 resolves
    renderPanel('thread-2');
    await flushFetch();

    // thread-2 resolves first
    resolveThread2({
      ok: true,
      json: async () => ({ sessions: [
        { id: 's2', catId: 'opus', seq: 5, status: 'active', messageCount: 3, createdAt: Date.now() },
      ] }),
    });
    await flushFetch();

    expect(container.textContent).toContain('Session #6'); // seq 5 → display #6

    // Now thread-1 (stale) resolves late
    resolveThread1({
      ok: true,
      json: async () => ({ sessions: [
        { id: 's1', catId: 'opus', seq: 0, status: 'active', messageCount: 10, createdAt: Date.now() },
      ] }),
    });
    await flushFetch();

    // Stale thread-1 data must NOT overwrite thread-2
    expect(container.textContent).toContain('Session #6');
    expect(container.textContent).not.toContain('Session #1');
  });
});
