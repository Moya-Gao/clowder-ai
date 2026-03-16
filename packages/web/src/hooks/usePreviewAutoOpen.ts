import { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { API_URL } from '@/utils/api-client';

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

      const room = worktreeId ? `worktree:${worktreeId}` : 'preview:global';
      socket.emit('join_room', room);

      const handler = (data: { port: number; path?: string; worktreeId?: string }) => {
        // Fail-closed scope: worktreeId must match
        if ((data.worktreeId ?? null) !== (worktreeId ?? null)) return;
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
