import { afterEach, describe, expect, it } from 'vitest';
import { useChatStore } from '@/stores/chatStore';

describe('preview auto-open store', () => {
  afterEach(() => {
    // Reset store between tests
    useChatStore.setState({
      pendingPreviewAutoOpen: null,
      rightPanelMode: 'status',
    });
  });

  it('pendingPreviewAutoOpen defaults to null', () => {
    const state = useChatStore.getState();
    expect(state.pendingPreviewAutoOpen).toBeNull();
  });

  it('setPendingPreviewAutoOpen stores port and path', () => {
    useChatStore.getState().setPendingPreviewAutoOpen({ port: 5173, path: '/about' });
    const state = useChatStore.getState();
    expect(state.pendingPreviewAutoOpen).toEqual({ port: 5173, path: '/about' });
  });

  it('setPendingPreviewAutoOpen switches rightPanelMode to workspace', () => {
    useChatStore.setState({ rightPanelMode: 'status' });
    useChatStore.getState().setPendingPreviewAutoOpen({ port: 5173, path: '/' });
    expect(useChatStore.getState().rightPanelMode).toBe('workspace');
  });

  it('consumePreviewAutoOpen returns and clears pending', () => {
    useChatStore.getState().setPendingPreviewAutoOpen({ port: 3000, path: '/home' });
    const consumed = useChatStore.getState().consumePreviewAutoOpen();
    expect(consumed).toEqual({ port: 3000, path: '/home' });
    expect(useChatStore.getState().pendingPreviewAutoOpen).toBeNull();
  });

  it('consumePreviewAutoOpen returns null when nothing pending', () => {
    const consumed = useChatStore.getState().consumePreviewAutoOpen();
    expect(consumed).toBeNull();
  });
});
