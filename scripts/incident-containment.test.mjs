import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(process.cwd());

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('incident containment: sync export gate split', () => {
  it('keeps the heavy open-source export dry-run out of default pnpm check', () => {
    const pkg = JSON.parse(read('package.json'));
    const profileIsolationTest = read('scripts/start-dev-profile-isolation.test.mjs');
    const syncExportTest = read('scripts/sync-to-opensource-public-launch.test.mjs');

    assert.equal(
      pkg.scripts['check:start-profile-isolation'],
      'node --test scripts/start-dev-profile-isolation.test.mjs',
    );
    assert.equal(pkg.scripts['check:sync-export'], 'node --test scripts/sync-to-opensource-public-launch.test.mjs');
    assert.match(pkg.scripts.check, /pnpm check:start-profile-isolation/);
    assert.doesNotMatch(pkg.scripts.check, /check:sync-export/);
    assert.doesNotMatch(profileIsolationTest, /sync-to-opensource\.sh/);
    assert.match(syncExportTest, /sync-to-opensource\.sh/);
    assert.match(syncExportTest, /--dry-run/);
    assert.match(syncExportTest, /--yes/);
  });

  it('keeps the explicit sync export check source-only in public package transforms', () => {
    const source = read('scripts/sync-to-opensource.sh');

    assert.match(source, /"check:sync-export"/);
    assert.match(source, /check:start-profile-isolation/);
    assert.match(source, /"check:incident-containment"/);
    assert.match(source, /delete pkg\.scripts\[s\]/);
    assert.doesNotMatch(source, /pkg\.scripts\.check \+= " && pnpm check:sync-export"/);
  });
});

describe('incident containment: pre-merge gate guard', () => {
  it('wires pre-merge gate through a singleflight and system-pressure guard', () => {
    const gateScript = read('scripts/pre-merge-check.sh');
    const guardScript = read('scripts/pre-merge-gate-guard.mjs');

    assert.match(gateScript, /GATE_GUARD_SCRIPT=.*pre-merge-gate-guard\.mjs/);
    assert.match(gateScript, /node "\$GATE_GUARD_SCRIPT" acquire/);
    assert.match(gateScript, /node "\$GATE_GUARD_SCRIPT" release/);
    assert.match(gateScript, /pre-merge-check\.lock/);
    assert.match(guardScript, /CAT_CAFE_FSEVENTSD_RSS_MAX_KB/);
    assert.match(guardScript, /fseventsd/);
    assert.match(guardScript, /redis-server/);
    assert.match(guardScript, /sync-to-opensource\\\.sh/);
    assert.match(guardScript, /start-dev-profile-isolation/);
  });
});

describe('incident containment: isolated Redis harness cleanup', () => {
  it('tracks test Redis instances and performs bounded shutdown cleanup', () => {
    const source = read('packages/api/scripts/run-isolated-redis-tests.sh');

    assert.match(source, /REGISTRY_FILE/);
    assert.match(source, /register_instance/);
    assert.match(source, /cleanup_registry/);
    assert.match(source, /shutdown nosave/);
    assert.match(source, /SIGTERM/);
    assert.match(source, /SIGKILL/);
    assert.match(source, /6398/);
    assert.match(source, /6399/);
  });

  it('includes the lightweight harness regression in root check', () => {
    const pkg = JSON.parse(read('package.json'));

    assert.equal(pkg.scripts['check:incident-containment'], 'node --test scripts/incident-containment.test.mjs');
    assert.match(pkg.scripts.check, /pnpm check:incident-containment/);
  });
});
