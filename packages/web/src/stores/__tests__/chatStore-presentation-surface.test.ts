import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../chatStore';

/**
 * F226 Presentation Surface — file/md tear-off floating window for demo mode.
 *
 * Core contract (砚砚 spec review P1.2):
 *  - dockBack:  switch docked workspace back to `dev` + restore file snapshot + clear float
 *  - close/minimize: must NOT mutate the current docked mode (演示中 docked 停在定时任务，
 *    收回/最小化讲稿浮窗不该把它踢回 dev)
 *  - tear-off is a COPY (KD-2): docked workspace file is preserved when detaching
 *  - snapshot is file-centric (KD-4/P2): only file/md, never carries other workspace modes
 */
describe('F226 presentation surface (file/md tear-off floating window)', () => {
  beforeEach(() => {
    useChatStore.setState({
      currentThreadId: 'thread-a',
      threadStates: {},
      workspaceMode: 'dev',
      workspaceWorktreeId: 'wt-main',
      workspaceOpenTabs: ['docs/讲稿.md'],
      workspaceOpenFilePath: 'docs/讲稿.md',
      workspaceOpenFileLine: 12,
      presentationSurface: null,
    });
  });

  it('detachToFloat snapshots the current dev file into a floating surface, docked file preserved', () => {
    useChatStore.getState().detachToFloat();
    const surface = useChatStore.getState().presentationSurface;
    expect(surface).not.toBeNull();
    expect(surface?.content.filePath).toBe('docs/讲稿.md');
    expect(surface?.content.title).toBe('讲稿.md');
    expect(surface?.content.fileKind).toBe('markdown');
    expect(surface?.content.line).toBe(12);
    expect(surface?.pos).toBeDefined();
    expect(surface?.size).toBeDefined();
    expect(surface?.minimized).toBe(false);
    // tear-off is a copy (KD-2): docked workspace file preserved, not moved away
    expect(useChatStore.getState().workspaceOpenFilePath).toBe('docs/讲稿.md');
  });

  it('detachToFloat infers fileKind=image for image extensions', () => {
    useChatStore.setState({ workspaceOpenFilePath: 'assets/slide-3.png', workspaceOpenTabs: ['assets/slide-3.png'] });
    useChatStore.getState().detachToFloat();
    expect(useChatStore.getState().presentationSurface?.content.fileKind).toBe('image');
    expect(useChatStore.getState().presentationSurface?.content.title).toBe('slide-3.png');
  });

  it('detachToFloat is a no-op when no dev file is open', () => {
    useChatStore.setState({ workspaceOpenFilePath: null, workspaceOpenTabs: [] });
    useChatStore.getState().detachToFloat();
    expect(useChatStore.getState().presentationSurface).toBeNull();
  });

  it('dockBack switches docked workspace back to dev + restores file snapshot + clears float', () => {
    useChatStore.getState().detachToFloat();
    // docked switched away to schedule during demo
    useChatStore.getState().setWorkspaceMode('schedule');
    expect(useChatStore.getState().workspaceMode).toBe('schedule');
    // dock back
    useChatStore.getState().dockBack();
    expect(useChatStore.getState().workspaceMode).toBe('dev');
    expect(useChatStore.getState().workspaceOpenFilePath).toBe('docs/讲稿.md');
    expect(useChatStore.getState().workspaceOpenFileLine).toBe(12);
    expect(useChatStore.getState().presentationSurface).toBeNull();
  });

  it('closeFloat clears the float WITHOUT mutating docked mode (砚砚 P1.2 contract)', () => {
    useChatStore.getState().detachToFloat();
    useChatStore.getState().setWorkspaceMode('schedule'); // docked parked on 定时任务
    useChatStore.getState().closeFloat();
    expect(useChatStore.getState().presentationSurface).toBeNull();
    // critical: docked mode must NOT be reset to dev
    expect(useChatStore.getState().workspaceMode).toBe('schedule');
  });

  it('minimizeFloat toggles minimized WITHOUT mutating docked mode', () => {
    useChatStore.getState().detachToFloat();
    useChatStore.getState().setWorkspaceMode('tasks');
    useChatStore.getState().minimizeFloat(true);
    expect(useChatStore.getState().presentationSurface?.minimized).toBe(true);
    expect(useChatStore.getState().workspaceMode).toBe('tasks');
    useChatStore.getState().minimizeFloat(false);
    expect(useChatStore.getState().presentationSurface?.minimized).toBe(false);
  });

  it('setFloatPos / setFloatSize update geometry', () => {
    useChatStore.getState().detachToFloat();
    useChatStore.getState().setFloatPos({ x: 240, y: 160 });
    useChatStore.getState().setFloatSize({ width: 500, height: 600 });
    const surface = useChatStore.getState().presentationSurface;
    expect(surface?.pos).toEqual({ x: 240, y: 160 });
    expect(surface?.size).toEqual({ width: 500, height: 600 });
  });

  it('detachToFloat snapshots the tracked viewport + dockBack restores it (云端 P2)', () => {
    // presentationLock had recorded a scroll position before tear-off
    useChatStore.setState({ workspaceScrollTop: 740 });
    useChatStore.getState().detachToFloat();
    expect(useChatStore.getState().presentationSurface?.content.scrollTop).toBe(740);
    // docked parked elsewhere during the demo (viewport cleared), then dock back
    useChatStore.setState({ workspaceScrollTop: null });
    useChatStore.getState().dockBack();
    // viewport restored → a long doc returns to where the presenter was, not the top
    expect(useChatStore.getState().workspaceScrollTop).toBe(740);
  });

  it('detachToFloat snapshots null scrollTop when no viewport was tracked', () => {
    useChatStore.setState({ workspaceScrollTop: null });
    useChatStore.getState().detachToFloat();
    expect(useChatStore.getState().presentationSurface?.content.scrollTop).toBeNull();
  });

  it('dockBack clears a stale edit token obtained in the interim worktree (云端 P2)', () => {
    // tear off from wt-main, then the freed docked panel switched worktree + got an edit session there
    useChatStore.getState().detachToFloat();
    useChatStore.setState({
      workspaceWorktreeId: 'wt-other',
      workspaceEditToken: 'interim-token',
      workspaceEditTokenExpiry: Date.now() + 60_000,
    });
    useChatStore.getState().dockBack();
    // worktree restored to the snapshot; the interim token is worktree-bound and must be cleared
    expect(useChatStore.getState().workspaceWorktreeId).toBe('wt-main');
    expect(useChatStore.getState().workspaceEditToken).toBeNull();
    expect(useChatStore.getState().workspaceEditTokenExpiry).toBeNull();
  });
});
