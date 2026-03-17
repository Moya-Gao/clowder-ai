/**
 * Port drift guard — ensures .env.example.opensource ports stay consistent
 * with sync-to-opensource.sh transforms.
 *
 * Root cause of clowder-ai#87 / #55 / #56: the .env.example.opensource had
 * API_SERVER_PORT and FRONTEND_PORT swapped relative to the code defaults
 * that sync-to-opensource.sh produces. This test prevents that from recurring.
 *
 * Convention (set by _sanitize-rules.pl + sync-to-opensource.sh):
 *   Home:        API=3002, Frontend=3001
 *   Open-source: API=3003, Frontend=3004
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(process.cwd());

function readEnvFile(relPath) {
  const content = readFileSync(resolve(ROOT, relPath), 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    vars[key] = val;
  }
  return vars;
}

function readScriptFallback(relPath, varName) {
  const content = readFileSync(resolve(ROOT, relPath), 'utf-8');
  // Match pattern: VAR=${ENV_NAME:-DEFAULT}
  const re = new RegExp(`${varName}=\\$\\{\\w+:-([^}]+)\\}`);
  const m = content.match(re);
  return m ? m[1] : null;
}

function readTsFallback(relPath, pattern) {
  const content = readFileSync(resolve(ROOT, relPath), 'utf-8');
  const m = content.match(pattern);
  return m ? m[1] : null;
}

describe('.env.example.opensource port consistency', () => {
  const env = readEnvFile('.env.example.opensource');

  it('API_SERVER_PORT matches sync convention (3003)', () => {
    assert.equal(
      env.API_SERVER_PORT,
      '3003',
      `API_SERVER_PORT should be 3003 (open-source convention), got ${env.API_SERVER_PORT}`,
    );
  });

  it('FRONTEND_PORT matches sync convention (3004)', () => {
    assert.equal(
      env.FRONTEND_PORT,
      '3004',
      `FRONTEND_PORT should be 3004 (open-source convention), got ${env.FRONTEND_PORT}`,
    );
  });

  it('NEXT_PUBLIC_API_URL uses API port (3003)', () => {
    assert.equal(
      env.NEXT_PUBLIC_API_URL,
      'http://localhost:3003',
      `NEXT_PUBLIC_API_URL should point to API port 3003, got ${env.NEXT_PUBLIC_API_URL}`,
    );
  });

  it('.env.example.opensource comment header documents correct ports', () => {
    const content = readFileSync(resolve(ROOT, '.env.example.opensource'), 'utf-8');
    // The comment should say frontend=3004, API=3003
    assert.ok(content.includes('3004') && content.includes('3003'), 'Comment header should mention both 3003 and 3004');
  });
});

describe('Home-side port defaults are internally consistent', () => {
  it('start-dev.sh API fallback is 3002', () => {
    const fallback = readScriptFallback('scripts/start-dev.sh', 'API_PORT');
    assert.equal(fallback, '3002', `start-dev.sh API_PORT fallback should be 3002, got ${fallback}`);
  });

  it('start-dev.sh Frontend fallback is 3001', () => {
    const fallback = readScriptFallback('scripts/start-dev.sh', 'WEB_PORT');
    assert.equal(fallback, '3001', `start-dev.sh WEB_PORT fallback should be 3001, got ${fallback}`);
  });

  it('index.ts API port fallback is 3002', () => {
    const fallback = readTsFallback('packages/api/src/index.ts', /API_SERVER_PORT\s*\?\?\s*'(\d+)'/);
    assert.equal(fallback, '3002', `index.ts API fallback should be 3002, got ${fallback}`);
  });

  it('env-registry.ts API_SERVER_PORT defaultValue is 3002', () => {
    const fallback = readTsFallback(
      'packages/api/src/config/env-registry.ts',
      /name:\s*'API_SERVER_PORT',\s*defaultValue:\s*'(\d+)'/,
    );
    assert.equal(fallback, '3002', `env-registry API_SERVER_PORT default should be 3002, got ${fallback}`);
  });

  it('ConfigRegistry.ts API port fallback is 3002', () => {
    const fallback = readTsFallback('packages/api/src/config/ConfigRegistry.ts', /API_SERVER_PORT\s*\?\?\s*'(\d+)'/);
    assert.equal(fallback, '3002', `ConfigRegistry API fallback should be 3002, got ${fallback}`);
  });

  it('frontend-origin.ts DEFAULT_FRONTEND_BASE_URL uses port 3001', () => {
    const fallback = readTsFallback(
      'packages/api/src/config/frontend-origin.ts',
      /DEFAULT_FRONTEND_BASE_URL\s*=\s*'http:\/\/localhost:(\d+)'/,
    );
    assert.equal(fallback, '3001', `frontend-origin DEFAULT_FRONTEND_BASE_URL should use 3001, got ${fallback}`);
  });
});

describe('Sync transform rules match convention', () => {
  it('_sanitize-rules.pl transforms 3002→3003 (API)', () => {
    const content = readFileSync(resolve(ROOT, 'scripts/_sanitize-rules.pl'), 'utf-8');
    assert.ok(
      content.includes('s#localhost:3002#localhost:3003#g'),
      'sanitize rules should transform localhost:3002 → localhost:3003',
    );
  });

  it('_sanitize-rules.pl transforms 3001→3004 (Frontend)', () => {
    const content = readFileSync(resolve(ROOT, 'scripts/_sanitize-rules.pl'), 'utf-8');
    assert.ok(
      content.includes('s#localhost:3001#localhost:3004#g'),
      'sanitize rules should transform localhost:3001 → localhost:3004',
    );
  });

  it('sync-to-opensource.sh transforms start-dev.sh API fallback to 3003', () => {
    const content = readFileSync(resolve(ROOT, 'scripts/sync-to-opensource.sh'), 'utf-8');
    assert.ok(
      content.includes("'s/API_PORT=${API_SERVER_PORT:-3002}/API_PORT=${API_SERVER_PORT:-3003}/g'"),
      'sync script should transform start-dev.sh API fallback 3002→3003',
    );
  });

  it('sync-to-opensource.sh transforms start-dev.sh Frontend fallback to 3004', () => {
    const content = readFileSync(resolve(ROOT, 'scripts/sync-to-opensource.sh'), 'utf-8');
    assert.ok(
      content.includes("'s/WEB_PORT=${FRONTEND_PORT:-3001}/WEB_PORT=${FRONTEND_PORT:-3004}/g'"),
      'sync script should transform start-dev.sh Frontend fallback 3001→3004',
    );
  });
});
