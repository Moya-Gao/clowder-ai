/**
 * GeminiAcpAdapter unit tests — Phase C: pool-backed AgentService via AcpClient.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, it, mock } from 'node:test';

const { GeminiAcpAdapter } = await import('../../dist/domains/cats/services/agents/providers/acp/GeminiAcpAdapter.js');
const { AcpProcessPool } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpProcessPool.js');
const { AcpClient } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpClient.js');

const TEST_POOL_KEY = { projectPath: '/tmp', providerProfile: 'test' };

/** Create a minimal mock child process */
function createMockChild() {
  const clientStdin = new PassThrough();
  const agentStdout = new PassThrough();
  const agentStderr = new PassThrough();

  const ee = new EventEmitter();
  const child = {
    pid: 12345,
    stdin: clientStdin,
    stdout: agentStdout,
    stderr: agentStderr,
    killed: false,
    kill: mock.fn(() => {
      child.killed = true;
      agentStdout.end();
      agentStderr.end();
      ee.emit('exit', 0, null);
      return true;
    }),
    on: ee.on.bind(ee),
    once: ee.once.bind(ee),
    removeListener: ee.removeListener.bind(ee),
  };

  return { child, clientStdin, agentStdout, ee };
}

const INIT_RESULT = {
  protocolVersion: 1,
  authMethods: [],
  agentInfo: { name: 'gemini', title: 'Gemini CLI', version: '0.35' },
  agentCapabilities: { loadSession: true },
};

/**
 * Create a pool backed by a mock spawn function that auto-responds to ACP protocol.
 * Returns { pool, captured } where captured is the list of sent JSON-RPC messages.
 */
function createPoolWithAutoRespond() {
  const { child, clientStdin, agentStdout, ee } = createMockChild();
  const captured = [];

  clientStdin.on('data', (chunk) => {
    for (const line of chunk.toString().trim().split('\n')) {
      const msg = JSON.parse(line);
      captured.push(msg);
      if (msg.method === 'initialize') {
        setImmediate(() =>
          agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: INIT_RESULT }) + '\n'),
        );
      } else if (msg.method === 'session/new') {
        setImmediate(() =>
          agentStdout.write(
            JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: `sess-${Date.now()}` } }) + '\n',
          ),
        );
      } else if (msg.method === 'session/prompt') {
        setImmediate(() => {
          agentStdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              method: 'session/update',
              params: {
                sessionId: msg.params.sessionId,
                update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello from ACP!' } },
              },
            }) + '\n',
          );
          setTimeout(() => {
            agentStdout.write(
              JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn' } }) + '\n',
            );
          }, 10);
        });
      }
    }
  });

  const pool = new AcpProcessPool(
    { maxLiveProcesses: 5, idleTtlMs: 999_999, healthCheckIntervalMs: 999_999 },
    {},
    () => new AcpClient({ command: 'fake', args: [], cwd: '/tmp', spawnFn: () => child }),
  );

  return { pool, captured, child, agentStdout, ee };
}

/**
 * Create a pool backed by a custom spawn function.
 */
function createPoolWithSpawn(spawnFn) {
  return new AcpProcessPool(
    { maxLiveProcesses: 5, idleTtlMs: 999_999, healthCheckIntervalMs: 999_999 },
    {},
    () => new AcpClient({ command: 'fake', args: [], cwd: '/tmp', spawnFn }),
  );
}

