import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.ts';

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function makeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'convention-graph-cli-'));
  write(
    repo,
    'packages/mcp-server/src/tools/callback-tools.ts',
    `
      export const callbackTools = [
        { name: 'cat_cafe_post_message', inputSchema: postMessageInputSchema, handler: handlePostMessage },
      ] as const;
    `,
  );
  write(
    repo,
    'packages/mcp-server/src/server-toolsets.ts',
    `
      const COLLAB_TOOL_SOURCES = [
        ...callbackTools,
      ];
    `,
  );
  write(
    repo,
    'packages/api/src/routes/callback-a2a-trigger.ts',
    `
      export function routeToolUse(toolName: string) {
        if (toolName === 'cat_cafe_post_message') return 'current-thread';
        return 'other';
      }
    `,
  );
  return repo;
}

function write(repo: string, path: string, content: string): void {
  const fullPath = join(repo, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

async function invoke(argv: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    ...(cwd ? { cwd } : {}),
    stdout: (chunk) => {
      stdout += chunk;
    },
    stderr: (chunk) => {
      stderr += chunk;
    },
  });
  return { code, stdout, stderr };
}

test('CLI index + code-consumers gives a reusable graph entry and freshness gate', async () => {
  const repo = makeRepo();
  try {
    const indexed = await invoke(['index', '--repo', repo, '--format', 'json'], repo);
    assert.equal(indexed.code, 0, indexed.stderr);
    const indexPayload = JSON.parse(indexed.stdout);
    assert.equal(indexPayload.command, 'index');
    assert.equal(indexPayload.dbPath, join(repo, '.cat-cafe/convention-graph.sqlite'));
    assert.ok(indexPayload.domains.some((d: { domainId: string }) => d.domainId === 'mcp-tool'));
    assert.ok(readFileSync(join(repo, '.cat-cafe/convention-graph.sqlite')).byteLength > 0);

    const queried = await invoke(
      [
        'code-consumers',
        '--repo',
        repo,
        '--format',
        'json',
        '--domain',
        'mcp-tool',
        '--kind',
        'mcp_tool',
        '--name',
        'cat_cafe_post_message',
      ],
      repo,
    );
    assert.equal(queried.code, 0, queried.stderr);
    const queryPayload = JSON.parse(queried.stdout);
    assert.equal(queryPayload.command, 'code-consumers');
    assert.equal(queryPayload.targets.length, 1);
    assert.deepEqual(queryPayload.consumers.map((c: { edge: { kind: string } }) => c.edge.kind).sort(), [
      'consumes',
      'registers',
    ]);
    assert.equal(queryPayload.freshness.stale, false);

    write(
      repo,
      'packages/api/src/routes/callback-a2a-trigger.ts',
      `
        export function routeToolUse(toolName: string) {
          if (toolName === 'cat_cafe_post_message') return 'updated-thread';
          return 'other';
        }
      `,
    );

    const stale = await invoke(
      [
        'code-consumers',
        '--repo',
        repo,
        '--format',
        'json',
        '--domain',
        'mcp-tool',
        '--kind',
        'mcp_tool',
        '--name',
        'cat_cafe_post_message',
      ],
      repo,
    );
    assert.equal(stale.code, 0, stale.stderr);
    const stalePayload = JSON.parse(stale.stdout);
    assert.equal(stalePayload.freshness.stale, true);
    assert.deepEqual(stalePayload.freshness.pendingChanges, [
      { path: 'packages/api/src/routes/callback-a2a-trigger.ts', reason: 'modified' },
    ]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('CLI resolves --repo . from pnpm INIT_CWD when invoked through a filtered root script', async () => {
  const repo = makeRepo();
  const previousInitCwd = process.env.INIT_CWD;
  try {
    process.env.INIT_CWD = repo;
    const indexed = await invoke(['index', '--repo', '.', '--domain', 'mcp-tool', '--format', 'json']);
    assert.equal(indexed.code, 0, indexed.stderr);
    const payload = JSON.parse(indexed.stdout);
    assert.equal(payload.repoRoot, repo);
    assert.equal(payload.domains[0].indexedFiles, 3);
  } finally {
    if (previousInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previousInitCwd;
    }
    rmSync(repo, { recursive: true, force: true });
  }
});

test('CLI index skips Python virtualenv and cache directories before plugin scopes', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'convention-graph-fastapi-'));
  try {
    write(
      repo,
      'backend/app/routes.py',
      `
        from fastapi import APIRouter
        router = APIRouter(prefix="/api")

        @router.get("/health")
        def health():
          return {"ok": True}
      `,
    );
    write(
      repo,
      '.venv/lib/python3.12/site-packages/vendor/routes.py',
      `
        from fastapi import APIRouter
        router = APIRouter(prefix="/vendor")

        @router.get("/leak")
        def leak():
          return {"ok": False}
      `,
    );
    write(
      repo,
      'venv/lib/python3.12/site-packages/vendor/routes.py',
      `
        from fastapi import APIRouter
        router = APIRouter(prefix="/vendor2")

        @router.get("/leak")
        def leak2():
          return {"ok": False}
      `,
    );
    write(
      repo,
      '__pycache__/cached.py',
      `
        from fastapi import APIRouter
        router = APIRouter(prefix="/cached")

        @router.get("/leak")
        def cached():
          return {"ok": False}
      `,
    );

    const indexed = await invoke(['index', '--repo', repo, '--domain', 'fastapi-route', '--format', 'json'], repo);
    assert.equal(indexed.code, 0, indexed.stderr);
    const payload = JSON.parse(indexed.stdout);
    assert.deepEqual(payload.domains, [{ domainId: 'fastapi-route', indexedFiles: 1, nodes: 2, edges: 1, gaps: 0 }]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('package bin runs when invoked through a symlinked package-manager entrypoint', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'convention-graph-bin-'));
  try {
    const binPath = join(sandbox, 'cat-cafe-convention-graph');
    symlinkSync(join(PACKAGE_ROOT, 'src/cli.ts'), binPath);

    const result = spawnSync(process.execPath, [binPath, '--help'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /cat-cafe-convention-graph index/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
