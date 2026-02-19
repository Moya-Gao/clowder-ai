import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const { parseLegacyArticles } = await import('../dist/scripts/migrate-signals/legacy-article-parser.js');

describe('legacy article parser', () => {
  it('parses YYYY-MM-DD filename prefixes when frontmatter date is missing', async () => {
    const libraryDir = await mkdtemp(join(tmpdir(), 'legacy-article-parser-'));
    const sourceDir = join(libraryDir, 'anthropic');
    await mkdir(sourceDir, { recursive: true });

    const filePath = join(sourceDir, '2026-01-23-agent-update.md');
    await writeFile(
      filePath,
      [
        '---',
        'title: "Agent update"',
        'url: "https://example.com/agent-update"',
        '---',
        '',
        'content',
        '',
      ].join('\n'),
      'utf-8',
    );

    const articles = await parseLegacyArticles(libraryDir);

    assert.equal(articles.length, 1);
    assert.equal(articles[0].publishedAt, '2026-01-23');
    assert.equal(articles[0].fetchedAt, '2026-01-23');
  });
});
