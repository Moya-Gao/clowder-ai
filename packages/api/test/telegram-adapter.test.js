import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TelegramAdapter } from '../dist/infrastructure/connectors/adapters/TelegramAdapter.js';

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

describe('TelegramAdapter', () => {
	describe('parseUpdate()', () => {
		it('extracts text message from update', () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const update = {
				update_id: 123,
				message: {
					message_id: 456,
					from: { id: 789, is_bot: false, first_name: 'Test' },
					chat: { id: 1001, type: 'private' },
					date: 1710000000,
					text: 'Hello cat!',
				},
			};
			const result = adapter.parseUpdate(update);
			assert.ok(result);
			assert.equal(result.chatId, '1001');
			assert.equal(result.text, 'Hello cat!');
			assert.equal(result.messageId, '456');
			assert.equal(result.senderId, '789');
		});

		it('returns null for non-text message', () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const update = {
				update_id: 123,
				message: {
					message_id: 456,
					from: { id: 789, is_bot: false, first_name: 'Test' },
					chat: { id: 1001, type: 'private' },
					date: 1710000000,
					photo: [{ file_id: 'abc', width: 100, height: 100 }],
				},
			};
			const result = adapter.parseUpdate(update);
			assert.equal(result, null);
		});

		it('returns null for group message (MVP = DM only)', () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const update = {
				update_id: 123,
				message: {
					message_id: 456,
					from: { id: 789, is_bot: false, first_name: 'Test' },
					chat: { id: -1001, type: 'group' },
					date: 1710000000,
					text: 'Hello from group!',
				},
			};
			const result = adapter.parseUpdate(update);
			assert.equal(result, null);
		});

		it('returns null for bot messages', () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const update = {
				update_id: 123,
				message: {
					message_id: 456,
					from: { id: 789, is_bot: true, first_name: 'Bot' },
					chat: { id: 1001, type: 'private' },
					date: 1710000000,
					text: 'Bot echo',
				},
			};
			const result = adapter.parseUpdate(update);
			assert.equal(result, null);
		});

		it('returns null for missing message', () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const result = adapter.parseUpdate({ update_id: 123 });
			assert.equal(result, null);
		});
	});

	describe('sendReply()', () => {
		it('calls bot.api.sendMessage with correct params', async () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const sendCalls = [];

			// Inject mock for bot.api.sendMessage
			adapter._injectSendMessage(async (chatId, text, opts) => {
				sendCalls.push({ chatId, text, opts });
			});

			await adapter.sendReply('1001', 'Hello from cat!');
			assert.equal(sendCalls.length, 1);
			assert.equal(sendCalls[0].chatId, '1001');
			assert.equal(sendCalls[0].text, 'Hello from cat!');
		});

		it('truncates messages over 4096 chars', async () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const sendCalls = [];
			adapter._injectSendMessage(async (chatId, text, opts) => {
				sendCalls.push({ chatId, text });
			});

			const longMsg = 'a'.repeat(5000);
			await adapter.sendReply('1001', longMsg);
			assert.equal(sendCalls.length, 1);
			assert.ok(sendCalls[0].text.length <= 4096);
			assert.ok(sendCalls[0].text.endsWith('…'));
		});
	});

	describe('sendRichMessage()', () => {
		it('sends HTML-formatted message with parse_mode', async () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const sendCalls = [];
			adapter._injectSendMessage(async (chatId, text, opts) => {
				sendCalls.push({ chatId, text, opts });
			});

			const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
			await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');

			assert.equal(sendCalls.length, 1);
			assert.equal(sendCalls[0].chatId, '1001');
			assert.deepEqual(sendCalls[0].opts, { parse_mode: 'HTML' });
			assert.ok(sendCalls[0].text.includes('<b>'));
			assert.ok(sendCalls[0].text.includes('布偶猫'));
			assert.ok(sendCalls[0].text.includes('Review'));
		});

		it('formats checklist blocks as HTML', async () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const sendCalls = [];
			adapter._injectSendMessage(async (chatId, text, opts) => {
				sendCalls.push({ chatId, text, opts });
			});

			const blocks = [{
				id: 'b2', kind: 'checklist', v: 1,
				items: [{ id: 'i1', text: 'Done', checked: true }, { id: 'i2', text: 'Pending' }],
			}];
			await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');

			assert.ok(sendCalls[0].text.includes('✅ Done'));
			assert.ok(sendCalls[0].text.includes('☐ Pending'));
		});
	});

	describe('connectorId', () => {
		it('is telegram', () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			assert.equal(adapter.connectorId, 'telegram');
		});
	});

	// P1-2: textContent must not be discarded when both text and blocks present
	describe('sendRichMessage() text preservation', () => {
		it('includes textContent in HTML output alongside blocks', async () => {
			const adapter = new TelegramAdapter('test-token', noopLog());
			const sendCalls = [];
			adapter._injectSendMessage(async (chatId, text, opts) => {
				sendCalls.push({ chatId, text, opts });
			});

			const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
			await adapter.sendRichMessage('1001', 'Cat reply text here', blocks, '布偶猫');

			assert.equal(sendCalls.length, 1);
			assert.ok(sendCalls[0].text.includes('Cat reply text here'), 'textContent must appear in output');
			assert.ok(sendCalls[0].text.includes('Review'), 'block content must also appear');
		});
	});
});