describe('GeminiAcpAdapter', () => {
  let pool = null;

  afterEach(async () => {
    if (pool) {
      await pool.closeAll();
      pool = null;
    }
  });

  it('invoke yields session_init + text + done', async () => {
    const result = createPoolWithAutoRespond();
    pool = result.pool;
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    assert.ok(types.includes('session_init'), `Expected session_init in ${JSON.stringify(types)}`);
    assert.ok(types.includes('text'), `Expected text in ${JSON.stringify(types)}`);
    assert.ok(types.includes('done'), `Expected done in ${JSON.stringify(types)}`);

    for (const msg of messages) {
      assert.equal(msg.catId, 'gemini');
    }

    const textMsg = messages.find((m) => m.type === 'text');
    assert.equal(textMsg.content, 'Hello from ACP!');

    const doneMsg = messages.find((m) => m.type === 'done');
    assert.equal(doneMsg.metadata.provider, 'google');
  });

  it('reuses pool client across invocations (warm hit)', async () => {
    const { pool: p, captured } = createPoolWithAutoRespond();
    pool = p;
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const msgs1 = [];
    for await (const msg of adapter.invoke('first')) msgs1.push(msg);
    assert.ok(msgs1.some((m) => m.type === 'done'));

    const msgs2 = [];
    for await (const msg of adapter.invoke('second')) msgs2.push(msg);
    assert.ok(msgs2.some((m) => m.type === 'done'));

    // Should reuse same process — only 1 initialize
    const initCount = captured.filter((m) => m.method === 'initialize').length;
    assert.equal(initCount, 1, `Expected exactly 1 initialize, got ${initCount}`);

    // Should have 2 session/new calls
    const sessionNewCount = captured.filter((m) => m.method === 'session/new').length;
    assert.equal(sessionNewCount, 2, `Expected 2 session/new, got ${sessionNewCount}`);

    // Pool metrics: 1 cold start, 1 warm hit
    const metrics = pool.getMetrics();
    assert.strictEqual(metrics.coldStartCount, 1);
    assert.strictEqual(metrics.warmHitCount, 1);
  });

  it('classifies init failure when pool.acquire fails', async () => {
    const ee = new EventEmitter();
    const child = {
      pid: undefined,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      killed: false,
      kill: mock.fn(() => {
        child.killed = true;
        return true;
      }),
      on: ee.on.bind(ee),
      once: ee.once.bind(ee),
      removeListener: ee.removeListener.bind(ee),
    };

    pool = createPoolWithSpawn(() => {
      setImmediate(() => ee.emit('error', new Error('spawn bad-cmd ENOENT')));
      return child;
    });

    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'Should yield an error message');
    assert.ok(
      errorMsg.error.includes('init_failure') || errorMsg.errorCode === 'init_failure',
      `Expected init_failure classification, got: ${errorMsg.error} / ${errorMsg.errorCode}`,
    );
    assert.ok(
      messages.some((m) => m.type === 'done'),
      'Should yield done after error',
    );

    child.stdout.end();
  });

  it('prepends system prompt to prompt text', async () => {
    const { pool: p, captured } = createPoolWithAutoRespond();
    pool = p;
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    for await (const _ of adapter.invoke('user question', { systemPrompt: 'You are a cat.' })) {
    }

    const promptReq = captured.find((m) => m.method === 'session/prompt');
    assert.ok(promptReq, 'Should have sent session/prompt');
    const promptText = promptReq.params.prompt[0].text;
    assert.ok(promptText.startsWith('You are a cat.'), `Prompt should start with system prompt`);
    assert.ok(promptText.includes('user question'), 'Prompt should contain user question');
  });

  it('P1-2: classifies mcp_pollution errors', async () => {
    const { child, clientStdin, agentStdout, ee } = createMockChild();

    clientStdin.on('data', (chunk) => {
      for (const line of chunk.toString().trim().split('\n')) {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: INIT_RESULT }) + '\n'),
          );
        } else if (msg.method === 'session/new') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 'mcp-sess' } }) + '\n'),
          );
        } else if (msg.method === 'session/prompt') {
          setImmediate(() =>
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32002, message: 'MCP server cat-cafe-collab failed to initialize: timeout after 30s' },
              }) + '\n',
            ),
          );
        }
      }
    });

    pool = createPoolWithSpawn(() => child);
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'Should yield error');
    assert.equal(errorMsg.errorCode, 'mcp_pollution', `Expected mcp_pollution, got: ${errorMsg.errorCode}`);
  });
});

