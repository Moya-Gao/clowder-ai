import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

interface PackageJson {
  main?: unknown;
  types?: unknown;
  exports?: { '.'?: { import?: unknown; types?: unknown } };
  scripts?: { build?: unknown };
  engines?: { node?: unknown };
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')) as PackageJson;
}

function readTsconfig(): { compilerOptions?: { noEmit?: unknown } } {
  return JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'tsconfig.json'), 'utf8')) as {
    compilerOptions?: { noEmit?: unknown };
  };
}

test('package exports point at files that exist in this source-runnable spike package', () => {
  const pkg = readPackageJson();
  const exportedImport = pkg.exports?.['.']?.import;
  const exportedTypes = pkg.exports?.['.']?.types;
  const paths = [pkg.main, pkg.types, exportedImport, exportedTypes];

  for (const p of paths) {
    assert.equal(typeof p, 'string', 'package entrypoints must be explicit strings');
    assert.equal(existsSync(resolve(PACKAGE_ROOT, p)), true, `${p} must exist`);
  }
});

test('noEmit package entrypoints do not target dist artifacts', () => {
  const pkg = readPackageJson();
  const tsconfig = readTsconfig();
  assert.equal(pkg.scripts?.build, 'tsc --noEmit');
  assert.equal(tsconfig.compilerOptions?.noEmit, true);

  const exportedImport = pkg.exports?.['.']?.import;
  const exportedTypes = pkg.exports?.['.']?.types;
  const paths = [pkg.main, pkg.types, exportedImport, exportedTypes];

  for (const p of paths) {
    assert.equal(typeof p, 'string', 'package entrypoints must be explicit strings');
    assert.equal(p.startsWith('./dist/'), false, `${p} must not point at dist when build is noEmit`);
  }
});

test('package declares the Node floor required by node:sqlite', () => {
  const pkg = readPackageJson();
  assert.equal(pkg.engines?.node, '>=24.0.0');
});

test('runtime parser dependencies are available outside dev installs', () => {
  const pkg = readPackageJson();
  assert.equal(typeof pkg.dependencies?.typescript, 'string');
  assert.equal(pkg.devDependencies?.typescript, undefined);
});
