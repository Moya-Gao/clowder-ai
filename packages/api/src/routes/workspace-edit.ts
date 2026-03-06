/**
 * Workspace Edit Routes — F063 AC-9
 *
 * POST /api/workspace/edit-session — sign edit session token (30min TTL)
 * PUT  /api/workspace/file         — write file (edit_session_token + sha256 conflict)
 */
import { extname } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { signEditToken, verifyEditToken, writeWorkspaceFile } from '../domains/workspace/workspace-edit.js';
import {
  getWorktreeRoot,
  resolveWorkspacePath,
  WorkspaceSecurityError,
} from '../domains/workspace/workspace-security.js';

/** Extensions allowed for text editing (whitelist approach). */
const EDITABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html',
  '.yaml', '.yml', '.toml', '.sh', '.py', '.txt',
]);

/** Dotfiles (no extension) that are safe to edit. */
const EDITABLE_DOTFILES = new Set([
  '.gitignore', '.npmrc', '.eslintrc', '.prettierrc', '.editorconfig',
  '.env.example', '.nvmrc', '.dockerignore', '.prettierignore',
]);

function isEditable(filepath: string): boolean {
  const ext = extname(filepath);
  if (ext && EDITABLE_EXTENSIONS.has(ext)) return true;
  // Dotfiles without extension — only explicit safe list
  const basename = filepath.split('/').pop() ?? '';
  if (EDITABLE_DOTFILES.has(basename)) return true;
  return false;
}

export const workspaceEditRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/workspace/edit-session — sign an edit session token (30min TTL)
  app.post<{
    Body: { worktreeId: string };
  }>('/api/workspace/edit-session', async (request, reply) => {
    const { worktreeId } = request.body ?? {};
    if (!worktreeId) {
      reply.status(400);
      return { error: 'worktreeId required' };
    }
    try {
      await getWorktreeRoot(worktreeId); // validate worktree exists
      const token = signEditToken(worktreeId);
      return { token, expiresIn: 1800 };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(404);
        return { error: e.message };
      }
      reply.status(500);
      return { error: 'Internal error' };
    }
  });

  // PUT /api/workspace/file — write file content (requires edit_session_token + baseSha256)
  app.put<{
    Body: {
      worktreeId: string;
      path: string;
      content: string;
      baseSha256: string;
      editSessionToken: string;
    };
  }>('/api/workspace/file', async (request, reply) => {
    const { worktreeId, path: filePath, content, baseSha256, editSessionToken } = request.body ?? {};
    if (!worktreeId || !filePath || content == null || !baseSha256 || !editSessionToken) {
      reply.status(400);
      return { error: 'worktreeId, path, content, baseSha256, and editSessionToken required' };
    }

    // Token validation
    const payload = verifyEditToken(editSessionToken, worktreeId);
    if (!payload) {
      reply.status(401);
      return { error: 'Invalid or expired edit session token' };
    }

    try {
      const root = await getWorktreeRoot(worktreeId);
      const resolved = await resolveWorkspacePath(root, filePath);
      // Reject non-editable files (binary, images, unknown extensions)
      if (!isEditable(filePath)) {
        reply.status(400);
        return { error: 'Cannot edit binary files' };
      }

      const result = await writeWorkspaceFile(resolved, content, baseSha256);
      if (!result.ok) {
        reply.status(409);
        return { error: 'Conflict: file was modified', currentSha256: result.currentSha256 };
      }

      return { path: filePath, sha256: result.newSha256, size: result.size };
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
        return { error: e.message };
      }
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        reply.status(404);
        return { error: 'File not found' };
      }
      reply.status(500);
      return { error: 'Internal error' };
    }
  });
};
