import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityAgentService } from
  '../dist/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.js';

async function collect(iterable) {
  const messages = [];
  for await (const msg of iterable) messages.push(msg);
  return messages;
}

/** Create a fake CDP client for testing */
function createMockCdpClient({ response = 'Meow!', connectError = null } = {}) {
  return {
    connected: false,
    connect: mock.fn(async () => {
      if (connectError) throw new Error(connectError);
    }),
    disconnect: mock.fn(async () => { /* noop */ }),
    sendMessage: mock.fn(async () => { /* noop */ }),
    pollResponse: mock.fn(async () => response),
    newConversation: mock.fn(async () => { /* noop */ }),
  };
}

describe('AntigravityAgentService', () => {
  test('yields text + done from successful response', async () => {
    const cdpClient = createMockCdpClient({ response: 'Hello from Antigravity!' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    const messages = await collect(service.invoke('Say hello'));

    // Should connect, create new conversation, send, poll
    assert.equal(cdpClient.connect.mock.callCount(), 1);
    assert.equal(cdpClient.newConversation.mock.callCount(), 1);
    assert.equal(cdpClient.sendMessage.mock.callCount(), 1);
    assert.equal(cdpClient.sendMessage.mock.calls[0].arguments[0], 'Say hello');
    assert.equal(cdpClient.pollResponse.mock.callCount(), 1);

    // Message sequence: text → done
    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'text');
    assert.equal(messages[0].content, 'Hello from Antigravity!');
    assert.equal(messages[0].catId, 'antigravity');
    assert.equal(messages[0].metadata.provider, 'antigravity');
    assert.equal(messages[0].metadata.model, 'gemini-3.1-pro');
    assert.equal(messages[1].type, 'done');
  });

  test('yields error + done when CDP connect fails', async () => {
    const cdpClient = createMockCdpClient({ connectError: 'Connection refused' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    const messages = await collect(service.invoke('test'));

    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'error');
    assert.ok(messages[0].error.includes('Connection refused'));
    assert.equal(messages[1].type, 'done');
  });

  test('yields error + done when poll returns null (timeout)', async () => {
    const cdpClient = createMockCdpClient({ response: null });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    const messages = await collect(service.invoke('test'));

    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'error');
    assert.ok(messages[0].error.toLowerCase().includes('timeout'));
    assert.equal(messages[1].type, 'done');
  });

  test('disconnect is called after successful invoke', async () => {
    const cdpClient = createMockCdpClient({ response: 'ok' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    await collect(service.invoke('test'));
    assert.equal(cdpClient.disconnect.mock.callCount(), 1);
  });

  test('disconnect is called after error', async () => {
    const cdpClient = createMockCdpClient({ connectError: 'fail' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    await collect(service.invoke('test'));
    assert.equal(cdpClient.disconnect.mock.callCount(), 1);
  });

  test('skips connect if already connected', async () => {
    const cdpClient = createMockCdpClient({ response: 'ok' });
    cdpClient.connected = true;
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    await collect(service.invoke('test'));
    assert.equal(cdpClient.connect.mock.callCount(), 0);
  });

  // R3: workingDirectory → titleHint derivation
  test('passes workingDirectory-derived titleHint to connect()', async () => {
    const cdpClient = createMockCdpClient({ response: 'ok' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    await collect(service.invoke('test', { workingDirectory: '/home/user/projects/cat-cafe' }));
    assert.equal(cdpClient.connect.mock.callCount(), 1);
    assert.equal(cdpClient.connect.mock.calls[0].arguments[0], 'cat-cafe');
  });

  test('connect receives undefined titleHint when no workingDirectory', async () => {
    const cdpClient = createMockCdpClient({ response: 'ok' });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      cdpClient,
    });
    await collect(service.invoke('test'));
    assert.equal(cdpClient.connect.mock.callCount(), 1);
    assert.equal(cdpClient.connect.mock.calls[0].arguments[0], undefined);
  });

  // P1-1: metadata must honestly mark model as unverified (CDP can't switch models yet)
  test('metadata marks model as unverified via modelVerified flag', async () => {
    const cdpClient = createMockCdpClient({ response: 'ok' });
    const service = new AntigravityAgentService({
      catId: 'antig-opus',
      model: 'claude-opus-4-6',
      cdpClient,
    });
    const messages = await collect(service.invoke('test'));
    const textMsg = messages.find(m => m.type === 'text');
    assert.equal(textMsg.metadata.modelVerified, false,
      'CDP bridge cannot verify which model Antigravity actually uses');
  });
});
