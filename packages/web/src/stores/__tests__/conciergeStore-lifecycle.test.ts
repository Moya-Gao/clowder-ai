/**
 * F229 PR-A2: conciergeStore 生命周期测试
 *
 * 覆盖 Block 3 (muted) + Block 4 (懒接线):
 *   INV-2: ballState 零存储
 *   INV-3: muted=true → hidden
 *   INV-8: muted 往返（optimistic update + PUT + 刷新后仍 hidden）
 *   INV-9: 懒接线 — config 仅一次 GET；panel 打开才 fetchThreadId；失败不重试风暴
 *
 * 注：apiFetch 整个 mock 掉（vi.mock），绕过 session 建立层，单测 store 逻辑。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// mock apiFetch — BEFORE store import（vi.mock 会 hoist，但显式放顶部）
// ---------------------------------------------------------------------------

vi.mock('../../utils/api-client', () => ({
  apiFetch: vi.fn(),
  API_URL: 'http://localhost:3001',
  resolveApiUrl: () => 'http://localhost:3001',
}));

import { apiFetch } from '../../utils/api-client';
import { projectBallState, useConciergeStore } from '../conciergeStore';

const mockApiFetch = vi.mocked(apiFetch);

// Helper — returns a Response-like object (cast to Response for mock types)
function mockOk(body: unknown = {}): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}
function mockFail(status = 500): Promise<Response> {
  return Promise.resolve({ ok: false, status } as unknown as Response);
}

// ---------------------------------------------------------------------------
// INV-2: ballState 零存储
// ---------------------------------------------------------------------------

describe('INV-2: ballState zero storage', () => {
  it('the store has no "ballState" field', () => {
    const keys = Object.keys(useConciergeStore.getState());
    expect(keys).not.toContain('ballState');
  });

  it('computing ballState requires calling projectBallState explicitly', () => {
    const state = useConciergeStore.getState();
    const result = projectBallState({
      enabled: state.enabled,
      muted: state.muted,
      invocationStatus: state.invocationStatus,
      pendingConfirmationCount: state.pendingConfirmationCount,
      pendingRelayCount: state.pendingRelayCount,
      unseenResultCount: state.unseenResultCount,
      panelOpen: state.panelOpen,
      inputFocused: state.inputFocused,
    });
    // Default state = enabled, not muted → not hidden
    expect(result).not.toBe('hidden');
  });
});

// ---------------------------------------------------------------------------
// INV-3 + INV-8: muted state
// ---------------------------------------------------------------------------

describe('INV-3 + INV-8: muted state', () => {
  beforeEach(() => {
    useConciergeStore.setState({
      enabled: true,
      muted: false,
      panelOpen: false,
      inputFocused: false,
      invocationStatus: 'idle',
      pendingConfirmationCount: 0,
      pendingRelayCount: 0,
      unseenResultCount: 0,
      configLoaded: false,
      configLoading: false,
      configFailed: false,
      threadIdLoaded: false,
      threadIdLoading: false,
      threadId: null,
    });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('INV-3: muted=true → projectBallState returns hidden', () => {
    useConciergeStore.setState({ muted: true });
    const s = useConciergeStore.getState();
    const ballState = projectBallState({
      enabled: s.enabled,
      muted: s.muted,
      invocationStatus: s.invocationStatus,
      pendingConfirmationCount: s.pendingConfirmationCount,
      pendingRelayCount: s.pendingRelayCount,
      unseenResultCount: s.unseenResultCount,
      panelOpen: s.panelOpen,
      inputFocused: s.inputFocused,
    });
    expect(ballState).toBe('hidden');
  });

  it('INV-8: setMuted(true) → optimistic update before await (state.muted = true immediately)', async () => {
    mockApiFetch.mockImplementation(() => mockOk());
    // Start async action, check optimistic state synchronously before await
    const promise = useConciergeStore.getState().setMuted(true);
    expect(useConciergeStore.getState().muted).toBe(true); // optimistic, before await
    await promise;
    expect(useConciergeStore.getState().muted).toBe(true); // still true after success
  });

  it('INV-8: setMuted(true) PUT fails → reverts to false', async () => {
    mockApiFetch.mockImplementation(() => mockFail());
    await useConciergeStore.getState().setMuted(true);
    expect(useConciergeStore.getState().muted).toBe(false);
  });

  it('INV-8: setMuted(false) → ball returns from hidden', async () => {
    useConciergeStore.setState({ muted: true });
    mockApiFetch.mockImplementation(() => mockOk());
    await useConciergeStore.getState().setMuted(false);
    const s = useConciergeStore.getState();
    const ballState = projectBallState({
      enabled: s.enabled,
      muted: s.muted,
      invocationStatus: s.invocationStatus,
      pendingConfirmationCount: s.pendingConfirmationCount,
      pendingRelayCount: s.pendingRelayCount,
      unseenResultCount: s.unseenResultCount,
      panelOpen: s.panelOpen,
      inputFocused: s.inputFocused,
    });
    expect(ballState).not.toBe('hidden');
  });
});

// ---------------------------------------------------------------------------
// INV-9: 懒接线 — config 仅一次 GET；失败不重试风暴
// ---------------------------------------------------------------------------

describe('INV-9: lazy wiring', () => {
  beforeEach(() => {
    useConciergeStore.setState({
      configLoaded: false,
      configLoading: false,
      configFailed: false,
      threadIdLoaded: false,
      threadIdLoading: false,
      threadId: null,
      invocationStatus: 'idle',
    });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetchConfig: only one GET even when called twice concurrently', async () => {
    // P1-1 fix: backend returns { config } wrapper — mock must match actual shape
    mockApiFetch.mockImplementation(() =>
      mockOk({
        config: {
          enabled: true,
          muted: false,
          displayName: 'Test',
          personaTone: 'cool',
          dutyCatProfileId: 'gemini25',
          proactivePolicy: 'quiet-badge',
          skin: 'yarn-ball',
        },
      }),
    );

    await Promise.all([useConciergeStore.getState().fetchConfig(), useConciergeStore.getState().fetchConfig()]);

    // Only one apiFetch call despite two concurrent invocations (INV-9)
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(useConciergeStore.getState().configLoaded).toBe(true);
    // Verify fields are correctly unpacked from { config } wrapper (P1-1)
    expect(useConciergeStore.getState().enabled).toBe(true);
    expect(useConciergeStore.getState().muted).toBe(false);
    expect(useConciergeStore.getState().displayName).toBe('Test');
  });

  it('fetchConfig: failure sets configFailed=true (P2: enables host fallback render)', async () => {
    mockApiFetch.mockImplementation(() => mockFail(503));
    await useConciergeStore.getState().fetchConfig();
    expect(useConciergeStore.getState().configLoading).toBe(false);
    expect(useConciergeStore.getState().configLoaded).toBe(false);
    // configFailed=true lets ConciergeHost render with optimistic defaults instead of staying null
    expect(useConciergeStore.getState().configFailed).toBe(true);
  });

  it('fetchConfig: subsequent call after loaded is no-op (zero fetch)', async () => {
    useConciergeStore.setState({ configLoaded: true });
    await useConciergeStore.getState().fetchConfig();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('fetchThreadId: failure sets error state, no subsequent auto-retry', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network error'));
    await useConciergeStore.getState().fetchThreadId();
    expect(useConciergeStore.getState().invocationStatus).toBe('error');
    expect(useConciergeStore.getState().threadIdLoading).toBe(false);
    expect(useConciergeStore.getState().threadIdLoaded).toBe(false);
    // No automatic retry — apiFetch called exactly once (INV-9)
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('fetchThreadId: success sets threadId and marks loaded', async () => {
    mockApiFetch.mockImplementation(() => mockOk({ threadId: 'thread-concierge-123' }));
    await useConciergeStore.getState().fetchThreadId();
    expect(useConciergeStore.getState().threadId).toBe('thread-concierge-123');
    expect(useConciergeStore.getState().threadIdLoaded).toBe(true);
  });

  it('fetchThreadId: success after prior failure clears error state (cloud P2)', async () => {
    // First call fails → invocationStatus=error (as expected)
    mockApiFetch.mockRejectedValueOnce(new Error('network error'));
    await useConciergeStore.getState().fetchThreadId();
    expect(useConciergeStore.getState().invocationStatus).toBe('error');
    // guard state after failure: threadIdLoaded=false, threadIdLoading=false → retry is allowed

    // Second call succeeds — must clear error state (P2: was stuck at 'error' forever)
    mockApiFetch.mockImplementation(() => mockOk({ threadId: 'retry-thread' }));
    await useConciergeStore.getState().fetchThreadId();
    expect(useConciergeStore.getState().threadId).toBe('retry-thread');
    expect(useConciergeStore.getState().invocationStatus).toBe('idle');
  });

  it('fetchThreadId: sends POST (backend is POST /api/concierge/thread — cloud P1)', async () => {
    // P1 fix: backend route is POST /api/concierge/thread (concierge.ts:101)
    // A bare GET would fall into catch → invocationStatus=error, threadId never set
    mockApiFetch.mockImplementation(() => mockOk({ threadId: 'thread-post-check' }));
    await useConciergeStore.getState().fetchThreadId();
    // Verify POST was used
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/concierge/thread'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ---------------------------------------------------------------------------
// INV-7: navigation action collapses panel
// ---------------------------------------------------------------------------

describe('INV-7: navigation action collapses panel', () => {
  it('onNavigationAction sets panelOpen=false', () => {
    useConciergeStore.setState({ panelOpen: true });
    useConciergeStore.getState().onNavigationAction();
    expect(useConciergeStore.getState().panelOpen).toBe(false);
  });

  it('setPanelOpen(true) then onNavigationAction → panelOpen=false', () => {
    useConciergeStore.getState().setPanelOpen(true);
    useConciergeStore.getState().onNavigationAction();
    expect(useConciergeStore.getState().panelOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P2-B: close actions must clear inputFocused (cloud review R4)
// ---------------------------------------------------------------------------

describe('P2-B: close actions clear inputFocused', () => {
  beforeEach(() => {
    useConciergeStore.setState({ panelOpen: true, inputFocused: true });
  });

  it('setPanelOpen(false) resets inputFocused to false', () => {
    useConciergeStore.getState().setPanelOpen(false);
    expect(useConciergeStore.getState().inputFocused).toBe(false);
  });

  it('onNavigationAction resets inputFocused to false', () => {
    useConciergeStore.getState().onNavigationAction();
    expect(useConciergeStore.getState().inputFocused).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// unseenResultCount clearance (found→0 transition)
// ---------------------------------------------------------------------------

describe('unseenResultCount clearance', () => {
  beforeEach(() => {
    useConciergeStore.setState({ unseenResultCount: 0 });
  });

  it('markResultsSeen clears unseenResultCount to 0', () => {
    useConciergeStore.setState({ unseenResultCount: 5 });
    useConciergeStore.getState().markResultsSeen();
    expect(useConciergeStore.getState().unseenResultCount).toBe(0);
  });

  it('setPanelOpen(true) clears unseenResultCount immediately', () => {
    useConciergeStore.setState({ unseenResultCount: 3 });
    useConciergeStore.getState().setPanelOpen(true);
    expect(useConciergeStore.getState().unseenResultCount).toBe(0);
  });

  it('onRelayReceived: pendingRelayCount-1, unseenResultCount+1', () => {
    useConciergeStore.setState({ pendingRelayCount: 2, unseenResultCount: 0 });
    useConciergeStore.getState().onRelayReceived();
    expect(useConciergeStore.getState().pendingRelayCount).toBe(1);
    expect(useConciergeStore.getState().unseenResultCount).toBe(1);
  });
});
