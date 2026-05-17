import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const XTERM_CSS_IMPORT_RE = /\bimport\s*(['"])@xterm\/xterm\/css\/xterm\.css\1\s*;?/;
const WEB_SRC = join(ROOT, 'packages/web/src');

function hasXtermCssImport(source) {
  return XTERM_CSS_IMPORT_RE.test(source);
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

test('xterm global CSS is imported only from the Next root layout', () => {
  const layoutPath = join(WEB_SRC, 'app/layout.tsx');
  const layoutSource = readFileSync(layoutPath, 'utf8');
  assert.equal(hasXtermCssImport(layoutSource), true);

  const offenders = walk(WEB_SRC)
    .filter((file) => file !== layoutPath)
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
