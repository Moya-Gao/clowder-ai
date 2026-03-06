/**
 * Integration tests for GET /api/workspace/file/raw — F063 AC-8 image preview
 *
 * Uses the REAL workspaceRoutes plugin (not a mirror), injecting against
 * the actual production route handler. Test files are created in a temp
 * subdirectory of this worktree and cleaned up after.
 *
 * Security properties verified:
 * 1. Only image/* MIME types served (non-image → 400)
 * 2. Path traversal/denylist inherited from resolveWorkspacePath
 * 3. Correct Content-Type / Content-Length headers
 * 4. Missing params → 400, nonexistent file → 404
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import Fastify from 'fastify';

// 1x1 transparent PNG (68 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
    'Nl7BcQAAAABJRU5ErkJggg==',
  'base64',
);

describe('workspace file/raw endpoint (integration)', () => {
  let app;
  let worktreeId;
  const TEST_DIR = '__raw_endpoint_test__';

  before(async () => {
    // Import real route plugin and security module
    const { workspaceRoutes } = await import('../dist/routes/workspace.js');
    const { listWorktrees } = await import(
      '../dist/domains/workspace/workspace-security.js'
    );

    // Find this worktree's ID
    const worktrees = await listWorktrees();
    const thisWt = worktrees.find((w) =>
      w.root.endsWith('cat-cafe-f063p2b4'),
    );
    // Fallback: use the main worktree if this one isn't found
    const wt = thisWt ?? worktrees[0];
    worktreeId = wt.id;

    // Create temp test files inside the worktree root
    const testBase = join(wt.root, TEST_DIR);
    await mkdir(testBase, { recursive: true });
    await writeFile(join(testBase, 'logo.png'), TINY_PNG);
    await writeFile(join(testBase, 'photo.jpg'), TINY_PNG); // fake jpg
    await writeFile(join(testBase, 'code.ts'), 'export {}');

    // Register real workspaceRoutes on a Fastify instance
    app = Fastify();
    await app.register(workspaceRoutes);
    await app.ready();
  });

  after(async () => {
    await app?.close();
    // Clean up test files — find the worktree root from the resolved path
    const { listWorktrees } = await import(
      '../dist/domains/workspace/workspace-security.js'
    );
    const worktrees = await listWorktrees();
    const thisWt = worktrees.find((w) =>
      w.root.endsWith('cat-cafe-f063p2b4'),
    );
    const wt = thisWt ?? worktrees[0];
    await rm(join(wt.root, TEST_DIR), { recursive: true, force: true });
  });

  // ── Image files served correctly via real route ──

  it('serves PNG with correct Content-Type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}&path=${TEST_DIR}/logo.png`,
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    assert.ok(Number(res.headers['content-length']) > 0);
    assert.equal(res.headers['cache-control'], 'private, max-age=60');
  });

  it('serves JPG with correct Content-Type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}&path=${TEST_DIR}/photo.jpg`,
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'image/jpeg');
  });

  // ── Non-image files rejected ──

  it('rejects non-image files with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}&path=${TEST_DIR}/code.ts`,
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.error.includes('image'));
  });

  // ── Security inheritance from resolveWorkspacePath ──

  it('rejects path traversal (../) with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}&path=../etc/passwd`,
    });
    assert.equal(res.statusCode, 403);
  });

  it('rejects denylist files (.env) with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}&path=.env`,
    });
    assert.equal(res.statusCode, 403);
  });

  // ── Missing params ──

  it('rejects missing worktreeId with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?path=${TEST_DIR}/logo.png`,
    });
    assert.equal(res.statusCode, 400);
  });

  it('rejects missing path with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}`,
    });
    assert.equal(res.statusCode, 400);
  });

  // ── File not found ──

  it('returns 404 for nonexistent image', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/file/raw?worktreeId=${worktreeId}&path=${TEST_DIR}/missing.png`,
    });
    assert.equal(res.statusCode, 404);
  });
});
