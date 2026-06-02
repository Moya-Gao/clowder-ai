/**
 * Tests for `scripts/video-forge/new-project.mjs` — F138 AC-1g scaffold
 *
 * Validates:
 * - Directory creation with correct structure
 * - Template file generation (voice-script.md, asset-markers.md, video-spec.json, brief.md)
 * - --type flag affects template content
 * - --style flag stored in spec (reserved for style-recipes AC-1i)
 * - Idempotency guard (refuses to overwrite existing project)
 * - Absolute & relative slug paths
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const SCRIPT = join(import.meta.dirname, '../../scripts/video-forge/new-project.mjs');
const run = (args, cwd) => exec('node', [SCRIPT, ...args], { cwd, env: { ...process.env } });

describe('video:new scaffold (AC-1g)', () => {
  let tempDir;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'video-new-test-'));
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates project directory with all expected files', async () => {
    const slug = 'test-video-01';
    await run([slug, '--base-dir', tempDir]);

    const projectDir = join(tempDir, slug);
    const entries = await readdir(projectDir);

    assert.ok(entries.includes('voice-script.md'), 'missing voice-script.md');
    assert.ok(entries.includes('asset-markers.md'), 'missing asset-markers.md');
    assert.ok(entries.includes('video-spec.json'), 'missing video-spec.json');
    assert.ok(entries.includes('brief.md'), 'missing brief.md');
    assert.ok(entries.includes('assets'), 'missing assets/');

    // assets/ should have .gitkeep
    const assetsEntries = await readdir(join(projectDir, 'assets'));
    assert.ok(assetsEntries.includes('.gitkeep'), 'missing assets/.gitkeep');
  });

  it('voice-script.md has correct frontmatter', async () => {
    const slug = 'test-voice-fm';
    await run([slug, '--base-dir', tempDir]);

    const content = await readFile(join(tempDir, slug, 'voice-script.md'), 'utf-8');
    assert.ok(content.includes('feature_ids: [F138]'), 'missing feature_ids');
    assert.ok(content.includes('doc_kind: voice-script'), 'missing doc_kind');
    assert.ok(content.includes('status: draft'), 'voice-script should start as draft');
    assert.ok(content.includes('## 完整剧本'), 'missing script section');
    assert.ok(content.includes('## 分段对照表'), 'missing segment table');
  });

  it('video-spec.json has valid structure', async () => {
    const slug = 'test-spec-struct';
    await run([slug, '--base-dir', tempDir]);

    const raw = await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8');
    const spec = JSON.parse(raw);

    assert.equal(spec.id, 'test-spec-struct');
    assert.equal(spec.version, 1);
    assert.equal(spec.status, 'editorial', 'video-spec status must match schema enum');
    assert.ok(spec.meta, 'missing meta');
    assert.equal(spec.meta.resolution.width, 1920);
    assert.equal(spec.meta.resolution.height, 1080);
    assert.equal(spec.meta.fps, 30);
    assert.ok(spec.global_audio, 'missing global_audio');
    assert.deepEqual(spec.segments, []);
  });

  it('--type=knowledge-explainer sets type in spec and brief', async () => {
    const slug = 'test-type-ke';
    await run([slug, '--base-dir', tempDir, '--type', 'knowledge-explainer']);

    const spec = JSON.parse(await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8'));
    assert.equal(spec.meta.type, 'knowledge-explainer');

    const brief = await readFile(join(tempDir, slug, 'brief.md'), 'utf-8');
    assert.ok(brief.includes('knowledge-explainer'), 'brief should mention type');
  });

  it('--type=showcase sets type correctly', async () => {
    const slug = 'test-type-sc';
    await run([slug, '--base-dir', tempDir, '--type', 'showcase']);

    const spec = JSON.parse(await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8'));
    assert.equal(spec.meta.type, 'showcase');
  });

  it('--type=tutorial sets type correctly', async () => {
    const slug = 'test-type-tut';
    await run([slug, '--base-dir', tempDir, '--type', 'tutorial']);

    const spec = JSON.parse(await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8'));
    assert.equal(spec.meta.type, 'tutorial');
  });

  it('defaults to type=general when --type not specified', async () => {
    const slug = 'test-type-default';
    await run([slug, '--base-dir', tempDir]);

    const spec = JSON.parse(await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8'));
    assert.equal(spec.meta.type, 'general');
  });

  it('--style stores style name in spec', async () => {
    const slug = 'test-style';
    await run([slug, '--base-dir', tempDir, '--style', 'minimalist-tech']);

    const spec = JSON.parse(await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8'));
    assert.equal(spec.meta.style, 'minimalist-tech');
  });

  it('refuses to overwrite existing project', async () => {
    const slug = 'test-idempotent';
    // First creation succeeds
    await run([slug, '--base-dir', tempDir]);
    // Second creation should fail
    await assert.rejects(() => run([slug, '--base-dir', tempDir]), /already exists/i);
  });

  it('fails gracefully without slug argument', async () => {
    await assert.rejects(() => run(['--base-dir', tempDir]), /usage|slug/i);
  });

  it('asset-markers.md has correct template', async () => {
    const slug = 'test-markers';
    await run([slug, '--base-dir', tempDir]);

    const content = await readFile(join(tempDir, slug, 'asset-markers.md'), 'utf-8');
    assert.ok(content.includes('feature_ids: [F138]'), 'missing feature_ids');
    assert.ok(content.includes('doc_kind: asset-manifest'), 'missing doc_kind');
    assert.ok(content.includes('素材存放位置'), 'missing asset location section');
  });

  it('brief.md contains project slug and type', async () => {
    const slug = 'my-cool-video';
    await run([slug, '--base-dir', tempDir, '--type', 'knowledge-explainer']);

    const content = await readFile(join(tempDir, slug, 'brief.md'), 'utf-8');
    assert.ok(content.includes('my-cool-video'), 'brief should contain slug');
    assert.ok(content.includes('knowledge-explainer'), 'brief should contain type');
  });

  it('pipeline.sh path printed in success output', async () => {
    const slug = 'test-output-msg';
    const { stdout } = await run([slug, '--base-dir', tempDir]);
    assert.ok(stdout.includes('pipeline.sh'), 'should mention pipeline.sh as next step');
  });

  // --- P1-1: video-spec must match schema ---
  it('video-spec.json status is "editorial" (schema-valid)', async () => {
    const slug = 'test-schema-status';
    await run([slug, '--base-dir', tempDir]);

    const spec = JSON.parse(await readFile(join(tempDir, slug, 'video-spec.json'), 'utf-8'));
    assert.ok(['editorial', 'render-ready'].includes(spec.status), `status "${spec.status}" not in schema enum`);
  });

  // --- P1-2: slug path traversal ---
  it('rejects slug with path traversal (../)', async () => {
    await assert.rejects(() => run(['../escape', '--base-dir', tempDir]), /invalid.*slug/i);
  });

  it('rejects slug with slash', async () => {
    await assert.rejects(() => run(['sub/dir', '--base-dir', tempDir]), /invalid.*slug/i);
  });

  it('rejects slug starting with dot', async () => {
    await assert.rejects(() => run(['.hidden', '--base-dir', tempDir]), /invalid.*slug/i);
  });

  // --- P2: --base-dir should use actual project path in output ---
  it('brief.md uses actual project path with --base-dir', async () => {
    const slug = 'test-basedir-path';
    await run([slug, '--base-dir', tempDir]);

    const brief = await readFile(join(tempDir, slug, 'brief.md'), 'utf-8');
    // Should reference the actual path, not hardcoded docs/videos/
    assert.ok(brief.includes(join(tempDir, slug).replace(/\\/g, '/')), 'brief should contain actual project path');
  });

  it('stdout uses actual project path with --base-dir', async () => {
    const slug = 'test-stdout-path';
    const { stdout } = await run([slug, '--base-dir', tempDir]);
    // Should show actual project dir in the pipeline.sh command
    assert.ok(stdout.includes(slug), 'stdout should contain slug');
    assert.ok(
      !stdout.includes('docs/videos/') || stdout.includes(tempDir),
      'stdout should not hardcode docs/videos/ with --base-dir',
    );
  });

  // --- P2 R2: in-repo projects use relative paths (no /Users/...) ---
  it('in-repo scaffold uses relative path in templates (no absolute)', async () => {
    const slug = 'test-relpath';
    // Use a subdir of the repo's docs/videos/ to trigger in-repo detection
    const repoVideosDir = join(import.meta.dirname, '../../docs/videos');
    await run([slug, '--base-dir', repoVideosDir]);

    try {
      const brief = await readFile(join(repoVideosDir, slug, 'brief.md'), 'utf-8');
      // Should contain relative path like docs/videos/test-relpath, not /Users/...
      assert.ok(brief.includes(`docs/videos/${slug}`), 'brief should contain relative path');
      assert.ok(!brief.includes('/Users/'), 'brief should NOT contain absolute /Users/ path');

      const { stdout } = await run([`${slug}-stdout`, '--base-dir', repoVideosDir]);
      assert.ok(stdout.includes(`docs/videos/${slug}-stdout`), 'stdout should contain relative path');
      assert.ok(!stdout.includes('/Users/'), 'stdout should NOT contain absolute /Users/ path');
    } finally {
      // Cleanup: remove test directories from repo
      await rm(join(repoVideosDir, slug), { recursive: true, force: true });
      await rm(join(repoVideosDir, `${slug}-stdout`), { recursive: true, force: true });
    }
  });
});
