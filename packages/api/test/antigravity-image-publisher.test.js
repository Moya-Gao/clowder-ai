import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

describe('antigravity-image-publisher', () => {
  const tempDirs = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  async function makeTempDir(prefix) {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  describe('extractAbsoluteImagePaths', () => {
    it('extracts absolute image paths from text', async () => {
      const { extractAbsoluteImagePaths } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const text = 'Saved image to /tmp/output/cat.png and /home/user/dog.jpeg';
      const paths = extractAbsoluteImagePaths(text);

      assert.deepEqual(paths, ['/tmp/output/cat.png', '/home/user/dog.jpeg']);
    });

    it('returns empty array for text without image paths', async () => {
      const { extractAbsoluteImagePaths } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      assert.deepEqual(extractAbsoluteImagePaths('no paths here'), []);
      assert.deepEqual(extractAbsoluteImagePaths(''), []);
      assert.deepEqual(extractAbsoluteImagePaths(null), []);
      assert.deepEqual(extractAbsoluteImagePaths(undefined), []);
    });

    it('deduplicates paths', async () => {
      const { extractAbsoluteImagePaths } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const text = '/tmp/cat.png was saved. Check /tmp/cat.png for the result.';
      const paths = extractAbsoluteImagePaths(text);

      assert.deepEqual(paths, ['/tmp/cat.png']);
    });

    it('extracts paths from quoted strings', async () => {
      const { extractAbsoluteImagePaths } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const text = 'Output: "/tmp/result.webp"';
      const paths = extractAbsoluteImagePaths(text);

      assert.deepEqual(paths, ['/tmp/result.webp']);
    });

    it('ignores relative paths', async () => {
      const { extractAbsoluteImagePaths } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const text = 'See ./output/image.png and ../other.jpg';
      assert.deepEqual(extractAbsoluteImagePaths(text), []);
    });

    it('ignores non-image extensions', async () => {
      const { extractAbsoluteImagePaths } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const text = '/tmp/data.json /tmp/code.ts /tmp/notes.txt';
      assert.deepEqual(extractAbsoluteImagePaths(text), []);
    });
  });

  describe('collectImagePathsFromSteps', () => {
    it('collects paths only from image-gen tool result steps', async () => {
      const { collectImagePathsFromSteps } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const steps = [
        { type: 'CORTEX_STEP_TYPE_TOOL_RESULT', status: 'done', toolResult: { toolName: 'image_gen', output: 'Saved /tmp/a.png' } },
        { type: 'CORTEX_STEP_TYPE_TOOL_CALL', status: 'done', toolCall: { toolName: 'something' } },
      ];

      const paths = collectImagePathsFromSteps(steps);
      assert.deepEqual(paths, ['/tmp/a.png']);
    });

    it('excludes paths from non-image-gen tool results', async () => {
      const { collectImagePathsFromSteps } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const steps = [
        { type: 'CORTEX_STEP_TYPE_TOOL_RESULT', status: 'done', toolResult: { toolName: 'list_files', output: 'Found /tmp/cat.png' } },
        { type: 'CORTEX_STEP_TYPE_TOOL_RESULT', status: 'done', toolResult: { output: 'Result: /tmp/mystery.jpg' } },
      ];

      const paths = collectImagePathsFromSteps(steps);
      assert.deepEqual(paths, [], 'non-image-gen tools should not have paths collected');
    });

    it('resolves tool name from metadata.toolCall.name fallback', async () => {
      const { collectImagePathsFromSteps } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const steps = [
        {
          type: 'CORTEX_STEP_TYPE_TOOL_RESULT',
          status: 'done',
          toolResult: { output: 'Saved /tmp/meta.png' },
          metadata: { toolCall: { name: 'image_gen' } },
        },
      ];

      const paths = collectImagePathsFromSteps(steps);
      assert.deepEqual(paths, ['/tmp/meta.png']);
    });

    it('excludes paths from runCommand steps (no false positives from ls/find)', async () => {
      const { collectImagePathsFromSteps } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const steps = [
        { type: 'CORTEX_STEP_TYPE_RUN_COMMAND', status: 'done', runCommand: { stdout: '/tmp/listed.png\n/tmp/found.jpg', commandLine: 'ls /tmp/*.png' } },
      ];

      const paths = collectImagePathsFromSteps(steps);
      assert.deepEqual(paths, [], 'runCommand stdout should not be scraped for image paths');
    });
  });

  describe('publishAntigravityImages', () => {
    it('publishes existing image files and skips non-existent ones', async () => {
      const { publishAntigravityImages } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const sourceDir = await makeTempDir('antigravity-src-');
      const uploadDir = await makeTempDir('antigravity-uploads-');
      const existingFile = join(sourceDir, 'generated.png');
      await writeFile(existingFile, Buffer.from('fake-png'));

      const results = await publishAntigravityImages({
        candidatePaths: [existingFile, '/nonexistent/path/image.png'],
        cascadeId: 'cascade-001',
        uploadDir,
      });

      assert.equal(results.length, 1);
      assert.match(results[0].urlPath, /^\/uploads\//);
      assert.equal(results[0].richBlock.kind, 'media_gallery');
      assert.equal(results[0].provenance.provider, 'antigravity');
    });

    it('skips paths already in /uploads/', async () => {
      const { publishAntigravityImages } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const uploadDir = await makeTempDir('antigravity-uploads-');

      const results = await publishAntigravityImages({
        candidatePaths: ['/some/path/uploads/existing.png'],
        cascadeId: 'cascade-002',
        uploadDir,
      });

      assert.deepEqual(results, []);
    });

    it('returns empty array when no valid images found', async () => {
      const { publishAntigravityImages } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const uploadDir = await makeTempDir('antigravity-uploads-');

      const results = await publishAntigravityImages({
        candidatePaths: ['/nonexistent/a.png', '/nonexistent/b.jpg'],
        cascadeId: 'cascade-003',
        uploadDir,
      });

      assert.deepEqual(results, []);
    });

    it('skips files with old mtime (P1-2: stale file safety)', async () => {
      const { publishAntigravityImages } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const sourceDir = await makeTempDir('antigravity-old-');
      const uploadDir = await makeTempDir('antigravity-uploads-');
      const oldFile = join(sourceDir, 'old-photo.png');
      await writeFile(oldFile, Buffer.from('old-png'));
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await utimes(oldFile, twoHoursAgo, twoHoursAgo);

      const results = await publishAntigravityImages({
        candidatePaths: [oldFile],
        cascadeId: 'cascade-old',
        uploadDir,
        maxAgeMs: 60 * 60 * 1000,
      });

      assert.equal(results.length, 0, 'should skip file with old mtime');
    });

    it('publishes same-basename files from different dirs as distinct artifacts (P2-2)', async () => {
      const { publishAntigravityImages } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const dir1 = await makeTempDir('dir1-');
      const dir2 = await makeTempDir('dir2-');
      const uploadDir = await makeTempDir('antigravity-uploads-');
      await writeFile(join(dir1, 'output.png'), Buffer.from('img-from-dir1'));
      await writeFile(join(dir2, 'output.png'), Buffer.from('img-from-dir2'));

      const results = await publishAntigravityImages({
        candidatePaths: [join(dir1, 'output.png'), join(dir2, 'output.png')],
        cascadeId: 'cascade-collision',
        uploadDir,
      });

      assert.equal(results.length, 2, 'both same-basename files should be published');
      assert.notEqual(results[0].urlPath, results[1].urlPath, 'should have distinct urlPaths');
    });

    it('returns only newly published images on repeated calls (P1-1 consistency)', async () => {
      const { publishAntigravityImages } = await import(
        '../dist/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.js'
      );

      const sourceDir = await makeTempDir('antigravity-repeat-');
      const uploadDir = await makeTempDir('antigravity-uploads-');
      await writeFile(join(sourceDir, 'fresh.png'), Buffer.from('fresh-img'));

      const opts = {
        candidatePaths: [join(sourceDir, 'fresh.png')],
        cascadeId: 'cascade-repeat',
        uploadDir,
      };

      const first = await publishAntigravityImages(opts);
      const second = await publishAntigravityImages(opts);

      assert.equal(first.length, 1);
      assert.equal(second.length, 0, 'second call should skip already-published');
    });
  });
});
