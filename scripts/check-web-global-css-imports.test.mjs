import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const XTERM_CSS_IMPORT_RE = /\bimport\s*(['"])@xterm\/xterm\/css\/xterm\.css\1\s*;?/;
const XTERM_STYLESHEET_LINK_RE =
  /<link\s+[^>]*rel=(['"])stylesheet\1[^>]*href=(['"])\/vendor\/xterm\/xterm\.css\2[^>]*\/?>/;
const WEB_SRC = join(ROOT, 'packages/web/src');

function hasXtermCssImport(source) {
  return XTERM_CSS_IMPORT_RE.test(source);
}

function hasXtermStylesheetLink(source) {
  return XTERM_STYLESHEET_LINK_RE.test(source);
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

test('xterm global CSS is linked from the Next root layout and never imported through JS', () => {
  const layoutPath = join(WEB_SRC, 'app/layout.tsx');
  const layoutSource = readFileSync(layoutPath, 'utf8');
  assert.equal(hasXtermStylesheetLink(layoutSource), true);

  const offenders = walk(WEB_SRC)
    .filter((file) => hasXtermCssImport(readFileSync(file, 'utf8')))
    .map((file) => relative(ROOT, file));

  assert.deepEqual(offenders, []);
});

test('xterm CSS import detector catches syntax variants', () => {
  const variants = [
    'import "@xterm/xterm/css/xterm.css";',
    "import '@xterm/xterm/css/xterm.css'",
    "import  '@xterm/xterm/css/xterm.css' ;",
    'import\n  "@xterm/xterm/css/xterm.css";',
  ];

  for (const source of variants) {
    assert.equal(hasXtermCssImport(source), true, source);
  }
});

test('xterm stylesheet is copied into the public vendor directory before dev/build', () => {
  const syncScript = readFileSync(join(ROOT, 'packages/web/scripts/sync-vendor-assets.mjs'), 'utf8');

  assert.match(syncScript, /@xterm\/xterm/);
  assert.match(syncScript, /xterm\.css/);
  assert.match(syncScript, /vendorRoot,\s*['"]xterm['"],\s*['"]xterm\.css['"]/);
});
