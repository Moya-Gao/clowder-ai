import { createHash } from 'node:crypto';
import { type FSWatcher, watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { Server, Socket } from 'socket.io';
import { createModuleLogger } from '../../infrastructure/logger.js';
import { getWorktreeRoot, resolveWorkspacePath } from './workspace-security.js';

const log = createModuleLogger('file-watcher');
const DEBOUNCE_MS = 300;

interface WatchEntry {
  watcher: FSWatcher;
  worktreeId: string;
  path: string;
  absolutePath: string;
  targetBasename: string;
  lastSha256: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function computeFileSha256(absolutePath: string): Promise<string | null> {
  try {
    const content = await readFile(absolutePath, 'utf-8');
    return sha256(content);
  } catch {
    return null;
  }
}

export function setupWorkspaceFileWatcher(io: Server): void {
  const socketWatchers = new Map<string, WatchEntry>();

  io.on('connection', (socket: Socket) => {
    socket.on('workspace:watch-file', async (data: { worktreeId: string; path: string; sha256?: string }) => {
      if (!data?.worktreeId || !data?.path) return;

      cleanupSocket(socket.id);

      try {
        const root = await getWorktreeRoot(data.worktreeId);
        const absolutePath = await resolveWorkspacePath(root, data.path);
        await stat(absolutePath);

        const currentSha = (await computeFileSha256(absolutePath)) || '';
        const targetBasename = basename(absolutePath);
        const parentDir = dirname(absolutePath);

        const watcher = watch(parentDir, { persistent: false }, (_eventType, filename) => {
          if (filename && filename !== targetBasename) return;
          const entry = socketWatchers.get(socket.id);
          if (!entry) return;
          if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
          entry.debounceTimer = setTimeout(() => handleChange(socket, entry), DEBOUNCE_MS);
        });

        watcher.on('error', () => cleanupSocket(socket.id));

        socketWatchers.set(socket.id, {
          watcher,
          worktreeId: data.worktreeId,
          path: data.path,
          absolutePath,
          targetBasename,
          lastSha256: currentSha,
          debounceTimer: null,
        });

        log.debug({ socketId: socket.id, path: data.path }, 'Watching file');

        if (currentSha && data.sha256 !== currentSha) {
          socket.emit('workspace:file-changed', {
            worktreeId: data.worktreeId,
            path: data.path,
            sha256: currentSha,
          });
          log.debug({ socketId: socket.id, path: data.path }, 'Immediate sha mismatch, notified client');
        }
      } catch (e) {
        log.debug({ socketId: socket.id, path: data.path, err: e }, 'Failed to watch file');
      }
    });

    socket.on('workspace:unwatch-file', () => {
      cleanupSocket(socket.id);
    });

    socket.on('disconnect', () => {
      cleanupSocket(socket.id);
    });
  });

  async function handleChange(socket: Socket, entry: WatchEntry): Promise<void> {
    const newSha = await computeFileSha256(entry.absolutePath);
    if (!newSha || newSha === entry.lastSha256) return;

    entry.lastSha256 = newSha;

    socket.emit('workspace:file-changed', {
      worktreeId: entry.worktreeId,
      path: entry.path,
      sha256: newSha,
    });
    log.debug({ socketId: socket.id, path: entry.path }, 'File changed, notified client');
  }

  function cleanupSocket(socketId: string): void {
    const entry = socketWatchers.get(socketId);
    if (!entry) return;
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
    socketWatchers.delete(socketId);
  }
}
