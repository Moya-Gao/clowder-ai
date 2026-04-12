export interface ThreadNavigationWindow {
  clearTimeout: (id: number) => void;
  location: {
    pathname: string;
    assign: (url: string) => void;
  };
  setTimeout: (handler: () => void, timeout?: number) => number;
}

interface PushThreadRouteWithFallbackOptions {
  threadId: string;
  routerPush: (href: string) => void;
  windowObj?: ThreadNavigationWindow;
  pendingTimerId: number | null;
  setPendingTimerId: (id: number | null) => void;
  fallbackDelayMs?: number;
  logger?: Pick<Console, 'warn'>;
}

export function getThreadHref(threadId: string): string {
  return threadId === 'default' ? '/' : `/thread/${threadId}`;
}

export function pushThreadRouteWithFallback({
  threadId,
  routerPush,
  windowObj,
  pendingTimerId,
  setPendingTimerId,
  fallbackDelayMs = 180,
  logger = console,
}: PushThreadRouteWithFallbackOptions): string {
  const href = getThreadHref(threadId);
  routerPush(href);

  if (!windowObj) return href;

  const startPath = windowObj.location.pathname;

  if (pendingTimerId !== null) {
    windowObj.clearTimeout(pendingTimerId);
    setPendingTimerId(null);
  }

  if (startPath === href) return href;

  const timerId = windowObj.setTimeout(() => {
    setPendingTimerId(null);
    if (windowObj.location.pathname === startPath) {
      logger.warn('[ThreadSidebar] router.push stalled, forcing hard navigation', { href, startPath });
      windowObj.location.assign(href);
    }
  }, fallbackDelayMs);

  setPendingTimerId(timerId);
  return href;
}
