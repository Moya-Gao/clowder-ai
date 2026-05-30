import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const XTERM_CSS_IMPORT_RE = /\bimport\s*(['"])@xterm\/xterm\/css\/xterm\.css\1\s*;?/;
const XTERM_STYLESHEET_LINK_RE =
  /<link\s+[^>]*rel=(['"])stylesheet\1[^>]*href=(['"])\/vendor\/xterm\/xterm\.css\2[^>]*\/?>/;
const APP_STATIC_CSS_FILES = [
  'theme-tokens.css',
  'cat-persona-tokens.css',
  'cat-persona-derived.css',
  'connector-tokens.css',
  'theme-extras.css',
  'console-tokens.css',
  'console-shell.css',
  'console-controls.css',
  'werewolf-theme.css',
];
const WEB_SRC = join(ROOT, 'packages/web/src');

function hasXtermCssImport(source) {
  return XTERM_CSS_IMPORT_RE.test(source);
}

function hasXtermStylesheetLink(source) {
  return XTERM_STYLESHEET_LINK_RE.test(source);
}

function hasAppStaticCssImport(source, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pathPattern = `(?:[^'")]*\\/)?${escaped}`;
  const jsImport = new RegExp(`\\bimport\\s*(?:\\(\\s*)?(?:[^'"()]+\\s+from\\s+)?(['"])${pathPattern}\\1\\s*;?`);
  const cssImport = new RegExp(`@import\\s+(?:url\\(\\s*)?(['"]?)${pathPattern}\\1\\s*\\)?\\s*;?`);
  return jsImport.test(source) || cssImport.test(source);
}

function hasAppStaticCssStylesheetLink(source, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<link\\s+[^>]*rel=(['"])stylesheet\\1[^>]*href=(['"])/vendor/app/${escaped}\\2[^>]*/?>`).test(
    source,
  );
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.isFile() && /\.(tsx?|jsx?|css)$/.test(entry.name)) {
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

test('app static global CSS is linked from the Next root layout and never imported through source files', () => {
  const layoutPath = join(WEB_SRC, 'app/layout.tsx');
  const layoutSource = readFileSync(layoutPath, 'utf8');

  for (const fileName of APP_STATIC_CSS_FILES) {
    assert.equal(hasAppStaticCssStylesheetLink(layoutSource, fileName), true, `${fileName} is linked`);
  }

  const offenders = [];
  for (const file of walk(WEB_SRC)) {
    // Skip test files — they reference CSS filenames in assertions, not as real imports
    if (file.includes('__tests__')) continue;
    const source = readFileSync(file, 'utf8');
    for (const fileName of APP_STATIC_CSS_FILES) {
      if (hasAppStaticCssImport(source, fileName)) {
        offenders.push(`${relative(ROOT, file)} imports ${fileName}`);
      }
    }
  }

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

test('app static CSS import detector catches syntax variants', () => {
  const variants = [
    'import "./connector-tokens.css";',
    "import './connector-tokens.css'",
    "import  './connector-tokens.css' ;",
    'import\n  "./connector-tokens.css";',
    'import "@/app/connector-tokens.css";',
    'import "../app/connector-tokens.css";',
    'import styles from "./connector-tokens.css";',
    'import("./connector-tokens.css");',
    '@import "./connector-tokens.css";',
    '@import url("./connector-tokens.css");',
    "@import url('../app/connector-tokens.css');",
    '@import url(@/app/connector-tokens.css);',
  ];

  for (const source of variants) {
    assert.equal(hasAppStaticCssImport(source, 'connector-tokens.css'), true, source);
  }
});

test('xterm stylesheet is copied into the public vendor directory before dev/build', () => {
  const syncScript = readFileSync(join(ROOT, 'packages/web/scripts/sync-vendor-assets.mjs'), 'utf8');

  assert.match(syncScript, /@xterm\/xterm/);
  assert.match(syncScript, /xterm\.css/);
  assert.match(syncScript, /vendorRoot,\s*['"]xterm['"],\s*['"]xterm\.css['"]/);
});

test('app static stylesheets are copied into the public vendor directory before dev/build', () => {
  const syncScript = readFileSync(join(ROOT, 'packages/web/scripts/sync-vendor-assets.mjs'), 'utf8');

  for (const fileName of APP_STATIC_CSS_FILES) {
    assert.match(syncScript, new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(syncScript, /resolve\(vendorRoot,\s*['"]app['"],\s*file\)/);
});

test('app static stylesheets are watched while Next dev runs', () => {
  const webPackage = JSON.parse(readFileSync(join(ROOT, 'packages/web/package.json'), 'utf8'));
  const startDev = readFileSync(join(ROOT, 'scripts/start-dev.sh'), 'utf8');
  const syncScript = readFileSync(join(ROOT, 'packages/web/scripts/sync-vendor-assets.mjs'), 'utf8');

  assert.match(webPackage.scripts.dev, /sync-vendor-assets\.mjs --watch -- next dev/);
  assert.match(startDev, /sync-vendor-assets\.mjs --watch -- next dev/);
  assert.doesNotMatch(startDev, /sync-vendor-assets\.mjs --watch -- pnpm exec next dev/);
  assert.match(syncScript, /watch\(resolve\(webRoot,\s*['"]src['"],\s*['"]app['"]\)/);
  assert.match(syncScript, /appGlobalCssFiles\.includes\(file\)/);
  assert.match(syncScript, /file\.includes\(['"]\.css\.['"]\)/);
  assert.doesNotMatch(syncScript, /watch\(src,/);
});
