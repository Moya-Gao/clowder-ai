import './helpers/setup-cat-registry.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startConnectorGateway } from '../dist/infrastructure/connectors/connector-gateway-bootstrap.js';

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

const baseDeps = {
	messageStore: {
		async append(input) {
			return { id: 'msg-1', ...input };
		},
	},
	threadStore: {
		create(userId, title) {
			return { id: 'thread-1', createdBy: userId, title };
		},
	},
	invokeTrigger: {
		trigger() {},
	},
	socketManager: {
		broadcastToRoom() {},
	},
	defaultUserId: 'owner-1',
	defaultCatId: 'opus',
	log: noopLog(),
};

describe('ConnectorGateway Bootstrap', () => {
	it('returns null when no connectors configured', async () => {
		const result = await startConnectorGateway({}, baseDeps);
		assert.equal(result, null);
	});

	it('returns null when feishu credentials present but no verification token (fail-closed)', async () => {
		const config = {
			feishuAppId: 'test-app-id',
			feishuAppSecret: 'test-app-secret',
		};
		const result = await startConnectorGateway(config, baseDeps);
		assert.equal(result, null);
	});

	it('creates gateway handle with feishu webhook handler', async () => {
		const config = {
			feishuAppId: 'test-app-id',
			feishuAppSecret: 'test-app-secret',
			feishuVerificationToken: 'test-token',
		};
		const handle = await startConnectorGateway(config, baseDeps);
		assert.ok(handle);
		assert.ok(handle.outboundHook);
		assert.ok(handle.webhookHandlers.has('feishu'));
		assert.equal(typeof handle.stop, 'function');
		await handle.stop();
	});

	it('feishu webhook handler handles verification challenge', async () => {
		const config = {
			feishuAppId: 'test-app-id',
			feishuAppSecret: 'test-app-secret',
			feishuVerificationToken: 'test-token',
		};
		const handle = await startConnectorGateway(config, baseDeps);
		assert.ok(handle);

		const feishuHandler = handle.webhookHandlers.get('feishu');
		assert.ok(feishuHandler);

		const result = await feishuHandler.handleWebhook(
			{ type: 'url_verification', challenge: 'my-challenge' },
			{},
		);
		assert.equal(result.kind, 'challenge');
		if (result.kind === 'challenge') {
			assert.equal(result.response.challenge, 'my-challenge');
		}
		await handle.stop();
	});

	it('feishu webhook handler routes DM text message', async () => {
		const triggerCalls = [];
		const deps = {
			...baseDeps,
			invokeTrigger: {
				trigger(...args) {
					triggerCalls.push(args);
				},
			},
		};

		const config = {
			feishuAppId: 'test-app-id',
			feishuAppSecret: 'test-app-secret',
			feishuVerificationToken: 'test-token',
		};
		const handle = await startConnectorGateway(config, deps);
		assert.ok(handle);

		const feishuHandler = handle.webhookHandlers.get('feishu');
		const result = await feishuHandler.handleWebhook(
			{
				header: {
					event_type: 'im.message.receive_v1',
					event_id: 'evt-1',
					token: 'test-token',
				},
				event: {
					sender: {
						sender_id: { open_id: 'ou_user' },
						sender_type: 'user',
					},
					message: {
						message_id: 'om_msg_1',
						chat_id: 'oc_chat_1',
						chat_type: 'p2p',
						content: JSON.stringify({ text: 'Hello cat!' }),
						message_type: 'text',
					},
				},
			},
			{},
		);

		assert.equal(result.kind, 'processed');
		assert.equal(triggerCalls.length, 1);
		await handle.stop();
	});

	it('feishu webhook handler skips unsupported events', async () => {
		const config = {
			feishuAppId: 'test-app-id',
			feishuAppSecret: 'test-app-secret',
			feishuVerificationToken: 'test-token',
		};
		const handle = await startConnectorGateway(config, baseDeps);
		assert.ok(handle);

		const feishuHandler = handle.webhookHandlers.get('feishu');
		const result = await feishuHandler.handleWebhook(
			{ header: { event_type: 'other.event', token: 'test-token' }, event: {} },
			{},
		);
		assert.equal(result.kind, 'skipped');
		await handle.stop();
	});

	it('feishu webhook handler rejects events with invalid verification token', async () => {
		const config = {
			feishuAppId: 'test-app-id',
			feishuAppSecret: 'test-app-secret',
			feishuVerificationToken: 'correct-token',
		};
		const handle = await startConnectorGateway(config, baseDeps);
		assert.ok(handle);

		const feishuHandler = handle.webhookHandlers.get('feishu');
		const result = await feishuHandler.handleWebhook(
			{
				header: {
					event_type: 'im.message.receive_v1',
					token: 'wrong-token',
				},
				event: {
					sender: { sender_id: { open_id: 'ou_user' } },
					message: {
						message_id: 'om_msg',
						chat_id: 'oc_chat',
						chat_type: 'p2p',
						content: JSON.stringify({ text: 'evil message' }),
						message_type: 'text',
					},
				},
			},
			{},
		);
		assert.equal(result.kind, 'error');
		if (result.kind === 'error') {
			assert.equal(result.status, 403);
		}
		await handle.stop();
	});
});
