import { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { API_URL } from '@/utils/api-client';

/**
 * Fail-closed filter: determines if an auto-open event should be accepted.
 * Exported for testing.
 */
export function shouldAcceptAutoOpen(
  sessionWorktreeId: string | null,
  eventWorktreeId: string | undefined,
): boolean {
  if (sessionWorktreeId) {
    // Session has worktree → only accept exact match
    return eventWorktreeId === sessionWorktreeId;
  }
  // Session has no worktree → only accept global events (no worktreeId)
  return !eventWorktreeId;
}

/**
 * F120: Always-mounted socket listener for preview:auto-open events.
 *
 * Problem: WorkspacePanel only mounts when rightPanelMode='workspace'.
 * When user is in status bar mode, auto-open events are lost.
 *
 * Solution: This hook mounts in ChatContainer (always rendered),
 * stores pending auto-open in the store, and switches to workspace mode.
 * WorkspacePanel then consumes the pending state on mount.
 */
export function usePreviewAutoOpen(worktreeId: string | null) {
  const setPendingPreviewAutoOpen = useChatStore((s) => s.setPendingPreviewAutoOpen);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      const apiUrl = new URL(API_URL);
      const socket = io(`${apiUrl.protocol}//${apiUrl.host}`, { transports: ['websocket'] });

      // Only join the room matching our session scope.
      // Sessions with worktreeId join ONLY their worktree room (not global),
      // preventing cross-session event fan-out at the transport layer.
      // Sessions without worktreeId join ONLY preview:global.
      if (worktreeId) {
        socket.emit('join_room', `worktree:${worktreeId}`);
      } else {
        socket.emit('join_room', 'preview:global');
      }

      const handler = (data: { port: number; path?: string; worktreeId?: string }) => {
        if (!shouldAcceptAutoOpen(worktreeId, data.worktreeId)) return;
        // Store triggers rightPanelMode='workspace', which auto-opens the panel
        setPendingPreviewAutoOpen({ port: data.port, path: data.path ?? '/' });
      };

      socket.on('preview:auto-open', handler);

      cleanup = () => {
        socket.off('preview:auto-open', handler);
        socket.disconnect();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [worktreeId, setPendingPreviewAutoOpen]);
}
