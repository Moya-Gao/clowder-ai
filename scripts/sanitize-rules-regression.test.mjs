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

  describe('public skill manifest', () => {
    it('removes opensource-ops from next arrays when the skill itself is hidden', () => {
      const input = [
        'skills:',
        '  open-source-teardown:',
        '    output: "report"',
        '    next: ["collaborative-thinking", "writing-skills", "deep-research", "opensource-ops"]',
        '  opensource-ops:',
        '    output: "internal ops"',
        '    next: []',
        '  writing-skills:',
        '    output: "skill edits"',
        '    next: []',
        '',
      ].join('\n');
      const result = applySanitizer(input, 'cat-cafe-skills/manifest.yaml');

      assert.ok(!result.includes('  opensource-ops:'), `expected opensource-ops skill to be hidden, got: ${result}`);
      assert.ok(!result.includes('"opensource-ops"'), `expected no dangling next reference, got: ${result}`);
      assert.ok(
        result.includes('next: ["collaborative-thinking", "writing-skills", "deep-research"]'),
        `expected next array to keep remaining targets, got: ${result}`,
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

  describe('backtick internal path handling (#682)', () => {
    // Structural paths → REMAP (not mask)
    it('remaps bare `docs/discussions/` in skill files', () => {
      const input = '搜 `docs/discussions/` 看有没有前人讨论\n';
      const result = applySanitizer(input, 'cat-cafe-skills/feat-lifecycle/SKILL.md');
      assert.ok(result.includes('`feature-discussions/`'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps template `docs/discussions/YYYY-MM-DD-{topic}/README.md`', () => {
      const input = '落盘到 `docs/discussions/YYYY-MM-DD-{topic}/README.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/feat-lifecycle/SKILL.md');
      assert.ok(result.includes('feature-discussions/YYYY-MM-DD-{topic}/README.md'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps template `docs/plans/YYYY-MM-DD-<feature-name>.md`', () => {
      const input = '**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/writing-plans/SKILL.md');
      assert.ok(result.includes('feature-specs/YYYY-MM-DD-<feature-name>.md'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps bare `docs/mailbox/` directory ref', () => {
      const input = 'Review 信存放：`docs/mailbox/`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/cross-cat-handoff/SKILL.md');
      assert.ok(result.includes('`review-notes/`'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps `docs/research/domain-glossary.md` (convention deliverable)', () => {
      const input = '**交付物**：`docs/research/domain-glossary.md`（使用骨架模板 1）\n';
      const result = applySanitizer(input, 'cat-cafe-skills/knowledge-engineering/SKILL.md');
      assert.ok(result.includes('project-research/domain-glossary.md'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps `docs/reflections/README.md` template source', () => {
      const input = '从 `docs/reflections/README.md` 复制模板\n';
      const result = applySanitizer(input, 'cat-cafe-skills/feat-lifecycle/SKILL.md');
      assert.ok(result.includes('project-reflections/README.md'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps `docs/evidence/` bare directory convention', () => {
      const input = '显式归档到 `docs/evidence/`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/refs/evidence-output-contract.md');
      assert.ok(result.includes('`project-evidence/`'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('remaps `docs/research/YYYY-MM-DD-{topic}/` template dir', () => {
      const input = '结果存：`docs/research/YYYY-MM-DD-{topic}/`（chatgpt / claude-ai / gemini）\n';
      const result = applySanitizer(input, 'cat-cafe-skills/deep-research/SKILL.md');
      assert.ok(result.includes('project-research/YYYY-MM-DD-{topic}/'), `expected remap, got: ${result}`);
      assert.ok(!result.includes('internal reference removed'));
    });

    it('masks `docs/archive/2026-02/` specific dated subdir in SOP', () => {
      const input = '- 归档查找：`docs/archive/2026-02/`\n';
      const result = applySanitizer(input, 'docs/SOP.md');
      assert.ok(
        result.includes('*(internal reference removed)*'),
        `expected mask for specific dated subdir, got: ${result}`,
      );
    });

    // Private paths → still MASK
    it('masks specific dated `docs/discussions/2026-...` file', () => {
      const input = '模板见 `docs/discussions/2026-05-07-eval-contract-template-v1-draft.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/feat-lifecycle/SKILL.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask, got: ${result}`);
    });

    it('masks specific dated `docs/research/2026-...` file', () => {
      const input = '实战范例：`docs/research/2026-04-16-f163-knowledge-lifecycle/research-brief.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/deep-research/SKILL.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask, got: ${result}`);
    });

    it('masks specific dated `docs/plans/2026-...` file', () => {
      const input = '详细设计见 `docs/plans/2026-04-30-worktree-port-offset.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/worktree/SKILL.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask, got: ${result}`);
    });

    it('masks specific dated `docs/archive/2026-.../...` deep path in decisions', () => {
      const input = '- `docs/archive/2026-02/discussions/2026-02-06-first-demo-findings.md`\n';
      const result = applySanitizer(input, 'docs/decisions/003-test.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask, got: ${result}`);
    });

    // P1 fix: non-date deep paths with specific subdirs → MASK
    it('masks `docs/research/knowledge-enginnering/知识工程实践指南.md` (deep private path)', () => {
      const input =
        '砚砚《知识工程实践指南》：`docs/research/knowledge-enginnering/知识工程实践指南：如何写好 Skills & MCP.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/refs/mcp-tool-description-standard.md');
      assert.ok(
        result.includes('*(internal reference removed)*'),
        `expected mask for deep private path, got: ${result}`,
      );
    });

    it('masks `docs/research/knowledge-enginnering/knowledge-engineering-skills-mcp.md`', () => {
      const input = '详见 `docs/research/knowledge-enginnering/knowledge-engineering-skills-mcp.md` §1.4\n';
      const result = applySanitizer(input, 'cat-cafe-skills/writing-skills/SKILL.md');
      assert.ok(
        result.includes('*(internal reference removed)*'),
        `expected mask for specific private file, got: ${result}`,
      );
    });

    it('masks `docs/research/knowledge-enginnering/` bare subdir (P1 Round 2)', () => {
      const input = '参考 `docs/research/knowledge-enginnering/` 目录\n';
      const result = applySanitizer(input, 'cat-cafe-skills/refs/mcp-tool-description-standard.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask for bare subdir, got: ${result}`);
    });

    it('keeps template subdir `docs/discussions/YYYY-MM-DD-{topic}/README.md` (not masked by 2b)', () => {
      const input = '归档 `docs/discussions/YYYY-MM-DD-{topic}/README.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/feat-lifecycle/SKILL.md');
      assert.ok(
        result.includes('feature-discussions/YYYY-MM-DD-{topic}/README.md'),
        `template subdir must survive, got: ${result}`,
      );
      assert.ok(!result.includes('internal reference removed'));
    });

    // Non-backtick paths should still work via existing remapping
    it('still remaps non-backtick docs/research/ references', () => {
      const input = 'Store in docs/research/ for archival.\n';
      const result = applySanitizer(input, 'cat-cafe-skills/deep-research/SKILL.md');
      assert.ok(result.includes('project-research/'), `expected remap, got: ${result}`);
    });

    // Cloud review P1: bare-dir remap must NOT match compound names
    it('does NOT rewrite deep-research/ to deep-project-research/ (cloud P1)', () => {
      const input = 'cat-cafe-skills/deep-research/SKILL.md\n';
      const result = applySanitizer(input, 'cat-cafe-skills/deep-research/SKILL.md');
      assert.ok(result.includes('deep-research/'), `compound name must survive, got: ${result}`);
      assert.ok(!result.includes('deep-project-research'));
    });

    // Cloud review P1 #2: bare subdir without trailing / must be masked
    it('masks `docs/research/knowledge-engineering` without trailing / (cloud P1 #2)', () => {
      const input = '详见 `docs/research/knowledge-engineering`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/refs/mcp-tool-description-standard.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask, got: ${result}`);
    });

    // Cloud review P2: date-only filenames must be masked
    it('masks `docs/discussions/2026-05-07.md` date-only filename (cloud P2)', () => {
      const input = '模板见 `docs/discussions/2026-05-07.md`\n';
      const result = applySanitizer(input, 'cat-cafe-skills/feat-lifecycle/SKILL.md');
      assert.ok(result.includes('*(internal reference removed)*'), `expected mask, got: ${result}`);
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

  // Regression: outbound sync 2026-05-28 — sop-predicate-evaluator.test.js red on temp target.
  // Root cause: the unconditional `/Users/.../cat-cafe → /path/to/project` rule rewrote the
  // basename to 'project', but the repository field 'cat-cafe' is intentionally preserved.
  // git_state_predicate's scope gate checks `worktreeRoot.includes(repository)`, so the
  // mismatch silently degraded a `violation` to `pass`. Fix: only directory-picker-modal.test
  // collapses to /path/to/project; all other files preserve the basename via the multi-segment rule.
  describe('cat-cafe path basename preservation (sync 2026-05-28 regression)', () => {
    it('preserves cat-cafe basename for non-directory-picker files (/home/user/cat-cafe)', () => {
      const input = `worktreeRoot: '/Users/dev/cat-cafe',\n`;
      const result = applySanitizer(input, 'sop-predicate-evaluator.test.js');
      assert.ok(result.includes('/home/user/cat-cafe'), `expected basename preserved, got: ${result}`);
      assert.ok(!result.includes('/path/to/project'), `must NOT collapse to /path/to/project, got: ${result}`);
    });

    it('keeps repository field "cat-cafe" unscrubbed (repo names preserved)', () => {
      const input = `repository: 'cat-cafe',\n`;
      const result = applySanitizer(input, 'sop-predicate-evaluator.test.js');
      assert.ok(result.includes("repository: 'cat-cafe'"), `repo name must be preserved, got: ${result}`);
    });

    it('still collapses to /path/to/project ONLY in directory-picker-modal.test', () => {
      const input = `const CWD_PATH = '/Users/dev/cat-cafe';\n`;
      const result = applySanitizer(input, 'directory-picker-modal.test.ts');
      assert.ok(result.includes('/path/to/project'), `directory-picker-modal must collapse, got: ${result}`);
    });

    it('negative case stays mismatched: other-project basename preserved', () => {
      const input = `worktreeRoot: '/Users/dev/other-project',\n`;
      const result = applySanitizer(input, 'sop-predicate-evaluator.test.js');
      assert.ok(result.includes('/home/user/other-project'), `expected basename preserved, got: ${result}`);
    });

    // Cloud codex P1 (sync 2026-05-28): deep cat-cafe fork subpaths must keep the
    // cat-cafe/packages/... suffix. The bare multi-segment rule would collapse them to
    // just the leaf (/home/user/index.js), breaking mcp-config-adapters.test /
    // deprecated-managed-servers.test which assert fork-path preservation.
    it('preserves cat-cafe subpath for deep fork paths (P1 — fork-path safety case)', () => {
      const input = `const p = "/Users/alice/forks/cat-cafe/packages/mcp-server/dist/index.js";\n`;
      const result = applySanitizer(input, 'mcp-config-adapters.test.js');
      assert.ok(
        result.includes('/home/user/cat-cafe/packages/mcp-server/dist/index.js'),
        `expected cat-cafe subpath preserved, got: ${result}`,
      );
      assert.ok(!result.includes('/home/user/index.js'), `must NOT collapse to leaf, got: ${result}`);
    });

    it('scrubs the /Users/<dev> prefix while keeping cat-cafe basename', () => {
      const input = `const root = '/Users/someone/code/cat-cafe';\n`;
      const result = applySanitizer(input, 'deprecated-managed-servers.test.js');
      assert.ok(result.includes('/home/user/cat-cafe'), `expected prefix scrubbed + basename kept, got: ${result}`);
      assert.ok(!result.includes('someone'), `username must be scrubbed, got: ${result}`);
    });
  });
});
