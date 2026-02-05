/**
 * CodexAgentService Tests
 * 测试缅因猫 (Codex) 的 Agent 服务
 *
 * Uses constructor injection for testability.
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Helper to create an async generator from events
async function* createEventStream(events) {
  for (const event of events) {
    yield event;
  }
}

// Create mock factory for each test
function createMocks() {
  const mockThread = {
    id: null,
    runStreamed: mock.fn(),
  };

  const mockCodex = {
    startThread: mock.fn(() => mockThread),
    resumeThread: mock.fn(() => mockThread),
  };

  return { mockThread, mockCodex };
}

test('CodexAgentService yields session_init, text, and done messages on success', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const threadId = 'test-thread-123';
  const responseText = 'Hello from Codex!';

  // Mock events stream
  const events = [
    { type: 'thread.started', thread_id: threadId },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'msg-1',
        type: 'agent_message',
        text: responseText,
      },
    },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20, cached_input_tokens: 0 } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  // Use dependency injection
  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have session_init, text, and done
  assert.equal(messages.length, 3);

  // Check session_init
  assert.equal(messages[0].type, 'session_init');
  assert.equal(messages[0].catId, 'codex');
  assert.equal(messages[0].sessionId, threadId);

  // Check text message
  assert.equal(messages[1].type, 'text');
  assert.equal(messages[1].catId, 'codex');
  assert.equal(messages[1].content, responseText);

  // Check done
  assert.equal(messages[2].type, 'done');
  assert.equal(messages[2].catId, 'codex');

  // Verify startThread was called
  assert.equal(mockCodex.startThread.mock.callCount(), 1);
});

test('CodexAgentService supports session resume via options.sessionId', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const existingSessionId = 'existing-session-456';
  const responseText = 'Resumed session response';

  const events = [
    { type: 'thread.started', thread_id: existingSessionId },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'msg-1',
        type: 'agent_message',
        text: responseText,
      },
    },
    { type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 10, cached_input_tokens: 0 } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Continue', { sessionId: existingSessionId })) {
    messages.push(msg);
  }

  // Verify resumeThread was called with the session ID
  assert.equal(mockCodex.resumeThread.mock.callCount(), 1);
  assert.equal(mockCodex.resumeThread.mock.calls[0].arguments[0], existingSessionId);

  // Should still yield proper messages
  assert.equal(messages[0].type, 'session_init');
  assert.equal(messages[0].sessionId, existingSessionId);
});

test('CodexAgentService yields error message on turn.failed', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const threadId = 'test-thread-error';
  const errorMessage = 'Something went wrong';

  const events = [
    { type: 'thread.started', thread_id: threadId },
    { type: 'turn.started' },
    { type: 'turn.failed', error: { message: errorMessage } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have session_init, error, and done
  assert.ok(messages.length >= 2);

  // Find error message
  const errorMsg = messages.find((m) => m.type === 'error');
  assert.ok(errorMsg, 'should have error message');
  assert.equal(errorMsg.catId, 'codex');
  assert.equal(errorMsg.error, errorMessage);
});

test('CodexAgentService yields error message on stream error event', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const threadId = 'test-thread-stream-error';
  const errorMessage = 'Stream error occurred';

  const events = [
    { type: 'thread.started', thread_id: threadId },
    { type: 'error', message: errorMessage },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Find error message
  const errorMsg = messages.find((m) => m.type === 'error');
  assert.ok(errorMsg, 'should have error message');
  assert.equal(errorMsg.error, errorMessage);
});

test('CodexAgentService yields error on SDK exception', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const sdkError = new Error('SDK connection failed');

  mockThread.runStreamed.mock.mockImplementation(async () => {
    throw sdkError;
  });

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have error message
  const errorMsg = messages.find((m) => m.type === 'error');
  assert.ok(errorMsg, 'should have error message');
  assert.equal(errorMsg.catId, 'codex');
  assert.equal(errorMsg.error, 'SDK connection failed');
});

test('CodexAgentService passes workingDirectory to thread options', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const events = [
    { type: 'thread.started', thread_id: 'test-123' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Done' },
    },
    { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1, cached_input_tokens: 0 } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];
  const workDir = '/home/user/project';

  for await (const msg of service.invoke('Hello', { workingDirectory: workDir })) {
    messages.push(msg);
  }

  // Verify startThread was called with workingDirectory option
  assert.equal(mockCodex.startThread.mock.callCount(), 1);
  const threadOptions = mockCodex.startThread.mock.calls[0].arguments[0];
  assert.equal(threadOptions?.workingDirectory, workDir);
});

test('CodexAgentService handles multiple agent_message items', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const events = [
    { type: 'thread.started', thread_id: 'test-multi' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'First message' },
    },
    {
      type: 'item.completed',
      item: { id: 'msg-2', type: 'agent_message', text: 'Second message' },
    },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20, cached_input_tokens: 0 } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have session_init, 2 text messages, and done
  const textMessages = messages.filter((m) => m.type === 'text');
  assert.equal(textMessages.length, 2);
  assert.equal(textMessages[0].content, 'First message');
  assert.equal(textMessages[1].content, 'Second message');
});

test('CodexAgentService ignores non-agent_message items', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const events = [
    { type: 'thread.started', thread_id: 'test-ignore' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'cmd-1', type: 'command_execution', command: 'ls', aggregated_output: '', status: 'completed' },
    },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Response' },
    },
    {
      type: 'item.completed',
      item: { id: 'file-1', type: 'file_change', changes: [], status: 'completed' },
    },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20, cached_input_tokens: 0 } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should only have session_init, one text message, and done
  const textMessages = messages.filter((m) => m.type === 'text');
  assert.equal(textMessages.length, 1);
  assert.equal(textMessages[0].content, 'Response');
});

test('CodexAgentService catId is codex', async () => {
  const { CodexAgentService } = await import(
    '../dist/domains/cats/services/CodexAgentService.js'
  );

  const { mockThread, mockCodex } = createMocks();
  const events = [
    { type: 'thread.started', thread_id: 'test-catid' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Test' },
    },
    { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1, cached_input_tokens: 0 } },
  ];

  mockThread.runStreamed.mock.mockImplementation(async () => ({
    events: createEventStream(events),
  }));

  const service = new CodexAgentService({ codex: mockCodex });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // All messages should have catId 'codex'
  for (const msg of messages) {
    assert.equal(msg.catId, 'codex', `Expected catId 'codex' for ${msg.type} message`);
  }
});
