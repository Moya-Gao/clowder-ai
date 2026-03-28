#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDeck } from './slide-builder.js';
import type { DeckBlueprint, ThemeTokens } from './types.js';

function usage(): never {
  console.error('Usage: ppt-forge <blueprint.json> <theme.json> <output.pptx>');
  process.exit(1);
}

async function main() {
  const [blueprintPath, themePath, outputPath] = process.argv.slice(2);

  if (!blueprintPath || !themePath || !outputPath) {
    usage();
  }

  const blueprint: DeckBlueprint = JSON.parse(
    readFileSync(resolve(blueprintPath), 'utf-8'),
  );
  const theme: ThemeTokens = JSON.parse(
    readFileSync(resolve(themePath), 'utf-8'),
  );

  console.log(`[ppt-forge] Building "${blueprint.meta.title}" (${blueprint.slides.length} slides)...`);

  const pres = buildDeck(blueprint, theme);

  await pres.writeFile({ fileName: resolve(outputPath) });

  console.log(`[ppt-forge] ✓ Written to ${outputPath}`);
}

main().catch(err => {
  console.error('[ppt-forge] Fatal:', err.message);
  process.exit(1);
});
