import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getThreadHref,
  pushThreadRouteWithFallback,
  type ThreadNavigationWindow,
} from '../ThreadSidebar/thread-navigation';

function createFakeWindow(pathname: string): ThreadNavigationWindow & { assigned: string[] } {
  const assigned: string[] = [];
  const location = {
    pathname,
    assign: (url: string) => {
      assigned.push(url);
      location.pathname = url;
    },
  };

  return {
    assigned,
    clearTimeout: (id) => clearTimeout(id),
    location,
    setTimeout: (handler, timeout) => window.setTimeout(handler, timeout),
  };
}

describe('thread navigation fallback', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('builds the expected href for default and regular threads', () => {
    expect(getThreadHref('default')).toBe('/');
    expect(getThreadHref('thread-123')).toBe('/thread/thread-123');
  });

  it('forces hard navigation when router.push does not change the pathname', () => {
    vi.useFakeTimers();
    const routerPush = vi.fn();
    const logger = { warn: vi.fn() };
    const fakeWindow = createFakeWindow('/thread/thread-a');
    let timerId: number | null = null;

    pushThreadRouteWithFallback({
      threadId: 'thread-b',
      routerPush,
      windowObj: fakeWindow,
      pendingTimerId: timerId,
      setPendingTimerId: (id) => {
        timerId = id;
      },
      logger,
    });

    expect(routerPush).toHaveBeenCalledWith('/thread/thread-b');
    expect(fakeWindow.assigned).toEqual([]);

    vi.advanceTimersByTime(181);

    expect(fakeWindow.assigned).toEqual(['/thread/thread-b']);
    expect(logger.warn).toHaveBeenCalledWith('[ThreadSidebar] router.push stalled, forcing hard navigation', {
      href: '/thread/thread-b',
      startPath: '/thread/thread-a',
    });
    expect(timerId).toBeNull();
  });

  it('skips hard navigation when the pathname changes before the fallback fires', () => {
    vi.useFakeTimers();
    const routerPush = vi.fn((href: string) => {
      fakeWindow.location.pathname = href;
    });
    const logger = { warn: vi.fn() };
    const fakeWindow = createFakeWindow('/thread/thread-a');
    let timerId: number | null = null;

    pushThreadRouteWithFallback({
      threadId: 'thread-b',
      routerPush,
      windowObj: fakeWindow,
      pendingTimerId: timerId,
      setPendingTimerId: (id) => {
        timerId = id;
      },
      logger,
    });

    vi.advanceTimersByTime(181);

    expect(fakeWindow.assigned).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(timerId).toBeNull();
  });

  it('clears an older pending fallback before arming a new one', () => {
    vi.useFakeTimers();
    const routerPush = vi.fn();
    const logger = { warn: vi.fn() };
    const fakeWindow = createFakeWindow('/thread/thread-a');
    let timerId: number | null = null;

    pushThreadRouteWithFallback({
      threadId: 'thread-b',
      routerPush,
      windowObj: fakeWindow,
      pendingTimerId: timerId,
      setPendingTimerId: (id) => {
        timerId = id;
      },
      logger,
    });

    const firstTimer = timerId;
    fakeWindow.location.pathname = '/thread/thread-a';

    pushThreadRouteWithFallback({
      threadId: 'thread-c',
      routerPush,
      windowObj: fakeWindow,
      pendingTimerId: timerId,
      setPendingTimerId: (id) => {
        timerId = id;
      },
      logger,
    });

    vi.advanceTimersByTime(181);

    expect(fakeWindow.assigned).toEqual(['/thread/thread-c']);
    expect(firstTimer).not.toBe(timerId);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
