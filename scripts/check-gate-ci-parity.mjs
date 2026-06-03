#!/usr/bin/env node
// scripts/check-gate-ci-parity.mjs -- Meta-guard: CI checks are a subset of gate checks.
//
// F217 Phase D. Guards the invariant that every check CI runs is ALSO run by
// local `pnpm gate` (pre-merge-check.sh + run-checks PARALLEL_CHECKS). If CI
// gains a check the gate lacks, "local gate green" stops implying "CI green" --
// the exact drift that let pre-existing red slip into main (the F217 root cause).
// This script is itself in PARALLEL_CHECKS, so it is self-bootstrapped.
//
// Design: a declarative coverage contract (CI job -> gate proof + verify fn),
// not fragile command-string normalization. Two checks:
//   1. every ci.yml job has a coverage declaration (CI adds a job without
//      declaring its gate coverage -> fail -> forces the author to think parity)
//   2. every declared coverage is actually present in the gate (gate drops a
//      command but the contract still claims it -> fail)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// -- Coverage contract: CI job display name -> how the gate covers it --
export const CI_GATE_COVERAGE = {
  Lint: {
    proof: 'pre-merge-check.sh Step 6 runs `pnpm check`',
    verify: (g) => g.preMergeText.includes('pnpm check'),
  },
  Build: {
    proof: 'pre-merge-check.sh Step 3 runs full `pnpm -r --if-present run build`',
    verify: (g) => /pnpm -r --if-present run build/.test(g.preMergeText),
  },
  'Test (Public)': {
    proof: 'pre-merge-check.sh Step 5 runs full `pnpm test` (superset of test:public)',
    verify: (g) => /\bpnpm test(?![\w:])/.test(g.preMergeText),
  },
  'Directory Size Guard': {
    proof: 'check:dir-size in run-checks.mjs PARALLEL_CHECKS (run via `pnpm check`)',
    verify: (g) => g.parallelChecks.includes('check:dir-size'),
  },
  Typecheck: {
    proof: 'pre-merge-check.sh Step 4 runs `tsc --noEmit` across all packages',
    verify: (g) => g.preMergeText.includes('tsc --noEmit'),
  },
};

// -- ci.yml job-name extraction --
// Job display names live at 4-space indent (`    name: X`); the workflow-level
// `name:` is at column 0, so the indent disambiguates.
export function parseCiJobNames(ciYamlText) {
  const re = /^ {4}name:\s*(.+?)\s*$/gm;
  return [...ciYamlText.matchAll(re)].map((m) => m[1]);
}

export function loadCiJobNames(root = REPO_ROOT) {
  const text = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  return parseCiJobNames(text);
}

// -- Gate source extraction --
export function loadGateSources(root = REPO_ROOT) {
  const preMergeText = readFileSync(path.join(root, 'scripts/pre-merge-check.sh'), 'utf8');
  const runChecks = readFileSync(path.join(root, 'scripts/run-checks.mjs'), 'utf8');
  const block = runChecks.match(/PARALLEL_CHECKS\s*=\s*\[([\s\S]*?)\]/);
  const parallelChecks = block ? [...block[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  return { preMergeText, parallelChecks };
}

// -- Parity check --
export function checkParity(ciJobNames, gate, coverage = CI_GATE_COVERAGE) {
  const violations = [];
  // 1. Every CI job must have a coverage declaration.
  for (const job of ciJobNames) {
    if (!coverage[job]) {
      violations.push({
        type: 'undeclared',
        job,
        msg: `CI job "${job}" has no gate-coverage declaration in check-gate-ci-parity.mjs. Does \`pnpm gate\` run an equivalent check? If yes, add a CI_GATE_COVERAGE entry; if no, the gate has a hole.`,
      });
    }
  }
  // 2. Every declared coverage (for jobs the ci.yml actually has) must hold.
  for (const [job, entry] of Object.entries(coverage)) {
    if (!ciJobNames.includes(job)) continue;
    if (!entry.verify(gate)) {
      violations.push({
        type: 'gate-missing',
        job,
        msg: `CI job "${job}" claims gate coverage (${entry.proof}) but it was not found in the gate. The gate may have dropped this command -- CI now runs something the gate does not.`,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

function main() {
  const ciJobs = loadCiJobNames();
  const gate = loadGateSources();
  const { ok, violations } = checkParity(ciJobs, gate);
  if (!ok) {
    console.error('\x1b[31mx gate/CI parity violated:\x1b[0m');
    for (const v of violations) console.error(`  - [${v.type}] ${v.msg}`);
    console.error('\nCI runs a check the local `pnpm gate` does not. Align gate to be a superset of CI.');
    process.exit(1);
  }
  console.log(`\x1b[32mv\x1b[0m gate/CI parity: all ${ciJobs.length} ci.yml jobs are gate-covered`);
}

const isEntryPoint = process.argv[1] && new URL(process.argv[1], 'file://').href === import.meta.url;
if (isEntryPoint) main();
