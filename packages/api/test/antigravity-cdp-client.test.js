import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityCdpClient, findEditorTarget } from
  '../dist/domains/cats/services/agents/providers/antigravity/AntigravityCdpClient.js';

describe('findEditorTarget', () => {
  test('picks editor page, skips Launchpad', () => {
    const targets = [
      { type: 'page', title: 'Launchpad', webSocketDebuggerUrl: 'ws://a', url: 'vscode-file://vscode-app' },
      { type: 'page', title: 'cat-cafe — main.ts', webSocketDebuggerUrl: 'ws://b', url: 'vscode-file://vscode-app' },
      { type: 'iframe', title: 'webview', webSocketDebuggerUrl: 'ws://c', url: 'vscode-webview://ext' },
    ];
    const result = findEditorTarget(targets);
    assert.equal(result?.webSocketDebuggerUrl, 'ws://b');
  });

  test('returns null when no editor page found', () => {
    const targets = [
      { type: 'page', title: 'Launchpad', webSocketDebuggerUrl: 'ws://a', url: '' },
    ];
    assert.equal(findEditorTarget(targets), null);
  });

  test('skips targets without webSocketDebuggerUrl', () => {
    const targets = [
      { type: 'page', title: 'Editor', webSocketDebuggerUrl: '', url: '' },
    ];
    assert.equal(findEditorTarget(targets), null);
  });

  test('skips non-page targets', () => {
    const targets = [
      { type: 'worker', title: 'shared-worker', webSocketDebuggerUrl: 'ws://w', url: '' },
      { type: 'page', title: 'my-project', webSocketDebuggerUrl: 'ws://p', url: '' },
    ];
    const result = findEditorTarget(targets);
    assert.equal(result?.webSocketDebuggerUrl, 'ws://p');
  });
});

// P1-2: findEditorTarget must support titleHint to avoid multi-window misrouting
describe('findEditorTarget with titleHint', () => {
  test('filters by titleHint when provided', () => {
    const targets = [
      { type: 'page', title: 'other-project — index.ts', webSocketDebuggerUrl: 'ws://a', url: '' },
      { type: 'page', title: 'cat-cafe — main.ts', webSocketDebuggerUrl: 'ws://b', url: '' },
    ];
    const result = findEditorTarget(targets, { titleHint: 'cat-cafe' });
    assert.equal(result?.webSocketDebuggerUrl, 'ws://b');
  });

  test('falls back to first match when titleHint has no match', () => {
    const targets = [
      { type: 'page', title: 'my-project — main.ts', webSocketDebuggerUrl: 'ws://a', url: '' },
    ];
    const result = findEditorTarget(targets, { titleHint: 'no-match' });
    assert.equal(result?.webSocketDebuggerUrl, 'ws://a');
  });

  test('without titleHint picks first non-Launchpad page (backward compat)', () => {
    const targets = [
      { type: 'page', title: 'Launchpad', webSocketDebuggerUrl: 'ws://a', url: '' },
      { type: 'page', title: 'project-x', webSocketDebuggerUrl: 'ws://b', url: '' },
    ];
    const result = findEditorTarget(targets);
    assert.equal(result?.webSocketDebuggerUrl, 'ws://b');
  });
});

describe('AntigravityCdpClient', () => {
  test('constructor defaults', () => {
    const client = new AntigravityCdpClient();
    assert.equal(client.connected, false);
  });

  test('constructor with custom port and titleHint', () => {
    const client = new AntigravityCdpClient({ port: 9222, titleHint: 'cat-cafe' });
    assert.equal(client.connected, false);
    // titleHint is stored internally and used in connect() → findEditorTarget()
  });

  test('sendMessage rejects when not connected', async () => {
    const client = new AntigravityCdpClient();
    await assert.rejects(
      () => client.sendMessage('hello'),
      { message: /not connected/i }
    );
  });

  test('newConversation rejects when not connected', async () => {
    const client = new AntigravityCdpClient();
    await assert.rejects(
      () => client.newConversation(),
      { message: /not connected/i }
    );
  });

  test('connect tolerates missing Input.enable on newer CDP targets', async () => {
    const savedFetch = global.fetch;
    const savedWebSocket = global.WebSocket;

    global.fetch = async () => ({
      json: async () => [
        { type: 'page', title: 'cat-cafe — main.ts', webSocketDebuggerUrl: 'ws://fake', url: '' },
      ],
    });

    class FakeWebSocket {
      static OPEN = 1;

      constructor() {
        this.readyState = FakeWebSocket.OPEN;
        queueMicrotask(() => this.onopen?.());
      }

      send(raw) {
        const { id, method } = JSON.parse(raw);
        if (method === 'Runtime.enable') {
          queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id, result: {} }) }));
          return;
        }
        if (method === 'Input.enable') {
          queueMicrotask(() => this.onmessage?.({
            data: JSON.stringify({ id, error: { message: "'Input.enable' wasn't found" } }),
          }));
          return;
        }
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id, result: {} }) }));
      }

      close() {}
    }

    global.WebSocket = FakeWebSocket;

    try {
      const client = new AntigravityCdpClient({ port: 9000 });
      await client.connect();
      assert.equal(client.connected, true);
      await client.disconnect();
    } finally {
      global.fetch = savedFetch;
      global.WebSocket = savedWebSocket;
    }
  });

  test('pollResponse returns once assistant text appears for the current user message count', async () => {
    const client = new AntigravityCdpClient();
    client.ws = { readyState: 1 };

    const states = [
      1,
      JSON.stringify({ userMsgCount: 1, responseText: 'pong', hasInlineLoading: false }),
      JSON.stringify({ userMsgCount: 1, responseText: 'pong', hasInlineLoading: false }),
    ];

    client.evaluate = async () => {
      const next = states.shift();
      if (next === undefined) throw new Error('unexpected evaluate call');
      return next;
    };

    const response = await client.pollResponse(50, {
      pollIntervalMs: 1,
      stablePollCount: 2,
    });

    assert.equal(response, 'pong');
  });

  test('pollResponse waits for inline loading to clear before returning text', async () => {
    const client = new AntigravityCdpClient();
    client.ws = { readyState: 1 };

    const states = [
      1,
      JSON.stringify({ userMsgCount: 1, responseText: 'pong', hasInlineLoading: true }),
      JSON.stringify({ userMsgCount: 1, responseText: 'pong', hasInlineLoading: false }),
      JSON.stringify({ userMsgCount: 1, responseText: 'pong', hasInlineLoading: false }),
    ];

    client.evaluate = async () => {
      const next = states.shift();
      if (next === undefined) throw new Error('unexpected evaluate call');
      return next;
    };

    const response = await client.pollResponse(50, {
      pollIntervalMs: 1,
      stablePollCount: 2,
    });

    assert.equal(response, 'pong');
  });
});
