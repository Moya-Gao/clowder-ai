#!/usr/bin/env node
// scripts/run-checks.mjs — Bounded-parallel check runner
//
// Replaces the serial && chain in package.json "check".
// Runs biome first (fast-fail gate), then the remaining checks
// in parallel with bounded concurrency.
//
// Why: 15 serial `node --test` invocations each pay ~200ms Node startup.
// With concurrency=4, wall-clock drops to roughly ceil(14/4) * avg_time
// instead of sum(all_times).

import { spawn } from 'node:child_process';

// ── Check definitions ──
// biome runs first as a fast-fail gate (cheap, catches most formatting issues).
// The rest are independent read-only checks that can safely run in parallel.

const BIOME_VERSION_COMMAND = ['pnpm', ['run', 'check:biome-version']];
const BIOME_COMMAND = ['pnpm', ['biome', 'check', '.', '--diagnostic-level=error']];

const PARALLEL_CHECKS = [
  'check:features',
  'check:f223-action-tracking',
  'check:sop-definitions',
  'check:skills:manifest',
  'check:skills:surfaces',
  'check:env-ports',
  'check:env-registry',
  'check:env-example',
  'check:hmac-salt',
  'check:start-profile-isolation',
  'check:pre-merge-gate',
  'check:incident-containment',
  'check:web-global-css-imports',
  'check:antigravity-smoke',
  'check:guides',
  'check:followup-tails',
  'check:settings-primitives',
  'check:source-hygiene',
  'check:scripts-ascii-only',
  'check:root-debris',
  'check:dir-size',
  'check:brand-dictionary',
  'check:brand-guard',
  'check:reverse-sanitizer',
  'check:boundary-roundtrip',
  // F228 outbound sync gate: spawn sync-to-opensource.sh --dry-run + JSON.parse exported package.json.
  // Previously not wired into pnpm check → sanitizer JSON breakage on main was invisible (LL: green main can hide regression).
  'check:sync-export',
];

const CONCURRENCY = parseConcurrency(process.env.CAT_CAFE_CHECK_CONCURRENCY);

function parseConcurrency(raw) {
  if (raw === undefined || raw === '') return 4;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(
      `CAT_CAFE_CHECK_CONCURRENCY must be a positive integer, got: ${JSON.stringify(raw)}. ` +
        'Setting it to 0 or a non-number would silently skip all checks (gate bypass).',
    );
  }
  return Math.min(Math.max(1, Math.round(n)), PARALLEL_CHECKS.length);
}

// ── Runner ──

function runCommand(label, command, args) {
  const start = Date.now();
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    proc.on('close', (code) => {
      resolve({ label, code: code ?? 1, elapsed: Date.now() - start, stdout, stderr });
    });
    proc.on('error', (err) => {
      resolve({ label, code: 1, elapsed: Date.now() - start, stdout, stderr: err.message });
    });
  });
}

async function runPool(checks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < checks.length) {
      const i = index++;
      const name = checks[i];
      const result = await runCommand(name, 'pnpm', ['run', name]);
      results.push(result);
      const icon = result.code === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const ms = `${result.elapsed}ms`;
      console.log(`  ${icon} ${name} (${ms})`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const totalStart = Date.now();

  // Phase 0: Biome toolchain must match pnpm-lock before we trust any local lint result.
  console.log('── biome toolchain ──');
  const biomeVersion = await runCommand('biome-version', BIOME_VERSION_COMMAND[0], BIOME_VERSION_COMMAND[1]);
  if (biomeVersion.code !== 0) {
    process.stderr.write(biomeVersion.stderr || biomeVersion.stdout);
    console.error(`\n\x1b[31m✗ biome toolchain failed (${biomeVersion.elapsed}ms)\x1b[0m`);
    process.exit(1);
  }
  console.log(`  \x1b[32m✓\x1b[0m biome version (${biomeVersion.elapsed}ms)`);

  // Phase 1: biome (fast-fail)
  console.log('\n── biome (fast-fail) ──');
  const biome = await runCommand('biome', BIOME_COMMAND[0], BIOME_COMMAND[1]);
  if (biome.code !== 0) {
    process.stderr.write(biome.stderr || biome.stdout);
    console.error(`\n\x1b[31m✗ biome failed (${biome.elapsed}ms)\x1b[0m`);
    process.exit(1);
  }
  console.log(`  \x1b[32m✓\x1b[0m biome (${biome.elapsed}ms)`);

  // Phase 2: parallel checks
  console.log(`\n── ${PARALLEL_CHECKS.length} checks (concurrency=${CONCURRENCY}) ──`);
  const results = await runPool(PARALLEL_CHECKS, CONCURRENCY);

  // Summary
  const failed = results.filter((r) => r.code !== 0);
  const totalElapsed = Date.now() - totalStart;

  console.log('');
  if (failed.length > 0) {
    console.error(`\x1b[31m✗ ${failed.length}/${results.length} checks failed (${totalElapsed}ms total)\x1b[0m\n`);
    for (const f of failed) {
      console.error(`── ${f.label} ──`);
      process.stderr.write(f.stderr || f.stdout);
      console.error('');
    }
    process.exit(1);
  }

  console.log(`\x1b[32m✓ All ${results.length + 1} checks passed (${totalElapsed}ms total)\x1b[0m`);
}

// Guard: only run when invoked directly (not when imported by tests).
// Avoids recursive check execution when run-checks.test.mjs imports parseConcurrency.
const isEntryPoint = process.argv[1] && new URL(process.argv[1], 'file://').href === import.meta.url;
if (isEntryPoint) {
  main();
}

export { parseConcurrency };
