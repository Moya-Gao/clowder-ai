import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('apiFetch 401 retry', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  async function loadApiFetch() {
    vi.resetModules();
    // Stub location so resolveApiUrl picks a deterministic base
    vi.stubGlobal('location', {
      hostname: 'localhost',
      port: '3001',
      protocol: 'http:',
    });
    const mod = await import('../api-client');
    return mod.apiFetch;
  }

  it('retries once after 401 by re-establishing session', async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      // Session endpoint always succeeds
      if (url.includes('/api/session')) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      // First data call returns 401, second succeeds
      if (calls.filter((c) => c.includes('/api/messages')).length === 1) {
        return Promise.resolve({ ok: false, status: 401 });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    globalThis.fetch = mockFetch;

    const apiFetch = await loadApiFetch();
    const res = await apiFetch('/api/messages');

    expect(res.status).toBe(200);
    // Should have called: session (init), messages (401), session (retry), messages (success)
    const sessionCalls = calls.filter((c) => c.includes('/api/session'));
    const messageCalls = calls.filter((c) => c.includes('/api/messages'));
    expect(sessionCalls.length).toBe(2);
    expect(messageCalls.length).toBe(2);
  });

  it('does not retry on non-401 errors', async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      if (url.includes('/api/session')) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });
    globalThis.fetch = mockFetch;

    const apiFetch = await loadApiFetch();
    const res = await apiFetch('/api/messages');

    expect(res.status).toBe(500);
    const messageCalls = calls.filter((c) => c.includes('/api/messages'));
    expect(messageCalls.length).toBe(1);
  });

  it('passes credentials: include on all requests including retry', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/session')) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      // Always 401 to trigger retry path
      return Promise.resolve({ ok: false, status: 401 });
    });
    globalThis.fetch = mockFetch;

    const apiFetch = await loadApiFetch();
    await apiFetch('/api/test');

    // Every call should have credentials: 'include'
    for (const call of mockFetch.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.credentials).toBe('include');
    }
  });
});
