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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const ROOT = resolve(process.cwd());
const RULES_PATH = resolve(ROOT, 'scripts/_sanitize-rules.pl');
const isHomeRepo = existsSync(RULES_PATH);

function applySanitizer(input, filename) {
  const tmpDir = mkdtempSync(join(resolve(ROOT, '..'), 'sanitize-test-'));
  const filePath = join(tmpDir, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, input, 'utf-8');
  execSync(`perl -pi ${RULES_PATH} ${filePath}`, { cwd: ROOT });
  const result = readFileSync(filePath, 'utf-8');
  unlinkSync(filePath);
  rmSync(tmpDir, { recursive: true });
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

    it('transforms relative ../BACKLOG.md links in .ts files', () => {
      const input = `expect(resolveRelativePath('docs/features', '../BACKLOG.md')).toBe('docs/ROADMAP.md');\n`;
      const result = applySanitizer(input, 'test-relative-link.ts');
      assert.ok(result.includes('../ROADMAP.md'), `expected relative link transform, got: ${result}`);
      assert.ok(!result.includes('../BACKLOG.md'));
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

    it('transforms review-start reserved internal ports to public defaults', () => {
      const input = `case "$port" in\n        3001|3002|3011|3012|4111) return 0 ;;\n        *) return 1 ;;\nesac\n`;
      const result = applySanitizer(input, 'scripts/review-start.sh');
      assert.ok(result.includes('3003|3004|3011|3012|4111'), `expected public reserved port list, got: ${result}`);
      assert.ok(!result.includes('3001|3002|3011|3012|4111'));
    });

    it('transforms review-start test expectations to public reserved ports', () => {
      const input = `const ports = { web: '3001', api: '3002' };\n`;
      const result = applySanitizer(input, 'packages/api/test/review-start-script.test.js');
      assert.ok(result.includes("{ web: '3003', api: '3004' }"), `expected public test ports, got: ${result}`);
      assert.ok(!result.includes("{ web: '3001', api: '3002' }"));
    });
  });

  describe('public package scripts', () => {
    it('removes desktop scripts from package.json when desktop/ is not synced', () => {
      const input = [
        '    "check:start-profile-isolation": "node --test scripts/start-dev-profile-isolation.test.mjs",',
        '    "desktop:prepare": "npm --prefix ./desktop install --include=dev",',
        '    "desktop:dev": "pnpm desktop:prepare && npm --prefix ./desktop run start"',
      ].join('\n');
      const result = applySanitizer(input, 'package.json');
      assert.ok(!result.includes('"desktop:'), `expected desktop scripts removed, got: ${result}`);
      assert.ok(
        result.includes('"check:start-profile-isolation": "node --test scripts/start-dev-profile-isolation.test.mjs"'),
        `expected preceding script to remain, got: ${result}`,
      );
      assert.ok(
        !result.includes('start-profile-isolation.test.mjs",'),
        `expected trailing comma removed, got: ${result}`,
      );
    });
  });

  describe('*.opensource.md → *.md link rewriting', () => {
    it('transforms SETUP.opensource.md link in .md files', () => {
      const input = `**[SETUP.opensource.md](SETUP.opensource.md)**\n`;
      const result = applySanitizer(input, 'docs/test-link.md');
      assert.ok(result.includes('SETUP.md'), `expected SETUP.md, got: ${result}`);
      assert.ok(!result.includes('SETUP.opensource.md'));
    });

    it('transforms SETUP.opensource.zh-CN.md anchor link', () => {
      const input = `See [Running](SETUP.opensource.zh-CN.md#section)\n`;
      const result = applySanitizer(input, 'test-readme.md');
      assert.ok(result.includes('SETUP.zh-CN.md#section'), `expected zh-CN, got: ${result}`);
    });

    it('transforms README.opensource.md reference', () => {
      const input = `See README.opensource.md for details.\n`;
      const result = applySanitizer(input, 'test-ref.md');
      assert.ok(result.includes('README.md'), `expected README.md, got: ${result}`);
      assert.ok(!result.includes('README.opensource.md'));
    });

    it('transforms CONTRIBUTING.opensource.md link', () => {
      const input = `Please read [CONTRIBUTING.opensource.md](CONTRIBUTING.opensource.md) first.\n`;
      const result = applySanitizer(input, 'test-contrib.md');
      assert.ok(result.includes('CONTRIBUTING.md'), `expected CONTRIBUTING.md, got: ${result}`);
      assert.ok(!result.includes('CONTRIBUTING.opensource.md'));
    });

    it('transforms README.opensource.zh-CN.md link', () => {
      const input = `中文版请看 [README.opensource.zh-CN.md](README.opensource.zh-CN.md)\n`;
      const result = applySanitizer(input, 'test-readme-zh.md');
      assert.ok(result.includes('README.zh-CN.md'), `expected README.zh-CN.md, got: ${result}`);
      assert.ok(!result.includes('README.opensource.zh-CN.md'));
    });
  });

  describe('lessons-learned.md → public-lessons.md', () => {
    it('transforms lessons-learned.md in docs/ markdown', () => {
      const input = `- [教训沉淀](lessons-learned.md) — 我们踩过的坑\n`;
      const result = applySanitizer(input, 'docs/VISION.md');
      assert.ok(result.includes('public-lessons.md'), `expected public-lessons.md, got: ${result}`);
      assert.ok(!result.includes('lessons-learned.md'));
    });

    it('does NOT transform lessons-learned.md outside docs/', () => {
      const input = `See lessons-learned.md for context.\n`;
      const result = applySanitizer(input, 'test-root.md');
      assert.ok(result.includes('lessons-learned.md'), `should not transform outside docs/, got: ${result}`);
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
