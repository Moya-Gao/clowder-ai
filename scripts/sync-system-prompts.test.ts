import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildTargets, checkDrift, renderForCodex, renderForGemini, type SyncTarget } from './sync-system-prompts.js';

// Use the real shards from the repo
const REPO_ROOT = join(__dirname, '..');
const SHARDS_DIR = join(REPO_ROOT, 'assets', 'system-prompts');

describe('sync-system-prompts', () => {
  describe('renderForCodex', () => {
    it('should include governance-l0 content', () => {
      const result = renderForCodex(SHARDS_DIR);
      assert.ok(result.includes('家规'), 'missing 家规');
      assert.ok(result.includes('P1'), 'missing P1 principle');
      assert.ok(result.includes('Magic Words'), 'missing magic words');
    });

    it('should include shared OpenAI maine-coon identity', () => {
      const result = renderForCodex(SHARDS_DIR);
      assert.ok(result.includes('砚砚'), 'missing 砚砚 nickname');
      assert.ok(result.includes('OpenAI 家族共享'), 'missing shared home prompt marker');
      assert.ok(result.includes('@gpt52'), 'missing gpt52 handle');
      assert.ok(result.includes('@spark'), 'missing spark handle');
      assert.ok(result.includes('默认按 `@codex` 行事'), 'missing default cat guard');
    });

    it('should include dynamic collab rules from cat-config roster', () => {
      const result = renderForCodex(SHARDS_DIR);
      const config = JSON.parse(readFileSync(join(REPO_ROOT, 'cat-config.json'), 'utf-8')) as {
        roster: Record<string, unknown>;
      };
      assert.ok(result.includes('@opus'), 'missing @opus handle');
      assert.ok(result.includes('@opencode'), 'missing @opencode handle');
      assert.ok(result.includes(`共 ${Object.keys(config.roster).length} 只猫`), 'missing dynamic roster count');
      assert.ok(result.includes('到我这里结束了吗'), 'missing exit check');
    });

    it('should produce valid markdown', () => {
      const result = renderForCodex(SHARDS_DIR);
      assert.ok(result.startsWith('#'), 'should start with markdown heading');
      assert.ok(result.length > 100, 'should be substantial content');
    });
  });

  describe('renderForGemini', () => {
    it('should include governance-l0 content', () => {
      const result = renderForGemini(SHARDS_DIR);
      assert.ok(result.includes('家规'), 'missing 家规');
      assert.ok(result.includes('P1'), 'missing P1 principle');
    });

    it('should include shared Gemini identity', () => {
      const result = renderForGemini(SHARDS_DIR);
      assert.ok(result.includes('烁烁'), 'missing 烁烁 nickname');
      assert.ok(result.includes('Gemini 家族共享'), 'missing shared Gemini prompt marker');
      assert.ok(result.includes('@gemini25'), 'missing gemini25 handle');
    });

    it('should include language instruction', () => {
      const result = renderForGemini(SHARDS_DIR);
      assert.ok(result.includes('中文'), 'missing 中文 instruction');
    });
  });

  describe('checkDrift', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'sync-prompt-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should detect drift when target differs from rendered', () => {
      const targetPath = join(tmpDir, 'AGENTS.md');
      writeFileSync(targetPath, 'old stale content');

      const target: SyncTarget = {
        name: 'codex',
        render: () => 'new rendered content',
        targetPath,
      };

      const result = checkDrift(target);
      assert.equal(result.drifted, true, 'should detect drift');
      assert.equal(result.name, 'codex');
    });

    it('should report no drift when synchronized', () => {
      const rendered = 'exact same content';
      const targetPath = join(tmpDir, 'AGENTS.md');
      writeFileSync(targetPath, rendered);

      const target: SyncTarget = {
        name: 'codex',
        render: () => rendered,
        targetPath,
      };

      const result = checkDrift(target);
      assert.equal(result.drifted, false, 'should not detect drift');
    });

    it('should report drift when target file does not exist', () => {
      const target: SyncTarget = {
        name: 'codex',
        render: () => 'some content',
        targetPath: join(tmpDir, 'nonexistent.md'),
      };

      const result = checkDrift(target);
      assert.equal(result.drifted, true, 'missing file = drifted');
    });
  });

  describe('buildTargets with custom targetRoot (CI support)', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'sync-prompt-ci-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should use custom targetRoot instead of homedir', () => {
      const targets = buildTargets(SHARDS_DIR, tmpDir);
      assert.ok(targets[0].targetPath.startsWith(tmpDir), 'codex target should use custom root');
      assert.ok(targets[1].targetPath.startsWith(tmpDir), 'gemini target should use custom root');
    });

    it('should reject a flag as --target-root value (CLI validation)', () => {
      // Exercises the actual CLI parser in main(), not buildTargets().
      // --target-root --dry-run should exit 2 because --dry-run is a flag, not a dir.
      const scriptPath = join(REPO_ROOT, 'scripts', 'sync-system-prompts.ts');
      try {
        execFileSync('npx', ['tsx', scriptPath, '--apply', '--target-root', '--dry-run'], {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        assert.fail('should have exited with error');
      } catch (err: unknown) {
        const e = err as { status: number; stderr: string };
        assert.equal(e.status, 2, 'should exit with code 2');
        assert.ok(e.stderr.includes('--target-root requires a directory'), 'should print validation error');
      }
    });

    it('should detect no drift after apply to custom targetRoot', () => {
      const targets = buildTargets(SHARDS_DIR, tmpDir);
      // Simulate apply: create all necessary directories and write rendered content
      for (const target of targets) {
        const dir = dirname(target.targetPath);
        mkdirSync(dir, { recursive: true });
        writeFileSync(target.targetPath, target.render(), 'utf-8');
      }
      // Now check — should be synced
      for (const target of targets) {
        const result = checkDrift(target);
        assert.equal(result.drifted, false, `${target.name} should not be drifted after apply`);
      }
    });

    it('should include hook targets in buildTargets', () => {
      const targets = buildTargets(SHARDS_DIR, tmpDir);
      const names = targets.map((t) => t.name);
      assert.ok(names.includes('hooks/session-start'), 'missing session-start hook target');
      assert.ok(names.includes('hooks/session-stop'), 'missing session-stop hook target');
      assert.ok(names.includes('codex-hooks'), 'missing codex-hooks target');
    });
  });
});
