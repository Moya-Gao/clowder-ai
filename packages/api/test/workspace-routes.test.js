import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('workspace-routes', () => {
  let mod;

  before(async () => {
    mod = await import('../dist/routes/workspace.js');
  });

  it('exports workspaceRoutes as FastifyPluginAsync', () => {
    assert.ok(typeof mod.workspaceRoutes === 'function');
  });

  // Integration tests for actual HTTP responses are covered by
  // the security layer tests (workspace-security.test.js) and
  // manual smoke testing against the running dev server.
  // The route handlers are thin wrappers around security + fs operations.
});
