import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { buildDeck } from '../src/slide-builder.js';
import type { DeckBlueprint, ThemeTokens } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf-8'));
}

function loadTheme(): ThemeTokens {
  return JSON.parse(
    readFileSync(join(__dirname, '..', 'src', 'themes', 'huawei-like.json'), 'utf-8'),
  );
}

describe('CJK Chart Font POC (release-gate P1)', () => {
  it('chart XML contains CJK font reference from theme', async () => {
    const blueprint = loadFixture<DeckBlueprint>('huawei-demo-blueprint.json');
    const theme = loadTheme();
    const pres = buildDeck(blueprint, theme);

    // Generate pptx as buffer
    const buf = await pres.write({ outputType: 'nodebuffer' });

    // pptx is a zip — extract chart XML files
    const zip = await JSZip.loadAsync(buf);

    const chartFiles: string[] = [];
    zip.forEach((path, _entry) => {
      if (path.startsWith('ppt/charts/') && path.endsWith('.xml')) {
        chartFiles.push(path);
      }
    });

    assert.ok(chartFiles.length > 0, 'Should have at least one chart XML');

    // Check each chart XML for CJK font reference (theme.brand.typography.cjkFont)
    const expectedFont = theme.brand.typography.cjkFont;
    let foundCJKFont = false;
    for (const chartFile of chartFiles) {
      const xml = await zip.file(chartFile)!.async('string');
      if (xml.includes(expectedFont)) {
        foundCJKFont = true;
        console.log(`  → CJK font "${expectedFont}" found in ${chartFile}`);
      }
    }

    assert.ok(foundCJKFont, `At least one chart should reference ${expectedFont}`);
  });

  it('chart XML contains Chinese category labels', async () => {
    const blueprint = loadFixture<DeckBlueprint>('huawei-demo-blueprint.json');
    const theme = loadTheme();
    const pres = buildDeck(blueprint, theme);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    const zip = await JSZip.loadAsync(buf);

    const chartFiles: string[] = [];
    zip.forEach((path) => {
      if (path.startsWith('ppt/charts/') && path.endsWith('.xml')) {
        chartFiles.push(path);
      }
    });

    // The full-chart slide has Chinese month labels (1月, 2月, ...)
    let foundChinese = false;
    for (const chartFile of chartFiles) {
      const xml = await zip.file(chartFile)!.async('string');
      if (xml.includes('1月') || xml.includes('月')) {
        foundChinese = true;
        console.log(`  → Chinese labels found in ${chartFile}`);
      }
    }

    assert.ok(foundChinese, 'At least one chart should contain Chinese category labels');
  });
});
