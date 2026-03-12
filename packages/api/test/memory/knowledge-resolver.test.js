import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('KnowledgeResolver', () => {
	let resolver;
	let store;

	beforeEach(async () => {
		const { SqliteEvidenceStore } = await import(
			'../../dist/domains/memory/SqliteEvidenceStore.js'
		);
		const { KnowledgeResolver } = await import(
			'../../dist/domains/memory/KnowledgeResolver.js'
		);

		store = new SqliteEvidenceStore(':memory:');
		await store.initialize();
		resolver = new KnowledgeResolver(store);

		await store.upsert([
			{
				anchor: 'F042',
				kind: 'feature',
				status: 'active',
				title: 'Prompt Engineering Audit',
				summary: 'Three-layer information architecture',
				updatedAt: '2026-03-11T00:00:00Z',
			},
		]);
	});

	it('resolve returns results from project store', async () => {
		const result = await resolver.resolve('prompt engineering');
		assert.ok(result.results.length >= 1);
		assert.equal(result.results[0].anchor, 'F042');
		assert.deepEqual(result.sources, ['project']);
		assert.equal(result.query, 'prompt engineering');
	});

	it('resolve passes options through', async () => {
		const result = await resolver.resolve('prompt', { kind: 'feature', limit: 5 });
		assert.ok(result.results.length >= 1);
	});

	it('resolve returns empty for no matches', async () => {
		const result = await resolver.resolve('nonexistent topic xyz');
		assert.equal(result.results.length, 0);
	});
});
