import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { extractTopicsFromTitle, formatFrontmatter, inferDocKind, runFormatter } from './frontmatter-formatter.mjs';

describe('frontmatter-formatter (F-3)', () => {
  describe('inferDocKind', () => {
    it('infers decision from decisions/ path', () => {
      assert.equal(inferDocKind('docs/decisions/adr-005.md', ''), 'decision');
    });

    it('infers lesson from lessons/ path', () => {
      assert.equal(inferDocKind('docs/lessons/pitfall.md', ''), 'lesson');
    });

    it('infers decision from content keyword', () => {
      assert.equal(inferDocKind('docs/misc/review.md', '# Decision: Use REST\n\nWe decided...'), 'decision');
    });

    it('infers lesson from content keyword', () => {
      assert.equal(inferDocKind('docs/misc/oops.md', "# Lesson Learned\n\nDon't do this."), 'lesson');
    });

    it('defaults to plan for unknown paths and content', () => {
      assert.equal(inferDocKind('docs/random/notes.md', '# Meeting Notes\n\nSome notes.'), 'plan');
    });
  });

  describe('extractTopicsFromTitle', () => {
    it('extracts meaningful words from title', () => {
      const topics = extractTopicsFromTitle('Redis Setup Guide');
      assert.ok(topics.includes('redis'));
      assert.ok(topics.includes('setup'));
      assert.ok(topics.includes('guide'));
    });

    it('filters out short words', () => {
      const topics = extractTopicsFromTitle('A Guide to the API');
      assert.ok(!topics.includes('a'));
      assert.ok(!topics.includes('to'));
      assert.ok(!topics.includes('the'));
    });

    it('returns at most 5 topics', () => {
      const topics = extractTopicsFromTitle('Very Long Title With Many Important Words Here Today');
      assert.ok(topics.length <= 5);
    });
  });

  describe('formatFrontmatter', () => {
    it('produces valid YAML frontmatter block', () => {
      const fm = formatFrontmatter({ doc_kind: 'plan', topics: ['redis', 'setup'] });
      assert.ok(fm.startsWith('---\n'));
      assert.ok(fm.endsWith('---\n'));
      assert.ok(fm.includes('doc_kind: plan'));
      assert.ok(fm.includes('topics: [redis, setup]'));
    });
  });

  describe('runFormatter', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = join(tmpdir(), `f102-fmt-${randomUUID().slice(0, 8)}`);
      mkdirSync(join(tmpDir, 'docs', 'notes'), { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('dry-run reports files missing frontmatter', () => {
      writeFileSync(join(tmpDir, 'docs', 'notes', 'bare.md'), '# Bare Document\n\nNo frontmatter.');
      const result = runFormatter(join(tmpDir, 'docs'), { dryRun: true });
      assert.equal(result.wouldUpdate.length, 1);
      assert.ok(result.wouldUpdate[0].includes('bare.md'));
      assert.equal(result.updated.length, 0);
    });

    it('dry-run does not modify files', () => {
      const filePath = join(tmpDir, 'docs', 'notes', 'bare.md');
      const original = '# Bare Document\n\nNo frontmatter.';
      writeFileSync(filePath, original);
      runFormatter(join(tmpDir, 'docs'), { dryRun: true });
      assert.equal(readFileSync(filePath, 'utf-8'), original);
    });

    it('apply adds frontmatter to file without it', () => {
      const filePath = join(tmpDir, 'docs', 'notes', 'bare.md');
      writeFileSync(filePath, '# Redis Setup Guide\n\nHow to configure Redis.');
      const result = runFormatter(join(tmpDir, 'docs'), { dryRun: false });
      assert.equal(result.updated.length, 1);

      const content = readFileSync(filePath, 'utf-8');
      assert.ok(content.startsWith('---\n'), 'should have frontmatter');
      assert.ok(content.includes('doc_kind: plan'));
      assert.ok(content.includes('# Redis Setup Guide'), 'should preserve original content');
    });

    it('skips files with complete frontmatter', () => {
      const filePath = join(tmpDir, 'docs', 'notes', 'has-fm.md');
      const original =
        '---\ndoc_kind: decision\ncreated: 2026-01-01\nanchor: doc:notes/has-fm\ntopics: [redis]\n---\n\n# Decision\n\nAlready has frontmatter.';
      writeFileSync(filePath, original);
      const result = runFormatter(join(tmpDir, 'docs'), { dryRun: false });
      assert.equal(result.updated.length, 0);
      assert.equal(result.skipped.length, 1);
      assert.equal(readFileSync(filePath, 'utf-8'), original);
    });

    it('apply includes anchor in frontmatter output', () => {
      const filePath = join(tmpDir, 'docs', 'notes', 'bare.md');
      writeFileSync(filePath, '# Redis Setup Guide\n\nHow to configure Redis.');
      runFormatter(join(tmpDir, 'docs'), { dryRun: false });

      const content = readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('anchor: doc:notes/bare'), 'should include anchor field');
    });

    it('fills missing doc_kind from path inference in partial frontmatter', () => {
      mkdirSync(join(tmpDir, 'docs', 'decisions'), { recursive: true });
      const filePath = join(tmpDir, 'docs', 'decisions', 'adr-001.md');
      writeFileSync(filePath, '---\ncreated: 2026-01-01\n---\n\n# ADR-001: Use REST\n\nWe decided to use REST.');
      const result = runFormatter(join(tmpDir, 'docs'), { dryRun: false });

      assert.equal(result.updated.length, 1, 'should update file missing doc_kind');
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('doc_kind: decision'), 'should infer doc_kind from decisions/ path');
      assert.ok(content.includes('created: 2026-01-01'), 'should preserve existing created');
      assert.ok(content.includes('anchor:'), 'should add anchor');
    });

    it('fills missing fields in file with partial frontmatter', () => {
      const filePath = join(tmpDir, 'docs', 'notes', 'partial.md');
      writeFileSync(filePath, '---\ndoc_kind: decision\n---\n\n# Important Decision About Redis\n\nSome content.');
      const result = runFormatter(join(tmpDir, 'docs'), { dryRun: false });

      // Should be updated (fill missing fields), not skipped
      assert.equal(result.updated.length, 1, 'partial frontmatter file should be updated');
      assert.equal(result.skipped.length, 0, 'partial frontmatter file should NOT be skipped');

      const content = readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('doc_kind: decision'), 'should preserve existing doc_kind');
      assert.ok(content.includes('anchor:'), 'should add missing anchor');
      assert.ok(content.includes('topics:'), 'should add missing topics');
    });
  });
});
