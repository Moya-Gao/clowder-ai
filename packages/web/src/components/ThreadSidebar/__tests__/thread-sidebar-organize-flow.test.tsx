import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addToastMock,
  createThreadSidebarHarness,
  defaultSidebarApiMock,
  installThreadSidebarGlobals,
  jsonOk,
  mockApiFetch,
  mockStore,
  resetThreadSidebarGlobals,
  resetThreadSidebarMocks,
  type ThreadSidebarHarness,
  textFail,
} from './thread-sidebar-test-helpers';

const testData = vi.hoisted(() => ({
  TEST_LABELS: [
    { id: 'lbl-a', name: '开源', color: '#5B8C5A', sortOrder: 0, createdBy: 'u1', createdAt: 1 },
    { id: 'lbl-b', name: '设计', color: '#C47F52', sortOrder: 1, createdBy: 'u1', createdAt: 2 },
  ],
}));

vi.mock('@/stores/label-store', () => {
  const store = {
    labels: testData.TEST_LABELS,
    isLoading: false,
    fetchLabels: vi.fn().mockResolvedValue(undefined),
    createLabel: vi.fn(),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
  };
  const hook = Object.assign((selector?: (s: typeof store) => unknown) => (selector ? selector(store) : store), {
    getState: () => store,
    setState: (partial: Partial<typeof store>) => Object.assign(store, partial),
  });
  return { useLabelStore: hook };
});

const ORGANIZER_THREAD = {
  id: 'org-thread-1',
  title: 'Thread 整理助手',
  projectPath: '/test',
  createdBy: 'u1',
  participants: [],
  lastActiveAt: 1000,
  createdAt: 1000,
};

function makeThread(id: string, labels?: string[]) {
  return {
    id,
    title: `Thread ${id}`,
    projectPath: '/test',
    createdBy: 'u1',
    participants: [],
    lastActiveAt: 1000,
    createdAt: 1000,
    labels,
  };
}

describe('ThreadSidebar ✨ organize flow', () => {
  let harness: ThreadSidebarHarness;

  beforeAll(() => {
    installThreadSidebarGlobals();
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetThreadSidebarMocks();
    harness = createThreadSidebarHarness();
  });

  afterEach(() => {
    harness.cleanup();
    vi.useRealTimers();
  });

  afterAll(() => {
    resetThreadSidebarGlobals();
  });

  function findOrganizeButton(container: HTMLElement) {
    return Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('title') === '猫猫帮你分类');
  }

  it('✨ button opens organizer modal, pre-fills from SUGGESTIONS_JSON, and apply sends filtered payload', async () => {
    const uncatThreads = [makeThread('t1'), makeThread('t2')];
    const catThread = makeThread('t3', ['lbl-a']);
    mockStore.threads = [...uncatThreads, catThread];
    (mockStore.updateThreadLabels as ReturnType<typeof vi.fn>).mockClear();

    const suggestionsJson = JSON.stringify({
      t1: ['lbl-a', 'bad'],
      t2: ['lbl-b'],
      hidden: ['lbl-a'],
    });
    const catMessage = {
      id: 'msg-cat-1',
      catId: 'opus',
      timestamp: Date.now() + 5000,
      isDraft: false,
      content: `分类建议如下...\n<!-- SUGGESTIONS_JSON:${suggestionsJson} -->`,
    };

    let pollCount = 0;
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/threads' && init?.method === 'POST') {
        return jsonOk(ORGANIZER_THREAD);
      }
      if (path === '/api/messages' && init?.method === 'POST') {
        return jsonOk({ id: 'msg-trigger', ok: true });
      }
      if (path.startsWith('/api/messages?')) {
        pollCount++;
        if (pollCount >= 2) {
          return jsonOk({ messages: [catMessage] });
        }
        return jsonOk({ messages: [] });
      }
      if (path === '/api/threads') {
        return jsonOk({ threads: [...uncatThreads, catThread, ORGANIZER_THREAD] });
      }
      return defaultSidebarApiMock(path);
    });

    await harness.render();

    const btn = findOrganizeButton(harness.container);
    expect(btn).toBeTruthy();

    await act(async () => {
      btn!.click();
    });
    await harness.flush();

    expect(harness.container.textContent).toContain('整理未分类');
    expect(harness.container.textContent).toContain('分析中');

    for (let tick = 0; tick < 4; tick++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await harness.flush();
      if (pollCount >= 2) break;
    }

    expect(pollCount).toBeGreaterThanOrEqual(2);
    for (let flushAttempt = 0; flushAttempt < 5; flushAttempt++) {
      await harness.flush();
      if (harness.container.textContent?.includes('已选 2 个 thread')) break;
    }

    for (let settle = 0; settle < 10 && !harness.container.textContent?.includes('已选 2 个 thread'); settle++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await harness.flush();
    }
    expect(harness.container.textContent).toContain('已选 2 个 thread');
    expect(harness.container.textContent).toContain('批量应用 (2)');

    const applyBtn = Array.from(harness.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('批量应用'),
    );
    expect(applyBtn).toBeTruthy();

    await act(async () => {
      applyBtn!.click();
    });
    await harness.flush();

    const updateFn = mockStore.updateThreadLabels as ReturnType<typeof vi.fn>;
    expect(updateFn).toHaveBeenCalledTimes(2);

    const calls = updateFn.mock.calls.map((c) => [c[0] as string, c[1] as string[]]);
    calls.sort((a, b) => (a[0] as string).localeCompare(b[0] as string));
    expect(calls).toEqual([
      ['t1', ['lbl-a']],
      ['t2', ['lbl-b']],
    ]);
  });

  it('shows error toast when trigger message fails', async () => {
    mockStore.threads = [makeThread('t1')];

    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/threads' && init?.method === 'POST') {
        return jsonOk(ORGANIZER_THREAD);
      }
      if (path === '/api/messages' && init?.method === 'POST') {
        return textFail(500, 'send failed');
      }
      if (path === '/api/threads') {
        return jsonOk({ threads: [makeThread('t1'), ORGANIZER_THREAD] });
      }
      return defaultSidebarApiMock(path);
    });

    await harness.render();

    const btn = findOrganizeButton(harness.container);
    expect(btn).toBeTruthy();

    await act(async () => {
      btn!.click();
    });
    await harness.flush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await harness.flush();

    expect(addToastMock).toHaveBeenCalled();
    expect(addToastMock.mock.calls[0]?.[0]).toMatchObject({
      type: 'error',
      title: '发送失败',
    });
  });
});
