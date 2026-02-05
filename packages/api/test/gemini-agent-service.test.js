/**
 * GeminiAgentService Tests
 * 测试暹罗猫 (Gemini) 的 Agent 服务
 *
 * Uses constructor injection for testability.
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create mock factory for each test
function createMocks() {
  const mockChat = {
    sendMessage: mock.fn(),
    getHistory: mock.fn(() => Promise.resolve([])),
  };

  const mockModel = {
    startChat: mock.fn(() => mockChat),
  };

  const mockGenAI = {
    getGenerativeModel: mock.fn(() => mockModel),
  };

  return { mockChat, mockModel, mockGenAI };
}

test('GeminiAgentService yields session_init, text, and done messages on success', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockGenAI } = createMocks();
  const responseText = 'Hello from Gemini!';

  mockChat.sendMessage.mock.mockImplementation(async () => ({
    response: {
      text: () => responseText,
    },
  }));

  const service = new GeminiAgentService({ genAI: mockGenAI });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have session_init, text, and done
  assert.equal(messages.length, 3);

  // Check session_init
  assert.equal(messages[0].type, 'session_init');
  assert.equal(messages[0].catId, 'gemini');
  assert.ok(messages[0].sessionId, 'should have a sessionId');

  // Check text message
  assert.equal(messages[1].type, 'text');
  assert.equal(messages[1].catId, 'gemini');
  assert.equal(messages[1].content, responseText);

  // Check done
  assert.equal(messages[2].type, 'done');
  assert.equal(messages[2].catId, 'gemini');
});

test('GeminiAgentService supports session resume via options.sessionId', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockGenAI } = createMocks();
  const existingSessionId = 'existing-session-456';
  const responseText = 'Resumed session response';

  // Simulate existing history from resumed session
  const existingHistory = [
    { role: 'user', parts: [{ text: 'First message' }] },
    { role: 'model', parts: [{ text: 'First response' }] },
  ];
  mockChat.getHistory.mock.mockImplementation(() =>
    Promise.resolve(existingHistory)
  );
  mockChat.sendMessage.mock.mockImplementation(async () => ({
    response: {
      text: () => responseText,
    },
  }));

  const service = new GeminiAgentService({ genAI: mockGenAI });

  // First call to establish session
  for await (const msg of service.invoke('First message')) {
    if (msg.type === 'session_init') {
      // Store session for later (simulated by setting internal state)
    }
  }

  // Manually add history for the session ID (simulate resume)
  service._setHistoryForTest(existingSessionId, existingHistory);

  // Resume with the session ID
  const messages = [];
  for await (const msg of service.invoke('Continue', {
    sessionId: existingSessionId,
  })) {
    messages.push(msg);
  }

  // Should return same session ID
  assert.equal(messages[0].type, 'session_init');
  assert.equal(messages[0].sessionId, existingSessionId);
});

test('GeminiAgentService yields error message on API error', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockGenAI } = createMocks();
  const errorMessage = 'API rate limit exceeded';

  mockChat.sendMessage.mock.mockImplementation(async () => {
    throw new Error(errorMessage);
  });

  const service = new GeminiAgentService({ genAI: mockGenAI });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have session_init and error
  assert.ok(messages.length >= 2);

  // Find error message
  const errorMsg = messages.find((m) => m.type === 'error');
  assert.ok(errorMsg, 'should have error message');
  assert.equal(errorMsg.catId, 'gemini');
  assert.equal(errorMsg.error, errorMessage);
});

test('GeminiAgentService yields error when API key is missing', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  // No genAI provided and no GOOGLE_API_KEY
  const originalEnv = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  try {
    const service = new GeminiAgentService();
    const messages = [];

    for await (const msg of service.invoke('Hello')) {
      messages.push(msg);
    }

    // Should have error
    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'should have error message');
    assert.ok(
      errorMsg.error.includes('GOOGLE_API_KEY'),
      'error should mention GOOGLE_API_KEY'
    );
  } finally {
    if (originalEnv) {
      process.env.GOOGLE_API_KEY = originalEnv;
    }
  }
});

test('GeminiAgentService catId is gemini', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockGenAI } = createMocks();
  mockChat.sendMessage.mock.mockImplementation(async () => ({
    response: {
      text: () => 'Test response',
    },
  }));

  const service = new GeminiAgentService({ genAI: mockGenAI });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // All messages should have catId 'gemini'
  for (const msg of messages) {
    assert.equal(msg.catId, 'gemini', `Expected catId 'gemini' for ${msg.type} message`);
  }
});

test('GeminiAgentService handles empty response', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockGenAI } = createMocks();
  mockChat.sendMessage.mock.mockImplementation(async () => ({
    response: {
      text: () => '',
    },
  }));

  const service = new GeminiAgentService({ genAI: mockGenAI });
  const messages = [];

  for await (const msg of service.invoke('Hello')) {
    messages.push(msg);
  }

  // Should have session_init, text (even if empty), and done
  assert.equal(messages.length, 3);
  assert.equal(messages[1].type, 'text');
  assert.equal(messages[1].content, '');
});

test('GeminiAgentService maintains chat history for session', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockModel, mockGenAI } = createMocks();

  mockModel.startChat.mock.mockImplementation(() => {
    return mockChat;
  });

  mockChat.sendMessage.mock.mockImplementation(async () => ({
    response: {
      text: () => 'Response',
    },
  }));

  const service = new GeminiAgentService({ genAI: mockGenAI });
  let sessionId = null;

  // First call - new session
  for await (const msg of service.invoke('First message')) {
    if (msg.type === 'session_init') {
      sessionId = msg.sessionId;
    }
  }

  assert.ok(sessionId, 'should have sessionId');

  // Second call with same session - should have history
  for await (const _ of service.invoke('Second message', { sessionId })) {
    // Just iterate through
  }

  // Check that startChat was called with history on second invocation
  assert.ok(
    mockModel.startChat.mock.callCount() >= 2,
    'startChat should be called at least twice'
  );
});

test('GeminiAgentService uses gemini-2.0-flash model by default', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockGenAI, mockModel } = createMocks();

  let capturedModelName = null;
  mockGenAI.getGenerativeModel.mock.mockImplementation((params) => {
    capturedModelName = params?.model;
    return mockModel;
  });

  const mockChat = {
    sendMessage: mock.fn(async () => ({
      response: { text: () => 'Test' },
    })),
    getHistory: mock.fn(() => Promise.resolve([])),
  };
  mockModel.startChat.mock.mockImplementation(() => mockChat);

  const service = new GeminiAgentService({ genAI: mockGenAI });
  for await (const _ of service.invoke('Hello')) {
    // Just iterate through
  }

  assert.equal(capturedModelName, 'gemini-2.0-flash');
});

test('GeminiAgentService handles blocked prompt', async () => {
  const { GeminiAgentService } = await import(
    '../dist/domains/cats/services/GeminiAgentService.js'
  );

  const { mockChat, mockGenAI } = createMocks();
  const blockedError = new Error('The prompt was blocked');
  blockedError.name = 'GoogleGenerativeAIResponseError';

  mockChat.sendMessage.mock.mockImplementation(async () => {
    throw blockedError;
  });

  const service = new GeminiAgentService({ genAI: mockGenAI });
  const messages = [];

  for await (const msg of service.invoke('Harmful content')) {
    messages.push(msg);
  }

  const errorMsg = messages.find((m) => m.type === 'error');
  assert.ok(errorMsg, 'should have error message');
  assert.ok(errorMsg.error.includes('blocked'), 'error should mention blocked');
});