describe('GeminiAcpAdapter integration', () => {
  let pool = null;

  afterEach(async () => {
    if (pool) {
      await pool.closeAll();
      pool = null;
    }
  });

  it('full invoke flow: session_init → text + thought → tool_use → text → done', async () => {
    const { child, clientStdin, agentStdout, ee } = createMockChild();

    clientStdin.on('data', (chunk) => {
      for (const line of chunk.toString().trim().split('\n')) {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: INIT_RESULT }) + '\n'),
          );
        } else if (msg.method === 'session/new') {
          setImmediate(() =>
            agentStdout.write(
              JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 'integ-sess' } }) + '\n',
            ),
          );
        } else if (msg.method === 'session/prompt') {
          const sid = msg.params.sessionId;
          setImmediate(() => {
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: sid,
                  update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Let me check...' } },
                },
              }) + '\n',
            );
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: sid,
                  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'I found ' } },
                },
              }) + '\n',
            );
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: sid,
                  update: { sessionUpdate: 'tool_call', toolName: 'read_file', toolInput: { path: '/a.txt' } },
                },
              }) + '\n',
            );
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: sid,
                  update: { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'echo' } },
                },
              }) + '\n',
            );
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: sid,
                  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'the answer.' } },
                },
              }) + '\n',
            );
          });
          setTimeout(() => {
            agentStdout.write(
              JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn' } }) + '\n',
            );
          }, 30);
        }
      }
    });

    pool = createPoolWithSpawn(() => child);
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const messages = [];
    for await (const msg of adapter.invoke('what is this?')) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    assert.deepEqual(types, ['session_init', 'system_info', 'text', 'tool_use', 'text', 'done']);
    assert.equal(messages[0].sessionId, 'integ-sess');
    const thinking = JSON.parse(messages[1].content);
    assert.equal(thinking.type, 'thinking');
    assert.equal(messages[3].toolName, 'read_file');
  });

  it('P1-1: abort one invocation does not kill concurrent invocations', async () => {
    const { child, clientStdin, agentStdout, ee } = createMockChild();
    let sessionCounter = 0;
    const capturedCancels = [];
    const pendingPrompts = new Map();

    clientStdin.on('data', (chunk) => {
      for (const line of chunk.toString().trim().split('\n')) {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: INIT_RESULT }) + '\n'),
          );
        } else if (msg.method === 'session/new') {
          sessionCounter++;
          const sid = `sess-${sessionCounter}`;
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: sid } }) + '\n'),
          );
        } else if (msg.method === 'session/prompt') {
          const sid = msg.params.sessionId;
          pendingPrompts.set(sid, msg.id);
          if (sid === 'sess-1') {
            // Long-running — will be cancelled
          } else if (sid === 'sess-2') {
            setImmediate(() => {
              agentStdout.write(
                JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'session/update',
                  params: {
                    sessionId: sid,
                    update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'alive!' } },
                  },
                }) + '\n',
              );
              setTimeout(
                () =>
                  agentStdout.write(
                    JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn' } }) + '\n',
                  ),
                10,
              );
            });
          }
        } else if (msg.method === 'session/cancel') {
          const cancelSid = msg.params?.sessionId;
          capturedCancels.push(cancelSid);
          const promptId = pendingPrompts.get(cancelSid);
          if (promptId) {
            setTimeout(() => {
              agentStdout.write(
                JSON.stringify({ jsonrpc: '2.0', id: promptId, result: { stopReason: 'cancelled' } }) + '\n',
              );
            }, 5);
          }
        }
      }
    });

    pool = createPoolWithSpawn(() => child);
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const ac1 = new AbortController();
    const msgs1 = [];
    const msgs2 = [];

    const invoke1 = (async () => {
      for await (const msg of adapter.invoke('task1', { signal: ac1.signal })) {
        msgs1.push(msg);
        if (msg.type === 'session_init') {
          setTimeout(() => ac1.abort(), 5);
        }
      }
    })();

    await new Promise((r) => setTimeout(r, 30));

    const invoke2 = (async () => {
      for await (const msg of adapter.invoke('task2')) {
        msgs2.push(msg);
      }
    })();

    await Promise.all([invoke1, invoke2]);

    const types2 = msgs2.map((m) => m.type);
    assert.ok(types2.includes('text'), `Invocation 2 should have text, got: ${JSON.stringify(types2)}`);
    assert.ok(types2.includes('done'), `Invocation 2 should have done, got: ${JSON.stringify(types2)}`);
    assert.ok(capturedCancels.includes('sess-1'), `Should cancel sess-1, got: ${JSON.stringify(capturedCancels)}`);
  });

  it('R2-P1: abort during newSession window still cancels the session', async () => {
    const { child, clientStdin, agentStdout, ee } = createMockChild();
    let sawCancel = false;

    clientStdin.on('data', (chunk) => {
      for (const line of chunk.toString().trim().split('\n')) {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: INIT_RESULT }) + '\n'),
          );
        } else if (msg.method === 'session/new') {
          setTimeout(
            () =>
              agentStdout.write(
                JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 'slow-sess' } }) + '\n',
              ),
            30,
          );
        } else if (msg.method === 'session/prompt') {
          setImmediate(() => {
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: msg.params.sessionId,
                  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'oops' } },
                },
              }) + '\n',
            );
            agentStdout.write(
              JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn' } }) + '\n',
            );
          });
        } else if (msg.method === 'session/cancel') {
          sawCancel = true;
        }
      }
    });

    const ac = new AbortController();
    pool = createPoolWithSpawn(() => child);
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    // Abort 10ms in — during the 30ms newSession delay
    setTimeout(() => ac.abort(), 10);

    const messages = [];
    for await (const msg of adapter.invoke('hello', { signal: ac.signal })) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    assert.ok(!types.includes('text'), `Should NOT have text after abort, got: ${JSON.stringify(types)}`);
    assert.ok(types.includes('done'), `Should yield done, got: ${JSON.stringify(types)}`);
  });

  it('R3-P1: abort right after session_init does not run prompt', async () => {
    const { child, clientStdin, agentStdout, ee } = createMockChild();
    let sawPrompt = false;

    clientStdin.on('data', (chunk) => {
      for (const line of chunk.toString().trim().split('\n')) {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: INIT_RESULT }) + '\n'),
          );
        } else if (msg.method === 'session/new') {
          setImmediate(() =>
            agentStdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 'r3-sess' } }) + '\n'),
          );
        } else if (msg.method === 'session/prompt') {
          sawPrompt = true;
          setImmediate(() => {
            agentStdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'session/update',
                params: {
                  sessionId: msg.params.sessionId,
                  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'should not see' } },
                },
              }) + '\n',
            );
            agentStdout.write(
              JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn' } }) + '\n',
            );
          });
        }
      }
    });

    const ac = new AbortController();
    pool = createPoolWithSpawn(() => child);
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const messages = [];
    for await (const msg of adapter.invoke('hello', { signal: ac.signal })) {
      messages.push(msg);
      if (msg.type === 'session_init') {
        ac.abort();
      }
    }

    const types = messages.map((m) => m.type);
    assert.ok(!types.includes('text'), `Should NOT have text after abort, got: ${JSON.stringify(types)}`);
    assert.ok(types.includes('done'), `Should yield done, got: ${JSON.stringify(types)}`);
    assert.ok(!sawPrompt, 'Prompt should NOT have been sent after abort');
  });

  it('P2: pre-aborted signal short-circuits immediately', async () => {
    const result = createPoolWithAutoRespond();
    pool = result.pool;
    const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool, poolKey: TEST_POOL_KEY, projectRoot: '/tmp' });

    const ac = new AbortController();
    ac.abort(); // Abort BEFORE invoke

    const messages = [];
    for await (const msg of adapter.invoke('hello', { signal: ac.signal })) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    assert.ok(!types.includes('session_init'), `Should NOT reach session_init, got: ${JSON.stringify(types)}`);
    assert.ok(types.includes('error'), `Should yield error, got: ${JSON.stringify(types)}`);
    assert.ok(types.includes('done'), `Should yield done, got: ${JSON.stringify(types)}`);
  });

  it('timeout with capacity stderr yields model_capacity not lease_timeout', async () => {
    const { AcpTimeoutError } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpClient.js');

    const listeners = new Set();
    const fakeClient = {
      isAlive: true,
      initialize: async () => ({}),
      close: async () => {},
      onCapacity: (fn) => listeners.add(fn),
      offCapacity: (fn) => listeners.delete(fn),
      newSession: async () => ({ sessionId: 'cap-sess' }),
      cancelSession: () => {},
      async *promptStream() {
        // Emit capacity signal before timeout (stderr arrived during prompt)
        for (const fn of listeners)
          fn({
            message: 'No capacity available for model gemini-3.1-pro-preview on the server',
            timestamp: Date.now(),
          });
        throw new AcpTimeoutError('session/prompt', 120000);
      },
    };

    const mockPool = {
      acquire: async () => ({ client: fakeClient, release: () => {} }),
      closeAll: async () => {},
    };

    const adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      pool: mockPool,
      poolKey: TEST_POOL_KEY,
      projectRoot: '/tmp',
    });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'Should yield error message');
    assert.equal(errorMsg.errorCode, 'model_capacity', `Expected model_capacity, got ${errorMsg.errorCode}`);
    assert.match(errorMsg.error, /capacity|429/i, 'Error message should mention capacity');
  });

  it('P1: late stderr capacity signal (after timeout) still reclassifies via grace window', async () => {
    const { AcpTimeoutError } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpClient.js');

    const listeners = new Set();
    const fakeClient = {
      isAlive: true,
      initialize: async () => ({}),
      close: async () => {},
      onCapacity: (fn) => listeners.add(fn),
      offCapacity: (fn) => listeners.delete(fn),
      newSession: async () => ({ sessionId: 'late-sess' }),
      cancelSession: () => {},
      async *promptStream() {
        // Simulate: timeout fires, then stderr arrives 500ms later (during grace window)
        setTimeout(() => {
          const signal = {
            message: 'MODEL_CAPACITY_EXHAUSTED: No capacity available for gemini-3.1-pro-preview',
            timestamp: Date.now(),
          };
          for (const fn of listeners) fn(signal);
        }, 500);
        throw new AcpTimeoutError('session/prompt', 120000);
      },
    };

    const mockPool = {
      acquire: async () => ({ client: fakeClient, release: () => {} }),
      closeAll: async () => {},
    };

    const adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      pool: mockPool,
      poolKey: TEST_POOL_KEY,
      projectRoot: '/tmp',
    });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'Should yield error message');
    assert.equal(
      errorMsg.errorCode,
      'model_capacity',
      `Expected model_capacity after grace window, got ${errorMsg.errorCode}`,
    );
  });

  it('capacity signal during newSession window is captured (invoke-level scope, by design)', async () => {
    const { AcpTimeoutError } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpClient.js');

    const listeners = new Set();
    const fakeClient = {
      isAlive: true,
      initialize: async () => ({}),
      close: async () => {},
      onCapacity: (fn) => listeners.add(fn),
      offCapacity: (fn) => listeners.delete(fn),
      newSession: async () => {
        // Emit capacity signal DURING newSession (provider is 429-ing right now)
        const signal = {
          message: 'No capacity available during session setup',
          timestamp: Date.now(),
        };
        for (const fn of listeners) fn(signal);
        return { sessionId: 'newsess-cap' };
      },
      cancelSession: () => {},
      async *promptStream() {
        throw new AcpTimeoutError('session/prompt', 120000);
      },
    };

    const mockPool = {
      acquire: async () => ({ client: fakeClient, release: () => {} }),
      closeAll: async () => {},
    };

    const adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      pool: mockPool,
      poolKey: TEST_POOL_KEY,
      projectRoot: '/tmp',
    });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'Should yield error message');
    // Provider was capacity-constrained during newSession → correct to classify as model_capacity
    assert.equal(
      errorMsg.errorCode,
      'model_capacity',
      `Expected model_capacity for signal during newSession, got ${errorMsg.errorCode}`,
    );
  });

  it('no capacity stderr during prompt yields lease_timeout (listener isolation)', async () => {
    const { AcpTimeoutError } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpClient.js');

    const fakeClient = {
      isAlive: true,
      initialize: async () => ({}),
      close: async () => {},
      onCapacity: () => {},
      offCapacity: () => {},
      newSession: async () => ({ sessionId: 'clean-sess' }),
      cancelSession: () => {},
      async *promptStream() {
        // Pure timeout — no capacity signal emitted to listener
        throw new AcpTimeoutError('session/prompt', 120000);
      },
    };

    const mockPool = {
      acquire: async () => ({ client: fakeClient, release: () => {} }),
      closeAll: async () => {},
    };

    const adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      pool: mockPool,
      poolKey: TEST_POOL_KEY,
      projectRoot: '/tmp',
    });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'Should yield error message');
    assert.equal(
      errorMsg.errorCode,
      'lease_timeout',
      `Expected lease_timeout when no capacity signal, got ${errorMsg.errorCode}`,
    );
  });

  it('concurrent prompts on same client both capture provider-level capacity signal', async () => {
    const { AcpTimeoutError } = await import('../../dist/domains/cats/services/agents/providers/acp/AcpClient.js');

    const listeners = new Set();
    let sessionCounter = 0;
    const fakeClient = {
      isAlive: true,
      initialize: async () => ({}),
      close: async () => {},
      onCapacity: (fn) => listeners.add(fn),
      offCapacity: (fn) => listeners.delete(fn),
      newSession: async () => ({ sessionId: `conc-sess-${++sessionCounter}` }),
      cancelSession: () => {},
      async *promptStream(sessionId) {
        // First session emits capacity signal (Google 429); second does not
        if (sessionId === 'conc-sess-1') {
          setTimeout(() => {
            const signal = {
              message: 'MODEL_CAPACITY_EXHAUSTED on gemini-3.1-pro',
              timestamp: Date.now(),
            };
            for (const fn of listeners) fn(signal);
          }, 50);
        }
        throw new AcpTimeoutError('session/prompt', 120000);
      },
    };

    const mockPool = {
      acquire: async () => ({ client: fakeClient, release: () => {} }),
      closeAll: async () => {},
    };

    const adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      pool: mockPool,
      poolKey: TEST_POOL_KEY,
      projectRoot: '/tmp',
    });

    // Helper to collect all messages from an invoke stream
    async function collect(stream) {
      const msgs = [];
      for await (const msg of stream) msgs.push(msg);
      return msgs;
    }

    // Two concurrent prompts on the same client (multiplexed pool)
    const [msgs1, msgs2] = await Promise.all([
      collect(adapter.invoke('prompt-1')),
      collect(adapter.invoke('prompt-2')),
    ]);

    const err1 = msgs1.find((m) => m.type === 'error');
    const err2 = msgs2.find((m) => m.type === 'error');
    assert.ok(err1 && err2, 'Both prompts should yield errors');
    // Both should see model_capacity: same process = same provider = same capacity constraint
    assert.equal(err1.errorCode, 'model_capacity', `Prompt 1: expected model_capacity, got ${err1.errorCode}`);
    assert.equal(err2.errorCode, 'model_capacity', `Prompt 2: expected model_capacity, got ${err2.errorCode}`);
  });
});
