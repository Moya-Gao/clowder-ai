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
});
