import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createThreadSidebarHarness,
  installThreadSidebarGlobals,
  mockStore,
  resetThreadSidebarGlobals,
  resetThreadSidebarMocks,
  type ThreadSidebarHarness,
} from './thread-sidebar-test-helpers';

describe('ThreadSidebar Mission Hub entry', () => {
  let harness: ThreadSidebarHarness;
  let originalLocation: Location;
  let assignMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    installThreadSidebarGlobals();
  });

  beforeEach(() => {
    resetThreadSidebarMocks();
    mockStore.currentThreadId = 'thread-active';
    assignMock = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignMock },
    });
    harness = createThreadSidebarHarness();
  });

  afterEach(() => {
    harness.cleanup();
    mockStore.currentThreadId = 'default';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  afterAll(() => {
    resetThreadSidebarGlobals();
  });

  it('keeps Mission Hub as a visible text entry and preserves thread referrer navigation', async () => {
    await harness.render();

    const missionEntry = harness.container.querySelector(
      '[data-testid="sidebar-mission-control"]',
    ) as HTMLButtonElement | null;

    expect(missionEntry).not.toBeNull();
    if (!missionEntry) throw new Error('Mission Hub entry missing');
    expect(missionEntry.textContent).toContain('Mission Hub');

    await act(async () => {
      missionEntry.click();
    });

    expect(assignMock).toHaveBeenCalledWith('/mission-hub?from=thread-active');
  });
});
