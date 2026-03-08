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

  test('cdp() includes timeout duration in error message', async () => {
    const client = new AntigravityCdpClient({ commandTimeoutMs: 50 });
    // Fake a connected WS that never responds
    client.ws = {
      readyState: 1,
      send() { /* swallow — never respond */ },
      close() {},
    };
    await assert.rejects(
      () => client.cdp('Runtime.evaluate', {}),
      (err) => {
        assert.match(err.message, /CDP timeout for Runtime.evaluate/);
        assert.match(err.message, /50ms/);
        return true;
      }
    );
  });

  test('cdp() per-call timeout overrides default', async () => {
    const client = new AntigravityCdpClient({ commandTimeoutMs: 30_000 });
    client.ws = {
      readyState: 1,
      send() { /* never respond */ },
      close() {},
    };
    const start = Date.now();
    await assert.rejects(() => client.cdp('Test.method', {}, 50));
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 1000, `Should timeout in ~50ms, took ${elapsed}ms`);
  });

  test('WebSocket close rejects all pending commands immediately', async () => {
    const savedFetch = global.fetch;
    const savedWebSocket = global.WebSocket;

    global.fetch = async () => ({
      json: async () => [
        { type: 'page', title: 'editor', webSocketDebuggerUrl: 'ws://fake', url: '' },
      ],
    });

    let wsInstance;
    class FakeWS {
      static OPEN = 1;
      constructor() {
        this.readyState = FakeWS.OPEN;
        wsInstance = this;
        queueMicrotask(() => this.onopen?.());
      }
      send(raw) {
        const { id, method } = JSON.parse(raw);
        if (method === 'Runtime.enable' || method === 'Input.enable') {
          queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id, result: {} }) }));
        }
        // For other methods, do NOT respond — let them pend
      }
      close() { this.readyState = 3; }
    }
    global.WebSocket = FakeWS;

    try {
      const client = new AntigravityCdpClient({ commandTimeoutMs: 30_000 });
      await client.connect();

      // Start a command that will never get a response
      const pendingCmd = client.cdp('Runtime.evaluate', { expression: '1+1' });

      // Simulate WebSocket closing
      queueMicrotask(() => wsInstance.onclose?.());

      await assert.rejects(pendingCmd, /WebSocket closed unexpectedly/);
    } finally {
      global.fetch = savedFetch;
      global.WebSocket = savedWebSocket;
    }
  });

  test('evaluate() surfaces CDP exception details', async () => {
    const savedFetch = global.fetch;
    const savedWebSocket = global.WebSocket;

    global.fetch = async () => ({
      json: async () => [
        { type: 'page', title: 'editor', webSocketDebuggerUrl: 'ws://fake', url: '' },
      ],
    });

    class FakeWS {
      static OPEN = 1;
      constructor() {
        this.readyState = FakeWS.OPEN;
        queueMicrotask(() => this.onopen?.());
      }
      send(raw) {
        const { id, method } = JSON.parse(raw);
        if (method === 'Runtime.enable' || method === 'Input.enable') {
          queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id, result: {} }) }));
          return;
        }
        // For Runtime.evaluate, return an exception result
        queueMicrotask(() => this.onmessage?.({
          data: JSON.stringify({
            id,
            result: {
              result: { type: 'object', subtype: 'error' },
              exceptionDetails: {
                text: 'Uncaught',
                exception: { description: 'ReferenceError: foo is not defined' },
              },
            },
          }),
        }));
      }
      close() {}
    }
    global.WebSocket = FakeWS;

    try {
      const client = new AntigravityCdpClient();
      await client.connect();
      await assert.rejects(
        () => client.evaluate('foo'),
        /CDP evaluate error.*ReferenceError/
      );
      await client.disconnect();
    } finally {
      global.fetch = savedFetch;
      global.WebSocket = savedWebSocket;
    }
  });

  test('connect() times out with connectTimeoutMs', async () => {
    const savedFetch = global.fetch;
    const savedWebSocket = global.WebSocket;

    global.fetch = async () => ({
      json: async () => [
        { type: 'page', title: 'editor', webSocketDebuggerUrl: 'ws://fake', url: '' },
      ],
    });

    class SlowWS {
      static OPEN = 1;
      constructor() { this.readyState = 0; /* never fire onopen */ }
      close() { this.readyState = 3; }
      send() {}
    }
    global.WebSocket = SlowWS;

    try {
      const client = new AntigravityCdpClient({ connectTimeoutMs: 50 });
      await assert.rejects(
        () => client.connect(),
        /WebSocket connect timeout.*50ms/
      );
    } finally {
      global.fetch = savedFetch;
      global.WebSocket = savedWebSocket;
    }
  });

  test('disconnect clears pending command timers without leaking', async () => {
    const client = new AntigravityCdpClient({ commandTimeoutMs: 60_000 });
    client.ws = {
      readyState: 1,
      send() { /* never respond */ },
      close() {},
      onclose: null,
      onerror: null,
    };
    // Start a command (will be pending forever)
    const pendingCmd = client.cdp('Test.method', {});
    // Disconnect should clear the pending map and timers
    await client.disconnect();
    // The pending promise should never resolve or reject (timer cleared),
    // but the map should be empty
    assert.equal(client.pending.size, 0);
  });

  test('sendMessage clicks send button when found (strategy A)', async () => {
    const client = new AntigravityCdpClient();
    client.ws = { readyState: 1 };

    const cdpCalls = [];
    const evaluateResults = [
      // 1. textbox query → returns position
      JSON.stringify({ x: 100, y: 200 }),
      // 2. execCommand insertText → void
      undefined,
      // 3. FIND_SEND_BUTTON_JS → returns button position
      JSON.stringify({ x: 300, y: 400 }),
    ];

    client.evaluate = async () => evaluateResults.shift();
    client.cdp = async (method, params) => {
      cdpCalls.push({ method, params });
      return {};
    };

    await client.sendMessage('hello');

    // Should have clicked textbox (mousePressed+Released) then send button (mousePressed+Released)
    const mouseEvents = cdpCalls.filter(c => c.method === 'Input.dispatchMouseEvent');
    assert.equal(mouseEvents.length, 4); // 2 for textbox click + 2 for send button click
    // Last click should be at send button coordinates
    assert.equal(mouseEvents[2].params.x, 300);
    assert.equal(mouseEvents[2].params.y, 400);
    // No keyboard events dispatched
    const keyEvents = cdpCalls.filter(c => c.method === 'Input.dispatchKeyEvent');
    assert.equal(keyEvents.length, 0);
  });

  test('sendMessage falls back to JS Enter when no send button (strategy B)', async () => {
    const client = new AntigravityCdpClient();
    client.ws = { readyState: 1 };

    const evaluateResults = [
      JSON.stringify({ x: 100, y: 200 }), // textbox
      undefined,                            // execCommand
      null,                                 // FIND_SEND_BUTTON_JS → not found
      true,                                 // DISPATCH_ENTER_JS → success
    ];

    const cdpCalls = [];
    client.evaluate = async () => evaluateResults.shift();
    client.cdp = async (method, params) => {
      cdpCalls.push({ method, params });
      return {};
    };

    await client.sendMessage('hello');

    // No CDP keyboard events — JS dispatch handled it
    const keyEvents = cdpCalls.filter(c => c.method === 'Input.dispatchKeyEvent');
    assert.equal(keyEvents.length, 0);
  });

  test('sendMessage falls back to CDP Input when button and JS Enter both fail (strategy C)', async () => {
    const client = new AntigravityCdpClient();
    client.ws = { readyState: 1 };

    const evaluateResults = [
      JSON.stringify({ x: 100, y: 200 }), // textbox
      undefined,                            // execCommand
      null,                                 // FIND_SEND_BUTTON_JS → not found
      false,                                // DISPATCH_ENTER_JS → no active element
    ];

    const cdpCalls = [];
    client.evaluate = async () => evaluateResults.shift();
    client.cdp = async (method, params) => {
      cdpCalls.push({ method, params });
      return {};
    };

    await client.sendMessage('hello');

    // Should fall through to CDP Input.dispatchKeyEvent
    const keyEvents = cdpCalls.filter(c => c.method === 'Input.dispatchKeyEvent');
    assert.equal(keyEvents.length, 2); // rawKeyDown + keyUp
    assert.equal(keyEvents[0].params.key, 'Enter');
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
