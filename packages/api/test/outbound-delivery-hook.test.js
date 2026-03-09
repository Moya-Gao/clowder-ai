import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OutboundDeliveryHook } from '../dist/infrastructure/connectors/OutboundDeliveryHook.js';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';

function noopLog() {
	const noop = () => {};
	return {
		info: noop,
		warn: noop,
		error: noop,
		debug: noop,
		trace: noop,
		fatal: noop,
		child: () => noopLog(),
	};
}

function mockAdapter(connectorId) {
	const sent = [];
	return {
		sent,
		adapter: {
			connectorId,
			async sendReply(externalChatId, content, metadata) {
				sent.push({ externalChatId, content, metadata });
			},
		},
	};
}

describe('OutboundDeliveryHook', () => {
	let bindingStore;
	let feishuMock;
	let hook;

	beforeEach(() => {
		bindingStore = new MemoryConnectorThreadBindingStore();
		feishuMock = mockAdapter('feishu');
		const adapters = new Map([['feishu', feishuMock.adapter]]);
		hook = new OutboundDeliveryHook({
			bindingStore,
			adapters,
			log: noopLog(),
		});
	});

	it('delivers reply to bound external chat', async () => {
		bindingStore.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello from cat!');
		assert.equal(feishuMock.sent.length, 1);
		assert.equal(feishuMock.sent[0].externalChatId, 'chat-123');
		assert.equal(feishuMock.sent[0].content, 'Hello from cat!');
	});

	it('skips delivery when no binding exists', async () => {
		await hook.deliver('thread-no-binding', 'Hello');
		assert.equal(feishuMock.sent.length, 0);
	});

	it('delivers to multiple bindings for same thread', async () => {
		const telegramMock = mockAdapter('telegram');
		const adapters = new Map([
			['feishu', feishuMock.adapter],
			['telegram', telegramMock.adapter],
		]);
		hook = new OutboundDeliveryHook({
			bindingStore,
			adapters,
			log: noopLog(),
		});

		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
		bindingStore.bind('telegram', 'chat-2', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello!');

		assert.equal(feishuMock.sent.length, 1);
		assert.equal(telegramMock.sent.length, 1);
	});

	it('does not throw when adapter.sendReply fails', async () => {
		const failAdapter = {
			connectorId: 'feishu',
			async sendReply() {
				throw new Error('network error');
			},
		};
		hook = new OutboundDeliveryHook({
			bindingStore,
			adapters: new Map([['feishu', failAdapter]]),
			log: noopLog(),
		});
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

		// Should not throw — fire-and-forget with error logging
		await hook.deliver('thread-abc', 'Hello');
	});

	it('skips binding when adapter not registered', async () => {
		bindingStore.bind('discord', 'chat-1', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello');
		assert.equal(feishuMock.sent.length, 0);
	});
});
