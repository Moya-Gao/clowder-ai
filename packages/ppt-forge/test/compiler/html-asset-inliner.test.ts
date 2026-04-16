import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { inlineLocalAssetUrls } from '../../src/compiler/html-asset-inliner.js';

const TMP_DIR = mkdtempSync(join(tmpdir(), 'ppt-forge-assets-'));

after(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('inlineLocalAssetUrls', () => {
  it('inlines local file:// image assets as data urls', () => {
    const pngPath = join(TMP_DIR, 'pixel.png');
    writeFileSync(
      pngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s8nK9sAAAAASUVORK5CYII=',
        'base64',
      ),
    );

    const fileUrl = pathToFileURL(pngPath).href;
    const html = `<div class="ppt-slide"><img src="${fileUrl}" alt="pixel" /></div>`;
    const inlined = inlineLocalAssetUrls(html);

    assert.match(inlined, /src="data:image\/png;base64,[A-Za-z0-9+/=]+"/);
    assert.doesNotMatch(inlined, /file:\/\//);
  });

  it('inlines when attribute has spaces around = (P2 — spaced attr)', () => {
    const pngPath = join(TMP_DIR, 'spaced.png');
    writeFileSync(
      pngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s8nK9sAAAAASUVORK5CYII=',
        'base64',
      ),
    );

    const fileUrl = pathToFileURL(pngPath).href;
    const html = `<img src = "${fileUrl}" />`;
    const inlined = inlineLocalAssetUrls(html);

    assert.match(inlined, /data:image\/png;base64,/);
    assert.doesNotMatch(inlined, /file:\/\//);
  });

  it('inlines when attribute is uppercase SRC (P2 — case insensitive)', () => {
    const pngPath = join(TMP_DIR, 'upper.png');
    writeFileSync(
      pngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s8nK9sAAAAASUVORK5CYII=',
        'base64',
      ),
    );

    const fileUrl = pathToFileURL(pngPath).href;
    const html = `<img SRC="${fileUrl}" />`;
    const inlined = inlineLocalAssetUrls(html);

    assert.match(inlined, /data:image\/png;base64,/);
    assert.doesNotMatch(inlined, /file:\/\//);
  });

  it('leaves html unchanged when no local file url exists', () => {
    const html = '<div class="ppt-slide"><p>hello</p></div>';
    assert.equal(inlineLocalAssetUrls(html), html);
  });

  it('skips non-image file:// href without throwing (R2-P2)', () => {
    const cssPath = join(TMP_DIR, 'style.css');
    writeFileSync(cssPath, 'body { color: red; }');

    const fileUrl = pathToFileURL(cssPath).href;
    const html = `<link href="${fileUrl}" rel="stylesheet" />`;
    const result = inlineLocalAssetUrls(html);

    // Should leave the href unchanged, not throw
    assert.match(result, /file:\/\//);
    assert.doesNotMatch(result, /data:/);
  });
});
