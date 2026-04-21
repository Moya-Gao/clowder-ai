import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const SCRIPT = resolve(process.cwd(), 'scripts/mcp-doctor.mjs');

function runDoctor(root, env = {}) {
  return spawnSync('node', [SCRIPT, root], {
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
}

function writeRepoFixture(root, { manifest, capabilities }) {
  mkdirSync(join(root, 'cat-cafe-skills'), { recursive: true });
  mkdirSync(join(root, '.cat-cafe'), { recursive: true });
  writeFileSync(join(root, 'cat-cafe-skills', 'manifest.yaml'), manifest, 'utf-8');
  if (capabilities) {
    writeFileSync(join(root, '.cat-cafe', 'capabilities.json'), JSON.stringify(capabilities, null, 2), 'utf-8');
  }
}

function makeCapability(id, mcpServer) {
  return {
    id,
    type: 'mcp',
    enabled: true,
    source: 'external',
    mcpServer,
  };
}

describe('mcp-doctor.mjs', () => {
  let sandboxRoot;

  beforeEach(() => {
    sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-mcp-doctor-'));
  });

  afterEach(() => {
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('reports ready for resolver-backed pencil via live env override', () => {
    const fakeBin = join(sandboxRoot, 'fake-pencil-bin');
    writeFileSync(fakeBin, '#!/bin/sh\nexit 0\n', 'utf-8');
    chmodSync(fakeBin, 0o755);

    writeRepoFixture(sandboxRoot, {
      manifest: [
        'skills:',
        '  pencil-design:',
        '    triggers: ["pencil"]',
        '    not_for: ["skip"]',
        '    output: "done"',
        '    next: []',
        '    requires_mcp: ["pencil"]',
        '',
      ].join('\n'),
      capabilities: {
        version: 1,
        capabilities: [
          {
            id: 'pencil',
            type: 'mcp',
            enabled: true,
            source: 'external',
            mcpServer: {
              resolver: 'pencil',
              command: '',
              args: [],
            },
          },
        ],
      },
    });

    const result = runDoctor(sandboxRoot, { PENCIL_MCP_BIN: fakeBin, PENCIL_MCP_APP: 'vscode' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pencil/i);
    assert.match(result.stdout, /ready/i);
  });

  it('reports missing dependencies and exits non-zero', () => {
    writeRepoFixture(sandboxRoot, {
      manifest: [
        'skills:',
        '  browser-automation:',
        '    triggers: ["browser"]',
        '    not_for: ["skip"]',
        '    output: "done"',
        '    next: []',
        '    requires_mcp: ["playwright"]',
        '',
      ].join('\n'),
      capabilities: null,
    });

    const result = runDoctor(sandboxRoot);
    assert.notEqual(result.status, 0, 'doctor should fail when required MCP is missing');
    assert.match(result.stdout, /playwright/i);
    assert.match(result.stdout, /missing/i);
    assert.match(result.stdout, /not declared in capabilities\.json/i);
  });

  it('fails when manifest.yaml is missing', () => {
    const result = runDoctor(sandboxRoot);
    assert.notEqual(result.status, 0, 'doctor should fail when manifest.yaml is absent');
    assert.match(result.stderr, /manifest not found/i);
  });

  it('fails when manifest.yaml has no top-level skills map', () => {
    mkdirSync(join(sandboxRoot, 'cat-cafe-skills'), { recursive: true });
    writeFileSync(join(sandboxRoot, 'cat-cafe-skills', 'manifest.yaml'), 'version: 1\n', 'utf-8');

    const result = runDoctor(sandboxRoot);
    assert.notEqual(result.status, 0, 'doctor should fail when skills map is missing');
    assert.match(result.stderr, /missing top-level "skills" map/i);
  });

  it('fails when any referenced local artifact argument is missing', () => {
    writeRepoFixture(sandboxRoot, {
      manifest: ['skills:', '  x:', '    requires_mcp: ["multi-artifact"]', ''].join('\n'),
      capabilities: {
        version: 1,
        capabilities: [
          makeCapability('multi-artifact', {
            command: 'node',
            args: ['./scripts/loader.js', './scripts/entry.js'],
          }),
        ],
      },
    });
    mkdirSync(join(sandboxRoot, 'scripts'), { recursive: true });
    writeFileSync(join(sandboxRoot, 'scripts', 'loader.js'), '// loader\n', 'utf8');

    const result = runDoctor(sandboxRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /command args reference missing local artifact/);
  });

  it('treats non-js path-like args as local artifacts', () => {
    writeRepoFixture(sandboxRoot, {
      manifest: ['skills:', '  x:', '    requires_mcp: ["non-js-artifact"]', ''].join('\n'),
      capabilities: {
        version: 1,
        capabilities: [
          makeCapability('non-js-artifact', {
            command: 'node',
            args: ['scripts/server.mjs', 'tools/bootstrap.ts'],
          }),
        ],
      },
    });
    mkdirSync(join(sandboxRoot, 'tools'), { recursive: true });
    writeFileSync(join(sandboxRoot, 'tools', 'bootstrap.ts'), '// bootstrap\n', 'utf8');

    const result = runDoctor(sandboxRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /command args reference missing local artifact/);
  });

  it('treats --flag=path args as local artifacts', () => {
    writeRepoFixture(sandboxRoot, {
      manifest: ['skills:', '  x:', '    requires_mcp: ["flagged-artifact"]', ''].join('\n'),
      capabilities: {
        version: 1,
        capabilities: [
          makeCapability('flagged-artifact', {
            command: 'node',
            args: ['--config=./missing.json'],
          }),
        ],
      },
    });

    const result = runDoctor(sandboxRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /command args reference missing local artifact/);
  });

  it('does not treat slash-bearing package specs as local artifacts', () => {
    writeRepoFixture(sandboxRoot, {
      manifest: ['skills:', '  x:', '    requires_mcp: ["slash-package-spec"]', ''].join('\n'),
      capabilities: {
        version: 1,
        capabilities: [
          makeCapability('slash-package-spec', {
            command: 'npx',
            args: ['github:modelcontextprotocol/servers'],
          }),
        ],
      },
    });

    const result = runDoctor(sandboxRoot);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /slash-package-spec/i);
    assert.match(result.stdout, /ready/i);
  });

  it('expands home-relative artifact args before checking the filesystem', () => {
    writeRepoFixture(sandboxRoot, {
      manifest: ['skills:', '  x:', '    requires_mcp: ["tilde-artifact"]', ''].join('\n'),
      capabilities: {
        version: 1,
        capabilities: [
          makeCapability('tilde-artifact', {
            command: 'node',
            args: ['~/tools/server.mjs'],
          }),
        ],
      },
    });

    const homeDir = join(sandboxRoot, 'fake-home');
    mkdirSync(join(homeDir, 'tools'), { recursive: true });
    writeFileSync(join(homeDir, 'tools', 'server.mjs'), '// server\n', 'utf8');

    const result = runDoctor(sandboxRoot, { HOME: homeDir, USERPROFILE: homeDir });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /tilde-artifact/i);
    assert.match(result.stdout, /ready/i);
  });
});
