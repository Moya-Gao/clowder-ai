import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Dynamically import to handle ESM
const { resolveUserId, resolveHeaderUserId } = await import('../../dist/utils/request-identity.js');

/** Helper to create a minimal fake Fastify request */
function fakeRequest(opts = {}) {
  return {
    headers: opts.headers ?? {},
    sessionUserId: opts.sessionUserId ?? undefined,
  };
}

describe('resolveHeaderUserId', () => {
  it('returns sessionUserId when present (highest priority)', () => {
    const req = fakeRequest({
      sessionUserId: 'session-user',
      headers: { 'x-cat-cafe-user': 'header-user', origin: 'http://evil.example' },
    });
    assert.equal(resolveHeaderUserId(req), 'session-user');
  });

  it('returns header userId when no session and no Origin', () => {
    const req = fakeRequest({
      headers: { 'x-cat-cafe-user': 'cli-user' },
    });
    assert.equal(resolveHeaderUserId(req), 'cli-user');
  });

  it('rejects X-Cat-Cafe-User header when Origin is present (browser path)', () => {
    const req = fakeRequest({
      headers: { 'x-cat-cafe-user': 'spoofed-user', origin: 'http://192.168.1.200:8080' },
    });
    assert.equal(resolveHeaderUserId(req), null);
  });

  it('allows session cookie even with Origin (legitimate browser)', () => {
    const req = fakeRequest({
      sessionUserId: 'default-user',
      headers: { origin: 'http://localhost:3001' },
    });
    assert.equal(resolveHeaderUserId(req), 'default-user');
  });
});

describe('resolveUserId', () => {
  it('returns sessionUserId as top priority', () => {
    const req = fakeRequest({
      sessionUserId: 'session-user',
      headers: { 'x-cat-cafe-user': 'header-user', origin: 'http://evil.example' },
    });
    assert.equal(resolveUserId(req, { defaultUserId: 'default-user' }), 'session-user');
  });

  it('falls back to header when no session and no Origin (CLI/MCP path)', () => {
    const req = fakeRequest({
      headers: { 'x-cat-cafe-user': 'mcp-cat' },
    });
    assert.equal(resolveUserId(req), 'mcp-cat');
  });

  it('falls back to defaultUserId when no session, no header, no Origin', () => {
    const req = fakeRequest({});
    assert.equal(resolveUserId(req, { defaultUserId: 'default-user' }), 'default-user');
  });

  it('rejects defaultUserId fallback when Origin is present (browser path)', () => {
    const req = fakeRequest({
      headers: { origin: 'http://192.168.1.200:8080' },
    });
    assert.equal(resolveUserId(req, { defaultUserId: 'default-user' }), null);
  });

  it('rejects header + defaultUserId when Origin present (cross-origin attack)', () => {
    const req = fakeRequest({
      headers: {
        'x-cat-cafe-user': 'spoofed',
        origin: 'http://10.0.0.50:9999',
      },
    });
    assert.equal(resolveUserId(req, { defaultUserId: 'default-user' }), null);
  });

  it('allows session cookie with Origin (legitimate browser after session established)', () => {
    const req = fakeRequest({
      sessionUserId: 'default-user',
      headers: { origin: 'http://localhost:3001' },
    });
    assert.equal(resolveUserId(req, { defaultUserId: 'default-user' }), 'default-user');
  });

  it('rejects body fallback when Origin is present', () => {
    const req = fakeRequest({
      headers: { origin: 'http://192.168.1.100:3000' },
    });
    assert.equal(resolveUserId(req, { fallbackUserId: 'body-user', defaultUserId: 'default-user' }), null);
  });

  it('allows body fallback when no Origin (legacy CLI path)', () => {
    const req = fakeRequest({});
    assert.equal(resolveUserId(req, { fallbackUserId: 'body-user' }), 'body-user');
  });
});
