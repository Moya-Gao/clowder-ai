import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FeishuAdapter } from '../dist/infrastructure/connectors/adapters/FeishuAdapter.js';

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

describe('FeishuAdapter', () => {
	describe('parseEvent()', () => {
		it('extracts text message from im.message.receive_v1 event', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			const event = {
				header: {
					event_type: 'im.message.receive_v1',
					event_id: 'evt-001',
				},
				event: {
					sender: {
						sender_id: { open_id: 'ou_sender_123' },
						sender_type: 'user',
					},
					message: {
						message_id: 'om_msg_456',
						chat_id: 'oc_chat_789',
						chat_type: 'p2p',
						content: JSON.stringify({ text: 'Hello cat!' }),
						message_type: 'text',
					},
				},
			};
			const result = adapter.parseEvent(event);
			assert.ok(result);
			assert.equal(result.chatId, 'oc_chat_789');
			assert.equal(result.text, 'Hello cat!');
			assert.equal(result.messageId, 'om_msg_456');
			assert.equal(result.senderId, 'ou_sender_123');
		});

		it('returns null for non-text message', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			const event = {
				header: { event_type: 'im.message.receive_v1', event_id: 'evt-002' },
				event: {
					sender: {
						sender_id: { open_id: 'ou_sender' },
						sender_type: 'user',
					},
					message: {
						message_id: 'om_msg',
						chat_id: 'oc_chat',
						chat_type: 'p2p',
						content: JSON.stringify({ image_key: 'abc' }),
						message_type: 'image',
					},
				},
			};
			assert.equal(adapter.parseEvent(event), null);
		});

		it('returns null for group messages (MVP = DM only)', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			const event = {
				header: { event_type: 'im.message.receive_v1', event_id: 'evt-003' },
				event: {
					sender: {
						sender_id: { open_id: 'ou_sender' },
						sender_type: 'user',
					},
					message: {
						message_id: 'om_msg',
						chat_id: 'oc_chat',
						chat_type: 'group',
						content: JSON.stringify({ text: 'group msg' }),
						message_type: 'text',
					},
				},
			};
			assert.equal(adapter.parseEvent(event), null);
		});

		it('returns null for unknown event type', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			assert.equal(
				adapter.parseEvent({
					header: { event_type: 'some.other.event' },
					event: {},
				}),
				null,
			);
		});
	});

	describe('isVerificationChallenge()', () => {
		it('detects url_verification event', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			const body = {
				type: 'url_verification',
				challenge: 'test-challenge-token',
			};
			const result = adapter.isVerificationChallenge(body);
			assert.ok(result);
			assert.equal(result.challenge, 'test-challenge-token');
		});

		it('returns null for non-verification body', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			assert.equal(
				adapter.isVerificationChallenge({ header: {}, event: {} }),
				null,
			);
		});
	});

	describe('sendReply()', () => {
		it('calls Lark API with correct params', async () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			const sendCalls = [];
			adapter._injectSendMessage(async (params) => {
				sendCalls.push(params);
			});

			await adapter.sendReply('oc_chat_789', 'Hello from cat!');
			assert.equal(sendCalls.length, 1);
			assert.equal(sendCalls[0].chatId, 'oc_chat_789');
			assert.equal(sendCalls[0].content, 'Hello from cat!');
			assert.equal(sendCalls[0].msgType, 'text');
		});
	});

	describe('connectorId', () => {
		it('is feishu', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			assert.equal(adapter.connectorId, 'feishu');
		});
	});

	describe('verifyEventToken()', () => {
		it('returns true when header.token matches verificationToken', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
				{ verificationToken: 'my-secret-token' },
			);
			const body = {
				header: { event_type: 'im.message.receive_v1', token: 'my-secret-token' },
				event: {},
			};
			assert.equal(adapter.verifyEventToken(body), true);
		});

		it('returns false when header.token does not match', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
				{ verificationToken: 'my-secret-token' },
			);
			const body = {
				header: { event_type: 'im.message.receive_v1', token: 'wrong-token' },
				event: {},
			};
			assert.equal(adapter.verifyEventToken(body), false);
		});

		it('returns true when no verificationToken configured (skip verification)', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
			);
			const body = {
				header: { event_type: 'im.message.receive_v1', token: 'any-token' },
				event: {},
			};
			assert.equal(adapter.verifyEventToken(body), true);
		});

		it('returns false when body has no header', () => {
			const adapter = new FeishuAdapter(
				'app-id',
				'app-secret',
				noopLog(),
				{ verificationToken: 'my-secret-token' },
			);
			assert.equal(adapter.verifyEventToken({}), false);
		});
	});
});
