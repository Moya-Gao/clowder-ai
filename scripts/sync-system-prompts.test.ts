import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildTargets, checkDrift, renderForCodex, renderForGemini, type SyncTarget } from './sync-system-prompts.js';

// Use the real shards from the repo
const REPO_ROOT = join(__dirname, '..');
const SHARDS_DIR = join(REPO_ROOT, 'assets', 'system-prompts');

describe('sync-system-prompts', () => {
  describe('renderForCodex', () => {
    // F203 codex user-layer strip: 缅因猫已切到 native developer_instructions
    // L0（压缩免疫层）。`~/.codex/AGENTS.md` 这条 F050 user-layer fallback 路径
    // 已退役——Codex CLI 默认 prepend 它到 user message，与 developer L0 重复
    // 注入身份/家规/队友。renderForCodex 渲染空字符串让 `--apply` 清空该文件。
    it('renders empty (codex migrated to native developer L0)', () => {
      assert.equal(renderForCodex(), '', 'codex AGENTS.md should render empty');
    });
  });

  describe('renderForGemini', () => {
    // F203 Phase H: ~/.gemini/GEMINI.md home-file 退役为空。暹罗猫身份由 runtime
    // 每次 prompt-prepend 提供（GeminiAgentService 的 gemini-cli / antigravity-cli
    // 两个 adapter 都把 options.systemPrompt 拼进 prompt），home-file 是冗余的双重
    // 注入；且被 Antigravity IDE Global Rules + AGY CLI global context 误读为身份源
    // → 在 IDE 里选任意模型都会被灌成"烁烁"。照 renderForCodex(KD-14) 退役方式。
    it('renders empty (gemini home-file retired, identity via runtime prepend)', () => {
      assert.equal(renderForGemini(), '', 'gemini ~/.gemini/GEMINI.md should render empty');
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
