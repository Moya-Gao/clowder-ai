/**
 * Sanitizer regression guard — ensures _sanitize-rules.pl transforms produce
 * correct results for known edge cases.
 *
 * Root cause: rounds 3-4 of outbound sync broke 161-192 tests because sanitizer
 * rules were too broad or missed regex-escaped patterns. This test pins expected
 * behavior so future rule changes get caught before sync.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const ROOT = resolve(process.cwd());
const RULES_PATH = resolve(ROOT, 'scripts/_sanitize-rules.pl');
const isHomeRepo = existsSync(RULES_PATH);

function applySanitizer(input, filename) {
  const tmpDir = mkdtempSync(join(resolve(ROOT, '..'), 'sanitize-test-'));
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, input, 'utf-8');
  execSync(`perl -pi ${RULES_PATH} ${filePath}`, { cwd: ROOT });
  const result = readFileSync(filePath, 'utf-8');
  unlinkSync(filePath);
  rmdirSync(tmpDir);
  return result;
}

describe('sanitize-rules regression (home repo only)', { skip: !isHomeRepo }, () => {
  describe('BACKLOG.md → ROADMAP.md scoping', () => {
    it('transforms docs/BACKLOG.md string path in .ts files', () => {
      const input = `readBacklogContent('docs/BACKLOG.md', cwd);\n`;
      const result = applySanitizer(input, 'test-source.ts');
      assert.ok(result.includes('docs/ROADMAP.md'), `expected docs/ROADMAP.md, got: ${result}`);
      assert.ok(!result.includes('docs/BACKLOG.md'));
    });

    it('transforms join(root, "docs", "BACKLOG.md") pattern in .ts files', () => {
      const input = `const p = join(root, 'docs', 'BACKLOG.md');\n`;
      const result = applySanitizer(input, 'test-join.ts');
      assert.ok(result.includes("'docs', 'ROADMAP.md'"), `expected join transform, got: ${result}`);
    });

    it('transforms regex-escaped docs\\/BACKLOG\\.md in .ts files', () => {
      const input = `const PATTERN = /^(docs\\/BACKLOG\\.md|cat-config\\.json)$/;\n`;
      const result = applySanitizer(input, 'test-regex.ts');
      assert.ok(result.includes('docs\\/ROADMAP\\.md'), `expected regex transform, got: ${result}`);
      assert.ok(!result.includes('docs\\/BACKLOG\\.md'));
    });

    it('does NOT transform bare BACKLOG.md (governance templates)', () => {
      const input = `{ relativePath: 'BACKLOG.md', content: fill(BACKLOG_TEMPLATE) },\n`;
      const result = applySanitizer(input, 'test-bare.ts');
      assert.ok(result.includes("'BACKLOG.md'"), `bare BACKLOG.md should be preserved, got: ${result}`);
    });

    it('does NOT transform join(tempDir, "BACKLOG.md") (test fixtures)', () => {
      const input = `const p = join(tempDir, 'BACKLOG.md');\n`;
      const result = applySanitizer(input, 'test-fixture.ts');
      assert.ok(result.includes("'BACKLOG.md'"), `tempDir join should be preserved, got: ${result}`);
    });

    it('transforms docs/BACKLOG.md in .js test files', () => {
      const input = `assert.deepEqual(result.unpushedFiles, ['docs/BACKLOG.md']);\n`;
      const result = applySanitizer(input, 'test-assert.js');
      assert.ok(result.includes('docs/ROADMAP.md'), `expected transform in .js, got: ${result}`);
    });

    it('transforms 来源 docs/BACKLOG.md label', () => {
      const input = `summary: '来源 docs/BACKLOG.md | 状态：spec',\n`;
      const result = applySanitizer(input, 'test-label.ts');
      assert.ok(result.includes('docs/ROADMAP.md'), `expected label transform, got: ${result}`);
    });

    it('does NOT transform BACKLOG.md in docs/ markdown files', () => {
      const input = `See BACKLOG.md for the task list.\n`;
      const result = applySanitizer(input, 'test-docs.md');
      assert.ok(result.includes('BACKLOG.md'), `markdown bare ref should be preserved, got: ${result}`);
    });
  });

  describe('directory-picker-modal file-specific transform', () => {
    it('transforms toContain("cat-cafe") in directory-picker-modal.test.js', () => {
      const input = `expect(result).toContain('cat-cafe');\n`;
      const result = applySanitizer(input, 'directory-picker-modal.test.js');
      assert.ok(result.includes("toContain('project')"), `expected project, got: ${result}`);
    });

    it('does NOT transform toContain("cat-cafe") in other test files', () => {
      const input = `expect(result).toContain('cat-cafe');\n`;
      const result = applySanitizer(input, 'other-test.js');
      assert.ok(!result.includes("toContain('project')"), `should not transform in non-target file, got: ${result}`);
    });
  });

  describe('Cat Cafe → Clowder AI branding', () => {
    it('transforms "Cat Cafe" in .ts files', () => {
      const input = `title: 'Cat Cafe'\n`;
      const result = applySanitizer(input, 'test-brand.ts');
      assert.ok(result.includes('Clowder AI'), `expected Clowder AI, got: ${result}`);
    });

    it('does NOT transform Cat Cafe in .md files', () => {
      const input = `Welcome to Cat Cafe!\n`;
      const result = applySanitizer(input, 'test-brand.md');
      assert.ok(!result.includes('Clowder AI'), `should not transform in .md, got: ${result}`);
    });
  });

  describe('port remapping', () => {
    it('transforms localhost:3002 → localhost:3004', () => {
      const input = `const url = 'http://localhost:3002/api';\n`;
      const result = applySanitizer(input, 'test-port.ts');
      assert.ok(result.includes('localhost:3004'), `expected 3004, got: ${result}`);
    });

    it('transforms localhost:3001 → localhost:3003', () => {
      const input = `const url = 'http://localhost:3001';\n`;
      const result = applySanitizer(input, 'test-port2.ts');
      assert.ok(result.includes('localhost:3003'), `expected 3003, got: ${result}`);
    });
  });

  describe('personal info sanitization', () => {
    it('transforms "Landy" → "You"', () => {
      const input = `name: "Landy"\n`;
      const result = applySanitizer(input, 'test-name.ts');
      assert.ok(result.includes('"You"'), `expected You, got: ${result}`);
    });

    it('transforms @Landy → @co-creator', () => {
      const input = `mention: '@Landy'\n`;
      const result = applySanitizer(input, 'test-mention.ts');
      assert.ok(result.includes('@co-creator'), `expected @co-creator, got: ${result}`);
    });
  });
});
