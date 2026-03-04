import { describe, it, expect } from 'vitest';
import {
  sortAndGroupThreads,
  formatRelativeTime,
  projectDisplayName,
  getProjectPaths,
} from '../ThreadSidebar/thread-utils';
import type { Thread } from '@/stores/chat-types';

function makeThread(overrides: Partial<Thread> & { id: string }): Thread {
  return {
    projectPath: 'default',
    title: null,
    createdBy: 'user',
    participants: [],
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── sortAndGroupThreads ────────────────────────────────

describe('sortAndGroupThreads', () => {
  it('returns empty array for empty input', () => {
    expect(sortAndGroupThreads([])).toEqual([]);
  });

  it('excludes the "default" thread (lobby)', () => {
    const threads = [makeThread({ id: 'default' })];
    expect(sortAndGroupThreads(threads)).toEqual([]);
  });

  it('groups regular threads by project', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: '/proj/a' }),
      makeThread({ id: 't2', projectPath: '/proj/b' }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups).toHaveLength(2);
    expect(groups[0].type).toBe('project');
    expect(groups[1].type).toBe('project');
    expect(groups.map((g) => g.label).sort()).toEqual(['a', 'b']);
  });

  it('puts pinned threads first, sorted by lastActiveAt desc', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: '/proj/x', lastActiveAt: 500 }),
      makeThread({ id: 'p1', pinned: true, pinnedAt: 200, projectPath: '/proj/x', lastActiveAt: 1000 }),
      makeThread({ id: 'p2', pinned: true, pinnedAt: 100, projectPath: '/proj/x', lastActiveAt: 5000 }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups[0].type).toBe('pinned');
    expect(groups[0].threads.map((t) => t.id)).toEqual(['p2', 'p1']); // lastActiveAt 5000 before 1000
  });

  it('puts favorites last, sorted by lastActiveAt desc', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: '/proj/x', lastActiveAt: 500 }),
      makeThread({ id: 'f1', favorited: true, favoritedAt: 100, projectPath: '/proj/x', lastActiveAt: 1000 }),
      makeThread({ id: 'f2', favorited: true, favoritedAt: 200, projectPath: '/proj/x', lastActiveAt: 5000 }),
    ];
    const groups = sortAndGroupThreads(threads);
    const last = groups[groups.length - 1];
    expect(last.type).toBe('favorites');
    expect(last.threads.map((t) => t.id)).toEqual(['f2', 'f1']); // lastActiveAt 5000 before 1000
  });

  it('pinned + favorited thread appears in pinned only', () => {
    const threads = [
      makeThread({
        id: 'both',
        pinned: true,
        pinnedAt: 100,
        favorited: true,
        favoritedAt: 50,
        projectPath: '/proj/x',
      }),
      makeThread({ id: 'regular', projectPath: '/proj/x' }),
    ];
    const groups = sortAndGroupThreads(threads);
    const pinnedGroup = groups.find((g) => g.type === 'pinned');
    const favGroup = groups.find((g) => g.type === 'favorites');
    expect(pinnedGroup).toBeDefined();
    expect(pinnedGroup!.threads).toHaveLength(1);
    expect(pinnedGroup!.threads[0].id).toBe('both');
    expect(favGroup).toBeUndefined(); // should not appear in favorites
  });

  it('order is pinned → project → favorites', () => {
    const threads = [
      makeThread({ id: 'f1', favorited: true, favoritedAt: 100, projectPath: '/proj/x' }),
      makeThread({ id: 'p1', pinned: true, pinnedAt: 100, projectPath: '/proj/x' }),
      makeThread({ id: 'r1', projectPath: '/proj/x' }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups.map((g) => g.type)).toEqual(['pinned', 'project', 'favorites']);
  });

  it('omits empty groups', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: '/proj/a' }),
      makeThread({ id: 't2', projectPath: '/proj/a' }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('project');
    expect(groups[0].threads).toHaveLength(2);
  });

  it('handles threads with no pinned/favorited fields (backward compat)', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: '/proj/x' }),
      makeThread({ id: 't2', projectPath: '/proj/x' }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('project');
    expect(groups[0].threads).toHaveLength(2);
  });

  it('sorts regular threads within project by lastActiveAt desc', () => {
    const threads = [
      makeThread({ id: 'old', projectPath: '/proj/x', lastActiveAt: 1000 }),
      makeThread({ id: 'new', projectPath: '/proj/x', lastActiveAt: 5000 }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups[0].threads.map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('sorts unread threads before read threads within pinned group', () => {
    const threads = [
      makeThread({ id: 'read-new', projectPath: '/proj/x', lastActiveAt: 9000, pinned: true }),
      makeThread({ id: 'unread-old', projectPath: '/proj/x', lastActiveAt: 1000, pinned: true }),
    ];
    const unreadSet = new Set(['unread-old']);
    const groups = sortAndGroupThreads(threads, unreadSet);
    const pinned = groups.find((g) => g.type === 'pinned')!;
    expect(pinned.threads[0].id).toBe('unread-old'); // unread first
    expect(pinned.threads[1].id).toBe('read-new');
  });

  it('within unread threads, still sorts by lastActiveAt desc', () => {
    const threads = [
      makeThread({ id: 'unread-old', projectPath: '/proj/x', lastActiveAt: 1000, pinned: true }),
      makeThread({ id: 'unread-new', projectPath: '/proj/x', lastActiveAt: 5000, pinned: true }),
    ];
    const unreadSet = new Set(['unread-old', 'unread-new']);
    const groups = sortAndGroupThreads(threads, unreadSet);
    const pinned = groups.find((g) => g.type === 'pinned')!;
    expect(pinned.threads[0].id).toBe('unread-new');
    expect(pinned.threads[1].id).toBe('unread-old');
  });

  it('unread priority works across all group types', () => {
    const threads = [
      makeThread({ id: 'fav-read', projectPath: '/proj/x', lastActiveAt: 9000, favorited: true }),
      makeThread({ id: 'fav-unread', projectPath: '/proj/x', lastActiveAt: 1000, favorited: true }),
      makeThread({ id: 'reg-read', projectPath: '/proj/x', lastActiveAt: 9000 }),
      makeThread({ id: 'reg-unread', projectPath: '/proj/x', lastActiveAt: 1000 }),
    ];
    const unreadSet = new Set(['fav-unread', 'reg-unread']);
    const groups = sortAndGroupThreads(threads, unreadSet);
    const project = groups.find((g) => g.type === 'project')!;
    expect(project.threads[0].id).toBe('reg-unread');
    const fav = groups.find((g) => g.type === 'favorites')!;
    expect(fav.threads[0].id).toBe('fav-unread');
  });

  it('no unreadIds param defaults to lastActiveAt-only sort', () => {
    const threads = [
      makeThread({ id: 'old', projectPath: '/proj/x', lastActiveAt: 1000, pinned: true }),
      makeThread({ id: 'new', projectPath: '/proj/x', lastActiveAt: 5000, pinned: true }),
    ];
    const groups = sortAndGroupThreads(threads);
    const pinned = groups.find((g) => g.type === 'pinned')!;
    expect(pinned.threads[0].id).toBe('new');
  });

  it('sorts project groups alphabetically, "default" last', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: 'default' }),
      makeThread({ id: 't2', projectPath: '/proj/b' }),
      makeThread({ id: 't3', projectPath: '/proj/a' }),
    ];
    const groups = sortAndGroupThreads(threads);
    expect(groups.map((g) => g.label)).toEqual(['a', 'b', '未分类']);
  });
});

