import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OutboundDeliveryHook } from '../dist/infrastructure/connectors/OutboundDeliveryHook.js';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';
import { CAT_CONFIGS, catRegistry } from '@cat-cafe/shared';

// Bootstrap catRegistry for tests
for (const [id, config] of Object.entries(CAT_CONFIGS)) {
	if (!catRegistry.has(id)) catRegistry.register(id, config);
}

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

	// Phase 2: cat identity prefix
	it('prepends cat display name prefix when catId is provided', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello!', 'opus');
		assert.equal(feishuMock.sent.length, 1);
		assert.match(feishuMock.sent[0].content, /^\[布偶猫🐱\] Hello!$/);
	});

	it('sends plain content when catId is omitted (backward compat)', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello!');
		assert.equal(feishuMock.sent[0].content, 'Hello!');
	});

	it('sends plain content when catId is unknown', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello!', 'nonexistent-cat');
		assert.equal(feishuMock.sent[0].content, 'Hello!');
	});

	// Phase 3: rich block delivery
	it('calls sendRichMessage when adapter supports it and blocks provided', async () => {
		const richSent = [];
		const richAdapter = {
			connectorId: 'feishu',
			async sendReply(externalChatId, content) {
				feishuMock.sent.push({ externalChatId, content });
			},
			async sendRichMessage(externalChatId, textContent, blocks, catDisplayName) {
				richSent.push({ externalChatId, textContent, blocks, catDisplayName });
			},
		};
		hook = new OutboundDeliveryHook({
			bindingStore,
			adapters: new Map([['feishu', richAdapter]]),
			log: noopLog(),
		});
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

		const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
		await hook.deliver('thread-abc', 'Summary text', 'opus', blocks);

		assert.equal(richSent.length, 1);
		assert.equal(richSent[0].catDisplayName, '布偶猫');
		assert.equal(richSent[0].blocks.length, 1);
		assert.equal(feishuMock.sent.length, 0); // sendReply NOT called
	});

	it('falls back to sendReply with plaintext when adapter lacks sendRichMessage', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

		const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
		await hook.deliver('thread-abc', 'Summary', 'opus', blocks);

		assert.equal(feishuMock.sent.length, 1);
		// Should contain both text prefix and plaintext-rendered block
		assert.ok(feishuMock.sent[0].content.includes('[布偶猫🐱]'));
		assert.ok(feishuMock.sent[0].content.includes('Review'));
		assert.ok(feishuMock.sent[0].content.includes('LGTM'));
	});

	it('sends text via sendReply when no rich blocks (backward compat)', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello!', 'opus', undefined);
		assert.equal(feishuMock.sent.length, 1);
		assert.match(feishuMock.sent[0].content, /^\[布偶猫🐱\] Hello!$/);
	});

	it('sends text via sendReply when rich blocks is empty array', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
		await hook.deliver('thread-abc', 'Hello!', 'opus', []);
		assert.equal(feishuMock.sent.length, 1);
		assert.match(feishuMock.sent[0].content, /^\[布偶猫🐱\] Hello!$/);
	});

	// P1-1: block-only responses (empty content) must still trigger delivery
	it('delivers rich blocks even when text content is empty', async () => {
		const richSent = [];
		const richAdapter = {
			connectorId: 'feishu',
			async sendReply(externalChatId, content) {
				feishuMock.sent.push({ externalChatId, content });
			},
			async sendRichMessage(externalChatId, textContent, blocks, catDisplayName) {
				richSent.push({ externalChatId, textContent, blocks, catDisplayName });
			},
		};
		hook = new OutboundDeliveryHook({
			bindingStore,
			adapters: new Map([['feishu', richAdapter]]),
			log: noopLog(),
		});
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

		const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' }];
		await hook.deliver('thread-abc', '', 'opus', blocks);

		assert.equal(richSent.length, 1);
		assert.equal(richSent[0].blocks.length, 1);
		assert.equal(feishuMock.sent.length, 0); // sendReply NOT called
	});

	it('falls back to plaintext for block-only when adapter lacks sendRichMessage', async () => {
		bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

		const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' }];
		await hook.deliver('thread-abc', '', 'opus', blocks);

		assert.equal(feishuMock.sent.length, 1);
		assert.ok(feishuMock.sent[0].content.includes('Status'));
		assert.ok(feishuMock.sent[0].content.includes('Done'));
	});

	// Phase A: MessageEnvelope formatted reply
	describe('sendFormattedReply (MessageEnvelope)', () => {
		it('calls sendFormattedReply when adapter supports it and threadMeta provided', async () => {
			const formattedCalls = [];
			const richAdapter = {
				connectorId: 'feishu',
				async sendReply(chatId, content) {
					feishuMock.sent.push({ chatId, content });
				},
				async sendFormattedReply(chatId, envelope) {
					formattedCalls.push({ chatId, envelope });
				},
			};
			hook = new OutboundDeliveryHook({
				bindingStore,
				adapters: new Map([['feishu', richAdapter]]),
				log: noopLog(),
			});
			bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

			await hook.deliver('thread-1', 'Hello from cat!', 'opus', undefined, {
				threadShortId: 'T42',
				threadTitle: '飞书登录bug排查',
				featId: 'F088',
			});

			assert.equal(formattedCalls.length, 1);
			assert.equal(feishuMock.sent.length, 0, 'sendReply should NOT be called');
			assert.equal(formattedCalls[0].chatId, 'oc_chat_1');
			const env = formattedCalls[0].envelope;
			assert.ok(env.header.includes('布偶猫'), 'header should contain cat display name');
			assert.ok(env.subtitle.includes('T42'), 'subtitle should have thread short ID');
			assert.ok(env.subtitle.includes('F088'), 'subtitle should have feat ID');
			assert.equal(env.body, 'Hello from cat!');
		});

		it('falls back to sendReply when adapter has no sendFormattedReply', async () => {
			bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

			await hook.deliver('thread-1', 'Hello!', 'opus', undefined, {
				threadShortId: 'T1',
			});

			assert.equal(feishuMock.sent.length, 1);
			assert.ok(feishuMock.sent[0].content.includes('Hello!'));
		});

		it('falls back to sendReply when no threadMeta provided (legacy path)', async () => {
			const formattedCalls = [];
			const richAdapter = {
				connectorId: 'feishu',
				async sendReply(chatId, content) {
					feishuMock.sent.push({ chatId, content });
				},
				async sendFormattedReply(chatId, envelope) {
					formattedCalls.push({ chatId, envelope });
				},
			};
			hook = new OutboundDeliveryHook({
				bindingStore,
				adapters: new Map([['feishu', richAdapter]]),
				log: noopLog(),
			});
			bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

			// No threadMeta → legacy plain text path
			await hook.deliver('thread-1', 'Old style message', 'opus');

			assert.equal(formattedCalls.length, 0, 'sendFormattedReply should NOT be called without threadMeta');
			assert.equal(feishuMock.sent.length, 1);
		});
	});
});
