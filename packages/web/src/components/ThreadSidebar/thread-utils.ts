import type { Thread } from '@/stores/chat-types';

export function formatRelativeTime(ts: number, compact = false): string {
  const diff = Date.now() - ts;
  if (compact) {
    if (diff < 60_000) return '刚刚';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}时`;
    return `${Math.floor(diff / 86400_000)}天`;
  }
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return `${Math.floor(diff / 86400_000)}天前`;
}

export function projectDisplayName(path: string): string {
  if (path === 'default') return '未分类';
  const parts = path.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || path;
}

export function getProjectPaths(threads: Thread[]): string[] {
  const paths = new Set<string>();
  for (const t of threads) {
    if (t.projectPath && t.projectPath !== 'default') {
      paths.add(t.projectPath);
    }
  }
  return [...paths].sort();
}

/** Thread group for sidebar rendering */
export interface ThreadGroup {
  type: 'pinned' | 'project' | 'favorites';
  label: string;
  threads: Thread[];
  projectPath?: string;
}

/**
 * Sort and group threads into: pinned → project groups → favorites.
 * Excludes the "default" thread (lobby) which is rendered separately.
 */
export function sortAndGroupThreads(threads: Thread[]): ThreadGroup[] {
  const groups: ThreadGroup[] = [];

  // 1. Pinned threads (sorted by pinnedAt desc)
  const pinned = threads
    .filter((t) => t.pinned && t.id !== 'default')
    .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
  if (pinned.length > 0) {
    groups.push({ type: 'pinned', label: '置顶', threads: pinned });
  }

  // 2. Regular threads grouped by project
  const regular = threads.filter((t) => !t.pinned && !t.favorited && t.id !== 'default');
  const projectGroups = groupByProject(regular);
  for (const [projectPath, projectThreads] of projectGroups) {
    groups.push({
      type: 'project',
      label: projectDisplayName(projectPath),
      threads: projectThreads,
      projectPath,
    });
  }

  // 3. Favorites (sorted by favoritedAt desc, excluding pinned)
  const favorited = threads
    .filter((t) => t.favorited && !t.pinned && t.id !== 'default')
    .sort((a, b) => (b.favoritedAt ?? 0) - (a.favoritedAt ?? 0));
  if (favorited.length > 0) {
    groups.push({ type: 'favorites', label: '收藏', threads: favorited });
  }

  return groups;
}

function groupByProject(threads: Thread[]): [string, Thread[]][] {
  const groups = new Map<string, Thread[]>();
  for (const thread of threads) {
    const key = thread.projectPath;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(thread);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return a.localeCompare(b);
  });
}
