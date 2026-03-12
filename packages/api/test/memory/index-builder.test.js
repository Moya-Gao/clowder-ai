import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('IndexBuilder', () => {
	let tmpDir;
	let docsDir;
	let store;
	let builder;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `f102-test-${randomUUID().slice(0, 8)}`);
		docsDir = join(tmpDir, 'docs');
		mkdirSync(join(docsDir, 'features'), { recursive: true });
		mkdirSync(join(docsDir, 'decisions'), { recursive: true });

		const { SqliteEvidenceStore } = await import(
			'../../dist/domains/memory/SqliteEvidenceStore.js'
		);
		const { IndexBuilder } = await import('../../dist/domains/memory/IndexBuilder.js');

		store = new SqliteEvidenceStore(':memory:');
		await store.initialize();
		builder = new IndexBuilder(store, docsDir);
	});

	afterEach(() => {
		store.close();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('rebuild indexes docs with YAML frontmatter', async () => {
		writeFileSync(
			join(docsDir, 'features', 'F042-prompt-audit.md'),
			`---
feature_ids: [F042]
topics: [prompt, skills]
doc_kind: spec
---

# F042: Prompt Engineering Audit

Some content here about prompt engineering.
`,
		);

		const result = await builder.rebuild();
		assert.equal(result.docsIndexed, 1);

		const item = await store.getByAnchor('F042');
		assert.ok(item, 'Should have indexed F042');
		assert.equal(item.kind, 'feature');
		assert.equal(item.title, 'F042: Prompt Engineering Audit');
		assert.ok(item.sourcePath.endsWith('F042-prompt-audit.md'));
	});

	it('rebuild indexes decisions', async () => {
		writeFileSync(
			join(docsDir, 'decisions', '005-hindsight.md'),
			`---
decision_id: ADR-005
topics: [hindsight, memory]
doc_kind: decision
---

# ADR-005: Hindsight Integration

Decision about using Hindsight.
`,
		);

		const result = await builder.rebuild();
		assert.equal(result.docsIndexed, 1);

		const item = await store.getByAnchor('ADR-005');
		assert.ok(item);
		assert.equal(item.kind, 'decision');
	});

	it('rebuild skips files without frontmatter', async () => {
		writeFileSync(join(docsDir, 'features', 'no-frontmatter.md'), '# Just a title\n\nNo frontmatter here.');

		const result = await builder.rebuild();
		assert.equal(result.docsIndexed, 0);
		assert.equal(result.docsSkipped, 1);
	});

	it('incrementalUpdate only re-indexes changed paths', async () => {
		const filePath = join(docsDir, 'features', 'F042-prompt-audit.md');
		writeFileSync(
			filePath,
			`---
feature_ids: [F042]
doc_kind: spec
---

# F042: Original Title
`,
		);
		await builder.rebuild();
		assert.equal((await store.getByAnchor('F042')).title, 'F042: Original Title');

		writeFileSync(
			filePath,
			`---
feature_ids: [F042]
doc_kind: spec
---

# F042: Updated Title
`,
		);
		await builder.incrementalUpdate([filePath]);
		assert.equal((await store.getByAnchor('F042')).title, 'F042: Updated Title');
	});

	it('checkConsistency reports ok when fts matches docs', async () => {
		writeFileSync(
			join(docsDir, 'features', 'F001.md'),
			`---
feature_ids: [F001]
doc_kind: spec
---

# F001: Test Feature
`,
		);
		await builder.rebuild();

		const report = await builder.checkConsistency();
		assert.equal(report.ok, true);
		assert.equal(report.docCount, 1);
		assert.equal(report.ftsCount, 1);
		assert.deepEqual(report.mismatches, []);
	});

	it('rebuild with force re-indexes everything', async () => {
		writeFileSync(
			join(docsDir, 'features', 'F001.md'),
			`---
feature_ids: [F001]
doc_kind: spec
---

# F001: Test
`,
		);
		const r1 = await builder.rebuild();
		assert.equal(r1.docsIndexed, 1);

		// Second rebuild without force — hash unchanged, should skip
		const r2 = await builder.rebuild();
		assert.equal(r2.docsSkipped, 1);

		// Force rebuild — should re-index
		const r3 = await builder.rebuild({ force: true });
		assert.equal(r3.docsIndexed, 1);
	});

	it('rebuild removes stale anchors for deleted files', async () => {
		const filePath = join(docsDir, 'features', 'F001.md');
		writeFileSync(
			filePath,
			`---
feature_ids: [F001]
doc_kind: spec
---

# F001: Will Be Deleted
`,
		);
		await builder.rebuild();
		assert.ok(await store.getByAnchor('F001'), 'F001 should exist after rebuild');

		// Delete the file
		unlinkSync(filePath);
		await builder.rebuild();

		// F001 should be gone from the index
		const stale = await store.getByAnchor('F001');
		assert.equal(stale, null, 'F001 should be removed after file deletion');
	});

	it('incrementalUpdate deletes anchor when file no longer exists', async () => {
		const filePath = join(docsDir, 'features', 'F099.md');
		writeFileSync(
			filePath,
			`---
feature_ids: [F099]
doc_kind: spec
---

# F099: Temporary
`,
		);
		await builder.rebuild();
		assert.ok(await store.getByAnchor('F099'));

		// Delete the file, then run incremental update on that path
		unlinkSync(filePath);
		await builder.incrementalUpdate([filePath]);

		const stale = await store.getByAnchor('F099');
		assert.equal(stale, null, 'F099 should be removed after incremental update');
	});
});
