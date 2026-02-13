import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { collectP0ImportSources } from '../../dist/domains/cats/services/hindsight-import/p0-source-discovery.js';

test('collectP0ImportSources includes only git-tracked decision docs', async (t) => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'cat-cafe-p0-source-'));
  t.after(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  execFileSync('git', ['init'], { cwd: repoRoot });
  mkdirSync(join(repoRoot, 'docs', 'decisions'), { recursive: true });
  writeFileSync(join(repoRoot, 'CLAUDE.md'), '# CLAUDE\n');
  writeFileSync(join(repoRoot, 'AGENTS.md'), '# AGENTS\n');
  writeFileSync(join(repoRoot, 'docs', 'lessons-learned.md'), '# Lessons\n');
  writeFileSync(join(repoRoot, 'docs', 'decisions', '001-alpha.md'), '# ADR 001\n');
  writeFileSync(join(repoRoot, 'docs', 'decisions', '999-untracked.md'), '# ADR 999\n');

  execFileSync('git', ['add', 'CLAUDE.md', 'AGENTS.md', 'docs/lessons-learned.md', 'docs/decisions/001-alpha.md'], {
    cwd: repoRoot,
  });

  const sources = await collectP0ImportSources(repoRoot);
  assert.ok(sources.includes('docs/decisions/001-alpha.md'));
  assert.ok(!sources.includes('docs/decisions/999-untracked.md'));
});