// ── formatRelativeTime ────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "刚刚" for less than 60s', () => {
    expect(formatRelativeTime(Date.now() - 30_000)).toBe('刚刚');
  });

  it('returns minutes in normal mode', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5分钟前');
  });

  it('returns compact minutes', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000, true)).toBe('5分');
  });

  it('returns hours in normal mode', () => {
    expect(formatRelativeTime(Date.now() - 3 * 3600_000)).toBe('3小时前');
  });

  it('returns compact hours', () => {
    expect(formatRelativeTime(Date.now() - 3 * 3600_000, true)).toBe('3时');
  });

  it('returns days in normal mode', () => {
    expect(formatRelativeTime(Date.now() - 2 * 86400_000)).toBe('2天前');
  });

  it('returns compact days', () => {
    expect(formatRelativeTime(Date.now() - 2 * 86400_000, true)).toBe('2天');
  });
});

// ── projectDisplayName ────────────────────────────────

describe('projectDisplayName', () => {
  it('returns "未分类" for "default"', () => {
    expect(projectDisplayName('default')).toBe('未分类');
  });

  it('returns last segment of path', () => {
    expect(projectDisplayName('/Users/dev/my-project')).toBe('my-project');
  });

  it('handles trailing slash', () => {
    expect(projectDisplayName('/foo/bar/')).toBe('bar');
  });
});

// ── getProjectPaths ────────────────────────────────

describe('getProjectPaths', () => {
  it('returns sorted unique non-default paths', () => {
    const threads = [
      makeThread({ id: 't1', projectPath: '/proj/b' }),
      makeThread({ id: 't2', projectPath: '/proj/a' }),
      makeThread({ id: 't3', projectPath: '/proj/b' }),
      makeThread({ id: 't4', projectPath: 'default' }),
    ];
    expect(getProjectPaths(threads)).toEqual(['/proj/a', '/proj/b']);
  });

  it('returns empty for no project threads', () => {
    const threads = [makeThread({ id: 't1', projectPath: 'default' })];
    expect(getProjectPaths(threads)).toEqual([]);
  });
});
