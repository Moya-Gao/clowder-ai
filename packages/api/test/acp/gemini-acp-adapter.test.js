/**
 * GeminiAcpAdapter unit tests — implements AgentService via AcpClient.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, it, mock } from 'node:test';

const { GeminiAcpAdapter } = await import('../../dist/domains/cats/services/agents/providers/acp/GeminiAcpAdapter.js');

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
 * Create a mock spawn function that auto-responds to ACP protocol messages.
 * Returns the mock child and a list of captured requests for assertions.
 */
function createAutoRespondSpawn() {
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
        // Send a text notification then complete
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

  return { child, agentStdout, ee, captured, spawnFn: () => child };
}

describe('GeminiAcpAdapter', () => {
  let adapter = null;

  afterEach(async () => {
    if (adapter) {
      await adapter.close?.();
      adapter = null;
    }
  });

  it('invoke yields session_init + text + done', async () => {
    const { spawnFn } = createAutoRespondSpawn();
    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn,
    });

    const messages = [];
    for await (const msg of adapter.invoke('hello')) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    assert.ok(types.includes('session_init'), `Expected session_init in ${JSON.stringify(types)}`);
    assert.ok(types.includes('text'), `Expected text in ${JSON.stringify(types)}`);
    assert.ok(types.includes('done'), `Expected done in ${JSON.stringify(types)}`);

    // All messages should have catId
    for (const msg of messages) {
      assert.equal(msg.catId, 'gemini');
    }

    // Text message should have content
    const textMsg = messages.find((m) => m.type === 'text');
    assert.equal(textMsg.content, 'Hello from ACP!');

    // Done should have metadata
    const doneMsg = messages.find((m) => m.type === 'done');
    assert.equal(doneMsg.metadata.provider, 'google');
  });

  it('reuses AcpClient across invocations (no re-initialize)', async () => {
    const { spawnFn, captured } = createAutoRespondSpawn();
    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn,
    });

    // First invocation
    const msgs1 = [];
    for await (const msg of adapter.invoke('first')) msgs1.push(msg);
    assert.ok(msgs1.some((m) => m.type === 'done'));

    // Second invocation — should reuse client (no second initialize)
    const msgs2 = [];
    for await (const msg of adapter.invoke('second')) msgs2.push(msg);
    assert.ok(msgs2.some((m) => m.type === 'done'));

    // Count how many initialize calls were sent
    const initCount = captured.filter((m) => m.method === 'initialize').length;
    assert.equal(initCount, 1, `Expected exactly 1 initialize, got ${initCount}`);

    // Should have 2 session/new calls
    const sessionNewCount = captured.filter((m) => m.method === 'session/new').length;
    assert.equal(sessionNewCount, 2, `Expected 2 session/new, got ${sessionNewCount}`);
  });

  it('classifies init failure vs prompt failure', async () => {
    // Spawn that fails at initialize
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

    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'bad-cmd', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn: () => {
        setImmediate(() => ee.emit('error', new Error('spawn bad-cmd ENOENT')));
        return child;
      },
    });

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

    // Should still yield done
    assert.ok(
      messages.some((m) => m.type === 'done'),
      'Should yield done after error',
    );

    // Cleanup
    child.stdout.end();
  });

  it('prepends system prompt to prompt text', async () => {
    const { spawnFn, captured } = createAutoRespondSpawn();
    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn,
    });

    for await (const _ of adapter.invoke('user question', { systemPrompt: 'You are a cat.' })) {
    }

    const promptReq = captured.find((m) => m.method === 'session/prompt');
    assert.ok(promptReq, 'Should have sent session/prompt');
    const promptText = promptReq.params.prompt[0].text;
    assert.ok(
      promptText.startsWith('You are a cat.'),
      `Prompt should start with system prompt, got: ${promptText.slice(0, 50)}`,
    );
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
          // Return an MCP pollution error
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

    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn: () => child,
    });

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
  let adapter = null;

  afterEach(async () => {
    if (adapter) {
      await adapter.close?.();
      adapter = null;
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
          // Simulate realistic multi-event stream
          setImmediate(() => {
            // 1. Thinking
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
            // 2. Text chunk 1
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
            // 3. Tool use
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
            // 4. User echo (should be skipped)
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
            // 5. Text chunk 2
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

    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn: () => child,
    });

    const messages = [];
    for await (const msg of adapter.invoke('what is this?')) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    // Verify expected message sequence (user_message_chunk should be skipped)
    assert.deepEqual(types, ['session_init', 'system_info', 'text', 'tool_use', 'text', 'done']);

    // Verify session_init has sessionId
    assert.equal(messages[0].sessionId, 'integ-sess');

    // Verify system_info is thinking
    const thinking = JSON.parse(messages[1].content);
    assert.equal(thinking.type, 'thinking');
    assert.equal(thinking.text, 'Let me check...');

    // Verify tool_use
    assert.equal(messages[3].toolName, 'read_file');
    assert.deepEqual(messages[3].toolInput, { path: '/a.txt' });

    // All messages have catId and metadata
    for (const msg of messages) {
      assert.equal(msg.catId, 'gemini');
      if (msg.type !== 'session_init') {
        assert.equal(msg.metadata?.provider, 'google');
      }
    }
  });

  it('P1-1: abort one invocation does not kill concurrent invocations', async () => {
    const { child, clientStdin, agentStdout, ee } = createMockChild();
    let sessionCounter = 0;
    const capturedCancels = [];
    // Track pending prompt request IDs by sessionId
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
            // Session 1: don't respond yet (long-running, will be cancelled)
          } else if (sid === 'sess-2') {
            // Session 2: respond normally
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
          // session/cancel is a notification (no id) — resolve the pending prompt
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

    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn: () => child,
    });

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

    // Small delay so session 1 starts first
    await new Promise((r) => setTimeout(r, 30));

    const invoke2 = (async () => {
      for await (const msg of adapter.invoke('task2')) {
        msgs2.push(msg);
      }
    })();

    await Promise.all([invoke1, invoke2]);

    // Invocation 2 should complete successfully — NOT killed by abort of invocation 1
    const types2 = msgs2.map((m) => m.type);
    assert.ok(types2.includes('text'), `Invocation 2 should have text, got: ${JSON.stringify(types2)}`);
    assert.ok(types2.includes('done'), `Invocation 2 should have done, got: ${JSON.stringify(types2)}`);

    // Cancel notification should have been sent for sess-1
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
          // Delay session response to simulate a slow newSession
          setTimeout(
            () =>
              agentStdout.write(
                JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 'slow-sess' } }) + '\n',
              ),
            30,
          );
        } else if (msg.method === 'session/prompt') {
          // Respond immediately
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
    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn: () => child,
    });

    // Pre-initialize so we isolate the newSession window
    // (call invoke once to warm up, then test the abort-during-newSession path)
    // Actually, simpler: abort 10ms in — during the 30ms newSession delay
    setTimeout(() => ac.abort(), 10);

    const messages = [];
    for await (const msg of adapter.invoke('hello', { signal: ac.signal })) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    // The abort happened during newSession wait. After newSession resolves,
    // the adapter should detect abort and NOT proceed to prompt (or cancel immediately).
    // It should yield error + done, and NOT yield text 'oops' from prompt.
    assert.ok(
      !types.includes('text'),
      `Should NOT have text (prompt should not run after abort), got: ${JSON.stringify(types)}`,
    );
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
        } else if (msg.method === 'session/cancel') {
          // OK
        }
      }
    });

    const ac = new AbortController();
    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn: () => child,
    });

    const messages = [];
    for await (const msg of adapter.invoke('hello', { signal: ac.signal })) {
      messages.push(msg);
      if (msg.type === 'session_init') {
        // Abort immediately upon receiving session_init
        ac.abort();
      }
    }

    const types = messages.map((m) => m.type);
    // prompt should NOT have been sent (or if sent, result should not appear as text)
    assert.ok(
      !types.includes('text'),
      `Should NOT have text after abort at session_init, got: ${JSON.stringify(types)}`,
    );
    assert.ok(types.includes('done'), `Should yield done, got: ${JSON.stringify(types)}`);
    assert.ok(!sawPrompt, 'Prompt should NOT have been sent after abort');
  });

  it('P2: pre-aborted signal short-circuits immediately', async () => {
    const { spawnFn, captured } = createAutoRespondSpawn();
    adapter = new GeminiAcpAdapter({
      catId: 'gemini',
      acpConfig: { command: 'fake', startupArgs: [] },
      workingDirectory: '/tmp',
      spawnFn,
    });

    const ac = new AbortController();
    ac.abort(); // Abort BEFORE invoke

    const messages = [];
    for await (const msg of adapter.invoke('hello', { signal: ac.signal })) {
      messages.push(msg);
    }

    const types = messages.map((m) => m.type);
    // Should get error + done without ever reaching session_init
    assert.ok(!types.includes('session_init'), `Should NOT reach session_init, got: ${JSON.stringify(types)}`);
    assert.ok(types.includes('error'), `Should yield error, got: ${JSON.stringify(types)}`);
    assert.ok(types.includes('done'), `Should yield done, got: ${JSON.stringify(types)}`);
  });
});
