import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AgentPaneRegistry } from '../dist/domains/terminal/agent-pane-registry.js';

describe('AgentPaneRegistry', () => {
	let registry;

	beforeEach(() => {
		registry = new AgentPaneRegistry();
	});

	it('register + getByInvocation', () => {
		registry.register('inv-1', 'wt-a', '%0');
		const info = registry.getByInvocation('inv-1');
		assert.equal(info.invocationId, 'inv-1');
		assert.equal(info.worktreeId, 'wt-a');
		assert.equal(info.paneId, '%0');
		assert.equal(info.status, 'running');
	});

	it('getByInvocation returns undefined for unknown', () => {
		assert.equal(registry.getByInvocation('nope'), undefined);
	});

	it('listByWorktree returns only matching entries', () => {
		registry.register('inv-1', 'wt-a', '%0');
		registry.register('inv-2', 'wt-b', '%1');
		registry.register('inv-3', 'wt-a', '%2');
		const list = registry.listByWorktree('wt-a');
		assert.equal(list.length, 2);
		assert.deepEqual(
			list.map((p) => p.invocationId).sort(),
			['inv-1', 'inv-3'],
		);
	});

	it('markDone updates status', () => {
		registry.register('inv-1', 'wt-a', '%0');
		registry.markDone('inv-1', 0);
		const info = registry.getByInvocation('inv-1');
		assert.equal(info.status, 'done');
		assert.equal(info.exitCode, 0);
	});

	it('markCrashed updates status', () => {
		registry.register('inv-1', 'wt-a', '%0');
		registry.markCrashed('inv-1', 'SIGKILL');
		const info = registry.getByInvocation('inv-1');
		assert.equal(info.status, 'crashed');
		assert.equal(info.signal, 'SIGKILL');
	});

	it('remove deletes entry', () => {
		registry.register('inv-1', 'wt-a', '%0');
		registry.remove('inv-1');
		assert.equal(registry.getByInvocation('inv-1'), undefined);
	});

	it('listByWorktree returns empty for unknown worktree', () => {
		assert.deepEqual(registry.listByWorktree('nope'), []);
	});
});
