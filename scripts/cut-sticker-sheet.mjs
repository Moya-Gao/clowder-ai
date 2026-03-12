#!/usr/bin/env node
/**
 * Sticker Sheet Cutter — F054 Phase 1.5
 *
 * Cuts a 4×4 sticker sheet into 16 individual sticker PNGs.
 *
 * Usage:
 *   node scripts/cut-sticker-sheet.mjs <sheet.png> <cat> [--rows=4] [--cols=4]
 *
 * Example:
 *   node scripts/cut-sticker-sheet.mjs assets/stickers/opus_sheet_poc.png opus
 *   node scripts/cut-sticker-sheet.mjs assets/stickers/maine_sheet.png maine --rows=4 --cols=4
 *
 * Output:
 *   assets/stickers/<cat>/01_happy.png
 *   assets/stickers/<cat>/02_thinking.png
 *   ...
 *   assets/stickers/<cat>/manifest.json
 */

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');

// Default sticker names matching F054 spec order
const DEFAULT_NAMES = [
  // Row 1
  'happy', 'thinking', 'confused', 'shocked',
  // Row 2
  'lgtm', 'sleeping', 'smirk', 'guilty',
  // Row 3
  'angry', 'punch', 'got_it', 'melting',
  // Row 4 (exclusive — will be overridden per cat)
  'exclusive_1', 'exclusive_2', 'exclusive_3', 'exclusive_4',
];

// Per-cat exclusive sticker names (Row 4)
const EXCLUSIVE_NAMES = {
  opus: ['wallet_burning', 'architecting', 'processing', 'deep_thinking'],
  maine: ['rejected', 'reviewing', 'slap', 'studying'],
  siam: ['eureka', 'painting', 'style_police', 'night_owl'],
};

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key] = val ? Number(val) : true;
    } else {
      positional.push(arg);
    }
  }

  const sheetPath = positional[0];
  const cat = positional[1];

  if (!sheetPath || !cat) {
    console.error('Usage: node scripts/cut-sticker-sheet.mjs <sheet.png> <cat> [--rows=4] [--cols=4]');
    console.error('  cat: opus | maine | siam');
    process.exit(1);
  }

  return {
    sheetPath,
    cat,
    rows: flags.rows || 4,
    cols: flags.cols || 4,
  };
}

async function main() {
  const { sheetPath, cat, rows, cols } = parseArgs();
  const totalCells = rows * cols;

  // Build sticker names
  const names = [...DEFAULT_NAMES.slice(0, 12)];
  const exclusives = EXCLUSIVE_NAMES[cat] || DEFAULT_NAMES.slice(12, 16);
  names.push(...exclusives);

  if (names.length < totalCells) {
    for (let i = names.length; i < totalCells; i++) {
      names.push(`extra_${i + 1}`);
    }
  }

  // Read sheet dimensions
  const image = sharp(sheetPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  console.log(`Sheet: ${width}×${height}, Grid: ${cols}×${rows} = ${totalCells} cells`);

  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);
  console.log(`Cell size: ${cellWidth}×${cellHeight}`);

  // Output directory
  const outDir = path.join('assets', 'stickers', cat);
  await mkdir(outDir, { recursive: true });

  const manifest = {
    cat,
    sheetSource: sheetPath,
    generatedAt: new Date().toISOString(),
    stickers: [],
  };

  // Cut each cell
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (index >= totalCells) break;

      const name = names[index];
      const filename = `${String(index + 1).padStart(2, '0')}_${name}.png`;
      const outPath = path.join(outDir, filename);

      const left = col * cellWidth;
      const top = row * cellHeight;

      await sharp(sheetPath)
        .extract({ left, top, width: cellWidth, height: cellHeight })
        .trim()  // Remove whitespace borders
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(outPath);

      console.log(`  ✅ ${filename}`);

      manifest.stickers.push({
        index: index + 1,
        name,
        file: filename,
        category: index < 12 ? 'common' : 'exclusive',
      });
    }
  }

  // Write manifest
  const manifestPath = path.join(outDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n📋 Manifest: ${manifestPath}`);
  console.log(`✅ Done! ${manifest.stickers.length} stickers cut to ${outDir}/`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
