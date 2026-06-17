import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(process.cwd());
const SYNC_SCRIPT = resolve(ROOT, 'scripts/sync-to-opensource.sh');
const PUBLIC_DOC_LEAK_RE =
  /铲屎官|孟加拉猫|暹罗猫|缅因猫|\bthread_(?=[a-z0-9_]*[0-9])[a-z0-9_]{8,}\b|\$[1-9][0-9]+(?:-[1-9][0-9]+)?\b|云端 review|\bCVO\b/;
const PUBLIC_SYNC_DOCS = [
  'docs/public-lessons.md',
  'docs/ROADMAP.md',
  'docs/features/F177-harness-update.md',
  'docs/features/F229-cat-ball-concierge.md',
  'docs/features/F233-ball-custody-observability.md',
];

describe('sync-to-opensource public launch transforms', { skip: !existsSync(SYNC_SCRIPT) }, () => {
  it('exports opensource-pinned direct launch wrappers and runtime startup', () => {
    const result = spawnSync('bash', [SYNC_SCRIPT, '--dry-run', '--yes'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        TERM: process.env.TERM ?? 'xterm-256color',
      },
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = `${result.stdout}\n${result.stderr}`;
    const match = output.match(/Export (?:complete|preserved) at:[^\n]*\n\s*(\/[^\n]+)/);
    assert.ok(match?.[1], output);

    const exportDir = match[1].trim();
    try {
      const pkg = JSON.parse(readFileSync(resolve(exportDir, 'package.json'), 'utf8'));
      const runtimeScript = readFileSync(resolve(exportDir, 'scripts/runtime-worktree.sh'), 'utf8');
      const canonicalEmbedScript = readFileSync(resolve(exportDir, 'scripts/services/embed-server.sh'), 'utf8');
      const canonicalEmbedPsScript = readFileSync(resolve(exportDir, 'scripts/services/embed-server.ps1'), 'utf8');
      const publicEnv = readFileSync(resolve(exportDir, '.env.example'), 'utf8');
      const setupDoc = readFileSync(resolve(exportDir, 'SETUP.md'), 'utf8');
      const setupZhDoc = readFileSync(resolve(exportDir, 'SETUP.zh-CN.md'), 'utf8');
      const apiPkg = JSON.parse(readFileSync(resolve(exportDir, 'packages/api/package.json'), 'utf8'));
      const publicTestRegistry = JSON.parse(
        readFileSync(resolve(exportDir, 'packages/api/config/public-test-exclusions.json'), 'utf8'),
      );

      assert.match(pkg.scripts['dev:direct'], /start-entry\.mjs dev:direct --profile=opensource/);
      assert.match(pkg.scripts['start:direct'], /start-entry\.mjs start:direct --profile=opensource/);
      assert.equal(existsSync(resolve(exportDir, 'scripts/start-entry.mjs')), true);
      assert.equal(existsSync(resolve(exportDir, 'scripts/services/embed-server.sh')), true);
      assert.equal(existsSync(resolve(exportDir, 'scripts/services/embed-server.ps1')), true);
      assert.equal(
        existsSync(resolve(exportDir, 'scripts/embed-server.sh')),
        false,
        'top-level scripts/embed-server.sh must not be re-exported after the legacy direct-spawn path was removed',
      );
      assert.equal(
        existsSync(resolve(exportDir, 'scripts/embed-server.ps1')),
        false,
        'top-level scripts/embed-server.ps1 must not be re-exported after the legacy direct-spawn path was removed',
      );
      assert.match(canonicalEmbedScript, /EMBED_MODEL/);
      assert.match(canonicalEmbedPsScript, /EMBED_MODEL/);
      assert.equal(
        pkg.scripts['check:start-profile-isolation'],
        'node --test scripts/start-dev-profile-isolation.test.mjs',
      );
      assert.equal(pkg.scripts['check:sync-export'], undefined);
      assert.equal(pkg.scripts['check:incident-containment'], undefined);
      assert.equal(existsSync(resolve(exportDir, 'cat-template.json')), true);
      assert.match(pkg.scripts.check, /check:start-profile-isolation/);
      assert.doesNotMatch(pkg.scripts.check, /check:sync-export/);
      assert.doesNotMatch(pkg.scripts.check, /check:incident-containment/);
      assert.match(apiPkg.scripts['test:public'], /run-public-tests\.sh/);
      assert.equal(
        existsSync(resolve(exportDir, 'packages/api/scripts/run-public-tests.sh')),
        true,
        'fail-propagating public-test wrapper must be exported so the open-source public gate inherits the same exit-code semantics as cat-cafe',
      );
      assert.equal(
        existsSync(resolve(exportDir, 'packages/api/scripts/resolve-public-test-files.mjs')),
        true,
        'resolver must be exported so run-public-tests.sh can invoke it inside the exported repo',
      );
      assert.ok(
        publicTestRegistry.entries.some((entry) => entry.match === 'github-schedule-factories\\.test'),
        'public test registry must preserve the github-schedule-factories exclusion in exported source',
      );
      assert.ok(
        publicTestRegistry.entries.some((entry) => entry.match === 'harness-eval/eval-hub-read-model\\.test'),
        'public test registry must preserve the eval-hub-read-model exclusion in exported source',
      );
      assert.ok(
        publicTestRegistry.entries.some(
          (entry) => entry.match === 'harness-eval/merge-gate-provenance-contract\\.test',
        ),
        'public test registry must preserve the merge-gate provenance exclusion in exported source',
      );
      assert.equal(
        existsSync(resolve(exportDir, 'plugins/github/plugin.yaml')),
        true,
        'GitHub plugin manifest must be exported so public schedule factories can register GitHub jobs',
      );
      assert.match(
        readFileSync(resolve(exportDir, 'plugins/github/plugin.yaml'), 'utf8'),
        /factoryId:\s*github\.issue-tracking/,
      );
      assert.equal(existsSync(resolve(exportDir, 'scripts/download-source-overrides.sh')), true);
      assert.equal(existsSync(resolve(exportDir, 'scripts/start-dev-profile-isolation.test.mjs')), true);
      assert.equal(
        existsSync(resolve(exportDir, 'cat-cafe-skills/refs/l0-staging-content.md')),
        false,
        'raw L0 staging content contains internal thread/routing context and must not be exported',
      );
      assert.match(
        readFileSync(resolve(exportDir, 'packages/api/src/domains/cats/services/context/StagingContent.ts'), 'utf8'),
        /code === 'ENOENT'[\s\S]*EMPTY_STAGING_CONTENT/,
        'API must tolerate omitted raw L0 staging content in the public export',
      );
      for (const relPath of PUBLIC_SYNC_DOCS) {
        const exportedPath = resolve(exportDir, relPath);
        if (!existsSync(exportedPath)) continue;

        assert.doesNotMatch(
          readFileSync(exportedPath, 'utf8'),
          PUBLIC_DOC_LEAK_RE,
          `${relPath} should not leak internal role names, thread ids, ops cost markers, or cloud-review process text`,
        );
      }
      assert.match(publicEnv, /EMBED_MODE=off/);
      assert.match(setupDoc, /install the \*\*Embedding\*\* service from Console settings/i);
      assert.doesNotMatch(setupDoc, /scripts\/embed-server\.sh/);
      assert.match(setupZhDoc, /Console 设置里安装并启用 \*\*Embedding\*\* 服务/);
      assert.doesNotMatch(setupZhDoc, /EMBED_MODE.*on/);
      assert.doesNotMatch(setupZhDoc, /scripts\/embed-server\.sh/);

      assert.match(
        runtimeScript,
        /exec env CAT_CAFE_STRICT_PROFILE_DEFAULTS=1 \.\/scripts\/start-dev\.sh --prod-web --profile=opensource/,
      );

      const envSource = spawnSync(
        'bash',
        ['-lc', 'set -euo pipefail\nset -a\nsource ./.env.example\nset +a\nprintf "%s" "$NEXT_PUBLIC_BRAND_NAME"'],
        {
          cwd: exportDir,
          env: {
            ...process.env,
            PATH: process.env.PATH ?? '',
            HOME: process.env.HOME ?? '',
            TERM: process.env.TERM ?? 'xterm-256color',
          },
          encoding: 'utf8',
        },
      );

      assert.equal(envSource.status, 0, envSource.stderr || envSource.stdout);
      assert.equal(envSource.stdout.trim(), 'Clowder AI');
    } finally {
      rmSync(exportDir, { recursive: true, force: true });
    }
  });
});
